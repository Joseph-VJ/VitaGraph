# Model-name field follow-up review (2026-10-12)

The model-name field is wired through validation, Test, Save, persistence and the next agent runtime. **22 controlled checks passed**. No application source or backend tests changed; real settings unchanged.

Confirmed: exact case and allowed punctuation are forwarded to the connection test; Save makes that name effective, writes MODEL_NAME in the scratch file, and closes old workers once. The next runtime receives that exact name, with no process started for this controlled check. Browser field exists, maxLength 100, autocomplete off and spellcheck false.

Names accept 1-100 characters, begin with a letter/digit, and may contain letters, digits, `. _ : / @ + -`. Outside spaces are trimmed. Blank, internal spaces/newlines, semicolon, symbol-first names and 101-character names return 422 without an upstream call, settings mutation or file change. This is syntax validation; the API decides whether the model identifier actually exists and is available to the supplied key.

The existing false-positive ping finding also affects confidence in model availability: an empty HTTP-200 response must not verify an unknown model. T4 must fix that before promising complete model validation. No new model-specific defect was reproduced in these checks.

Proof: `C:/Users/Admin/AppData/Local/Temp/codex-vita-connection-audit-d530b89ec9a443229c0672a8498786d9/model_name_check.py`; results under `model-name/results.json`. All five paths isolated; only synthetic keys/names used.
