<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C5 — One backend status for every page; Upload and the AI Agent pause while offline

- **Goal:** Share the shell's backend-online flag through a React context, so the Upload and AI Agent pages disable actions that would fail and say why.
- **Tier:** Must
- **Size:** M
- **Review:** light
- **Depends on:** A9, A10
- **Files to read first:**
  - `site design/src/components/shell/AppShell.tsx` lines 36–118 (anchor `const [backendOnline, setBackendOnline] = useState(true);`)
  - `site design/src/pages/UploadPage.tsx`
  - `site design/src/pages/AgentPage.tsx`
- **Files to create or modify:**
  - create `site design/src/context/BackendStatus.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/pages/UploadPage.tsx`
  - modify `site design/src/pages/AgentPage.tsx`

**What to change**
1. **Create `site design/src/context/BackendStatus.tsx`.** It exports:
   - `BackendStatusProvider`, with props `online` (boolean) and `children`;
   - `useBackendStatus()`, which returns `{ online }`.
   
   The default value outside a provider is `{ online: true }`, so the gallery and tests still render. The probe stays in `AppShell`; this file only shares the result.
2. **Provide it:** `site design/src/components/shell/AppShell.tsx` lines 160–176 (anchor `<StatusStrip backendOnline={backendOnline} />`). Wrap `Header`, `main` and `StatusStrip` in `BackendStatusProvider` with `online={backendOnline}`. Keep the existing offline banner and the existing props.
3. **Upload page:**
   - Read `useBackendStatus()`.
   - While offline, disable the "Choose file" label (the same way it is disabled while uploading), the file input and "Load demo cohort". Drops on the dropzone are ignored.
   - Show `PageState` kind offline above the columns: title "Uploads are paused", detail "The backend is offline. Uploading starts again when it is back."
   - It has no action, because the shell re-checks every 8 seconds (`site design/src/components/shell/AppShell.tsx` line 112, anchor `setInterval(probeBackend, 8000)`).
4. **AI Agent page:**
   - Read `useBackendStatus()`. The composer counts as ready only when online.
   - While offline:
     - the placeholder is "The backend is offline. Asking starts again when it is back.";
     - the send button and the suggestion buttons are disabled (`site design/src/pages/AgentPage.tsx` lines 403–487, anchor `disabled={!composerReady}`);
     - an answer that is streaming when the connection drops keeps the hook's own error handling.

**How to verify**
1. `cd "site design"; npm run build`. It must exit 0.
2. Both servers running: open `/upload` and `/agent`, then stop the backend. Within 10 seconds, both pages show the offline message and their actions are disabled.
3. Start the backend. Within 10 seconds, the actions work again without a page reload.

**Acceptance criteria**
- [ ] `useBackendStatus` is used by the Upload and AI Agent pages.
- [ ] No action that needs the backend can be started while it is offline (screenshots of both pages).
- [ ] The pages recover without a reload.
- [ ] The build exits 0.
