<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task F2 — Security hygiene: remove the committed key and add a secret scan

- **Goal:** Remove the API key value committed in two archive files, and add a scan script that fails when a key-like value is committed again. Rotating the key is the owner's job.
- **Tier:** Must
- **Size:** S
- **Review:** gate
- **Depends on:** none
- **Files to read first:**
  - `docs/archive/CODES.md` line 685 (anchor `AI_SERVICE_API_KEY=`)
  - `vitagraph/CODES.md` line 671 (anchor `AI_SERVICE_API_KEY=`)
  - `.gitignore` lines 14–16 (anchor `*.env`)
  
  Read these lines without printing the value. Use `Select-String … | ForEach-Object { $_.LineNumber }`.
- **Files to create or modify:**
  - modify `docs/archive/CODES.md`
  - modify `vitagraph/CODES.md`
  - create `scripts/plan/secret_scan.py`

**Facts found by the planner (values never printed):**
- `docs/archive/CODES.md` line 685 and `vitagraph/CODES.md` line 671 each hold `AI_SERVICE_API_KEY=` followed by a 51-character value starting with `sk-`.
- The other key-like hits in tracked files are placeholders, for example in `vitagraph/backend/.env.example`, or false matches such as "ask-…" and "risk-…".
- `.env` files are ignored by git.

**What to change**
1. **Redact the two lines:** in both files, replace only the value after `AI_SERVICE_API_KEY=` with `<redacted>`. Nothing else in those files changes. Never paste the old value anywhere: not in the report, not in a commit message, not in a terminal echo.
2. **Create `scripts/plan/secret_scan.py`.** It scans every file from `git ls-files`, skipping binary files.
   - **Patterns:**
     - `sk-` followed by 20 or more letters, digits, `_` or `-`, with no letter or digit just before it, so "ask-" and "risk-" never match;
     - a name ending in `API_KEY`, `SECRET`, `TOKEN` or `PASSWORD`, followed by `=` or `:` and a value of 16 or more characters;
     - `-----BEGIN … PRIVATE KEY-----`;
     - `AKIA` followed by 16 capitals or digits.
   - **Placeholders are not findings:** values starting with `<`, `${` or `$env:`, and values containing `replace`, `your`, `example`, `changeme`, `xxx` or `redacted`, ignoring case.
   - **Output:** one line per finding, giving the file, the line, the pattern name, and the value masked as its first 4 characters plus its length. It never prints the full value.
   - **Result:** end with `RESULT: PASS` or `RESULT: FAIL (<n> findings)`, and exit 1 on failure.
3. **The key stays in git history.** Removing it from the files does not remove it from earlier commits. Rewriting history needs a force-push, which rule 1 forbids. So the report must say in capitals that the owner must **rotate the key now**, and that the old key stays readable in the history of `main` and of this branch.

**How to verify**
1. `python scripts\plan\secret_scan.py`. It ends with `RESULT: PASS`.
2. `git diff --stat` lists exactly the two files and the new script.

**Acceptance criteria**
- [ ] The scan passes, and its output contains no full secret value.
- [ ] Only the two value strings changed in the archive files.
- [ ] The report asks the owner to rotate the key.
