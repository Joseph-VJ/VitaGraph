---
name: vita-verify
description: >-
  Runs the VitaGraph verification pipeline: backend pytest (38 tests), frontend
  production build, sample request smoke tests, and captures browser evidence artifacts.
  Use whenever verifying a user story before claiming completion or committing.
---

# VitaGraph Verification Skill (vita-verify)

Follow this strict sequence to verify VitaGraph changes before claiming completion or committing code.

## 1. Backend Verification (pytest)
Run the backend test suite:
```powershell
cd vitagraph/backend
.venv\Scripts\python.exe -m pytest tests -q
```
- **Constraint**: Must be green (38/38 tests passing).
- **Rule**: Never edit backend tests to make them pass.

## 2. Frontend Build Verification
Verify that the frontend builds cleanly without TypeScript or bundler errors:
```powershell
cd "site design"
npm run build
```
- **Constraint**: Must exit 0 with clean bundle generation.

## 3. API Integration Smoke Test (When Backend Is Running)
To verify end-to-end endpoint functionality:
```powershell
pwsh vitagraph/backend/verification/sample_requests.ps1
```

## 4. UI Evidence Capture (Browser)
For all UI-touching stories:
1. Start dev server or preview if not running:
   ```powershell
   cd "site design"
   npm run dev
   ```
2. Open the affected route in the browser.
3. Interact with the newly implemented or updated elements.
4. Capture a screenshot or recording artifact as tangible proof of completion.

## 5. Output Formatting
Include only the tail of the command outputs and the artifact link in the turn report:
- `pytest` result summary
- `npm run build` result summary
- Screenshot/recording artifact link
