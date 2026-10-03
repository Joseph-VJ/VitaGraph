# TASK 04: Upload & Ingest page, exact to the reference (plus one sidebar fix)

Read `gemini/RULES.md` first (section 0 "the reference wins", 3b branch guard, section 6 cheat-sheet). Obey it.

**Reference for this page:** `design/reference/app-v3-source.html` lines 402-456 (markup) and 1293-1316 (frame-stage logic), and the screenshot `design/reference/screens/00_Upload.png`. Open the screenshot and look at it now.

Task 03 was reviewed and accepted. One deviation was found and is fixed in Part A.

## FILES THIS TASK MAY CHANGE (and nothing else)
1. `site design/src/components/shell/Sidebar.tsx` (one line, Part A)
2. `site design/src/components/shell/AppShell.tsx` (one line, Part B)
3. `site design/src/pages/UploadPage.tsx` (rewritten, Part D)
4. `site design/src/components/upload/FrameStage.tsx` (NEW file, Part C; create the folder)
Do not touch `useJobStream.ts`, `CinematicPipelinePopup.tsx`, `api/*`, `motion/*`, `modernist.css`.

---

## STEP 0: branch guard, green start
```
git branch --show-current          # redesign/modernist-app
git log --oneline -3
cd "F:\kiruthika\kiruthika final project\site design"
npm run build                      # exit 0 before you start
```

## PART A: sidebar item height
In the reference every nav item is 48px tall (its items are `<button>`s, which have `line-height: normal`). Ours are `<a>` links that inherit line-height 1.55, so ours are about 53px tall. In `Sidebar.tsx`, in the `style={{ ... }}` object of the nav `<Link>` (the one that has `textDecoration: "none"`, `background: isActive ? ...`), add the property `lineHeight: "normal",`. Change nothing else in that file.

## PART B: AppShell
In `AppShell.tsx` change `const OWN_LAYOUT = new Set<string>([]);` to `const OWN_LAYOUT = new Set<string>(["/upload"]);`. Nothing else.

## PART C: new file `site design/src/components/upload/FrameStage.tsx`
This is the reference's "interactive stage": a canvas that shows an image sequence; moving the pointer left to right, or scrolling the wheel, scrubs through the frames with easing; dropping several image files onto it loads them as the frames. Create the file with exactly this code:

```tsx
import React, { useEffect, useRef, useState } from "react";

interface FrameStageProps {
  /** URL pattern; {n} becomes a 4-digit frame number starting at 0001. */
  framePath?: string;
  frameCount?: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const FrameStage: React.FC<FrameStageProps> = ({
  framePath = "/assets/frames/frame_{n}.jpg",
  frameCount = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = Math.max(2, frameCount);
    const frameUrl = (i: number) => framePath.replace("{n}", String(i + 1).padStart(4, "0"));

    let frames: HTMLImageElement[] | null = null;
    let objectUrls: string[] = [];
    let target = 0;
    let current = 0;
    let dirty = true;
    let raf = 0;
    let disposed = false;

    const paint = () => {
      if (!frames || frames.length === 0) return;
      let j = Math.round(current * (frames.length - 1));
      let im: HTMLImageElement | undefined = frames[j];
      while ((!im || !im.complete || !im.naturalWidth) && j > 0) {
        j -= 1;
        im = frames[j];
      }
      if (!im || !im.naturalWidth) return;
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(rect.width));
      const H = Math.max(1, Math.round(rect.height));
      if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) {
        el.width = Math.round(W * dpr);
        el.height = Math.round(H * dpr);
      }
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      const w = im.naturalWidth * scale;
      const h = im.naturalHeight * scale;
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    };

    const step = () => {
      raf = 0;
      const d = target - current;
      if (Math.abs(d) > 0.0004) {
        current += reduce ? d : d * 0.14;
        paint();
        raf = requestAnimationFrame(step);
      } else if (dirty) {
        dirty = false;
        paint();
      }
    };
    const kick = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target = clamp01((e.clientX - r.left) / r.width);
      kick();
    };
    const onWheel = (e: WheelEvent) => {
      if (!frames) return;
      e.preventDefault();
      target = clamp01(target + e.deltaY * 0.0009);
      kick();
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? [])
        .filter((f) => /^image\//.test(f.type))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (files.length < 2) return;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
      objectUrls = files.map((f) => URL.createObjectURL(f));
      frames = objectUrls.map((u) => {
        const im = new Image();
        im.onload = () => {
          dirty = true;
          kick();
        };
        im.src = u;
        return im;
      });
      setReady(true);
      dirty = true;
      kick();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);

    const ro = new ResizeObserver(() => {
      dirty = true;
      kick();
    });
    ro.observe(el);

    // Probe frame 1; only if it exists, request the rest.
    const first = new Image();
    first.onload = () => {
      if (disposed) return;
      const list: HTMLImageElement[] = [first];
      for (let i = 1; i < count; i += 1) {
        const im = new Image();
        im.onload = () => {
          dirty = true;
          kick();
        };
        im.src = frameUrl(i);
        list.push(im);
      }
      frames = list;
      setReady(true);
      dirty = true;
      kick();
    };
    first.onerror = () => {
      if (disposed) return;
      frames = null;
      setReady(false);
    };
    first.src = frameUrl(0);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      ro.disconnect();
      first.onload = null;
      first.onerror = null;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [framePath, frameCount]);

  return (
    <div
      style={{
        position: "relative", width: "100%", height: "min(74vh,760px)", minHeight: 420,
        background: "var(--color-surface)", border: "2px solid var(--color-divider)", overflow: "hidden",
        backgroundImage:
          "repeating-linear-gradient(45deg,color-mix(in srgb,var(--color-text) 6%,transparent) 0 8px,transparent 8px 20px)",
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive frame stage"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: "ew-resize" }}
      />
      {!ready && (
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, padding: "var(--space-6)", display: "flex",
            flexDirection: "column", gap: "var(--space-1)", pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
            Interactive stage
          </span>
          <span style={{ fontSize: "1rem", fontWeight: 600 }}>
            Frames go in assets/frames. Move or scroll here to scrub through them.
          </span>
        </div>
      )}
      {ready && (
        <div style={{ position: "absolute", right: "var(--space-4)", bottom: "var(--space-4)", pointerEvents: "none" }}>
          <span className="tag tag-neutral" style={{ fontWeight: 800 }}>Move · Scroll</span>
        </div>
      )}
    </div>
  );
};
```
(The "Frames go in assets/frames…" line is the reference's own empty state. Frames are provided later by the project owner into `site design/public/assets/frames/frame_0001.jpg`, `frame_0002.jpg`, … Do not invent or generate frames.)

## PART D: rewrite `UploadPage.tsx`
Keep from the current file, unchanged: the imports `React, useState, useEffect`, `useNavigate`, `CinematicPipelinePopup`, `useToast` (import both from `"../components/gallery"`), `reportsApi`, `useActiveUser`, types `ReportPage, Report`, `transitionNavigate`, `useJobStream`; the state `file, isUploading, isLoadingCohort, isPopupOpen, pages, activeReport, quarantinedFiles`; `const jobStream = useJobStream();`; `handleLoadDemoCohort`; the `loadInitialData` effect; `handleFileSelect`; the effect that reacts to `jobStream.status` (see edits below).

### D1. Edits to the kept logic
- Delete everything about the "success moment": `showSuccessMoment`, `successCanvasRef`, `isT3`, `isT0`, the effect with `ticker.subscribe`, and the `PhotonManager`/`DustManager` calls inside the completion effect.
- In the completion effect keep: `setIsUploading(false)`, loading the pages (`reportsApi.pages(reportId)`) and `setActiveReport(...)`. REMOVE the success toast (`addToast("done", ...)`). Keep the failure branch (quarantine + `addToast("failed", ...)`).
- In `handleFileSelect` and `handleLoadDemoCohort` replace `catch (err: any)` with `catch (err: unknown)` and use `const msg = err instanceof Error ? err.message : String(err);`.
- DELETE `handleTestUploadSamplePdf`, `handleTestUploadCorruptedFile`, `handleTestUploadScannedOcrPdf` and the whole "Direct pipeline ingestion" bar. These were developer shortcuts; the reference has none.
- Delete every import that becomes unused: `Dropzone, QuarantineRow, Badge, Button, UncertainState, governor, isReducedMotion, Odometer, ticker, PhotonManager, DustManager, DetentPress, DrawPath, playDetent, useRef`.

### D2. New derived values and helpers (put above the `return`)
```tsx
  const [dragOver, setDragOver] = useState(false);

  const fmtSize = (bytes: number) =>
    bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

  const nativePagesCount = pages.filter((p) => p.extraction_method === "native").length;
  const ocrPagesCount = pages.filter((p) => p.extraction_method.toLowerCase().includes("ocr")).length;
  const totalChunks = jobStream.finalMetadata?.chunks ?? activeReport?.chunk_count ?? 0;
  const done = jobStream.status === "completed";

  const stepStatus = (stepName: string): "done" | "active" | "pending" =>
    jobStream.steps.find((s) => s.name === stepName)?.status ?? "pending";
  const stepStopped = (stepName: string) => {
    const s = jobStream.steps.find((x) => x.name === stepName);
    return jobStream.status === "error" && s?.status === "pending" && /quarantined|interrupted/.test(s.value);
  };

  const pipeRows: { name: string; out: string; step: string }[] = [
    { name: "Parse digital text", step: "Extracted",
      out: done && pages.length > 0 ? `${pages.length} pages, ${nativePagesCount} with a text layer` : "Reads the text layer of each page" },
    { name: "Read scanned pages (OCR)", step: "Extracted",
      out: done && pages.length > 0 ? (ocrPagesCount > 0 ? `${ocrPagesCount} ${ocrPagesCount === 1 ? "page" : "pages"} read by OCR` : "No scanned pages") : "Scanned pages are read by OCR" },
    { name: "Chunk with provenance", step: "Chunked",
      out: done && totalChunks > 0 ? `${totalChunks} chunks, page and character spans kept` : "Page and character spans are kept" },
    { name: "Embed passages", step: "Embedded",
      out: done && totalChunks > 0 ? `${totalChunks} vectors, 384 dimensions` : "384 dimensions" },
    { name: "Index, scoped to user", step: "Indexed",
      out: done && totalChunks > 0 ? `${totalChunks} upserts where user_id = ${effectiveUserId}` : "Scoped to the active persona" },
  ];

  const tagStyle = (kind: "done" | "running" | "waiting" | "failed"): React.CSSProperties =>
    kind === "done" ? { background: "var(--color-text)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "running" ? { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }
    : kind === "failed" ? { background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontWeight: 800 }
    : { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" };

  const fileIsQuarantined = !!file && quarantinedFiles.some((q) => q.filename === file.name);
  const fileTag: { label: string; kind: "done" | "running" | "waiting" | "failed" } =
    fileIsQuarantined ? { label: "Quarantined", kind: "failed" }
    : done ? { label: "Indexed", kind: "done" }
    : isUploading ? { label: "Ingesting", kind: "running" }
    : { label: "Selected", kind: "waiting" };
```
(`effectiveUserId` already exists in the file.)

### D3. The returned JSX (replace the whole `return`)
Copy this exactly. It is the reference markup (lines 404-455) with real data and handlers.
```tsx
  return (
    <div
      data-screen-label="Upload"
      style={{ maxWidth: 1280, margin: "0 auto", padding: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "flex-start" }}>
        {/* Left column: 320px */}
        <div style={{ flex: "0 0 320px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div
            data-testid="upload-dropzone"
            role="region"
            aria-label="Upload a report"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && !isUploading) handleFileSelect(f);
            }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: "var(--space-3)",
              padding: "var(--space-4) var(--space-6)", minHeight: 0, boxSizing: "border-box",
              border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-divider)"}`,
              background: dragOver ? "var(--color-accent-100)" : "var(--color-surface)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
              style={{ strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <div style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.01em" }}>Drop a PDF here</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <label className="btn btn-primary" style={{ cursor: isUploading ? "not-allowed" : "pointer", opacity: isUploading ? 0.45 : 1 }}>
                Choose file
                <input
                  data-testid="upload-file-input"
                  type="file"
                  accept="application/pdf"
                  disabled={isUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <button className="btn btn-secondary" disabled={isUploading || isLoadingCohort} onClick={handleLoadDemoCohort}>
                {isLoadingCohort ? "Loading demo cohort" : "Load demo cohort"}
              </button>
            </div>
          </div>

          {file && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0", borderTop: "2px solid var(--color-divider)", borderBottom: "2px solid var(--color-divider)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflowWrap: "anywhere", fontSize: "0.9375rem" }}>{file.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>
                  PDF · {fmtSize(file.size)} · scoped to {user?.display_label ?? effectiveUserId}
                </div>
              </div>
              <span className="tag" style={tagStyle(fileTag.kind)}>{fileTag.label}</span>
            </div>
          )}

          {quarantinedFiles.map((q, idx) => (
            <div
              key={`${q.filename}-${idx}`}
              data-testid="upload-quarantine-row"
              style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "var(--space-2) 0", borderTop: "2px solid var(--color-accent)", borderBottom: "1px solid var(--color-divider)" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflowWrap: "anywhere", fontSize: "0.9375rem" }}>{q.filename}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-accent-800)" }}>{q.reason}</div>
              </div>
              <span className="tag" style={tagStyle("failed")}>Quarantined</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: "0.75rem" }}
                onClick={() => setQuarantinedFiles((prev) => prev.filter((_, i) => i !== idx))}
              >
                Dismiss
              </button>
            </div>
          ))}

          <div>
            {pipeRows.map((r, i) => {
              const st = stepStatus(r.step);
              const kind: "done" | "running" | "waiting" | "failed" =
                stepStopped(r.step) ? "failed" : st === "done" ? "done" : st === "active" ? "running" : "waiting";
              const label = kind === "done" ? "Done" : kind === "running" ? "Running" : kind === "failed" ? "Failed" : "Waiting";
              return (
                <div
                  key={r.name}
                  style={{ display: "grid", gridTemplateColumns: "1.75rem minmax(0,1fr) auto", gap: "var(--space-2)", alignItems: "baseline", padding: "var(--space-2) 0", borderTop: "1px solid var(--color-divider)" }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-700)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 800, fontSize: "0.9375rem" }}>{r.name}</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>{r.out}</span>
                  </span>
                  <span className="tag" style={tagStyle(kind)}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: interactive stage */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <FrameStage />
        </div>
      </div>

      {pages.length > 0 && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)", borderBottom: "2px solid var(--color-divider)" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>Pages</div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="btn btn-primary"
                style={{ gap: "var(--space-6)" }}
                onClick={() =>
                  transitionNavigate(navigate, activeReport ? `/ask?report=${encodeURIComponent(activeReport.id)}` : "/ask", { direction: "forward" })
                }
              >
                Ask about this report
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
                  style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </button>
              <button className="btn btn-secondary" onClick={() => transitionNavigate(navigate, "/library", { direction: "forward" })}>
                Open library
              </button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr><th>Page</th><th>Source</th><th>Characters</th><th>Quality</th></tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const native = p.extraction_method === "native";
                return (
                  <tr key={p.page_number}>
                    <td style={{ fontWeight: 800 }}>p.{p.page_number}</td>
                    <td>
                      <span
                        className="tag"
                        style={native
                          ? { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" }
                          : { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }}
                      >
                        {native ? "Native text" : p.extraction_method.toLowerCase().includes("ocr") ? "OCR" : "No text"}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.text_length.toLocaleString("en-US")}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", textTransform: "capitalize" }}>{p.quality}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CinematicPipelinePopup
        isOpen={isPopupOpen}
        filename={file?.name || "Report"}
        jobStream={jobStream}
        userId={user?.id}
        onContinueToAsk={() => {
          setIsPopupOpen(false);
          const rid = jobStream.finalMetadata?.reportId;
          transitionNavigate(navigate, rid ? `/ask?report=${encodeURIComponent(String(rid))}` : "/ask", { direction: "forward" });
        }}
        onClose={() => setIsPopupOpen(false)}
        onContinueToLibrary={() => {
          setIsPopupOpen(false);
          transitionNavigate(navigate, "/library", { direction: "forward" });
        }}
      />
    </div>
  );
```
Add the import `import { FrameStage } from "../components/upload/FrameStage";`. Make sure `React` is imported as a value (the file already does `import React, ...`), because `React.CSSProperties` is used.

---

## VERIFY
1. `cd "F:\kiruthika\kiruthika final project\site design"` then `npm run build`: exit 0.
2. Greps from the project root (paste outputs, all must be empty):
```
grep -n "any\b" "site design/src/pages/UploadPage.tsx" "site design/src/components/upload/FrameStage.tsx"
grep -n "rounded\|Spectral\|var(--ink-\|Quarantined files\|Direct pipeline" "site design/src/pages/UploadPage.tsx"
```
   (The first grep may match the word "any" inside a comment or string; list such hits and say they are text.)
3. Start the backend and frontend: the backend is `cd vitagraph/backend` then `.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000` (do not edit any backend file), the frontend is `npm run dev`. In the browser at 1440x900, open `/upload`:
   a. Screenshot `gemini/shots/task04-upload-empty.png`. Place it next to `design/reference/screens/00_Upload.png`. List every visible difference in the LEFT column, the dropzone, the pipeline list and the stage.
   b. Real upload: choose `site design/public/synthetic_panel_2025-01-15.pdf` with the file input (`data-testid="upload-file-input"`). The cinematic popup opens (kept as is); while it runs, close it with its close button if present, or wait for completion; then screenshot `gemini/shots/task04-upload-done.png`. Report: the five pipeline rows should read Done, the Pages table should list the pages, the file row tag should read Indexed. State the page and chunk counts shown and confirm they equal `GET http://127.0.0.1:8000/api/reports?user_id=<id>` (paste that report's `page_count` and `chunk_count`).
   c. Quarantine: choose a `.txt` file renamed to `bad.pdf` (create `bad.pdf` containing the text `not a pdf` in the scratch folder, NOT in the repo). Screenshot `gemini/shots/task04-upload-quarantine.png`. A quarantine row with the real error and a Dismiss button must appear; Dismiss removes it.
   d. Measure, console on `/upload` at 1440x900, and paste the JSON:
```js
(() => { const g = s => document.querySelector(s); const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
return JSON.stringify({ dropzone: r(g('[data-testid="upload-dropzone"]')), dropBorder: getComputedStyle(g('[data-testid="upload-dropzone"]')).borderStyle, primaryBtn: getComputedStyle(g('label.btn-primary')).backgroundColor, stage: r(g('canvas')?.parentElement), navItem: r(g('aside nav a')), mainPad: getComputedStyle(g('[data-screen-label="Upload"]')).padding }); })()
```
   Expected: dropzone w 320 · borderStyle `dashed` · primaryBtn `rgb(236, 48, 19)` · stage h about 666 (74vh at 900) and w about 780 · navItem h 48 (±1) · mainPad `32px`.
4. Keyboard: Tab to "Choose file" label is not focusable (a label): confirm the file can be chosen with the keyboard by tabbing to the "Load demo cohort" button and that the focus ring is the red 2px outline. If "Choose file" cannot be reached by keyboard, add `tabIndex={0}` and an `onKeyDown` (Enter or Space) on the label that calls `click()` on its input via a ref. Report what you did.

## COMMIT
Stage ONLY the 4 files in the list at the top plus `gemini/shots/task04-*.png`. Message: `feat(redesign): T04 Upload page exact to reference, frame stage, honest pipeline`. Then `git show --stat HEAD`, `git branch --show-current`, `git log --oneline -3`.

## ACCEPTANCE (PASS/FAIL each with evidence)
- A nav item height 48±1.
- Layout matches reference: 320px left column, dashed dropzone, 5 pipeline rows with tags, stage on the right, nothing else on the page when the persona has no report.
- Pipeline rows change only from real job events (no timers); the text never shows a number before the job is completed.
- Pages table shows real pages of the active report and the two buttons navigate (`/ask?report=<id>`, `/library`).
- Quarantine row works with the real backend error.
- No developer test buttons, no "Quick Test Bar", no success toast.
- Build exit 0, branch correct, only listed files in the commit.
