# AI connection deep review (2026-10-12)

Verdict: **the normal connection flow works, but it is NOT issue-free. Three reproducible reliability defects require T4.** This review extends the narrower T3 host/key checks; it does not invalidate their passing results.

## What passed freshly
- Focused model-connection/env/privacy suite: **41 passed in 4.50s**. Production build: exit 0, 400 modules, built in 1.14s. No application source or backend tests were edited for this review.
- Browser against an isolated real backend: a pasted synthetic key and Responses endpoint pass Test, Save clears the key, reload retains connection; wrong key shows Authentication failed and preserves the saved key; changed host requires a fresh key.
- A full `/v1/chat/completions` address, saved key, model, format and reasoning survived a scratch backend restart; the saved key passed Test afterwards. The restart loaded only the temporary settings file into its process environment.
- **Real saved connection** on the primary app: ping passed and a real AI Agent question about a temporary synthetic report finished `answered`, used **2 tool calls**, returned **1 evidence card**, contained the correct **13.8** value, `safety_passed=true`, and emitted **0 error events**. Temporary persona was deleted afterwards. Primary settings and `.env` timestamp stayed unchanged.

## Reproduced findings
### [P1] Test accepts a response with no model answer
Location: `vitagraph/backend/app/generation/ai_client.py`, `test_connection`, lines 123-124 and 153-157.

A Responses endpoint returning HTTP 200 and `{}` is reported as "Connection verified. Model responded: 'OK'" even though no text exists. Chat mode also accepts arbitrary JSON without choices. `_run_test` trusts that result, so Save can persist an unusable endpoint and tell the person it is ready.

Proof: isolated response injection returned `test_says_success=true` and `invents_OK_reply=true`. Also reproduced through the **actual Settings browser and actual scratch backend**, using `/empty/responses` on a local synthetic endpoint: Test displayed verified, and Save accepted that address. Screenshot: `gemini/shots/T4-empty-response-false-success.png`.

Required fix: validate a nonempty model text response in the selected format. Missing/empty/error/malformed responses must return a clear failure; normal Save then returns 422 and changes nothing. Never fabricate an OK reply. A ping validates basic request compatibility, not streaming/tool support for every service.

### [P1] An answer can start while Save tests the connection
Location: `vitagraph/backend/app/routes/ai.py`, `save_model_connection`, lines 510-524.

The busy check occurs before awaiting the network ping. A second browser tab can start an answer during that wait. Save then still applies the new settings and closes the worker pool, which can interrupt the new answer, although the UI contract promises changes are refused while an answer runs.

Proof: controlled route test let `_run_test` enter, then changed the registry's active-answer state before releasing the ping. Save still succeeded and `close_all` was called once. This proof uses synthetic settings and injected coordination; no real answer was interrupted.

Required fix: coordinate run registration and connection changes, recheck active runs after the ping, and prevent a new run from registering between that check and worker replacement. Do not hold a blocking thread lock across async awaits.

### [P2] A failed file write still changes the live connection
Location: `vitagraph/backend/app/core/config.py`, `apply_model_connection`, lines 245-261; same ordering exists in `forget_model_key`.

Runtime fields are changed before `.env` persistence. If disk writing fails, Save raises an error, but subsequent model calls already use the new connection while the settings file retains the old one. Warm workers are not closed because execution never reaches `close_all`. Restart therefore changes the connection again unexpectedly.

Proof: controlled writer failure produced `runtime_model_changed_despite_failure=true` and `disk_kept_old_model=true`. Only a scratch file and synthetic values were used.

Required fix: validate/stage values, persist atomically first, then publish the in-memory change. Convert write failures into a plain HTTP error with no key or path disclosure. The removal operation needs the same failure guarantee; worker pool must remain unchanged on failed persistence.

## Limits and next action
Security: T3 changed-host isolation passed; real credentials were neither printed nor manually read/edited. Performance: no new performance regression measured. Correctness: **not accepted for an issue-free claim** until the three findings above are fixed. Maintainability: the connection route has no common transaction/coordinator yet; add one without a broad refactor.

The ready implementation specification is `gemini/TASK_T4_connection_reliability.md`. This turn was a review under the project's default reviewer-and-prompt workflow, so the defects are **documented, not fixed**. No sub-agents, commits, merges or pushes.

Proof scripts/results: `C:/Users/Admin/AppData/Local/Temp/codex-vita-connection-audit-d530b89ec9a443229c0672a8498786d9/`: `proofs.py`, `proof_results.json`, `real_agent.py`, `real_agent_results.json`, `restart_check.py`, `restart_results.json`, scratch startup/fake-server files. All five data/settings paths are isolated. Primary app remains running; scratch servers are stopped after review.
