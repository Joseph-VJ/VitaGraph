import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '..', 'src');

const isStrict = process.argv.includes('--strict');

const PENDING_FILES = new Set([
  'pages/KnowledgeGraphPage.tsx',
  'components/gallery/CinematicPipelinePopup.tsx',
]);

const THEME_FILES = new Set([
  'index.css',
  'theme/tokens.css',
  'theme/modernist.css',
]);

function toRelPath(absPath) {
  return path.relative(srcDir, absPath).replace(/\\/g, '/');
}

function isSkipped(relPath) {
  return relPath === 'pages/GalleryPage.tsx' || relPath.startsWith('motion/');
}

function resolveImport(dir, specifier) {
  if (!specifier.startsWith('.')) return null;
  const basePath = path.resolve(dir, specifier);
  const suffixes = ['', '.tsx', '.ts', '.css', '/index.ts', '/index.tsx'];
  for (const suffix of suffixes) {
    const candidate = suffix.startsWith('/')
      ? path.join(basePath, suffix)
      : basePath + suffix;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function extractImports(content, isCss) {
  const imports = [];
  if (isCss) {
    const cssImportRe = /@import\s+(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])/g;
    let m;
    while ((m = cssImportRe.exec(content)) !== null) {
      imports.push(m[1] || m[2]);
    }
    return imports;
  }

  // Strip block and line comments to avoid false import matches
  const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

  // Dynamic imports: import("...") or import('...')
  const dynamicImportRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let dm;
  while ((dm = dynamicImportRe.exec(stripped)) !== null) {
    imports.push(dm[1]);
  }

  // Static imports and exports:
  // Skip type-only: import type ... from "..." or export type ... from "..."
  // Match: import ... from "..." or export ... from "..." or import "..."
  const staticImportRe = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+[\s\S]*?\bfrom\s*['"][^'"]+['"]|[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|['"]([^'"]+)['"])/g;
  let sm;
  while ((sm = staticImportRe.exec(stripped)) !== null) {
    const spec = sm[1] || sm[2];
    if (spec) {
      imports.push(spec);
    }
  }

  return imports;
}

const RULES = [
  {
    id: 'hex-colour',
    skipOnTheme: true,
    test: (line) => /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![a-zA-Z0-9_-])/.test(line),
  },
  {
    id: 'rounded',
    skipOnTheme: true,
    test: (line) => /(?<![\w-])rounded(-[a-zA-Z0-9_-]+)?(?![\w-])/.test(line),
  },
  {
    id: 'radius',
    skipOnTheme: true,
    test: (line) => {
      const match = line.match(/(?:border-radius|borderRadius)\s*:\s*([^;,]+)/);
      if (!match) return false;
      const val = match[1].trim().replace(/^['"]|['"]$/g, '');
      const isAllowed = val === '0' || val === '0px' || val.startsWith('var(--r');
      return !isAllowed;
    },
  },
  {
    id: 'old-font',
    skipOnTheme: false,
    test: (line) => /Spectral|IBM Plex|Georgia/.test(line),
  },
  {
    id: 'legacy-token',
    skipOnTheme: true,
    test: (line) =>
      /var\(--(?:ink-\d+|bone|paper[\w-]*|chrome[\w-]*|titanium-mist|alloy-surface|steel-fog|deep-petrol|jade-slate|solar-bronze|cornflower|lilac|text-main|text-muted|shadow-3d[\w-]*|shadow-float|shadow-floating)\b/.test(
        line
      ),
  },
  {
    id: 'console',
    skipOnTheme: false,
    test: (line) => /\bconsole\.(?:log|warn|error|info|debug)\s*\(/.test(line),
  },
  {
    id: 'demo-value',
    skipOnTheme: false,
    test: (line) => /VG-2026-001|\bArjun R\b|NEJM_2023/.test(line),
  },
  {
    id: 'provider-name',
    skipOnTheme: false,
    test: (line) => /\b(?:agentrouter|deepseek|gemini|openai|anthropic|claude|gpt-\d)/i.test(line),
  },
];

let errorCount = 0;
let pendingCount = 0;
const visited = new Set();
const queue = [path.resolve(srcDir, 'main.tsx')];

while (queue.length > 0) {
  const currentFile = queue.shift();
  if (visited.has(currentFile)) continue;

  const relPath = toRelPath(currentFile);
  if (isSkipped(relPath)) continue;

  visited.add(currentFile);

  const isPending = !isStrict && PENDING_FILES.has(relPath);
  const severity = isPending ? 'pending' : 'ERROR';
  const isTheme = THEME_FILES.has(relPath);

  const content = fs.readFileSync(currentFile, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('{/*')
    ) {
      continue;
    }

    for (const rule of RULES) {
      if (isTheme && rule.skipOnTheme) continue;
      if (rule.test(line)) {
        if (severity === 'ERROR') {
          errorCount++;
        } else {
          pendingCount++;
        }
        console.log(
          `${severity.padEnd(7)} ${rule.id.padEnd(14)} ${relPath}:${i + 1}  ${trimmed.slice(0, 120)}`
        );
      }
    }
  }

  // Follow imports if not pending
  if (!isPending) {
    const isCss = currentFile.endsWith('.css');
    const importedSpecifiers = extractImports(content, isCss);
    for (const spec of importedSpecifiers) {
      const resolved = resolveImport(path.dirname(currentFile), spec);
      if (resolved && !visited.has(resolved)) {
        const targetRel = toRelPath(resolved);
        if (!isSkipped(targetRel)) {
          queue.push(resolved);
        }
      }
    }
  }
}

console.log();
const strictSuffix = isStrict ? ' (strict)' : '';
console.log(`Checked ${visited.size} files${strictSuffix}: ${errorCount} error(s), ${pendingCount} pending.`);

if (errorCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
