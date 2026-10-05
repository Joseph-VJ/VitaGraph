<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D6 — Frontend API for conversations; the chat hook can resume

- **Goal:** Add a typed client for the conversation routes, and extend `useAgentChat` so a stored conversation can be loaded and continued.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** D2
- **Files to read first:**
  - `site design/src/hooks/useAgentChat.ts`
  - `site design/src/api/client.ts`
- **Files to create or modify:**
  - create `site design/src/api/agent.ts`
  - modify `site design/src/hooks/useAgentChat.ts`

**What to change**
1. **Create `site design/src/api/agent.ts`.** It holds the interfaces `ConversationSummary`, `ConversationMessage` and `Conversation`, matching the D2 schemas, and an object `agentApi` with:
   - `listConversations(userId)`, calling `GET /api/agent/conversations?user_id=`;
   - `getConversation(userId, id)`, calling `GET /api/agent/conversations/{conversation_id}?user_id=`;
   - `deleteConversation(userId, id)`, calling `DELETE /api/agent/conversations/{conversation_id}?user_id=`.
   
   Every ID is encoded with `encodeURIComponent`. Task D10 adds the artifact functions to this file when it is done.
2. **Extend `useAgentChat.ts`:**
   - **`load(userId, conversationId)`:**
     - Fetch the conversation and rebuild the entries from its message pairs: the question, the answer, the status, the evidence, the trajectory, the stats and `aiStatus`.
     - Set the hook's conversation ID reference (`site design/src/hooks/useAgentChat.ts` line 152, anchor `const conversationIdRef = useRef<string | null>(null);`) to that ID.
     - Later `send` calls continue it, sending the stored turns as history exactly as live turns are sent today.
   - **`conversationId`:** expose the current ID for the URL.
   - **Unchanged:**
     - `reset()` still starts a new conversation (line 477, anchor `conversationIdRef.current = null;`);
     - the existing fields, events and cleanup stay the same: the `AbortController` is aborted on unmount and on stop.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] Every `agentApi` path matches a D2 route by method and path.
- [ ] `load` restores entries, and the next `send` reuses the loaded conversation ID.
- [ ] The build exits 0.
