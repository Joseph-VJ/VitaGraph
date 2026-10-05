<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task E5 — Tools check script

- **Goal:** Prove the Tools pages end to end with one re-runnable script, and include them in the layout and accessibility checks.
- **Tier:** Should
- **Size:** S
- **Review:** gate
- **Depends on:** E3
- **Files to read first:**
  - `scripts/plan/check_layout.py`
  - `scripts/plan/check_a11y.py`
- **Files to create or modify:**
  - create `scripts/plan/tools_check.py`

**What to change**
1. **Create `scripts/plan/tools_check.py`** (Playwright, Chrome channel, both servers running). Checks:
   - **PDF to Text:** "Use sample report" gives at least one page whose text contains "Vitamin D".
   - **Scanned hand-off:**
     1. "Use scanned sample" marks at least one page "No text layer".
     2. Its "Read with Image to Text" opens `/tools/image-to-text`.
     3. Capture the `POST /api/tools/ocr` response with `page.on("response")`.
     4. The page's stats equal that response's line count and `mean_confidence`.
     5. The number of "Needs review" rows equals the number of lines below 60.
   - **Text to Graph:**
     - only when `/tools/text-to-graph` exists (E4 done), otherwise print "skipped (task not done)";
     - send the sample's text, and every table row's span slices back to its own text.
   
   End with `RESULT: PASS` or `RESULT: FAIL (...)`.

**How to verify**
1. `$env:PYTHONIOENCODING="utf-8"; python scripts\plan\tools_check.py`. It ends with `RESULT: PASS`.
2. `python scripts\plan\check_layout.py usr_51f14542d71a /tools/image-to-text /tools/pdf-to-text`. Add `/tools/text-to-graph` when E4 is done. It ends with `RESULT: PASS`.
3. `python scripts\plan\check_a11y.py usr_51f14542d71a /tools/image-to-text /tools/pdf-to-text`. Add `/tools/text-to-graph` when E4 is done. It ends with `RESULT: PASS`.

**Acceptance criteria**
- [ ] All three runs print `RESULT: PASS` (outputs pasted).
