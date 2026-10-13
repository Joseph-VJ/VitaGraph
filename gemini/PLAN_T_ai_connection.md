# PLAN T: "AI connection" in Settings (2026-10-12)

**Latest readiness review:** normal flow and a real Agent answer passed, but three reliability faults were reproduced on 2026-10-12. T3 below remains complete for its host/key fixes; the broader connection needs T4 before an issue-free sign-off. Read `gemini/reviews/T_connection_deep_review.md`, `gemini/TASK_T4_connection_reliability.md` and SESSION_CONTEXT section 41. T4 is written, not implemented.

**Current status: COMPLETE, accepted on 2026-10-12 after T3.** Both changed-host/key defects are fixed and verified. 791 backend tests passed; build/audit/scan and live browser checks passed; the real saved connection ping returned HTTP 200, ok true. Source and documentation remain uncommitted on `feature/privacy-shield-and-rag-lab`. See `gemini/reviews/T3_review.md` and `docs/SESSION_CONTEXT.md` section 40. The contract below records the original plan; T3 narrows blank-key reuse to the saved host and port.

The owner wants to type the model endpoint, API key and model name into the Settings page instead of editing `vitagraph/backend/.env` by hand and restarting the backend. Two Gemini sessions build it in parallel; Claude reviews. **This file is the contract between the two sessions. Neither session may change it. If you think it is wrong, stop and say so in your report.**

Branch: `feature/privacy-shield-and-rag-lab` (`git branch --show-current` must print exactly that). Do not commit, push, merge, rebase, reset, stash or clean. The reviewer commits.

## 0. Facts about the code today (do not re-derive)

- `Settings` (`vitagraph/backend/app/core/config.py`) has `model_api_key`, `model_api_url`, `model_name`, `model_api_format` ("chat" | "responses"), `model_reasoning_effort` ("minimal" | "low" | "medium" | "high" | ""), `model_fallback_models`. A validator (`_apply_model_api`) copies them onto the ACTIVE fields `agentrouter_api_key`, `agentrouter_base_url`, `agentrouter_model` (only when `model_api_key` is not empty) at start-up. Everything else in the backend reads `settings.effective_api_key`, `effective_base_url`, `effective_model`, `api_format` at the moment of each call, so changing the settings object at run time works for every new call.
- Exceptions: the AI Agent workers (`app/agent/pool.py`, `get_pool()`) get key/URL/model when they START, so after a change the pool must be closed (`await get_pool().close_all()`); they restart on the next question.
- The old route `POST /api/ai/config` writes the legacy `AI_SERVICE_*` names and cannot change `MODEL_*`. LEAVE IT UNTOUCHED (out of scope). The new routes below are the only ones the new UI uses.
- `ai_client.test_connection(url, key, model, timeout=12) -> (ok, message)` tests ONE full URL: it uses the Responses format when the URL ends with `/responses`, else chat-completions with the URL as given. It never raises.
- There is NO login in the app. The endpoint decides where report passages are sent, so every route that CHANGES the connection is allowed only from the computer that runs the backend (loopback).
- The Privacy Shield covers the model traffic only in the Responses format (`settings.api_format == "responses"`). In the Chat format the shield cannot hide anything; the UI must say so.
- No provider or model brand name may appear in the UI: labels, placeholders and help text stay neutral. The only place a model name may show is inside the input the person typed it into.
- The real `vitagraph/backend/.env` holds the owner's key. Nobody reads, prints, edits or copies it. Tests and live checks use a temporary `.env` (see T1).

## 1. Backend contract (session T1)

All routes live in `app/routes/ai.py` under the existing prefix `/api/ai`.

| Method + path | Who | Body | Reply |
|---|---|---|---|
| `GET /api/ai/model` | anyone | none | `ModelConnectionOut` |
| `POST /api/ai/model/test` | local only | `ModelConnectionIn` | `{ "ok": bool, "message": str, "api_format": "responses"\|"chat" }` (tests, saves nothing) |
| `POST /api/ai/model` | local only | `ModelConnectionIn` | `ModelConnectionOut` (tests first, then saves) |
| `POST /api/ai/model/remove-key` | local only | none | `ModelConnectionOut` |

`ModelConnectionIn` (JSON):
```
{ "url": str (1..500),
  "key": str (0..500, "" means keep the saved key),
  "model": str (1..100),
  "api_format": "auto" | "responses" | "chat"   (default "auto"),
  "reasoning": "minimal" | "low" | "medium" | "high" | "default"   (default "low"),
  "skip_test": bool   (default false) }
```
`ModelConnectionOut` (JSON). It NEVER contains the key:
```
{ "url": str, "model": str, "api_format": "responses"|"chat", "reasoning": "minimal"|"low"|"medium"|"high"|"default",
  "has_key": bool, "masked_key": str ("" when no key, else "••••" + last 4 characters, or "••••" for a short key),
  "allow_api": bool, "shield_covered": bool, "can_edit": bool, "message": str }
```
- `url` and `model` are the values the person saved (`settings.model_api_url`, `settings.model_name`), empty strings when never set. They must NOT fall back to the built-in defaults (those contain a brand name).
- `api_format` is `settings.model_api_format` ("responses" or "chat"). `shield_covered` is `settings.api_format == "responses"` (the format actually in force). `can_edit` is true when the caller is local.
- `reasoning` shown is `settings.model_reasoning_effort` if it is one of minimal/low/medium/high, else "default".
- "auto" format: `responses` when the URL path ends with `/responses`, else `chat`. The saved format is always the concrete one.
- Saving: validate -> refuse with 409 while any AI Agent answer is running -> test the connection (unless `skip_test`; a failed test returns **422 with the message as `detail` and changes nothing**) -> apply to the live settings -> write `.env` -> `await get_pool().close_all()` -> return `ModelConnectionOut` with `message` = the test message ("Saved without a test." when skipped).
- Errors are `{ "detail": "<plain sentence>" }` (HTTP 403 not local, 409 answer running, 422 bad value or failed test).
- The key must never appear in any response, log line, exception text or test message (a test message that contains the key is rewritten with the key replaced by "…").

## 2. Frontend contract (session T2)

- `src/api/ai.ts` gets the types `ModelConnection`, `ModelConnectionInput`, `ModelTestResult` (same fields as section 1, camelCase NOT used: keep the snake_case names exactly as the backend sends them) and `aiApi.getModel()`, `aiApi.testModel(input)`, `aiApi.saveModel(input)`, `aiApi.removeModelKey()`.
- A new component `src/components/settings/AiConnectionSection.tsx` renders the whole "AI connection" block; `SettingsPage.tsx` only imports it and renders it once (see T2 for where).
- After a successful save or key removal the component dispatches `window.dispatchEvent(new CustomEvent("vitagraph:ai-config", { detail: { allow_api } }))` like the privacy switch does.
- The key is never kept anywhere except the password input's React state until Save/Test returns; it is cleared after a successful save and never goes to localStorage, sessionStorage, the URL, `console.*` or an error message.

## 3. Ownership (no overlap)

| Session | Files |
|---|---|
| T1 backend | `vitagraph/backend/app/core/config.py`, `app/routes/ai.py`, `app/agent/runs.py` (one small method), NEW `tests/test_ai_model_connection.py`, NEW `tests/test_env_writer.py` |
| T2 frontend | `site design/src/api/ai.ts`, NEW `site design/src/components/settings/AiConnectionSection.tsx`, `site design/src/pages/SettingsPage.tsx` (import + one render + nothing else) |

Run order: both start at once. T2 finishes with static checks (tsc, build, audit). Its live check waits for `gemini/reports/T1_summary.md`; if that file does not exist when T2 is otherwise done, T2 reports "live check not run" and stops.

## 4. Owner decisions already taken (defaults, do not ask)

1. Only the computer that runs VitaGraph may change the connection (loopback only). Reading is allowed from anywhere.
2. Neutral labels; the typed model name and URL are shown only inside their own inputs.
3. In the Chat format a visible warning says the Privacy Shield cannot protect that traffic.
4. The key stays in the git-ignored `backend/.env`, in plain text, as it is today.
