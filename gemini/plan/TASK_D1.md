<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D1 — Database: conversations, messages and artifacts, and a complete persona delete

- **Goal:** Add tables for agent conversations, their messages and their artifacts. Deleting a persona then removes these rows, and its `ai_calls` rows too.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A8
- **Files to read first:**
  - `vitagraph/backend/app/core/database.py` lines 20–117 (anchor `CREATE INDEX IF NOT EXISTS idx_events_user ON history_events(user_id);`)
  - `vitagraph/backend/app/services/user_service.py` lines 90–118 (anchor `def delete_user(user_id: str) -> dict:`)
  - `site design/src/pages/SettingsPage.tsx`
- **Files to create or modify:**
  - modify `vitagraph/backend/app/core/database.py`
  - modify `vitagraph/backend/app/services/user_service.py`
  - modify `site design/src/pages/SettingsPage.tsx`
  - create `vitagraph/backend/tests/test_agent_store_schema.py`

**What to change**
1. **New tables:** `vitagraph/backend/app/core/database.py` line 116 (anchor `CREATE INDEX IF NOT EXISTS idx_events_user ON history_events(user_id);`). Before the closing `"""` of `SCHEMA`, add three tables and their indexes:
   - **`agent_conversations`:**
     - `id` TEXT PRIMARY KEY;
     - `user_id` TEXT NOT NULL;
     - `title` TEXT;
     - `created_at` TEXT NOT NULL;
     - `updated_at` TEXT NOT NULL.
     
     Index on `user_id`.
   - **`agent_messages`:**
     - `id` TEXT PRIMARY KEY;
     - `conversation_id` TEXT NOT NULL;
     - `user_id` TEXT NOT NULL;
     - `seq` INTEGER NOT NULL;
     - `role` TEXT NOT NULL (`user` or `assistant`);
     - `content` TEXT NOT NULL;
     - `status` TEXT;
     - `ai_status` TEXT;
     - `evidence_json` TEXT;
     - `trajectory_json` TEXT;
     - `stats_json` TEXT;
     - `created_at` TEXT NOT NULL.
     
     A unique index on `(conversation_id, seq)`, and an index on `user_id`.
   - **`agent_artifacts`:**
     - `id` TEXT PRIMARY KEY;
     - `user_id` TEXT NOT NULL;
     - `conversation_id` TEXT;
     - `kind` TEXT NOT NULL (`code`, `report_html` or `report_pdf`);
     - `title` TEXT NOT NULL;
     - `language` TEXT;
     - `content` TEXT (code or HTML);
     - `data` BLOB (PDF bytes);
     - `created_at` TEXT NOT NULL.
     
     An index on `user_id`.
   
   Every statement uses `IF NOT EXISTS`, as the existing ones do, so existing databases upgrade on the next start.
2. **Complete delete:** `vitagraph/backend/app/services/user_service.py` lines 101–115 (anchor `db.execute("DELETE FROM history_events WHERE user_id = ?", (user_id,))`).
   - Before the `DELETE FROM users` line, delete the persona's rows from `agent_artifacts`, `agent_messages`, `agent_conversations` and `ai_calls`.
   - Today `ai_calls` rows survive a persona delete, although the docstring promises "every derived record" (open issue O-11).
   - Update the returned `records` text to also name "agent conversations, artifacts, AI call records".
3. **Settings sentence:** in `site design/src/pages/SettingsPage.tsx`, extend the persona-delete description added in task A8 to: "… raw files, AI Agent folder, AI Agent conversations, artifacts and AI call records."
4. **Tests:** create `vitagraph/backend/tests/test_agent_store_schema.py`.
   - **`test_agent_tables_exist`:** after `init_db()`, `sqlite_master` lists the three tables.
   - **`test_deleting_a_persona_removes_agent_rows_and_ai_calls`:**
     1. Make a persona with `make_user`.
     2. Insert one row into each of the three tables and into `ai_calls` with plain SQL.
     3. Call `user_service.delete_user`.
     4. Count zero rows for that `user_id` in all four tables.

**How to verify**
1. `cd vitagraph\backend; .venv\Scripts\python.exe -m pytest tests\test_agent_store_schema.py -q -p no:cacheprovider`. The output reads `2 passed`.
2. Full suite: baseline + 2 (section 5.1).
3. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] The three tables exist on a fresh and on an existing database.
- [ ] A persona delete leaves no agent rows and no `ai_calls` rows.
- [ ] Full suite: baseline + 2. No existing test was edited.
