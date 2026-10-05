<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C4 — Evidence-only answers say so

- **Goal:** When an answer was written without the AI model (`ai_status` is not `ok`), the evidence block says it is quoted report text and does not warn about the AI.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/components/agent/EvidenceModules.tsx`
  - `site design/src/pages/AgentPage.tsx` lines 160–175 (anchor `<EvidenceModules cards={citedCards} openRefs={openRefs} onToggle={toggleRef} />`)
  - `vitagraph/backend/app/services/agent_service.py` lines 369–379 (anchor `ai_status="ok",`)
- **Files to create or modify:**
  - modify `site design/src/components/agent/EvidenceModules.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **New prop:** `site design/src/components/agent/EvidenceModules.tsx` lines 15–20 (anchor `interface EvidenceModulesProps`). Add a required boolean prop `aiUsed`.
2. **Limitations text:** `site design/src/components/agent/EvidenceModules.tsx` lines 25–27 (anchor `The AI Agent can misread a table or a scan`).
   - When `aiUsed` is true, keep the sentence exactly as it is.
   - When false: "Quoted from <n passage(s)> in <m report(s)>. No AI model wrote this answer; it is report text only."
3. **Pass the prop:** `site design/src/pages/AgentPage.tsx` line 168 (anchor `<EvidenceModules cards={citedCards}`). Pass `aiUsed={entry.aiStatus === "ok"}`. The backend sets `ai_status` to `ok` only on the harness path (`agent_service.py`), and to `not_used` on the offline path (`chat_service.py`).

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Turn the AI off: `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/ai/privacy -ContentType 'application/json' -Body '{"allow_api":false}'`.
3. On `/agent` as "Empty Test Persona", ask "What was my vitamin D result?". The answer cites passages, and Limitations reads "… No AI model wrote this answer; it is report text only."
4. Restore the setting you found before step 2. Read it first with `Invoke-RestMethod http://127.0.0.1:8000/api/ai/config`.

**Acceptance criteria**
- [ ] `aiUsed` is required, and `AgentPage` passes it.
- [ ] An evidence-only answer never shows the AI caveat (screenshot).
- [ ] The privacy setting is restored to its earlier value (paste both config reads).
- [ ] The build exits 0.
