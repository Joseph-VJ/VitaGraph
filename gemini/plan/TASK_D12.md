<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D12 — Harness check script

- **Goal:** Add one script that proves the harness features end to end without needing the AI. Optional features are checked only when their task was done.
- **Tier:** Must
- **Size:** M
- **Review:** gate
- **Depends on:** D11
- **Files to read first:**
  - `scripts/plan/e2e_journey.py`
  - `scripts/plan/check_layout.py`
- **Files to create or modify:**
  - create `scripts/plan/agent_harness.py`

**What to change**
1. **Create `scripts/plan/agent_harness.py`** (Playwright, Chrome channel). The setup and the `finally` cleanup follow `e2e_journey.py`:
   - read and restore `allow_api`, setting it to false for the run;
   - create a throwaway persona with consent;
   - upload `synthetic_panel_2025-01-15.pdf` with `POST /api/reports/upload` and the form field `background` set to `false`, so it finishes before the checks start;
   - delete the persona at the end.
   
   **Must checks:**
   1. **Answer and resume:** ask the vitamin D question and wait for `completed`. Reload. The same entry is restored, and `GET /api/agent/conversations?user_id=` lists one conversation with 2 messages.
   2. **List:** the conversation list shows one `agent-conversation-row`. "New conversation" clears the page, and clicking the row restores it.
   3. **Stats:** the run stats line shows an elapsed time.
   
   **Optional checks.** Each runs only when its test ID exists on the page, and otherwise prints "skipped (task not done)":
   - **D7:** each option of `agent-display-mode` changes the number of visible `agent-tool-card` elements.
   - **D8:** `/foo` gives "Unknown command /foo", and no new request is sent to `/api/agent/stream`.
   - **D10:**
     - "Make a report" (HTML) gives an `agent-artifact` with `data-kind="report_html"` whose fetched HTML contains "18" in the vitamin D row and "This is not a diagnosis.";
     - PDF bytes start with `%PDF`;
     - an artifact card's computed `transform` is not `none` on hover, and is `none` after turning on Reduce motion.
   
   End with `RESULT: PASS` or `RESULT: FAIL (...)`.

**How to verify**
1. `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\agent_harness.py`. It ends with `RESULT: PASS` and lists any skipped optional checks.
2. Full backend suite: baseline + 0 (this task adds no backend tests).

**Acceptance criteria**
- [ ] The Must checks pass.
- [ ] Optional checks either pass or say "skipped (task not done)".
- [ ] `RESULT: PASS` (output pasted).
