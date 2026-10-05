<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task B9 — "Show in graph" from an answer

- **Goal:** Under a finished, cited answer on the AI Agent page, a button saves that answer's evidence and opens the graph with it highlighted.
- **Tier:** Should
- **Size:** S
- **Review:** light
- **Depends on:** B8
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx` lines 160–200 (anchor `<EvidenceModules cards={citedCards}`)
  - `site design/src/lib/lastAnswer.ts`
- **Files to create or modify:**
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. Next to the evidence modules of an answered, not withheld entry with at least one cited card (the same condition as at `site design/src/pages/AgentPage.tsx` line 168, anchor `<EvidenceModules cards={citedCards}`), add a `btn btn-secondary` "Show in graph" with `data-testid="agent-show-in-graph"`.
2. On click:
   1. Call `saveLastAnswer` with the persona, the entry's question, and the `chunk_id`s of the cited cards.
   2. Navigate to `/graph?answer=1`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser: ask "What was my vitamin D result?". Click "Show in graph".
   - The graph opens with the evidence nodes highlighted and the line "Highlighting the evidence of: What was my vitamin D result?".
   - Paste the chunk IDs from the answer's evidence next to the highlighted node IDs.

**Acceptance criteria**
- [ ] `agent-show-in-graph` appears only under cited answers.
- [ ] The highlighted nodes come from `POST /api/graph/subgraph` for exactly the cited chunk IDs.
- [ ] The build exits 0.
