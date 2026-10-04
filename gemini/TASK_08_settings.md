# TASK 08: Settings page, exact to the reference, with REAL controls only

Read `gemini/RULES.md` first (branch guard 3b, report format 5, **work report file 5b**, **quality bar 5c**). Read `gemini/reviews/TASK_08a_review.md` and obey it (do not print `masked_key`; copy numbers from git). Then LOOK at `design/reference/screens/10_Settings.png` and read `design/reference/app-v3-source.html` lines 739-761 (the markup) and 1316-1337 (the rows).

The backend part (`POST /api/ai/privacy`, `.env` persistence, chunk sizes in `GET /api/health`) was finished and accepted in Task 08a. This task is frontend only. Do not touch `vitagraph/backend/`.

## What this task delivers
The Settings page looks exactly like the reference (960px centered column, red section heads with a 2px rule, option rows with On/Off buttons, note rows) and every control is real:

| Row (reference) | In the live app |
|---|---|
| Cinematic ingestion On/Off | Saved in the browser. When Off, the Upload page no longer opens the full-screen popup. |
| Process speed | **Left out on purpose.** It has no effect until the new live ingestion show (Task 12). A control that does nothing is not allowed. |
| Chunk size slider + "Chunks for a 5-page report" | **Replaced by one note row**, "Chunk size": the REAL value from `GET /api/health` (200 target, 800 max). The backend has no per-upload chunk setting, so a slider would be a lie. |
| Embedding model note | Real model name from `GET /api/health`, plus "runs locally" (true: the backend loads the model in-process). The "384 dimensions" of the reference is dropped (no API reports it). |
| Send retrieved passages to the AI model On/Off | Calls `POST /api/ai/privacy`. Saved by the backend (survives restart). The header tag "AI explanations off" updates at once. |
| Vector filter note | Real: the active persona's id. |
| Reduce motion On/Off | Saved in the browser. When On: every CSS animation and transition is switched off app-wide, and the motion governor is forced to its static tier. |
| Model provider row | **Not copied** (rule: no provider or model names in the UI). |

The old Settings page (motion tier selector, sound toggle, replay boot, theme buttons, fake "gen-service v2" text, "Disabled by academic policy" text, dead toggles) is replaced completely. That page showed claims that were not true, which is why it goes.

## Files you may change (closed list)
1. `site design/src/pages/SettingsPage.tsx` : REPLACE the whole file
2. NEW `site design/src/lib/preferences.ts`
3. `site design/src/api/ai.ts` : two small additions (below). This is the only allowed change to an `api/` file.
4. `site design/src/pages/UploadPage.tsx` : two small edits
5. `site design/src/components/shell/Header.tsx` : one added effect
6. `site design/src/components/shell/AppShell.tsx` : one word added to `OWN_LAYOUT`
7. `site design/src/main.tsx` : two added lines
8. `site design/src/index.css` : one block appended at the end
9. NEW `gemini/reports/TASK_08_report.md`
10. screenshots in `gemini/shots/` named `task08-*.png`

Everything else is forbidden (backend, hooks, tests, `design/`, `docs/`, `modernist.css`, `tokens.css`, other pages). Do not delete any file.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
Branch must be `redesign/modernist-app`. The build must exit 0. (`site design/tsconfig.tsbuildinfo` changes after every build; never stage it.)

## Step 1: create `site design/src/lib/preferences.ts`
Copy exactly:
```ts
import { useSyncExternalStore } from "react";
import { governor } from "../motion";

export interface Preferences {
  cinematic: boolean;
  reduceMotion: boolean;
}

const STORAGE_KEY = "vitagraph_preferences";
const DEFAULTS: Preferences = { cinematic: true, reduceMotion: false };

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const stored = parsed as Record<string, unknown>;
    return {
      cinematic: typeof stored.cinematic === "boolean" ? stored.cinematic : DEFAULTS.cinematic,
      reduceMotion: typeof stored.reduceMotion === "boolean" ? stored.reduceMotion : DEFAULTS.reduceMotion,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Preferences = load();
const listeners = new Set<() => void>();

function apply(initial: boolean): void {
  document.documentElement.dataset.reduceMotion = String(current.reduceMotion);
  if (current.reduceMotion) {
    governor.setOverride("T0");
  } else if (!initial) {
    governor.setOverride("auto");
  }
}

/** Call once before the first render so the saved choices are in force from the first frame. */
export function applyPreferences(): void {
  apply(true);
}

export function getPreferences(): Preferences {
  return current;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: the choice then lasts for this visit only */
  }
  apply(false);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}
```

## Step 2: replace `site design/src/pages/SettingsPage.tsx`
Replace the ENTIRE file with exactly:
```tsx
import React, { useEffect, useState } from "react";
import { aiApi, type AiConfig, type HealthInfo } from "../api/ai";
import { useActiveUser } from "../context/UserContext";
import { setPreference, usePreferences } from "../lib/preferences";

const rowBox: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-3) var(--space-6)",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-4) 0",
  borderBottom: "1px solid var(--color-divider)",
};
const rowTitle: React.CSSProperties = { fontSize: "1.0625rem", fontWeight: 800 };
const rowDesc: React.CSSProperties = { fontSize: "0.875rem", color: "var(--color-neutral-700)" };

const Head: React.FC<{ title: string }> = ({ title }) => (
  <div
    style={{
      padding: "var(--space-6) 0 var(--space-2)",
      borderBottom: "2px solid var(--color-text)",
      fontSize: "0.6875rem",
      fontWeight: 800,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--color-accent-700)",
    }}
  >
    {title}
  </div>
);

interface OptionRowProps {
  testId: string;
  title: string;
  desc: string;
  current: boolean | null;
  disabled: boolean;
  status?: string;
  onPick: (value: boolean) => void;
}

const OptionRow: React.FC<OptionRowProps> = ({ testId, title, desc, current, disabled, status, onPick }) => (
  <div style={rowBox} data-testid={testId}>
    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
      <div style={rowTitle}>{title}</div>
      <div style={rowDesc}>{desc}</div>
      {status ? (
        <div role="status" style={{ ...rowDesc, color: "var(--color-accent-700)", fontWeight: 600 }}>
          {status}
        </div>
      ) : null}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
      {[
        { value: true, label: "On" },
        { value: false, label: "Off" },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          className={current === option.value ? "btn btn-primary" : "btn btn-secondary"}
          aria-pressed={current === option.value}
          disabled={disabled}
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const NoteRow: React.FC<{ testId: string; title: string; desc: string }> = ({ testId, title, desc }) => (
  <div
    data-testid={testId}
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: "var(--space-6)",
      padding: "var(--space-4) 0",
      borderBottom: "1px solid var(--color-divider)",
    }}
  >
    <div style={rowTitle}>{title}</div>
    <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", textAlign: "right" }}>{desc}</div>
  </div>
);

export const SettingsPage: React.FC = () => {
  const { user } = useActiveUser();
  const prefs = usePreferences();
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([aiApi.getConfig(), aiApi.getHealth()])
      .then(([loadedConfig, loadedHealth]) => {
        if (!alive) return;
        setConfig(loadedConfig);
        setHealth(loadedHealth);
        setLoadFailed(false);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const changePrivacy = async (allow: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      const next = await aiApi.setPrivacy(allow);
      setConfig(next);
      try {
        sessionStorage.setItem("vg_allow_api", String(next.allow_api));
      } catch {
        /* storage unavailable: the header reads the backend again on its next load */
      }
      window.dispatchEvent(new CustomEvent("vitagraph:ai-config", { detail: { allow_api: next.allow_api } }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "The change could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  let privacyStatus: string | undefined;
  if (loadFailed) {
    privacyStatus = "The backend is not reachable, so this setting cannot be read or changed.";
  } else if (saveError) {
    privacyStatus = saveError;
  } else if (config && config.allow_api && !config.has_api_key) {
    privacyStatus = "No AI key is set on the backend, so answers use quoted report text only.";
  }

  const unavailable = "Not available while the backend is unreachable.";
  const chunkNote = health
    ? `About ${health.chunk_target_chars} characters per chunk, never more than ${health.chunk_max_chars}.`
    : unavailable;
  const embeddingNote = health ? `${health.embedding_model.split("/").pop()} · runs locally` : unavailable;
  const vectorNote = user
    ? `Every query is filtered to user_id ${user.id}. This cannot be turned off.`
    : "Every query is filtered to the active persona. This cannot be turned off.";

  return (
    <div
      data-screen-label="Settings"
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Head title="Ingestion" />
      <OptionRow
        testId="setting-cinematic"
        title="Cinematic ingestion"
        desc="Run the full-screen show when a report is ingested."
        current={prefs.cinematic}
        disabled={false}
        onPick={(value) => setPreference("cinematic", value)}
      />
      <NoteRow testId="setting-chunk-size" title="Chunk size" desc={chunkNote} />

      <Head title="Reading" />
      <NoteRow testId="setting-embedding" title="Embedding model" desc={embeddingNote} />

      <Head title="Privacy and answers" />
      <OptionRow
        testId="setting-privacy"
        title="Send retrieved passages to the AI model"
        desc="Off keeps answers to quoted report text only."
        current={config ? config.allow_api : null}
        disabled={saving || config === null}
        status={privacyStatus}
        onPick={changePrivacy}
      />
      <NoteRow testId="setting-vector-filter" title="Vector filter" desc={vectorNote} />

      <Head title="Display" />
      <OptionRow
        testId="setting-reduce-motion"
        title="Reduce motion"
        desc="Turns off animations and transitions across the app."
        current={prefs.reduceMotion}
        disabled={false}
        onPick={(value) => setPreference("reduceMotion", value)}
      />
    </div>
  );
};
```

## Step 3: the small edits (each "find" text must exist exactly once; if it does not, STOP and report BLOCKED)

### 3a. `site design/src/api/ai.ts`
Find `export interface BiomarkerItem {` and put this block directly ABOVE it:
```ts
export interface HealthInfo {
  status: string;
  allow_api: boolean;
  embedding_model: string;
  chunk_target_chars: number;
  chunk_max_chars: number;
}

```
Find the line `  analyzeReport: (reportId: string, userId: string) =>` and put these two lines directly ABOVE it (inside `aiApi`):
```ts
  setPrivacy: (allowApi: boolean) => api.post<AiConfig>("/api/ai/privacy", { allow_api: allowApi }),
  getHealth: () => api.get<HealthInfo>("/api/health"),
```

### 3b. `site design/src/pages/UploadPage.tsx`
Find `import { FrameStage } from "../components/upload/FrameStage";` and add this line directly below it:
```ts
import { getPreferences } from "../lib/preferences";
```
Find these two lines:
```ts
    // 2. Open cinematic storytelling popup immediately
    setIsPopupOpen(true);
```
Replace them with:
```ts
    // 2. Open the full-screen show immediately, unless the user turned "Cinematic ingestion" off in Settings
    if (getPreferences().cinematic) setIsPopupOpen(true);
```

### 3c. `site design/src/components/shell/Header.tsx`
Find the line `  const getHeaderConfig = (): { title: string; sub: string } => {` and put this block directly ABOVE it (it keeps the existing blank line before `getHeaderConfig`):
```tsx
  // Settings announces a privacy change so the "AI explanations" tag updates at once
  useEffect(() => {
    const onConfig = (event: Event) => {
      const detail = (event as CustomEvent<{ allow_api?: boolean }>).detail;
      if (typeof detail?.allow_api === "boolean") setAllowApi(detail.allow_api);
    };
    window.addEventListener("vitagraph:ai-config", onConfig);
    return () => window.removeEventListener("vitagraph:ai-config", onConfig);
  }, []);

```

### 3d. `site design/src/components/shell/AppShell.tsx`
Find `new Set<string>(["/upload", "/compare", "/insights", "/library"]);` and change it to `new Set<string>(["/upload", "/compare", "/insights", "/library", "/settings"]);`

### 3e. `site design/src/main.tsx`
Find these two lines:
```ts
import { App } from "./App";
import "./index.css";
```
Replace them with:
```ts
import { App } from "./App";
import { applyPreferences } from "./lib/preferences";
import "./index.css";

applyPreferences();
```

### 3f. `site design/src/index.css`
Append this block at the very end of the file (after one blank line):
```css
/* Settings > Reduce motion: switches every CSS animation and transition off. Set on <html> by src/lib/preferences.ts. */
:root[data-reduce-motion="true"] *,
:root[data-reduce-motion="true"] *::before,
:root[data-reduce-motion="true"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

## Step 4: static checks (paste the output)
1. `npm run build` exits 0 (paste the last 3 lines).
2. `grep -n "rounded\|Spectral\|#[0-9a-fA-F]\{3,6\}\|backdrop" "src/pages/SettingsPage.tsx" "src/lib/preferences.ts"` prints nothing.
3. `grep -n -i "gemini\|agentrouter\|deepseek\|claude\|gpt" src/pages/SettingsPage.tsx` prints nothing.
4. `git diff --stat` lists only the files in the closed list (plus `tsconfig.tsbuildinfo`, which you do not stage).

## Step 5: live checks in the browser (both servers up, REAL backend)
Start the backend (`cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, background) and the frontend (`cd "site design"; npm run dev -- --port 5173`, background). Wait 12 s. Use Chrome (`channel="chrome"` if you script it) at 1440x900. Select the persona before loading the page with an init script: `localStorage.setItem('vitagraph_user_id','usr_d1d7f9b2a4b1')`.

**5.1 Look.** Open `http://localhost:5173/settings`. Save a screenshot as `gemini/shots/task08-settings-1440.png`. Compare it with `design/reference/screens/10_Settings.png`. Required: the same order of sections (Ingestion, Reading, Privacy and answers, Display), red uppercase heads with a 2px ink rule, the active button red with light text, the inactive button outlined, note rows with grey right-aligned text. Differences that are EXPECTED (list them in the report): no "Process speed", no slider, no model button in the header, no "Reset demo"/"Simulate outage", the notes carry real values.

**5.2 Measurements.** Run this in the page and paste the result:
```js
(() => { const q = id => document.querySelector('[data-testid="' + id + '"]'); const r = id => Math.round(q(id).getBoundingClientRect().height); return { container: document.querySelector('[data-screen-label="Settings"]').getBoundingClientRect().width, optionRows: [r('setting-cinematic'), r('setting-privacy'), r('setting-reduce-motion')], noteRows: [r('setting-chunk-size'), r('setting-embedding'), r('setting-vector-filter')], font: getComputedStyle(document.body).fontFamily.slice(0, 30) }; })()
```
Expected: `container 960`, option rows about 81 (80 to 84), note rows about 59 (57 to 62), font starts with `Archivo`.

**5.3 Values equal the API.** Paste both sides: (a) the text of the three note rows on the page, (b) `Invoke-RestMethod http://127.0.0.1:8000/api/health | Select-Object chunk_target_chars, chunk_max_chars, embedding_model` and the persona id. They must agree: `About 200 characters per chunk, never more than 800.`, `all-MiniLM-L6-v2 · runs locally`, `Every query is filtered to user_id usr_d1d7f9b2a4b1. This cannot be turned off.`

**5.4 Browser-only settings.** Click Cinematic ingestion **Off** and Reduce motion **On**. Then run and paste:
```js
({ prefs: localStorage.getItem('vitagraph_preferences'), tier: localStorage.getItem('motion_tier'), html: document.documentElement.dataset.reduceMotion })
```
Expected `prefs {"cinematic":false,"reduceMotion":true}`, `tier "T0"`, `html "true"`. Reload the page (F5): both rows still show Off / On, and this probe prints `1e-05s`:
```js
(() => { const d = document.createElement('div'); d.style.transition = 'opacity 5s'; document.body.appendChild(d); const v = getComputedStyle(d).transitionDuration; d.remove(); return v; })()
```
Then click Cinematic **On** and Reduce motion **Off** again; `localStorage.getItem('motion_tier')` must be `null` and `dataset.reduceMotion` `"false"`. (If you want to leave the app in its default state, that is the state.)

**5.5 Cinematic ingestion really controls the popup.** Find the persona "Empty Test Persona" with `Invoke-RestMethod http://127.0.0.1:8000/api/users` and use its id (this test adds two reports to that throwaway persona; say so in the report).
 a. Settings: Cinematic **Off**. Open `/upload`, choose the file `site design/public/synthetic_panel_2025-06-20.pdf` through `[data-testid="upload-file-input"]`. For 10 seconds `document.querySelector('[role="dialog"]')` must stay `null`, and the five pipeline rows on the page must reach Done.
 b. Settings: Cinematic **On**. Upload `site design/public/synthetic_panel_2025-01-15.pdf`. Within 3 seconds `document.querySelector('[role="dialog"]')` must exist. Close it with its close button.
 c. Paste the checks and save `gemini/shots/task08-upload-popup-off.png`.

**5.6 The privacy switch (this writes the real `vitagraph/backend/.env`; back it up first as in Task 08a).**
 a. Back up: `Copy-Item vitagraph\backend\.env "$env:TEMP\vitagraph_env_backup_t08"`. Never print the file.
 b. Read the start value: `(Invoke-RestMethod http://127.0.0.1:8000/api/ai/config).allow_api` (call it START, normally True). The "Send retrieved passages" row must show the same button red.
 c. Click **Off**. Without reloading, the header must show the tag "AI explanations off" (`[data-testid="allow-api-chip"]`). Paste `(Invoke-RestMethod http://127.0.0.1:8000/api/ai/config).allow_api` (expected False) and `(Select-String -Path vitagraph\backend\.env -Pattern '^ALLOW_API').Line` (expected `ALLOW_API=false`).
 d. Reload the page: the Off button is red, the tag is still there.
 e. Click **On**: the tag disappears at once; the API says True; `.env` says `ALLOW_API=true`.
 f. If START was False, finish in the False state instead. Then restore the backup byte for byte: `Copy-Item "$env:TEMP\vitagraph_env_backup_t08" vitagraph\backend\.env -Force; Remove-Item "$env:TEMP\vitagraph_env_backup_t08"`.

**5.7 Error state.** Stop the backend (`Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`) and reload `/settings`. Required: the three notes read `Not available while the backend is unreachable.` (the vector-filter note still shows the persona id only if the persona was loaded earlier; if not, it reads `Every query is filtered to the active persona. This cannot be turned off.`), both privacy buttons are disabled (dimmed), and the red status line `The backend is not reachable, so this setting cannot be read or changed.` is visible. Save `gemini/shots/task08-backend-down.png`. Then start the backend again.

**5.8 Narrow screen.** At 820x1100 take `gemini/shots/task08-settings-820.png`. Nothing may overflow horizontally (`document.documentElement.scrollWidth <= window.innerWidth`; paste the two numbers) and no button label may wrap.

**5.9 Console.** During all of the above, the browser console must show **zero errors and zero warnings**. Paste what you collected (for example via `page.on("console")`). If you see font warnings, say so, they are not expected.

**5.10 Sidebar and header still correct.** The Settings item is the active (ink) one, the header title reads `Settings` with subtitle `Ingestion, reading, privacy and display.`; click through the other seven sidebar links once each and confirm each page still renders (the console rule of 5.9 applies to Settings and Upload only, because the other pages are converted in later tasks).

Finally stop both servers and confirm `Get-NetTCPConnection -LocalPort 5173,8000 -State Listen` prints nothing.

## Step 6: work report
Write `gemini/reports/TASK_08_report.md` (nine headings, RULES 5b). Section 6 must list every difference from the reference (the expected ones in 5.1 and any other). Section 4 must contain the real outputs of 4.1 to 4.4 and 5.2 to 5.9.

## COMMIT
Stage ONLY these paths by explicit path (screenshots by explicit file name):
```
git add "site design/src/pages/SettingsPage.tsx" "site design/src/lib/preferences.ts" "site design/src/api/ai.ts" "site design/src/pages/UploadPage.tsx" "site design/src/components/shell/Header.tsx" "site design/src/components/shell/AppShell.tsx" "site design/src/main.tsx" "site design/src/index.css" gemini/reports/TASK_08_report.md
git add gemini/shots/task08-settings-1440.png gemini/shots/task08-settings-820.png gemini/shots/task08-upload-popup-off.png gemini/shots/task08-backend-down.png
git commit -m "feat(redesign): T08 Settings with real controls (privacy, cinematic, reduce motion)"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```

## ACCEPTANCE (PASS/FAIL each with evidence)
- Build exits 0; greps 4.2 and 4.3 print nothing.
- Settings matches the reference layout (screenshot compared); measurements within the ranges.
- Notes equal the API values; Cinematic and Reduce motion persist across reload; reduce motion changes the transition probe to `1e-05s`; defaults restored.
- Cinematic Off: no dialog on upload and the page rows complete; Cinematic On: dialog appears.
- Privacy Off/On: API, `.env` and header tag all agree; survives reload; original value and original `.env` restored.
- Backend-down state is honest (notes unavailable, buttons disabled, red status line).
- 820px: no horizontal overflow. Console: zero errors and warnings.
- Servers stopped; `.env` backup removed; only closed-list files in the commit; branch correct.
