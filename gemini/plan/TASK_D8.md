<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task D8 — Slash commands and the command menu

- **Goal:** Typing `/` in the composer opens a command menu. Commands run locally and are never sent to the model, and unknown commands are rejected, as in the harness.
- **Tier:** Could
- **Size:** M
- **Review:** light
- **Depends on:** D11
- **Files to read first:**
  - `site design/src/pages/AgentPage.tsx` lines 449–498 (anchor `data-testid="agent-composer"`)
  - `site design/src/api/agent.ts`
- **Files to create or modify:**
  - create `site design/src/components/agent/commands.ts`
  - create `site design/src/components/agent/CommandMenu.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Create `commands.ts`.** It exports:
   - a small registry: `registerCommand({ name, args, description, run })` and `listCommands()`;
   - `parseCommand(text)`, which returns `{ name, arg }` for text starting with `/`, or null. The name is lower-case and the argument is trimmed.
   
   It registers four commands:
   - `/help`: "List the commands."
   - `/new`: "Start a new conversation."
   - `/history`: "Open your past conversations."
   - `/stats`: "Show the statistics of the last answer."
   
   D7 adds `/mode` and D10 adds `/report` through `registerCommand` when they are done.
2. **Create `CommandMenu.tsx`.**
   - **Props:** `query` (the text after `/`), `onPick(name)` and `onClose`.
   - **Rendering:** a listbox (`role="listbox"`, `data-testid="agent-command-menu"`) of the matching commands, positioned above the composer, with `--color-bg`, a 2 px rule and `--shadow-md`.
   - **Keyboard:**
     - Up and Down move the active option (`aria-activedescendant`).
     - Enter or Tab fills the composer with the command name and a space.
     - Escape closes the menu.
3. **Wire it in the page:** in `AgentPage.tsx`, the composer runs `parseCommand` before `submit`.
   - A known command runs locally and adds a local entry marked "Command". Local entries are never sent to the model.
   - An unknown name adds the local entry "Unknown command /x. Type /help for the list."
   - The menu shows while the input starts with `/` and contains no space.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser:
   - `/help` lists the commands, `/new` starts a new conversation, `/history` opens the list, and `/stats` shows the last answer's line.
   - `/foo` answers "Unknown command /foo". No request to `/api/agent/stream` appears in DevTools > Network.

**Acceptance criteria**
- [ ] The four base commands work, and unknown ones are rejected locally.
- [ ] The menu is fully usable with the keyboard.
- [ ] The build exits 0.
