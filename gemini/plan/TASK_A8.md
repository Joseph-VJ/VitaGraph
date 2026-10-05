<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A8 — Settings: offline state with retry, phone-safe rows, and the persona delete action

- **Goal:** Show an offline state with retry when the backend is down, keep rows readable at 360 px, and move the "Delete persona" action here. Task A12 removes the old one from Timeline.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A2
- **Files to read first:**
  - `site design/src/pages/SettingsPage.tsx`
  - `site design/src/api/users.ts`
  - `site design/src/pages/TimelinePage.tsx` lines 287–335 (anchor `const executeDeleteCascade = async () => {`), the delete flow being moved
  - `vitagraph/backend/app/routes/users.py` lines 32–39 (anchor `@router.delete("/{user_id}")`)
  - `vitagraph/backend/app/services/user_service.py` lines 90–118 (anchor `def delete_user(user_id: str) -> dict:`)
- **Files to create or modify:**
  - modify `site design/src/pages/SettingsPage.tsx`

**What to change**
1. **Imports:** `site design/src/pages/SettingsPage.tsx` lines 2–4 (anchor `import { aiApi, type AiConfig, type HealthInfo } from "../api/ai";`). Add imports of `usersApi` from `../api/users`, and `PageFrame` and `PageState` from `../components/ui`.
2. **`NoteRow`:** `site design/src/pages/SettingsPage.tsx` lines 75–90 (anchor `const NoteRow`).
   - The row gap becomes `var(--space-3) var(--space-6)`.
   - The description loses `textAlign: "right"` and gains `overflowWrap: "anywhere"`. Long values such as the user ID filter sentence then wrap on a phone instead of overflowing.
3. **Persona context:** `site design/src/pages/SettingsPage.tsx` line 93 (anchor `const { user } = useActiveUser();`). Also read `setUser` and `refreshUsers`.
4. **New state:** `site design/src/pages/SettingsPage.tsx` lines 97–99 (anchor `const [loadFailed, setLoadFailed] = useState(false);`). Add:
   - a number state `loadTick` (0);
   - a state `deleteStep`, one of `"idle"`, `"confirm"` or `"deleting"`, starting at `"idle"`;
   - a state `deleteError`, a string or null.
5. **Load effect:** `site design/src/pages/SettingsPage.tsx` lines 101–116 (anchor `Promise.all([aiApi.getConfig(), aiApi.getHealth()])`).
   - At the start, set `loadFailed` back to false, and remove the same call from inside the success handler.
   - The dependency list becomes `[loadTick]`, so "Try again" reloads.
6. **New function `deletePersona`:** after `changePrivacy` (`site design/src/pages/SettingsPage.tsx` lines 118–135, anchor `const changePrivacy = async`).
   - When no persona is active, do nothing.
   - Otherwise:
     1. Set `deleteStep` to `"deleting"` and clear `deleteError`.
     2. Call `usersApi.remove(user.id)`, which is `DELETE /api/users/{user_id}`.
     3. On success: call `setUser(null)` (this also forgets the saved ID), set `deleteStep` back to `"idle"`, and await `refreshUsers()`. `refreshUsers` then picks the first remaining persona, or creates a new empty one when none is left (`site design/src/context/UserContext.tsx` lines 27–51, anchor `const refreshUsers = async () => {`).
     4. On failure: store the error message, or "The persona could not be deleted.", in `deleteError`, and set `deleteStep` back to `"confirm"`.
7. **Root and offline state:** `site design/src/pages/SettingsPage.tsx` lines 155–165 (anchor `data-screen-label="Settings"`).
   - The root `div` becomes `PageFrame` with label "Settings", width narrow and gap `"0"`. The section heads keep their own spacing.
   - As the frame's first child, when `loadFailed` is true, render `PageState` kind offline:
     - title "Backend settings are not available";
     - detail "The backend did not answer. Settings stored in this browser still work.";
     - action "Try again", which increments `loadTick`.
8. **Persona section:** after the "Reduce motion" row (`site design/src/pages/SettingsPage.tsx` lines 192–201, anchor `testId="setting-reduce-motion"`), add a `Head` titled "Persona" and one row built like `OptionRow`'s layout, using `rowBox`, `rowTitle` and `rowDesc`, with `data-testid="setting-delete-persona"`.
   - **Title:** "Delete this persona".
   - **Description:** when a persona is active: "Removes <display label> (<id>) and its reports, pages, chunks, vectors, questions, answers, timeline, raw files and AI Agent folder." These are exactly the records that `user_service.delete_user` and the route delete; see open issue O-11 about `ai_calls`. When no persona is active: "No persona is active."
   - **Error:** when `deleteError` is set, show it below the description in a `role="alert"` line coloured `--color-accent-700`, weight 600.
   - **Buttons, when `deleteStep` is `"idle"`:** one `btn btn-secondary` button, "Delete persona", disabled when there is no persona. It sets `deleteStep` to `"confirm"`.
   - **Buttons otherwise:**
     - a `btn btn-primary` button with `data-testid="setting-delete-confirm"`, reading "Yes, delete everything", or "Deleting" while deleting. It is disabled while deleting and calls `deletePersona`.
     - a `btn btn-secondary` "Cancel" button, disabled while deleting, which sets `deleteStep` back to `"idle"`.
   - Close the frame with `</PageFrame>` (the closing tag at `site design/src/pages/SettingsPage.tsx` line 201, anchor `</div>`).
   - Keep these test IDs: `setting-cinematic`, `setting-chunk-size`, `setting-embedding`, `setting-privacy`, `setting-vector-filter`, `setting-reduce-motion`.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Browser on `/settings`, both servers running: all six existing rows show, then the Persona section.
   - Create a throwaway persona first: `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/users -ContentType 'application/json' -Body '{"display_label":"Delete Me"}'`.
   - Select it in the persona picker. On Settings, click "Delete persona", then "Yes, delete everything". The page switches to another persona, and `Invoke-RestMethod http://127.0.0.1:8000/api/users` no longer lists "Delete Me".
   - Never run this check with "Empty Test Persona" or any other persona that holds data.
3. Stop the backend and reload `/settings`. The offline state with "Try again" shows above the rows. Start the backend and click "Try again"; the state disappears.
4. At 360 × 740: no page-level horizontal scroll.

**Acceptance criteria**
- [ ] The offline `PageState` appears only when loading failed, and "Try again" reloads.
- [ ] Deleting a throwaway persona works from Settings, and the deleted persona is gone from `GET /api/users`.
- [ ] All six existing setting test IDs still exist, and the two new ones are spelled exactly `setting-delete-persona` and `setting-delete-confirm`.
- [ ] The build exits 0.
