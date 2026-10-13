# TASK T2: AI connection, FRONTEND (Gemini session 2 of 2)

You are session T2. Another Gemini session (T1) builds the backend routes at the same time; you never touch its files. Claude reviews your work. Be exact: copy the code blocks, then do the "Write yourself" parts. If anything is unclear, or a rule would be broken, STOP and write BLOCKED in the report instead of guessing.

## Read first (in this order)
1. `gemini/PLAN_T_ai_connection.md` (the contract; sections 1 and 2 matter most).
2. `gemini/RULES.md` sections 2, 4, 5c, 5d and `gemini/DESIGN_LAW.md` (ignore the old branch name in RULES; the branch for this task is `feature/privacy-shield-and-rag-lab`).
3. `site design/src/pages/SettingsPage.tsx` (look at the "Privacy and answers" block, around lines 322 to 372: the row style you must match), `site design/src/api/ai.ts`, `site design/src/api/client.ts`, `site design/src/components/data/ConfirmDialog.tsx`.
4. Look at the Settings page in a browser once (http://localhost:5173/settings is the owner's running app: read-only look, do not change anything there).

## Hard rules
- First command: `git branch --show-current` must print `feature/privacy-shield-and-rag-lab`. Last command: the same plus `git status --short` (paste both).
- Edit ONLY: `site design/src/api/ai.ts` (add, do not change existing exports), create `site design/src/components/settings/AiConnectionSection.tsx`, and `site design/src/pages/SettingsPage.tsx` (one import and one JSX line, nothing else). Never edit `site design/tsconfig.tsbuildinfo` by hand and never stage it.
- Design law: Archivo only, 0 radius, flat, one red accent, tokens only (`var(--color-...)`, `var(--space-...)`; the spacing tokens that exist are 1, 2, 3, 4, 6 and 8: there is NO `--space-5`). No hex colours, no inline `border-radius`, no gradients, no shadows.
- No provider or model brand names anywhere in the UI text, placeholders, titles, aria labels or comments shown to users. Forbidden words (case-insensitive): openai, anthropic, claude, gemini, deepseek, gpt, agentrouter, muse, llama, mistral, groq, openrouter, google, azure, ollama. Use neutral examples such as `https://your-provider.example/v1`.
- The API key: only in the password input's React state; cleared after a successful save; never in localStorage, sessionStorage, the URL, `console.*`, an error message or a `data-` attribute.
- No git writes (no add, commit, stash, checkout, reset, restore, clean, push, merge, rebase, amend).
- Never open, print or edit `vitagraph/backend/.env`. Never touch backend files.
- Do not start, stop or use ports 8000 or 5173 (the owner's running app). Your own scratch servers use backend port 8002 and frontend port 5175 (see "Live check").
- No fake timers or fake progress: every state comes from a real request.

## Progress ladder
- 25 %: `api/ai.ts` done, `npx tsc -b` clean.
- 60 %: the component exists and `SettingsPage.tsx` renders it, `npx tsc -b` clean.
- 85 %: `npm run build` exit 0, `npm run audit:design` 0 errors.
- 100 %: live check done (or reported "not run" because T1's report did not exist yet) and `gemini/reports/T2_summary.md` written.

## Part A: `site design/src/api/ai.ts`
Add, after the existing `ReportAnalysisResponse` interface and before `export const aiApi`:
```ts
export type ModelFormat = "auto" | "responses" | "chat";
export type ModelReasoning = "minimal" | "low" | "medium" | "high" | "default";

/** What the backend remembers about the model connection. It never contains the key. */
export interface ModelConnection {
  url: string;
  model: string;
  api_format: "responses" | "chat";
  reasoning: ModelReasoning;
  has_key: boolean;
  masked_key: string;
  allow_api: boolean;
  shield_covered: boolean;
  can_edit: boolean;
  message: string;
}

export interface ModelConnectionInput {
  url: string;
  key: string;
  model: string;
  api_format: ModelFormat;
  reasoning: ModelReasoning;
  skip_test?: boolean;
}

export interface ModelTestResult {
  ok: boolean;
  message: string;
  api_format: "responses" | "chat";
}
```
and inside the `aiApi` object, after `setPrivacy`:
```ts
  getModel: () => api.get<ModelConnection>("/api/ai/model"),
  testModel: (input: ModelConnectionInput) => api.post<ModelTestResult>("/api/ai/model/test", input),
  saveModel: (input: ModelConnectionInput) => api.post<ModelConnection>("/api/ai/model", input),
  removeModelKey: () => api.post<ModelConnection>("/api/ai/model/remove-key", {}),
```

## Part B: create `site design/src/components/settings/AiConnectionSection.tsx`
Create the folder `site design/src/components/settings/` if it does not exist. Copy this file exactly:

```tsx
import React, { useEffect, useId, useState } from "react";
import { aiApi, type ModelConnection, type ModelFormat, type ModelReasoning } from "../../api/ai";
import { ConfirmDialog } from "../data/ConfirmDialog";

const REASONING: { value: ModelReasoning; label: string }[] = [
  { value: "minimal", label: "Fastest" },
  { value: "low", label: "Quick" },
  { value: "medium", label: "Balanced" },
  { value: "high", label: "Thorough" },
  { value: "default", label: "Service default" },
];

const FORMATS: { value: ModelFormat; label: string }[] = [
  { value: "auto", label: "Detect from the address" },
  { value: "responses", label: "Responses" },
  { value: "chat", label: "Chat" },
];

interface Form {
  url: string;
  model: string;
  key: string;
  format: ModelFormat;
  reasoning: ModelReasoning;
}

type Busy = "idle" | "testing" | "saving" | "removing";
type Notice = { tone: "ok" | "error"; text: string } | null;

const formFrom = (c: ModelConnection): Form => ({
  url: c.url,
  model: c.model,
  key: "",
  format: c.url ? c.api_format : "auto",
  reasoning: c.reasoning,
});

const sectionHead: React.CSSProperties = {
  padding: "var(--space-6) 0 var(--space-2)",
  borderBottom: "2px solid var(--color-text)",
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-accent-700)",
};
const block: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  padding: "var(--space-4) 0",
  borderBottom: "1px solid var(--color-divider)",
};
const labelStyle: React.CSSProperties = { fontSize: "1.0625rem", fontWeight: 800 };
const helpStyle: React.CSSProperties = { fontSize: "0.875rem", color: "var(--color-neutral-700)" };
const inputStyle: React.CSSProperties = { width: "100%", maxWidth: 560 };

function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  disabled: boolean;
  testId: string;
}) {
  return (
    <div role="radiogroup" aria-label={props.label} data-testid={props.testId} style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          disabled={props.disabled}
          className={props.value === o.value ? "btn btn-primary" : "btn btn-secondary"}
          data-testid={`${props.testId}-${o.value}`}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const announce = (c: ModelConnection) =>
  window.dispatchEvent(new CustomEvent("vitagraph:ai-config", { detail: { allow_api: c.allow_api } }));

/** The AI connection: endpoint, key, model name. The key is sent to the backend only and is never shown again. */
export const AiConnectionSection: React.FC = () => {
  const [conn, setConn] = useState<ModelConnection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<Form>({ url: "", model: "", key: "", format: "auto", reasoning: "low" });
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<Busy>("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const [canForce, setCanForce] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const urlId = useId();
  const keyId = useId();
  const keyHelpId = useId();
  const modelId = useId();

  useEffect(() => {
    let alive = true;
    aiApi
      .getModel()
      .then((c) => {
        if (!alive) return;
        setConn(c);
        setForm(formFrom(c));
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof Form>(name: K, value: Form[K]) => setForm((f) => ({ ...f, [name]: value }));

  const base = conn ? formFrom(conn) : null;
  const dirty =
    base !== null &&
    (form.url !== base.url || form.model !== base.model || form.key !== "" || form.format !== base.format || form.reasoning !== base.reasoning);
  const canEdit = conn?.can_edit ?? false;
  const filled = form.url.trim() !== "" && form.model.trim() !== "" && (form.key.trim() !== "" || Boolean(conn?.has_key));
  const working = busy !== "idle";
  const effectiveFormat = form.format === "auto" ? (/\/responses\/*$/i.test(form.url.trim()) ? "responses" : "chat") : form.format;
  const showShieldWarning = canEdit && effectiveFormat === "chat" && (form.url.trim() !== "" || Boolean(conn?.has_key));

  const payload = (skipTest = false) => ({
    url: form.url.trim(),
    key: form.key.trim(),
    model: form.model.trim(),
    api_format: form.format,
    reasoning: form.reasoning,
    ...(skipTest ? { skip_test: true } : {}),
  });

  const test = async () => {
    setBusy("testing");
    setNotice(null);
    setCanForce(false);
    try {
      const result = await aiApi.testModel(payload());
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "The connection could not be tested." });
    } finally {
      setBusy("idle");
    }
  };

  const save = async (skipTest = false) => {
    setBusy("saving");
    setNotice(null);
    setCanForce(false);
    try {
      const next = await aiApi.saveModel(payload(skipTest));
      setConn(next);
      setForm(formFrom(next));
      setShowKey(false);
      setNotice({ tone: "ok", text: `Saved. ${next.message} The AI Agent uses it from its next question.` });
      announce(next);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "The connection could not be saved." });
      setCanForce(true);
    } finally {
      setBusy("idle");
    }
  };

  const removeKey = async () => {
    setBusy("removing");
    setRemoveError(null);
    try {
      const next = await aiApi.removeModelKey();
      setConn(next);
      setForm(formFrom(next));
      setConfirmRemove(false);
      setNotice({ tone: "ok", text: next.message || "The saved key was removed." });
      announce(next);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "The key could not be removed.");
    } finally {
      setBusy("idle");
    }
  };

  return (
    <>
      <div style={sectionHead}>AI connection</div>

      {loadFailed ? (
        <div role="status" style={{ ...block, ...helpStyle }} data-testid="ai-conn-unavailable">
          The connection settings are not available while the backend is unreachable.
        </div>
      ) : conn === null ? (
        <div role="status" style={{ ...block, ...helpStyle }}>
          Loading
        </div>
      ) : (
        <form
          data-testid="ai-conn"
          onSubmit={(event) => {
            event.preventDefault();
            if (canEdit && filled && dirty && !working) void save();
          }}
        >
          <div style={block}>
            <div style={helpStyle}>
              The address, key and model name of the AI service that writes answers. They are saved on this computer only. Nothing is sent until you turn
              on &ldquo;Send retrieved passages to the AI model&rdquo; below.
            </div>
            {!canEdit ? (
              <div role="status" data-testid="ai-conn-readonly" style={{ ...helpStyle, color: "var(--color-accent-700)", fontWeight: 600 }}>
                This can only be changed on the computer that runs VitaGraph.
              </div>
            ) : null}
            {!conn.allow_api ? (
              <div role="status" data-testid="ai-conn-off-note" style={helpStyle}>
                Sending passages to the AI is Off, so this connection is not used yet.
              </div>
            ) : null}
          </div>

          <div style={block}>
            <label htmlFor={urlId} style={labelStyle}>
              Address
            </label>
            <div style={helpStyle}>For example https://your-provider.example/v1 or an address ending in /responses.</div>
            <input
              id={urlId}
              className="input"
              style={inputStyle}
              data-testid="ai-conn-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={500}
              disabled={!canEdit || working}
              value={form.url}
              placeholder="https://your-provider.example/v1"
              onChange={(e) => set("url", e.target.value)}
            />
          </div>

          <div style={block}>
            <label htmlFor={keyId} style={labelStyle}>
              API key
            </label>
            <div id={keyHelpId} style={helpStyle}>
              {conn.has_key ? `A key ending in ${conn.masked_key.slice(-4)} is saved. Leave this empty to keep it.` : "Paste the key from your provider. It is never shown again."}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
              <input
                id={keyId}
                className="input"
                style={{ ...inputStyle, flex: "1 1 280px" }}
                data-testid="ai-conn-key"
                type={showKey ? "text" : "password"}
                autoComplete="new-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={500}
                aria-describedby={keyHelpId}
                disabled={!canEdit || working}
                value={form.key}
                placeholder={conn.has_key ? "Leave empty to keep the saved key" : "Paste your API key"}
                onChange={(e) => set("key", e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="ai-conn-key-toggle"
                aria-pressed={showKey}
                disabled={!canEdit || working || form.key === ""}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? "Hide" : "Show"}
              </button>
              {conn.has_key && canEdit ? (
                <button type="button" className="btn btn-ghost" data-testid="ai-conn-remove-key" disabled={working} onClick={() => setConfirmRemove(true)}>
                  Remove saved key
                </button>
              ) : null}
            </div>
          </div>

          <div style={block}>
            <label htmlFor={modelId} style={labelStyle}>
              Model name
            </label>
            <div style={helpStyle}>Exactly as your provider writes it.</div>
            <input
              id={modelId}
              className="input"
              style={inputStyle}
              data-testid="ai-conn-model"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              disabled={!canEdit || working}
              value={form.model}
              placeholder="the model name from your provider"
              onChange={(e) => set("model", e.target.value)}
            />
          </div>

          <div style={block}>
            <div style={labelStyle}>Request format</div>
            <div style={helpStyle}>Most services use Chat. Choose Responses when your provider asks for it. The default reads it from the address.</div>
            <Choice label="Request format" value={form.format} options={FORMATS} disabled={!canEdit || working} testId="ai-conn-format" onChange={(v) => set("format", v)} />
            {showShieldWarning ? (
              <div role="status" data-testid="ai-conn-shield-warning" style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-accent-700)" }}>
                With the Chat format the Privacy Shield cannot hide private details before they are sent. Choose Responses if your provider supports it.
              </div>
            ) : null}
          </div>

          <div style={block}>
            <div style={labelStyle}>How carefully the AI thinks</div>
            <div style={helpStyle}>Faster settings answer sooner. Thorough settings can take much longer.</div>
            <Choice label="How carefully the AI thinks" value={form.reasoning} options={REASONING} disabled={!canEdit || working} testId="ai-conn-reasoning" onChange={(v) => set("reasoning", v)} />
          </div>

          <div style={{ ...block, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
            <button type="button" className="btn btn-secondary" data-testid="ai-conn-test" disabled={!canEdit || !filled || working} onClick={() => void test()}>
              {busy === "testing" ? "Testing…" : "Test connection"}
            </button>
            <button type="submit" className="btn btn-primary" data-testid="ai-conn-save" disabled={!canEdit || !filled || !dirty || working}>
              {busy === "saving" ? "Saving…" : "Save"}
            </button>
            {canForce ? (
              <button type="button" className="btn btn-ghost" data-testid="ai-conn-save-anyway" disabled={working} onClick={() => void save(true)}>
                Save without testing
              </button>
            ) : null}
          </div>

          <div
            role={notice?.tone === "error" ? "alert" : "status"}
            data-testid="ai-conn-status"
            style={{
              minHeight: "1.5em",
              padding: "var(--space-3) 0",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: notice?.tone === "error" ? "var(--color-accent-700)" : "var(--color-text)",
            }}
          >
            {notice?.text ?? ""}
          </div>
        </form>
      )}

      {confirmRemove ? (
        <ConfirmDialog
          title="Remove the saved key?"
          body="The AI Agent and the AI summaries stop working until you save a new key. Everything else keeps working."
          confirmLabel="Remove key"
          busy={busy === "removing"}
          error={removeError}
          onConfirm={() => void removeKey()}
          onCancel={() => {
            setConfirmRemove(false);
            setRemoveError(null);
          }}
          testId="ai-conn-remove-dialog"
        />
      ) : null}
    </>
  );
};
```
After pasting run `npx tsc -b` from `site design`. If TypeScript complains about the generic `Choice` in a `.tsx` file, keep it a `function` declaration (it is) and fix only that line; do not change anything else without saying so in the report.

## Part C: `site design/src/pages/SettingsPage.tsx`
1. Add one import line next to the other component imports: `import { AiConnectionSection } from "../components/settings/AiConnectionSection";`
2. Render `<AiConnectionSection />` ONCE, directly BEFORE the comment `{/* PRIVACY AND ANSWERS */}` (that is right after the "Embedding model" row and before the "Privacy and answers" heading). Nothing else in this file changes.

## Write yourself: a Playwright check (do not commit it)
Save it in your scratch folder, not in the repo. It must check, against the scratch stack of "Live check":
1. The section "AI connection" is between the embedding row and "Privacy and answers"; all test ids exist (`ai-conn`, `ai-conn-url`, `ai-conn-key`, `ai-conn-model`, `ai-conn-format-*`, `ai-conn-reasoning-*`, `ai-conn-test`, `ai-conn-save`, `ai-conn-status`).
2. Fresh state (no key): Test and Save are disabled until address, key and model are filled; Save is disabled until something changed.
3. Fill the fake endpoint (`http://127.0.0.1:8099/v1`), a key like `test-key-ABCDEFGH1234`, model `fake-model`: the format "Detect" shows the shield warning (chat); choosing Responses hides it; click Test: status shows the success text; Save: status says "Saved."; the key input is empty afterwards; the help line says "A key ending in 1234 is saved."; reload the page: the same address and model are there, the key is not.
4. The full key `test-key-ABCDEFGH1234` appears NOWHERE: not in `document.body.innerText`, not in `localStorage`/`sessionStorage` (JSON.stringify both), not in any console message, not in the page HTML (`page.content()`).
5. A wrong address (`http://127.0.0.1:8099/nothing`): Save shows a red error and the "Save without testing" button; the saved values do not change after reload.
6. Remove saved key: dialog opens with focus on the safe button, Esc closes it, confirm removes the key (help line says "Paste the key from your provider...").
7. Text scan: lower-case the text of the whole Settings page and assert none of these words occur: openai, anthropic, claude, gemini, deepseek, gpt, agentrouter, muse, llama, mistral, groq, openrouter, google, azure, ollama.
8. Responsive: 1440, 1000, 820, 400 px wide: `document.documentElement.scrollWidth <= innerWidth`; screenshots to `gemini/shots/T2-1440.png`, `T2-820.png`, `T2-400.png` (plus `T2-error.png` for step 5).
9. Keyboard: Tab reaches address, key, Show, model, the format buttons, the thinking buttons, Test, Save in a sensible order; Enter in the model field submits Save (only when allowed).
10. Console: no errors and no warnings from the app during all of the above.
11. Reduced motion (`vitagraph_preferences.reduceMotion = true`) changes nothing for this section.

## Live check (needs T1 to be finished: `gemini/reports/T1_summary.md` must exist)
If that file does not exist when you reach this point: skip this whole section, write "live check NOT RUN (T1 report missing)" in your report and finish with the static checks only.
1. Scratch folder under your temp dir, e.g. `...\scratchpad\t2live`, with an empty `scratch.env`.
2. Your own fake model server on port 8099 (Python `http.server`): `POST /v1/responses` -> `{"output_text":"OK"}`, `POST /v1/chat/completions` -> `{"choices":[{"message":{"content":"OK"}}]}`, other paths 404.
3. Scratch backend from `vitagraph/backend` with ALL of these set: `DATA_DIR`, `DB_PATH`, `CHROMA_DIR`, `UPLOADS_DIR` (inside the scratch folder), `VITAGRAPH_ENV_FILE=<scratch>\scratch.env`, `MODEL_API_KEY=`, `MODEL_API_URL=`, `MODEL_NAME=` (empty), `ALLOW_API=false`, `BACKEND_URL=http://127.0.0.1:8002`; command `.venv\Scripts\python.exe -m uvicorn app.main:app --port 8002`. `GET http://127.0.0.1:8002/api/health` must show `"chunks": 0` first (proof it is isolated). If `/api/ai/model` answers 404 the T1 code is not in place: stop and report PARTIAL.
4. Scratch frontend from `site design`: set `VITE_API_URL=http://127.0.0.1:8002` and run `npx vite --port 5175 --strictPort`.
5. Run your Playwright script against `http://localhost:5175/settings` with `channel="chrome"`, viewport 1440x900, `PYTHONIOENCODING=utf-8`.
6. Stop all four scratch processes and confirm ports 8002, 5175 and 8099 are free (`Get-NetTCPConnection`).

## Verify (static, always)
1. `cd "site design" && npx tsc -b` prints nothing.
2. `npm run build` exit code 0 (paste the last 3 lines).
3. `npm run audit:design` -> `0 error(s)` (paste the last line).
4. `python scripts/plan/secret_scan.py` -> `RESULT: PASS`.
5. `git diff --numstat -- "site design/src/api/ai.ts" "site design/src/pages/SettingsPage.tsx"` (paste; SettingsPage must show about 2 added lines and 0 removed) and the line count of the new component.

## Report (write `gemini/reports/T2_summary.md`, then tell the owner)
Headings: Status (COMPLETE | PARTIAL | BLOCKED), Files changed (numstat), Ladder results, Static checks (pasted), Live check (pasted output of every numbered check above, the key replaced by `<KEY>`; or "NOT RUN" with the reason), Screenshots written, Deviations (none unless you had to), Open points (anything odd you saw, even if the checklist did not ask), Branch proof. Believe the output when it contradicts the checklist; say PARTIAL when evidence is partial; never claim a check you did not run.
