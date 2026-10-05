<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D11 — The AI Agent page as a harness

- **Goal:** Wire the conversation list, resume through the URL, the visible thinking, tool-call and result loop, and the run and session statistics into `/agent`. Keep every working behaviour and test ID. The optional tasks D7, D8 and D10 plug into this page later.
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** D6, D9
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx`
  - `site design/src/components/agent/TrajectoryPanel.tsx`
  - `site design/src/components/agent/ConversationList.tsx`
- **Files to create or modify:**
  - modify `site design/src/pages/AgentPage.tsx`
  - modify `site design/src/components/agent/TrajectoryPanel.tsx`

**What to change**
1. **Layout:**
   - At 1024 px and wider, a 280 px conversation column on the left and the existing chat column on the right.
   - Below 1024 px, the list opens as a full-width panel from a "Conversations" button in the page header row.
   - Both keep the `vg-gutter` rules from A10.
2. **Resume through the URL:** `?c=<conversation_id>`.
   - On load, when `c` is present, call `chat.load(userId, c)`.
   - After every `send`, write the hook's `conversationId` to `c` with `replace`, so a reload resumes the same conversation.
   - "New conversation" clears `c` and calls `chat.reset()`.
   - The existing `report` and `q` parameters keep working (`site design/src/pages/AgentPage.tsx` lines 228–236, anchor `// Header search hands a question over as ?q=`).
3. **The visible loop:** `TrajectoryPanel` (`site design/src/components/agent/TrajectoryPanel.tsx` line 139, anchor `export const TrajectoryPanel: React.FC<{ entry: AgentEntry }> = ({ entry }) => {`) already shows status, steps, reasoning and tool cards. Keep it, and add a **run stats line** at its top:
   - the elapsed time (`stats.elapsedMs`);
   - the number of tool calls (`stats.toolCalls`);
   - the input and output tokens (`stats.inputTokens`, `stats.outputTokens`) from the hook's `AgentStats` (`site design/src/hooks/useAgentChat.ts` lines 32–38, anchor `export interface AgentStats {`). They are `null` when the backend sent none.
   
   A count the backend did not send is left out, never shown as 0.
4. **Session totals:** a line above the messages shows the conversation's total answers, tool calls and tokens, summed from the entries' stats. A total is left out when no entry has that number.
5. **Keep:**
   - the B9 "Show in graph" button (when B9 is done);
   - the C4 `aiUsed` evidence text;
   - the C5 offline handling;
   - the A10 states.
   - Keep these test IDs: `agent-page`, `agent-empty`, `agent-composer`, `agent-input`, `agent-trajectory`, `agent-stats`, `agent-modules`.

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0.
2. Browser as "Empty Test Persona", with the AI off (as in C4):
   - Ask "What was my vitamin D result?", then reload. The conversation is restored from `?c=…` and appears in the list.
   - Start a new conversation, then open the first one again from the list.
3. **Needs the AI** (rule 9): with the AI on, ask the same question.
   - The loop shows the tool calls with their arguments and results.
   - The stats line shows the time, the tool calls and the tokens.
   - If the gateway refuses, paste the error frame and write `API blocked`.

**Acceptance criteria**
- [ ] Resume through `?c=` works after a reload.
- [ ] The run stats line and the session totals show only numbers the backend sent.
- [ ] All listed test IDs exist.
- [ ] The build and the audit exit 0.


---

## Code skeleton for this task (Appendix A of the plan)

Only signatures and the one tricky part. If the skeleton and the task description disagree, the task description wins; report the difference.

### A.6 Task D11 — Resume through the URL without double loads, and session totals

```tsx
const c = searchParams.get("c");
const loadedRef = useRef<string | null>(null);

useEffect(() => {                                   // open a stored conversation once
  if (!userId || !c || loadedRef.current === c || c === chat.conversationId) return;
  loadedRef.current = c;
  void chat.load(userId, c);
}, [userId, c]);                                    // chat.load is a stable useCallback

useEffect(() => {                                   // after a send, put the id in the URL
  const id = chat.conversationId;
  if (!id || searchParams.get("c") === id) return;
  loadedRef.current = id;                           // the page already shows it: do not reload
  const next = new URLSearchParams(searchParams);
  next.set("c", id);
  setSearchParams(next, { replace: true });
}, [chat.conversationId]);

function sessionTotals(entries: AgentEntry[]) {
  let toolCalls = 0;
  let input: number | null = null;
  let output: number | null = null;
  for (const e of entries) {
    if (!e.stats) continue;
    toolCalls += e.stats.toolCalls;
    if (e.stats.inputTokens !== null) input = (input ?? 0) + e.stats.inputTokens;
    if (e.stats.outputTokens !== null) output = (output ?? 0) + e.stats.outputTokens;
  }
  return { answers: entries.filter((e) => e.status === "answered").length, toolCalls, input, output };
}
```
