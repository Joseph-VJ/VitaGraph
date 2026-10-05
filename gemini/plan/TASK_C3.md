<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task C3 — The ingestion show: a full-screen live view built only from real events

- **Goal:** Replace the old `CinematicPipelinePopup` on the Upload page with a Modernist full-screen view. It shows the six stages and the real payload of each stage as it arrives, and ends with "Ask about this report".
- **Tier:** Must
- **Size:** L · hard
- **Review:** gate
- **Depends on:** C2
- **Files to read first:**
  - `site design/src/components/gallery/CinematicPipelinePopup.tsx` lines 26–80 (anchor `export const CinematicPipelinePopup: React.FC<CinematicPipelinePopupProps>`)
  - `site design/src/components/upload/stages.ts`
  - `site design/src/pages/UploadPage.tsx`
  - `vitagraph/backend/app/services/report_service.py` lines 91–109 (anchor `event_type="page_extracted",`)
- **Files to create or modify:**
  - create `site design/src/components/upload/IngestionShow.tsx`
  - modify `site design/src/pages/UploadPage.tsx`
  - modify `site design/scripts/audit-design.mjs`

**What to change**
1. **Create `site design/src/components/upload/IngestionShow.tsx`**, exporting `IngestionShow`.
   - **Props:**
     - `isOpen`;
     - `filename`;
     - `jobStream` (the hook's return type);
     - `onClose`;
     - `onAsk` (receives the report ID);
     - `onOpenLibrary`.
   - **Rendering:** render nothing when it is closed. When open, render into `document.body` through a portal:
     - a fixed full-screen `div` with `role="dialog"`, `aria-modal="true"` and `aria-labelledby` pointing at its heading;
     - `data-testid="ingestion-show"`;
     - background `--color-bg` and text `--color-text`.
   - **Header row:**
     - the kicker "Ingesting";
     - the filename as an `h2` (1.5rem, weight 800, long names allowed to break);
     - on the right, a `btn btn-ghost` "Close" button.
   - **Body:** two columns that stack below 820 px.
     - **Left column:** the six `STAGES` as a numbered list. Each item has `data-testid="ingestion-stage-<n>"` (n from 1 to 6), `data-state` set to the stage state, the name, the `what` sentence or the real output (as in C2), and a `Tag`. The running stage gets a 4 px left rule in `--color-accent`.
     - **Right column:** a "Live" panel showing the payload of the latest real event only:
       - **while extracting:** for each `page_extracted` event received so far, a row with the page number, the method, the character count and a `Tag` for the quality ("Uncertain" in the uncertain tone when it is `uncertain`), plus the newest page's `text_preview` (up to 240 characters, pre-wrapped);
       - **chunked:** the first passages from `metadata.chunks` (page, character span, preview);
       - **embedded:** the vector count and dimension. When `samples` exist, the first sample's values are shown as a row of numbers with three decimals, labelled "First 8 of <dim> values";
       - **indexed:** the indexed count and the collection total, when the metadata has them;
       - **graphed:** the node and edge counts, and up to 12 node labels from `metadata.nodes`.
       
       Nothing is drawn for a stage until its event has arrived.
   - **Failure:** when the stream status is `error`, a `PageState` kind error with the title "Ingestion stopped" and the stream's real `error` text as detail. There is no fixed sentence.
   - **Completion:** when the stream is completed, a footer row with:
     - a `btn btn-primary` "Ask about this report" (`data-testid="ingestion-ask"`), which calls `onAsk(reportId)`;
     - a `btn btn-secondary` "Open library", which calls `onOpenLibrary`.
   - **Behaviour:**
     - Escape calls `onClose`.
     - On open, focus moves to the dialog heading. On close, focus returns to the element that had it before.
     - Remove the keydown listener on close and on unmount.
     - No animation runs while Reduce motion is on (`usePreferences().reduceMotion`) or while the user's system prefers reduced motion.
     - Only design tokens are used: no hex, no radius, no blur.
2. **Swap the popup:** in `site design/src/pages/UploadPage.tsx`, replace the `CinematicPipelinePopup` import (task A9) and its element (`site design/src/pages/UploadPage.tsx` lines 379–394, anchor `<CinematicPipelinePopup`) with `IngestionShow`. Give it:
   - `isOpen` from the same state;
   - `filename` from the selected file, or "Report";
   - `onAsk` navigating to `/agent?report=<id>` with the existing `transitionNavigate` call;
   - `onOpenLibrary` navigating to `/library`;
   - `onClose`, which closes it.
3. **Audit:** in `site design/scripts/audit-design.mjs`, remove `components/gallery/CinematicPipelinePopup.tsx` from the PENDING list. The shipping app no longer imports it; it stays only for the development gallery (`site design/src/pages/GalleryPage.tsx`).

**How to verify**
1. `cd "site design"; npm run build; npm run audit:design`. Both must exit 0. The audit's pending lines now name only `pages/KnowledgeGraphPage.tsx`.
2. Browser, with Cinematic ingestion on: upload `VitaGraph-Report4-Scanned-OCR-Test-2024-12-01.pdf`.
   - The show lists six stages, and page rows appear while extracting.
   - A page whose quality is `uncertain` in `GET /api/reports/<id>/pages` shows "Uncertain".
   - After Graphed, "Ask about this report" opens `/agent?report=<id>`.
3. Upload `bad.pdf` (a text file). "Ingestion stopped" shows the backend's own message.
4. Press Escape. The show closes and focus returns to "Choose file".

**Acceptance criteria**
- [ ] `ingestion-show`, `ingestion-stage-1` to `ingestion-stage-6` and `ingestion-ask` exist.
- [ ] Every number and text in the Live panel comes from an event (no fixed section names, no fixed failure sentence).
- [ ] The audit exits 0, with only the graph page pending.
- [ ] The build exits 0.


---

## Code skeleton for this task (Appendix A of the plan)

Only signatures and the one tricky part. If the skeleton and the task description disagree, the task description wins; report the difference.

### A.2 Task C3 — Ingestion show: portal, focus and the live payload

```tsx
export interface IngestionShowProps {
  isOpen: boolean;
  filename: string;
  jobStream: UseJobStreamReturn;
  onClose: () => void;
  onAsk: (reportId: string) => void;
  onOpenLibrary: () => void;
}

export const IngestionShow: React.FC<IngestionShowProps> = ({ isOpen, onClose, jobStream, ...rest }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const returnTo = document.activeElement as HTMLElement | null;   // focus goes back here on close
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const pages = jobStream.events.filter((e) => e.stage === "extracting");     // page_extracted events
  const latest = jobStream.events[jobStream.events.length - 1] ?? null;       // decides which live panel shows
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="ingestion-title" data-testid="ingestion-show">
      <h2 id="ingestion-title" ref={headingRef} tabIndex={-1}>{rest.filename}</h2>
      {/* six STAGES rows (ingestion-stage-1..6) | live panel built only from `latest` and `pages` */}
    </div>,
    document.body
  );
};
```
