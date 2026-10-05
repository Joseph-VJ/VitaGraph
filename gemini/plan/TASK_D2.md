<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D2 — Conversation store and routes (session resume)

- **Goal:** Every finished agent turn is stored as a user message and an assistant message, with its evidence, trajectory and stats. Three routes list, open and delete a persona's conversations.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** D1
- **Files to read first:**
  - `vitagraph/backend/app/services/agent_service.py` lines 78–135 (anchor `def _persist_turn(`) and lines 136–395 (anchor `async def stream_agent(`)
  - `vitagraph/backend/app/routes/agent.py`
  - `vitagraph/backend/app/schemas/agent.py`
  - `vitagraph/backend/tests/test_agent_service.py` lines 18–90 (anchor `def _collect(user_id, turns, *, pool, conversation_id=None, report_id=None):`)
- **Files to create or modify:**
  - create `vitagraph/backend/app/services/conversation_service.py`
  - modify `vitagraph/backend/app/services/agent_service.py`
  - modify `vitagraph/backend/app/schemas/agent.py`
  - modify `vitagraph/backend/app/routes/agent.py`
  - create `vitagraph/backend/tests/test_agent_conversations.py`

**What to change**
1. **Create `conversation_service.py`**, with these functions:
   - **`record_turn(user_id, conversation_id, question, final, trajectory, stats)`:**
     - Create the conversation row if it is missing. Its title is `final["session_title"]` when present, else the first 80 characters of the question.
     - Append two messages with the next `seq` numbers:
       - the user message with the question;
       - the assistant message with `summary_text`, `status`, `ai_status`, the evidence list, the trajectory and the stats, the last three as JSON text.
     - Update `updated_at`.
     - It never raises. Errors are logged, as `_persist_turn` does.
   - **`list_conversations(user_id)`:** each conversation's `id`, `title`, `updated_at` and message count, newest first.
   - **`get_conversation(user_id, conversation_id)`:** the conversation with its messages in `seq` order and the JSON fields decoded. It raises `HTTPException(404)` when the conversation does not exist **or belongs to another persona**.
   - **`delete_conversation(user_id, conversation_id)`:** deletes the conversation, its messages and its artifacts, with the same 404 rule.
2. **`_TurnRecorder`:** in `agent_service.py`, add a small class that only **observes** events. It collects `thinking`, `tool_call` and `tool_result` items into a trajectory list (tool results trimmed to 4,000 characters of JSON each) and keeps the last `stats` payload.
   - In `stream_agent`, every event that is yielded is also passed to the recorder, at the mapper loop (`vitagraph/backend/app/services/agent_service.py` line 278, anchor `for ev in mapper.feed(msg):`) and wherever stats are yielded.
   - The yielded events, their order and their payloads stay exactly the same. The existing tests pin the order, for example `["text_delta","completed","done"]` for refusals.
3. **Store the turn:** `_persist_turn` (lines 78–135, anchor `def _persist_turn(`) gets two keyword-only parameters, `trajectory=None` and `stats=None`.
   - After `question_service._persist(...)` succeeds, it calls `conversation_service.record_turn(user_id, conversation_id, question, final, trajectory or [], stats or {})`.
   - All four existing call sites keep working unchanged. The harness path passes the recorder's data.
4. **Schemas:** in `vitagraph/backend/app/schemas/agent.py`, add:
   - `ConversationSummaryOut`: `id`, `title`, `updated_at`, `message_count`;
   - `ConversationMessageOut`: `seq`, `role`, `content`, `status`, `ai_status`, `evidence` (list), `trajectory` (list), `stats` (dict), `created_at`;
   - `ConversationOut`: `id`, `title`, `messages`.
5. **Routes** in `vitagraph/backend/app/routes/agent.py`, after `agent_stream` (lines 69–80, anchor `async def agent_stream(`). Each takes a `user_id` query parameter and calls `user_service.user_exists` first.
   - `GET /api/agent/conversations` returns a list of `ConversationSummaryOut`.
   - `GET /api/agent/conversations/{conversation_id}` returns `ConversationOut`.
   - `DELETE /api/agent/conversations/{conversation_id}` returns `{"deleted": <id>}`.
6. **Tests:** create `vitagraph/backend/tests/test_agent_conversations.py`. Import `FakePool` and `_collect` from `tests.test_agent_service`; the existing file is imported, never edited. Use the refusal path, which needs no AI ("Do I have diabetes? Please diagnose me."), with `conversation_id="conv_test1"`.
   - **`test_a_refused_turn_is_stored_and_listed`:** the list route shows `conv_test1` with 2 messages, and the get route returns the question and the refusal text.
   - **`test_another_persona_cannot_open_the_conversation`:** a get with a second persona's `user_id` returns 404.
   - **`test_deleting_a_conversation_removes_it`:** delete returns 200, and a following get returns 404.

**How to verify**
1. `.venv\Scripts\python.exe -m pytest tests\test_agent_conversations.py tests\test_agent_service.py -q -p no:cacheprovider`. Both files pass. The second one proves the event order did not change.
2. Full suite: baseline + 3.

**Acceptance criteria**
- [ ] The three routes exist with exactly these methods and paths, and a foreign persona gets 404.
- [ ] `tests/test_agent_service.py` passes unchanged.
- [ ] Full suite: baseline + 3.
