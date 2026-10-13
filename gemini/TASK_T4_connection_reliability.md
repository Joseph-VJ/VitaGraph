# TASK T4: make AI connection failure and concurrency handling reliable

Status: **READY, NOT IMPLEMENTED.** Read `gemini/reviews/T_connection_deep_review.md` completely first. This is the next single story after T3; do not repeat T3 or change unrelated Q/R features.

## 0. Contract and guard
Branch must be `feature/privacy-shield-and-rag-lab`, HEAD currently c4fca21 with all earlier work uncommitted. No git writes, commits, push, merge, reset, stash or clean. Preserve all existing changes. Never print, manually read/edit/copy the real backend `.env`. No sub-agents. Primary ports 8000/5173 belong to the owner; tests use 8001/5174 with DATA_DIR, DB_PATH, CHROMA_DIR, UPLOADS_DIR and VITAGRAPH_ENV_FILE all separate and temporary.

No UI redesign. Neutral error messages; preserve Archivo/flat/square/red styling. Test, normal Save and explicit Save without testing remain distinct. The latter is allowed to save a connection without an upstream validation, but must never bypass URL/key/host checks, active-answer checks or persistence guarantees.

## 1. Closed files
- `vitagraph/backend/app/generation/ai_client.py`: test_connection only, plus a small pure helper if needed.
- `vitagraph/backend/app/core/config.py`: connection persistence/update/removal and env writer coordination only.
- `vitagraph/backend/app/routes/ai.py`: new connection routes/helpers only; leave legacy config routes unchanged unless required and report why.
- `vitagraph/backend/app/agent/runs.py`: coordination of run registration with model connection changes only. Preserve streaming, replay, persistence and stop behavior.
- `vitagraph/backend/app/routes/agent.py`: warm/registration wiring only if necessary for the coordinator.
- Optional new small `vitagraph/backend/app/services/connection_state.py` for shared async coordination; do not add packages.
- NEW regression files: `vitagraph/backend/tests/test_ai_connection_reliability.py` and `test_connection_run_coordination.py`. Do not edit existing backend tests to pass.
- Reports and screenshots only under `gemini/reports/`, `gemini/reviews/`, `gemini/shots/`.

## 2. Write the regression checks first (0-25%)
Reproduce the three review proofs before production edits. Make the new tests fail first and paste the failure summary. Use fake transports/controlled thread events, no real key or network in unit tests.

Ping cases in BOTH formats: HTTP 200 `{}`, empty output_text, empty choices, content null, embedded error, malformed JSON fail; valid Responses output_text and output[] text succeed; valid Chat message.content succeeds. Preserve handled 401/403/404/429/timeout errors. Test no successful reply is fabricated. Save following a failed ping must return 422 with all fields, settings-file bytes and pool-close count unchanged.

Concurrency case: hold the ping with events, start/register an answer before it finishes, release ping. Save must return 409, with unchanged file/settings and no pool close. A run registration racing the final commit/worker replacement must wait or be refused clearly; it must not execute on a worker being removed. Concurrent saves and save/remove must have a deterministic order and never mix endpoint/key/model/format. TestClient buffers streams: test route/registry functions with an explicit async test harness or a real scratch server rather than waiting on a never-ending TestClient stream.

Disk cases: injected read/write/replace failure for Save and Remove leaves all runtime fields, actual temporary file contents and pool state unchanged. Errors are plain and contain neither key nor internal paths. A successful save/remove still closes the pool once. Test writer concurrency with the privacy settings writer so shared temporary filenames cannot overwrite each other or drop unrelated keys.

## 3. Validate real model output (25-45%)
`test_connection` must only return success after a real, nonempty answer in the chosen contract. Parse and validate types before extracting content. Responses may expose output_text or output message content; Chat must have a usable choice/message. Trim text; missing, blank, invalid or error-only bodies produce `(False, plain_message)` even under HTTP 200. Remove `reply or 'OK'` and generic success for arbitrary JSON. Keep redaction in `_run_test`; never include full response bodies or keys in errors. Preserve the existing healthy endpoint behavior and URL normalization.

The test cannot certify that an endpoint supports streaming and tool calls merely from a ping. Report that limitation honestly; do not add provider-specific workarounds.

## 4. Publish settings only after successful persistence (45-65%)
Build validated candidate values without mutating Settings. For persist=True, write the candidate updates before changing active runtime fields. On any persistence exception the previous in-memory state and file must remain usable. On success apply the candidate as one synchronous publication with no await between related field changes, then close old workers. Follow the same sequence for key removal. Keep unrelated `.env` lines and avoid reusing a saved key for another host.

Coordinate `write_env_values` across threads; create a unique temporary file in the target directory, replace atomically and remove only that temporary file on failure. All paths must honor VITAGRAPH_ENV_FILE. Never print file contents. Keep existing env-writer tests green. Do not modify the real environment file during verification.

## 5. Coordinate run starts and connection changes (65-85%)
Perform slow ping before the final connection-change critical section. Inside shared async coordination, recheck any_running, persist/publish and finish replacing old idle workers. Run registration must use that same coordination for its registration boundary so a new answer cannot slip between the final busy check and replacement. Release it before producing the answer; do not serialize all inference.

Think through warm workers and lock ordering with the pool: no nested-lock deadlock, no blocking threading.Lock across an await, no event-loop lock reused incorrectly across tests. Keep Stop, per-persona isolation and disconnect-independent runs intact. Pure Test is not a settings mutation and remains usable while an answer is running. If a stronger coordinator would require a file outside the closed list, stop and report the exact needed change.

## 6. Fresh verification and report (85-100%)
1. Run new regression files plus `test_ai_model_connection.py`, `test_env_writer.py`, `test_ai_privacy.py`, `test_agent_runs.py` and `test_agent_pool.py`.
2. Run the FULL backend suite once on the final semantic code (baseline 791 plus new cases), then build, audit:design, secret scan and diff --check. Do not guess the count.
3. Scratch browser: valid endpoint/key Test, Save and reload; wrong key/network failure preserves settings; empty response shows failure and normal Save refuses; changed host without key refused; explicit Save without testing remains clearly labeled; restart preserves saved configuration; remove-key success/failure behave correctly.
4. Scratch concurrency: start an answer during the delayed save test and prove 409/no worker cancellation. Prove no answer starts on a worker being replaced. Use controlled synthetic streaming upstream and inspect registry/pool state, not invented UI timers.
5. Capture 1440x900 evidence; check 820/400 overflow and console. Keep fake credentials out of screenshot fields after save. Check real `.env` timestamp before/after; stop your scratch servers and confirm ports free.
6. Write `gemini/reports/T4_summary.md`: Status, files/numstat, failing-first results, final test/build/audit/scan outputs, browser/concurrency proof, timestamps, screenshots, deviations and remaining limits. Report PARTIAL for checks not run; never claim issue-free for every external service.

Ready paste message: "Read gemini/reviews/T_connection_deep_review.md, then gemini/TASK_T4_connection_reliability.md completely. Do only T4, with failing-first regression proofs, preserve the dirty tree and keep the real .env and primary ports untouched. No git writes or sub-agents. Write gemini/reports/T4_summary.md when finished."
