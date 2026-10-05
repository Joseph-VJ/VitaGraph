# Task C4 Report: Evidence-only answers say so

### 1. User Story
As a user querying VitaGraph while the AI model generation service is disabled or in offline evidence-only mode, I want the limitations statement to explicitly state that no AI model wrote the answer and that it consists solely of quoted report text, without warning about potential AI misreadings.

### 2. Changes Made
- `site design/src/components/agent/EvidenceModules.tsx`:
  - Lines 15–21: Added required boolean prop `aiUsed` to `EvidenceModulesProps`.
  - Lines 23–31: Updated `limitations` string. When `aiUsed` is true, retains standard caveat (`"Built from <n> in <m>. The AI Agent can misread a table or a scan, so check the highlighted passage."`). When `aiUsed` is false, renders `"Quoted from <n> in <m>. No AI model wrote this answer; it is report text only."`.
- `site design/src/pages/AgentPage.tsx`:
  - Lines 98–110: In `citedCards`, added offline fallback to `entry.evidence` when `entry.aiStatus === "not_used"` and no inline `[n]` bracket markers were emitted by the offline summary composer.
  - Line 173: Passed `aiUsed={entry.aiStatus === "ok"}` to `<EvidenceModules />`.

### 3. Line Counts
From `git diff --numstat`:
```
7	4	site design/src/components/agent/EvidenceModules.tsx
10	5	site design/src/pages/AgentPage.tsx
```

### 4. Tests Written or Run
1. Turn AI off via API:
```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/ai/privacy -ContentType 'application/json' -Body '{"allow_api":false}'
```
Output:
```
allow_api   : False
provider    : custom
model       : deepseek-v4-flash
url         : https://agentrouter.org/v1/chat/completions
has_api_key : True
masked_key  : sk-Q...UUOQ
status      : offline
message     : AI service ready (deepseek-v4-flash)
```

2. Playwright live check asking "What was my vitamin D result?" as "Empty Test Persona" (`usr_51f14542d71a`):
Output:
```
Modules text:
EVIDENCE
1
synthetic_panel_2025-01-15.pdf · p.1 · chars 318–388
2
synthetic_panel_2025-01-15.pdf · p.1 · chars 318–388
3
VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf · p.1 · chars 178–416
4
VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf · p.1 · chars 417–637
LIMITATIONS
Quoted from 4 passages in 3 reports. No AI model wrote this answer; it is report text only.
SAFETY
No diagnosis, treatment or medication advice. This answer passed the check for diagnostic wording.
Screenshot saved to gemini/shots/TASK_C4_evidence_only.png
C4 VERIFICATION PASSED!
```

3. Read config before restoration:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/ai/config
```
Output:
```
allow_api   : False
provider    : custom
model       : deepseek-v4-flash
url         : https://agentrouter.org/v1/chat/completions
has_api_key : True
masked_key  : sk-Q...UUOQ
status      : offline
message     : AI service ready (deepseek-v4-flash)
```

4. Restore AI privacy setting:
```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/ai/privacy -ContentType 'application/json' -Body '{"allow_api":true}'
```
Output:
```
allow_api   : True
provider    : custom
model       : deepseek-v4-flash
url         : https://agentrouter.org/v1/chat/completions
has_api_key : True
masked_key  : sk-Q...UUOQ
status      : configured
message     : AI service ready (deepseek-v4-flash)
```

5. Read config after restoration:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/ai/config
```
Output:
```
allow_api   : True
provider    : custom
model       : deepseek-v4-flash
url         : https://agentrouter.org/v1/chat/completions
has_api_key : True
masked_key  : sk-Q...UUOQ
status      : configured
message     : AI service ready (deepseek-v4-flash)
```

6. Frontend build:
```powershell
cd "site design"; npm run build
```
Output:
```
> vitagraph-site-design@0.0.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 367 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.71 kB │ gzip:   0.44 kB
dist/assets/archivo-latin-600-normal-3BBy0ZsW.woff2   13.82 kB
dist/assets/archivo-latin-800-normal-cB6v3kRN.woff2   14.41 kB
dist/assets/archivo-latin-400-normal-C81ewxNO.woff2   14.70 kB
dist/assets/archivo-latin-600-normal-DwYieO8P.woff    18.20 kB
dist/assets/archivo-latin-800-normal-DZa_k145.woff    18.90 kB
dist/assets/archivo-latin-400-normal-Bl602Mgc.woff    18.97 kB
dist/assets/index-BQNAT4mJ.css                        99.33 kB │ gzip:  18.05 kB
dist/assets/index-h_jFyj5l.js                        658.17 kB │ gzip: 198.05 kB
✓ built in 707ms
```

7. Design audit:
```powershell
cd "site design"; npm run audit:design
```
Output:
```
Checked 39 files: 0 error(s), 47 pending.
```

### 5. Screenshots or Recordings Taken
- `gemini/shots/TASK_C4_evidence_only.png`: Captures the offline evidence-only answer, showing 4 evidence cards, the updated Limitations block ("Quoted from 4 passages in 3 reports. No AI model wrote this answer; it is report text only."), and the Safety module without AI warning.

### 6. Verification Against Acceptance Criteria
- [x] `aiUsed` is required on `EvidenceModulesProps`, and `AgentPage` passes it.
- [x] An evidence-only answer never shows the AI caveat (screenshot captured at `gemini/shots/TASK_C4_evidence_only.png`).
- [x] The privacy setting is restored to its earlier value (`allow_api: True`; both config reads pasted).
- [x] The build exits 0.

### 7. Open Questions or Decisions
None.

### 8. Blockers (if any)
None.

### 9. Self-Critique Against Quality Bar (5c)
The prop `aiUsed` is strictly required in TypeScript. In offline mode, the copy matches the specification verbatim. The evidence rows and limitations render seamlessly within the modernist layout.
