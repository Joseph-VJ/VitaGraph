# AI Agent dark chat (2026-10-12)

Status: **COMPLETE**. Owner requested "make the chat userinterface only darker same like the knowledge graph dark". Direct implementation was authorized for this UI story. No sub-agents, commits or pushes.

## Change
`site design/src/index.css`: scoped dark tokens to `.vg-agent-page`, matching the graph ink background #201e1d, raised surface #2d2b2b, Archivo text #f3f2f2, muted text #bab6b6 and readable red tints. History, composer, menus, dialogs and side-panel chrome inherit this palette. Primary red buttons use black text for contrast. No shared/root token or graph stylesheet was modified.

`site design/src/pages/AgentPage.tsx`: the small AI mark uses the scoped on-accent foreground; loading/no-persona/offline wrapper also receives the chat theme. No API, stream, data, layout, worker or chat logic changed. Reports, chart exports and source-page images retain their document colours.

## Fresh verification
```text
Backend: 791 passed in 496.23s (0:08:16)
Frontend: npm run build exit 0, 400 modules, built in 3.50s
Design audit: Checked 104 files: 0 error(s), 0 pending.
Secret scan: RESULT: PASS
git diff --check: clean
```

Browser: chat background rgb(32,30,29) matches graph ink exactly; root/Library palette remains #f3f2f2. Chart and report helpers fill the composer, Send enables, History toggles/search work, row menu and report picker are dark, panel opens/full screen works, delete confirmation uses the raised ink surface and Escape cancels without deletion. Saved conversations load. Mobile History works, keyboard Tab reaches report scope, and reduced motion keeps the dark UI. No overflow at 1440x900, 820x1100 and 400x900. Simulated network failure shows a dark no-persona view; normal connection restored after interception was removed.

Axe color-contrast checks: **0 violations** in the saved chart conversation, saved report conversation, and 400px History drawer. Normal checks produced no app page errors. Deliberately aborted network requests generated expected browser network logs during the offline-state check. No new model request, upload, chat rename, pin or deletion was performed. Citation links were absent in the sampled saved replies, so no new citation-click claim is made.

Screenshots: `gemini/shots/chat-dark-1440.png`, `chat-dark-820.png`, `chat-dark-400.png`, `chat-dark-conversation.png`, `chat-dark-mobile-history.png`, `chat-dark-offline.png`.

Reference: Knowledge Graph dark stage. Compared with screenshots directly; intentional deviation from old light Agent reference is now DESIGN_LAW item 14. Header, global sidebar/status strip and other pages remain in their existing palette. No new decoration, motion, font, geometry or asset was introduced.

All previous dirty-tree work preserved; branch feature/privacy-shield-and-rag-lab, HEAD c4fca21. No backend source/tests/settings edited. Existing T4 connection-reliability task is still READY, NOT IMPLEMENTED; this colour change does not fix those three defects. No commit, merge or push.
