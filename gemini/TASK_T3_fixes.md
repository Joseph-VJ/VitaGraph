# TASK T3: fixes after the review of plan T (two small parts: T1 = backend, T2 = frontend)

**Completed and accepted 2026-10-12.** The owner requested direct completion; Codex implemented both parts without sub-agents. Fresh verification: 791 backend tests, build exit 0, 104-file design audit clean, secret scan PASS, 32 scratch browser checks and real connection ping passed. Reports: `gemini/reports/T3_T1_summary.md`, `T3_T2_summary.md`; review: `gemini/reviews/T3_review.md`. Read `docs/SESSION_CONTEXT.md` section 40 for the current state. The instructions below are retained as the executed specification; do not rerun them as pending work.

Read `gemini/reviews/T_review.md` first (defects D1 and D2), then only YOUR part below. The same hard rules as in `gemini/TASK_T1_ai_connection_backend.md` / `gemini/TASK_T2_ai_connection_frontend.md` apply: branch `feature/privacy-shield-and-rag-lab`, no git writes, never open/print/edit `vitagraph/backend/.env`, never use ports 8000/5173, copy code exactly, STOP and report BLOCKED if unclear. Do not commit. Both parts are independent and can run at the same time.

---
## PART T1 (backend session). Files: `vitagraph/backend/app/routes/ai.py`, `vitagraph/backend/app/core/config.py`, `vitagraph/backend/tests/test_ai_model_connection.py` (your own file from round 1, you may edit it).

### T1-a. D1 fix in `app/routes/ai.py`
Add this helper directly above `_checked_input`:
```python
def _same_host(a: str, b: str) -> bool:
    """Same address host and port (scheme and path may differ)."""
    return urlsplit(a).netloc.lower() == urlsplit(b).netloc.lower()
```
Replace the whole body of `_checked_input` by:
```python
def _checked_input(payload: ModelConnectionIn) -> tuple[str, str, str, str]:
    url = _clean_url(payload.url)
    model = _clean_model_name(payload.model)
    key = _clean_key(payload.key)
    if not key:
        if not settings.effective_api_key:
            raise HTTPException(status_code=422, detail="Enter an API key.")
        # A saved key is only ever used with the address it was saved for.
        saved = settings.model_api_url.strip() or settings.effective_base_url
        if saved and not _same_host(url, saved):
            raise HTTPException(
                status_code=422,
                detail="You changed the address, so paste the key again. A saved key is only used with the address it was saved for.",
            )
    return url, key, model, _resolve_format(url, payload.api_format)
```
This protects `POST /api/ai/model/test` and `POST /api/ai/model` (both call `_checked_input`).

### T1-b. Nit in `app/core/config.py`
Remove the extra blank line so there are exactly two blank lines between `os.replace(tmp, env_file)` and `class Settings(BaseSettings):`. Change nothing else in that file.

### T1-c. Tests (edit `tests/test_ai_model_connection.py`)
- The existing test `test_save_model_connection_keeps_old_key_when_empty` may now fail because it saves with an empty key to a different host. Change ONLY its address so it uses the same host as the fixture's saved address (the fixture's saved URL is `https://old.example.invalid/v1`; use e.g. `https://old.example.invalid/v2`). Keep every assertion.
- Add tests (plain names):
  1. empty key + a different host: `POST /api/ai/model/test` and `POST /api/ai/model` both return 422 with `detail` starting "You changed the address"; the recorder shows `test_connection` was NOT called; settings and `.env` unchanged; `close_all` not called.
  2. empty key + same host, different path/scheme (e.g. `http` vs `https` is rejected by the URL rules, so use a different path on the same host, and the same host in a different letter case): accepted (200) and the test recorder received the SAVED key.
  3. a typed key + a different host: accepted (200), the recorder received the typed key.
  4. empty key + different host when NO key is saved: still the old message "Enter an API key."
  5. in the successful save test, assert `close_all` was called exactly once (add the assertion if it is not there).

### T1-d. Verify and report
`cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests/test_ai_model_connection.py tests/test_env_writer.py tests/test_ai_privacy.py -q -p no:cacheprovider` (paste the last 3 lines), then the full suite once (`... -m pytest tests -q -p no:cacheprovider`, expect 778 + your new tests, 0 failed; paste the last line), then `(Get-Item vitagraph\backend\.env).LastWriteTime.ToString("o")` before and after (must be equal; the expected value is `2026-10-08T14:16:14.5578770+05:30`). No live check needed. Write `gemini/reports/T3_T1_summary.md` (Status, files with `git diff --numstat`, test output, `.env` timestamps, deviations, branch proof).

---
## PART T2 (frontend session). File: `site design/src/components/settings/AiConnectionSection.tsx` only.

### T2-a. D2 fix
1. Add this helper above the `Choice` function:
```tsx
const hostOf = (address: string): string => {
  try {
    return new URL(address.trim()).host.toLowerCase();
  } catch {
    return "";
  }
};
```
2. Inside the component, find the existing line `const filled = ...` (it starts with `const filled =` and ends with `Boolean(conn?.has_key));`). REPLACE that one line by this block (the comment line is part of it):
```tsx
  // A saved key is only used with the address it was saved for, so a new host needs the key typed again.
  const hostChanged = Boolean(conn?.has_key) && conn !== null && conn.url !== "" && hostOf(form.url) !== "" && hostOf(form.url) !== hostOf(conn.url);
  const needsKey = hostChanged && form.key.trim() === "";
  const filled =
    form.url.trim() !== "" && form.model.trim() !== "" && (form.key.trim() !== "" || (Boolean(conn?.has_key) && !hostChanged));
```
3. Change the help line under "API key" (the `div` with `id={keyHelpId}`) to:
```tsx
              {needsKey
                ? "You changed the address, so paste the key again. A saved key is only used with the address it was saved for."
                : conn.has_key
                  ? `A key ending in ${conn.masked_key.slice(-4)} is saved. Leave this empty to keep it.`
                  : "Paste the key from your provider. It is never shown again."}
```
4. Also change the key input's `placeholder` to `needsKey ? "Paste your API key" : conn.has_key ? "Leave empty to keep the saved key" : "Paste your API key"`.
5. Make the help line red when `needsKey`: add `style={needsKey ? { ...helpStyle, color: "var(--color-accent-700)", fontWeight: 600 } : helpStyle}` on that same `div` (replace its existing `style={helpStyle}`), and add `data-testid="ai-conn-key-help"` to it.

### T2-b. Verify and report
1. `cd "site design" && npx tsc -b` (clean), `npm run build` (exit 0), `npm run audit:design` (0 errors), `python scripts/plan/secret_scan.py` (PASS).
2. A small Playwright check on a scratch stack (all env set as in TASK_T2 "Live check", ports backend 8002, frontend 5175, fake model 8099; the CORS list in the backend does not include 5175, so use frontend port **5174** instead and tell the report so): save a key for `http://127.0.0.1:8099/v1`; reload; change the address to `http://localhost:8099/v1` and leave the key empty: the help line says "You changed the address, so paste the key again..." in red and Test and Save are disabled; type a key: both enable; change the address back to `http://127.0.0.1:8099/v2`: the help line returns to "A key ending in ... is saved" and Save is enabled. The save of a new host with a typed key succeeds. Paste each result. Stop all scratch processes and confirm the ports are free.
3. Write `gemini/reports/T3_T2_summary.md` (Status, numstat, static checks pasted, the Playwright results, deviations, branch proof).
