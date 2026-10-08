// Splits code into tokens for colouring (see components/agent/CodeBlock). Pure; it never runs the code.

const KEYWORDS: Record<string, string[]> = {
  python: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "),
  javascript: "async await break case catch class const continue default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield interface type enum implements readonly".split(" "),
  sql: "select from where group by order having join left right inner outer on as and or not in is null insert into values update set delete create table drop alter limit distinct union case when then else end like between asc desc count sum avg min max".split(" "),
  bash: "if then else elif fi for while do done case esac function in echo cd ls export return exit".split(" "),
  json: ["true", "false", "null"],
};

const ALIASES: Record<string, string> = {
  py: "python", python3: "python",
  js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript", typescript: "javascript", node: "javascript",
  sh: "bash", shell: "bash", zsh: "bash", powershell: "bash",
  postgresql: "sql", mysql: "sql", sqlite: "sql",
};

function languageOf(raw: string): string {
  const lang = raw.toLowerCase();
  return ALIASES[lang] ?? lang;
}

const COMMENT: Record<string, string> = { python: "#[^\\n]*", bash: "#[^\\n]*", sql: "--[^\\n]*", javascript: "//[^\\n]*|/\\*[\\s\\S]*?\\*/" };

export interface Token {
  text: string;
  kind: "plain" | "keyword" | "string" | "comment" | "number";
}

/** Splits code into tokens for colouring. Pure and total: the pieces always join back to the input. */
export function tokenize(code: string, rawLang: string): Token[] {
  const lang = languageOf(rawLang);
  const keywords = new Set((KEYWORDS[lang] ?? []).map((k) => (lang === "sql" ? k : k)));
  const comment = COMMENT[lang];
  const parts = [
    comment ? `(?<comment>${comment})` : null,
    "(?<string>\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)",
    "(?<number>\\b\\d+(?:\\.\\d+)?\\b)",
    "(?<word>[A-Za-z_][A-Za-z0-9_]*)",
  ].filter(Boolean);
  const pattern = new RegExp(parts.join("|"), "g");
  const tokens: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > last) tokens.push({ text: code.slice(last, start), kind: "plain" });
    const g = m.groups ?? {};
    let kind: Token["kind"] = "plain";
    if (g.comment !== undefined) kind = "comment";
    else if (g.string !== undefined) kind = "string";
    else if (g.number !== undefined) kind = "number";
    else if (g.word !== undefined && keywords.has(lang === "sql" ? g.word.toLowerCase() : g.word)) kind = "keyword";
    tokens.push({ text: m[0], kind });
    last = start + m[0].length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last), kind: "plain" });
  return tokens;
}

