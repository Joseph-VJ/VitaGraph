# TASK AG1: the VitaGraph tool server for the AI Agent (MCP over stdio, backend)

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report 5b**, **quality bar 5c**, **5d: API blocked**). Read `gemini/AGENT_PLAN.md` completely and **`gemini/reviews/TASK_AG0b_review.md` completely** (it lists the binding design results; copy numbers from git; answer PARTIAL when evidence is partial; check process ids before attributing a process to your test).

## Why this task exists
The AI Agent runs on the real DeepSeek Harness. The harness must have NO shell and NO file access (proven in AG0/AG0b). Its only tools are VitaGraph's own, supplied by a small MCP server that the harness starts as a child process. This task builds that server. It is plain Python inside the backend, tested with the MCP client library; **no harness and no AI model are involved**, so the blocked AI API does not matter here.

## The security design you must implement (non-negotiable, from the AG0b findings)
1. **The persona comes ONLY from the process environment variable `VITAGRAPH_USER_ID`**, read once at start-up. **No tool has a parameter that names a persona or user** (the model must never be able to choose whose data it reads). The backend that starts the harness sets this variable; here you only read it.
2. If `VITAGRAPH_USER_ID` is missing, empty, or names a persona that does not exist, the server prints ONE line to **stderr**, prints nothing to stdout, and exits with a non-zero code BEFORE serving anything.
3. Every tool argument that is a `report_id` is checked: the report must belong to the persona. Otherwise the tool returns the JSON `{"error": "Report not found for this persona."}` (the same text whether the id does not exist or belongs to someone else, so the model cannot probe other personas).
4. **stdout belongs to the MCP protocol.** Nothing in the server (and nothing it imports at call time, for example the embedding model loader) may write to stdout. Logging goes to stderr. A test must prove the protocol still works after a real search (which loads the embedding model).

## Files you may change (closed list)
1. NEW `vitagraph/backend/app/agent/__init__.py` (empty file with a one-line docstring)
2. NEW `vitagraph/backend/app/agent/mcp_server.py`
3. NEW `vitagraph/backend/tests/test_agent_mcp_server.py`
4. `vitagraph/backend/requirements.txt` : one added line, the pinned `mcp` package
5. NEW `gemini/reports/TASK_AG1_report.md`
Everything else is forbidden, in particular: do not edit any existing file under `vitagraph/backend/app/` (reuse their functions by importing them), do not edit any existing test, do not touch `site design/`, `docs/`, `design/`. Never print or commit `vitagraph/backend/.env` or any key.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Branch must be `redesign/modernist-app`; the suite must end with `103 passed`. If not, STOP and write the report (BLOCKED).

## Step 1: install and pin the MCP package
AG0b used `mcp` **2.3.0**, whose high-level server class is `MCPServer` (older versions called it `FastMCP`). Install exactly that version into the BACKEND virtual environment and pin it:
```
.venv\Scripts\python.exe -m pip install mcp==2.3.0
.venv\Scripts\python.exe -m pip list | Select-String "^mcp "
```
Append the line `mcp==2.3.0` to `requirements.txt` (under the `tenacity` line, with a comment line `# MCP server for the AI Agent (stdio); exact version proven in the harness spikes`). Then run the whole suite again: it must still print `103 passed` (if installing `mcp` changed other packages and a test now fails, STOP and report BLOCKED with the failing test). Read the installed package (`.venv\Lib\site-packages\mcp\`) to find the exact import of the high-level server class, how to register a tool with a decorator, how the tool's docstring becomes its description, and how to run it over stdio. Do not guess; paste the 5 relevant lines you found in the report.

## Step 2: write the tests FIRST
Create `vitagraph/backend/tests/test_agent_mcp_server.py`. Read `tests/conftest.py` first: it sets `DATA_DIR`, `UPLOADS_DIR`, `DB_PATH`, `CHROMA_DIR` in `os.environ` BEFORE the app is imported, so a child process started with `env=dict(os.environ)` plus `VITAGRAPH_USER_ID` sees the SAME temporary database and vector store as the test. Read `tests/test_chat_stream.py` (`_persona_with_report`, `make_user`, `sample_pdf`, `report_service.process_upload`) to see how to create a persona with an ingested report; use the sample files `synthetic_panel_2025-01-15.pdf` (persona A) and `synthetic_panel_2025-06-20.pdf` (persona B).
Use the MCP client library (`from mcp.client.stdio import stdio_client, StdioServerParameters` and `ClientSession`; read the installed package for the exact names in 2.3.0) to start `[sys.executable, "-m", "app.agent.mcp_server"]` with `cwd` = the backend folder. Every test uses `asyncio.run(...)` around a helper `async def call(persona_id, tool, args)` with a generous timeout (180 s; the first search loads the embedding model). Keep the number of server starts small (group assertions) so the new tests add less than 2 minutes to the suite.
The tests (names exactly):
1. `test_the_server_offers_exactly_four_tools_without_any_persona_parameter`: tool names are exactly `get_measurements`, `graph_lookup`, `list_reports`, `search_reports`; each has a non-empty description; NO input property of any tool is named `user_id`, `persona`, `user`, `owner` or `id`.
2. `test_list_reports_returns_only_the_personas_own_reports`: A sees only its `synthetic_panel_2025-01-15.pdf` report, B sees only its `synthetic_panel_2025-06-20.pdf`; each entry has `report_id`, `filename`, `report_date`, `page_count`.
3. `test_search_returns_numbered_evidence_cards_with_exact_character_offsets`: `search_reports` with query `Hemoglobin` returns `evidence` cards with the keys `ref, chunk_id, report_id, report_filename, report_date, page_number, snippet, score, char_start, char_end`; `ref` values start at 1 and are unique; for every card `char_start`/`char_end` are integers and the text stored for that report page (query the `report_pages` table with `app.core.database.get_db`) sliced `[char_start:char_end]` starts with the first 40 characters of `snippet` (after strip); a second identical search returns the SAME `ref` for the same `chunk_id` (numbering is stable per process); a search for a different word may add new refs that continue the numbering.
4. `test_a_persona_can_not_read_another_personas_report`: with the server of persona A, `get_measurements` and `search_reports` (with its `report_id` argument) given persona B's report id both return the exact error JSON of rule 3; and a search without `report_id` returns only evidence whose `report_filename` is A's file.
5. `test_get_measurements_returns_the_values_of_the_report`: for A's report the result contains a measurement named `Hemoglobin` with value `13.8` and unit `g/dL`.
6. `test_graph_lookup_returns_matching_nodes_for_the_persona`: `graph_lookup` with `Hemoglobin` returns `matched_nodes` of at least 1.
7. `test_the_server_refuses_to_start_without_a_valid_persona`: run the module with `subprocess.run` (timeout 120) three times: variable missing, variable empty, variable `usr_does_not_exist`; each returns a non-zero code, `stdout` is empty, `stderr` is not empty.
8. `test_the_protocol_survives_the_embedding_model_load`: covered if tests 3 to 5 pass; add an explicit assertion in test 3 that the first call after start-up succeeded (no protocol error) and name that in a comment.
Run only this file now: `.venv\Scripts\python.exe -m pytest tests/test_agent_mcp_server.py -q -p no:cacheprovider`. Expected: all tests FAIL or error because `app.agent.mcp_server` does not exist. Paste the last 12 lines.

## Step 3: implement `app/agent/mcp_server.py`
Behavior, not code (you write the code, matching the surrounding style: type hints, small functions, docstrings):
- Module docstring explaining the security design in 5 lines.
- `_persona() -> str`: read and validate `VITAGRAPH_USER_ID` (rules 1 and 2); use `app.services.user_service.user_exists` or the equivalent function already used by the routes (read `app/services/user_service.py`; it may raise `HTTPException`; catch everything and exit with code 2 and a stderr line).
- Import the heavy modules lazily INSIDE the tool functions or at the top, but make sure a missing persona exits quickly (before loading the embedding model).
- `class _EvidenceRefs`: keeps `dict[chunk_id, card]` and a counter; `add(hit) -> card` assigns `ref = len(cards) + 1` the first time a `chunk_id` is seen and returns the same card afterwards. Build each card exactly like `_EvidenceBook.add` in `app/services/chat_service.py` (read it: it looks up `char_start/char_end/page_number` in the `report_chunks` table when the hit metadata lacks them; snippet cut at 600 characters; score rounded to 3 decimals). Do NOT import or edit `chat_service`; copy the small amount of logic.
- Tool `list_reports()`: returns JSON text `{"reports": [{"report_id", "filename", "report_date", "page_count"}]}` for the persona (reuse `app.services.report_service` listing function the `/api/reports` route uses; read `app/routes/reports.py`).
- Tool `search_reports(query: str, top_k: int = 5, report_id: str = "")`: `top_k` is clamped to 1..8; empty `query` returns `{"error": "query is required"}`; a non-empty `report_id` must pass the ownership check (rule 3); uses `app.rag.retriever.retrieve(user_id=persona, question=query, top_k=top_k, report_id=report_id or None)`; returns `{"evidence": [cards...]}`; retrieval errors become `{"error": "Report search failed: ..."}`.
- Tool `get_measurements(report_id: str)`: ownership check, then the same function the route `GET /api/reports/{report_id}/measurements` uses (read `app/routes/reports.py` and `app/services/measurement_service.py`); returns `{"report_id": ..., "measurements": [...]}` with the fields the service already returns.
- Tool `graph_lookup(concept: str)`: calls `app.services.llm_service.execute_tool("query_networkx_graph", {"concept": concept}, user_id=persona)` and returns its dictionary as JSON.
- Every tool returns a **string of JSON** (`json.dumps(..., ensure_ascii=False)`), at most 12,000 characters (if longer, drop trailing list items and add `"truncated": true`).
- Each tool function has a docstring of 2 to 4 plain sentences written FOR THE MODEL: what it does, what it returns, when to use it (for example "Use this first to find which reports exist and their ids", "Quote values only from the evidence returned; cite the reference number in square brackets"). These docstrings are the tool descriptions the model reads.
- `main()` starts the stdio server; `if __name__ == "__main__": main()` so that `python -m app.agent.mcp_server` works.

## Step 4: verify
1. `.venv\Scripts\python.exe -m pytest tests/test_agent_mcp_server.py -q -p no:cacheprovider` : all pass (paste the last lines and the duration).
2. Full suite: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` : `103` old tests + your new tests, all passed. Paste the last line. If an existing test fails, do NOT edit it: STOP and report BLOCKED.
3. **Live check against the real development data (read only).** Start the backend (`.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, background; wait 12 s). Save a script as `$env:TEMP\mcp_live_ag1.py` (NOT in the repo) that, with the MCP client library, starts the server with `cwd` = the backend folder and `env = dict(os.environ) + VITAGRAPH_USER_ID = "usr_d1d7f9b2a4b1"` (do NOT set DATA_DIR/DB_PATH: it must read the real development database), then calls `list_reports`, `get_measurements` for the FIRST report, `search_reports("hemoglobin")`, `graph_lookup("Hemoglobin")`, prints the first 300 characters of each answer, and the number of evidence cards. Then compare at least THREE values with the API: `Invoke-RestMethod http://127.0.0.1:8000/api/reports/<report_id>/measurements` (test name, value, unit) and paste both sides. Then call `get_measurements` with the report id of ANOTHER persona (list `Invoke-RestMethod "http://127.0.0.1:8000/api/reports?user_id=usr_85e48cddd9f7"` for an id) and paste the answer (must be the exact error JSON). Delete the script, stop the backend (`Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`) and confirm no `python` process of the server remains (check ids and command lines before attributing a process).
4. `git status --short vitagraph` lists only: `requirements.txt` (modified), `app/agent/` (new), `tests/test_agent_mcp_server.py` (new).
5. Confirm `vitagraph\backend\.env` is untouched (same last-write time as before the task; read it at Step 0 with `(Get-Item vitagraph\backend\.env).LastWriteTime`).

## Step 5: work report
`gemini/reports/TASK_AG1_report.md`, nine headings (RULES 5b). Section 3 line counts come from `git diff --stat`. Section 6 must list: every difference between the MCP 2.3.0 API and what the task text assumed; the time the new tests add; anything in the live output that looks wrong; and a table "Security rule | Where enforced | Test that proves it" for rules 1 to 4.

## COMMIT
```
git add vitagraph/backend/app/agent/__init__.py vitagraph/backend/app/agent/mcp_server.py vitagraph/backend/tests/test_agent_mcp_server.py vitagraph/backend/requirements.txt gemini/reports/TASK_AG1_report.md
git commit -m "feat(agent): VitaGraph MCP tool server (persona from environment, four tools)"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list exactly those five files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- All new tests failed before the implementation and pass after; full suite green with the old 103 tests unchanged.
- Rule 1: no tool has a persona or user parameter (test 1). Rule 2: three failing starts (test 7). Rule 3: cross-persona error (test 4 and the live check). Rule 4: protocol intact after the embedding model loaded (tests 3 to 5).
- Live check: values equal the API (three compared); other persona's report id gives the error JSON.
- `mcp==2.3.0` pinned; `.env` untouched; servers stopped; only the five files committed; branch correct.
