<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C6 — End-to-end journey script

- **Goal:** One re-runnable script proves the whole journey: upload, six stages, graph, a cited answer, a refusal, a no-evidence answer and the offline states.
- **Tier:** Must
- **Size:** L
- **Review:** gate
- **Depends on:** C2, C3, C4, C5
- **Files to read first:**
  - `scripts/plan/check_layout.py`
  - `vitagraph/backend/app/routes/ai.py`
  - `vitagraph/backend/app/routes/users.py`
  - `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf` (it prints "Vitamin D, 25-Hydroxy Result: 18 ng/mL"; the 2025-06-20 panel prints 34 ng/mL; neither prints ferritin)
- **Files to create or modify:**
  - create `scripts/plan/e2e_journey.py`

**What to change**
1. **Create `scripts/plan/e2e_journey.py`**, a Python script using Playwright (sync API, Chrome channel) and plain HTTP calls through `urllib.request`. No new packages. Three modes:
   - **Default mode** (both servers running):
     1. Read `GET /api/ai/config` and remember `allow_api`. Then set it to false with `POST /api/ai/privacy` (`{"allow_api": false}`), so the run is deterministic and needs no AI gateway.
     2. Create a throwaway persona: `POST /api/users` with the label "E2E Journey" and `POST /api/users/{id}/consent`. Open the app with that persona ID in localStorage and `vg_booted` set.
     3. On `/upload`, set the file input `upload-file-input` to `vitagraph/sample_data/synthetic_panel_2025-01-15.pdf`.
        - Wait up to 120 s until `ingestion-ask` is visible, or all six `upload-stage-row` rows have `data-state="done"` when the show is off.
        - Check that exactly six stage elements exist, and that none failed.
     4. Read the new report from `GET /api/reports?user_id=<id>`. Check `GET /api/graph/<id>` returns at least one node and one edge.
     5. Open `/agent?report=<report_id>`. Ask "What was my vitamin D result?" and wait for the answer to finish (up to 90 s).
        - The answer text contains "18".
        - At least one citation exists.
        - Limitations contains "No AI model wrote this answer".
     6. Ask "Do I have diabetes? Please diagnose me." The answer is a refusal: the entry's refusal state shows, and no evidence modules are shown.
     7. Ask "What was my ferritin level?". The answer says the reports hold no evidence for it (status `insufficient_evidence`), with no invented number. Check that no digit sequence followed by "ng/mL" appears in that answer.
     8. **Always, in a `finally` block:**
        - restore `allow_api` to the value read in step 1;
        - delete the throwaway persona with `DELETE /api/users/{id}`;
        - print one line per check and end with `RESULT: PASS` or `RESULT: FAIL (<names of failed checks>)`.
   - **`--offline-check` mode** (run with the frontend up and the backend stopped):
     - Open `/upload` and `/agent`.
     - Expect the shell banner text "Backend offline." on both, the upload controls disabled, and the composer disabled.
     - End with the RESULT line.
   - **`--online-check` mode** (run after starting the backend again):
     - Wait up to 15 s.
     - Expect the banner gone and the controls enabled.
     - End with the RESULT line.
   - Exit code 0 only on PASS.

**How to verify**
1. Both servers running, from the repository root: `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\e2e_journey.py`. It must end with `RESULT: PASS`.
2. Stop the backend, then run `python scripts\plan\e2e_journey.py --offline-check`. It ends with `RESULT: PASS`.
3. Start the backend, wait 10 seconds, then run `python scripts\plan\e2e_journey.py --online-check`. It ends with `RESULT: PASS`.
4. `Invoke-RestMethod http://127.0.0.1:8000/api/users` no longer lists "E2E Journey", and `GET /api/ai/config` shows the original `allow_api`.

**Acceptance criteria**
- [ ] All three runs end with `RESULT: PASS` (outputs pasted).
- [ ] The throwaway persona is deleted, and the privacy setting is restored (pasted).
- [ ] The script never uses "Empty Test Persona" or any other existing persona.
