<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D9 — Conversation list (resume)

- **Goal:** Show the persona's past conversations, open one to resume it, and delete one with a confirmation.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** A2, D6
- **Files to read first:**
  - `site design/src/api/agent.ts`
  - `site design/src/components/ui/index.ts`
- **Files to create or modify:**
  - create `site design/src/components/agent/ConversationList.tsx`

**What to change**
1. **Create `ConversationList.tsx`.**
   - **Props:** `userId`, `currentId`, `onOpen(id)`, `onNew()`, `refreshSignal` (a number).
   - **Loading:** call `agentApi.listConversations`, and reload when `refreshSignal` changes.
   - **States:**
     - loading: `PageState` loading "Loading conversations";
     - error: `PageState` error with "Try again";
     - empty: "No conversations yet. Ask a question to start one."
   - **Rows:** each row is a button (`data-testid="agent-conversation-row"`) showing the title, the date of `updated_at` and the message count. The current conversation is marked with a 4 px left rule in `--color-accent`.
   - **Delete:** a small "Delete" button per row asks "Delete this conversation?" with "Delete" and "Cancel", then calls `agentApi.deleteConversation` and reloads.
   - **Wrapper:** a `nav` with `aria-label="Conversations"` and `data-testid="agent-conversations"`. It has a "New conversation" `btn btn-primary` at the top.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.

**Acceptance criteria**
- [ ] The list uses only the D2 routes for listing and deleting conversations.
- [ ] Loading, empty and error states are present.
- [ ] The build exits 0.
