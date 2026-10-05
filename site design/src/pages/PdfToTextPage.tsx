import React, { useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure pdfjs worker the Vite way per specification
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PageData {
  pageNumber: number;
  chars: number;
  hasText: boolean;
  text: string;
  imageUrl: string;
}

export const PdfToTextPage: React.FC = () => {
  const [pdfName, setPdfName] = useState("");
  const [pages, setPages] = useState<PageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Ready");
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processBuffer = useCallback(async (buffer: ArrayBuffer, filename: string) => {
    setIsLoading(true);
    setPdfName(filename);
    setPages([]);
    setStatusMsg(`Reading ${filename}...`);

    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      const count = pdfDoc.numPages;
      const pageList: PageData[] = [];

      for (let i = 1; i <= count; i++) {
        setStatusMsg(`Reading page ${i} of ${count}...`);
        const page = await pdfDoc.getPage(i);

        // 1. Render thumbnail image at scale 0.9
        const viewport = page.getViewport({ scale: 0.9 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Render page to canvas
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (page.render({ canvasContext: ctx, viewport } as any)).promise;
        }
        const imageUrl = canvas.toDataURL("image/png");

        // 2. Extract text layer
        const textContent = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const strings = textContent.items.map((item: any) => item.str || "").filter(Boolean);
        const text = strings.join(" ").replace(/\s{2,}/g, " ").trim();
        const chars = text.length;

        pageList.push({
          pageNumber: i,
          chars,
          hasText: chars > 0,
          text,
          imageUrl,
        });
      }

      setPages(pageList);
      const totalChars = pageList.reduce((acc, p) => acc + p.chars, 0);
      setStatusMsg(`Extracted ${count} pages (${totalChars.toLocaleString("en-US")} characters)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg(`Failed to read PDF: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      if (buf) processBuffer(buf, selectedFile.name);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUseSample = async () => {
    setIsLoading(true);
    setStatusMsg("Loading sample report...");
    try {
      const res = await fetch("/synthetic_panel_2025-01-15.pdf");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      processBuffer(buf, "synthetic_panel_2025-01-15.pdf");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg(`Could not load sample: ${msg}`);
      setIsLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (pages.length === 0) return;
    const allText = pages
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join("\n\n");
    navigator.clipboard.writeText(allText);
    setStatusMsg("Copied all extracted text to clipboard.");
  };

  const handleDownloadMd = () => {
    if (pages.length === 0) return;
    const content =
      `# ${pdfName || "PDF"}\n\n` +
      pages
        .map((p) => `## Page ${p.pageNumber}\n\n${p.text || "(no text layer)"}`)
        .join("\n\n") +
      "\n";
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdf-to-text.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalChars = pages.reduce((acc, p) => acc + p.chars, 0);

  return (
    <div
      data-screen-label="PDF to Text"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <style>{`
        .btn-primary { background: var(--color-accent-700) !important; color: var(--color-bg) !important; }
      `}</style>

      {/* Input bar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !isLoading && f.name.toLowerCase().endsWith(".pdf")) {
            handleFileSelect(f);
          }
        }}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-4) var(--space-6)",
          border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-divider)"}`,
          background: dragOver ? "var(--color-accent-100)" : "var(--color-surface)",
        }}
      >
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-neutral-700)",
            }}
          >
            Input
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 800 }}>Choose a PDF</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            The text layer is read page by page in your browser.
          </div>
        </div>

        <label className="btn btn-primary" style={{ cursor: isLoading ? "not-allowed" : "pointer", gap: "var(--space-6)" }}>
          Choose PDF
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            disabled={isLoading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isLoading}
          onClick={handleUseSample}
        >
          Use sample report
        </button>
      </div>

      {/* Status line */}
      <div style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{statusMsg}</div>

      {/* Stats row with top and bottom 2px rules */}
      {pages.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--space-6)",
            padding: "var(--space-3) 0",
            borderTop: "2px solid var(--color-divider)",
            borderBottom: "2px solid var(--color-divider)",
          }}
        >
          <div style={{ fontWeight: 800, overflowWrap: "anywhere", maxWidth: 340 }}>{pdfName}</div>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {totalChars.toLocaleString("en-US")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>characters</div>
          </div>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {pages.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>pages</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
            <button type="button" className="btn btn-secondary" onClick={handleCopyAll}>
              Copy all
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDownloadMd}>
              Download .md
            </button>
          </div>
        </div>
      )}

      {/* Two columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        {/* Original panel */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", borderTop: "2px solid var(--color-text)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-2) 0 var(--space-3)",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-neutral-700)",
              }}
            >
              Original
            </div>
          </div>
          {pages.length > 0 ? (
            <div
              style={{
                maxHeight: 720,
                overflow: "auto",
                background: "var(--color-surface)",
                padding: "var(--space-2)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              {pages.map((p) => (
                <div key={p.pageNumber}>
                  <img
                    src={p.imageUrl}
                    alt={`p.${p.pageNumber}`}
                    style={{
                      width: "100%",
                      height: "auto",
                      border: "2px solid var(--color-divider)",
                      display: "block",
                    }}
                  />
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      color: "var(--color-neutral-700)",
                      paddingTop: 2,
                    }}
                  >
                    p.{p.pageNumber}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                minHeight: 420,
                background: "var(--color-surface)",
                display: "flex",
                alignItems: "flex-end",
                padding: "var(--space-4)",
                fontSize: "0.9375rem",
                color: "var(--color-neutral-700)",
              }}
            >
              The original pages appear here.
            </div>
          )}
        </div>

        {/* Text panel */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", borderTop: "2px solid var(--color-text)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-2) 0 var(--space-3)",
            }}
          >
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-neutral-700)",
              }}
            >
              Text
            </div>
          </div>
          {pages.length > 0 ? (
            <div
              style={{
                maxHeight: 720,
                overflow: "auto",
                background: "var(--color-surface)",
                padding: "var(--space-2) var(--space-4)",
              }}
            >
              {pages.map((p) => (
                <div
                  key={p.pageNumber}
                  style={{
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--color-divider)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-3)",
                      alignItems: "center",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    <span style={{ fontSize: "1.125rem", fontWeight: 800 }}>p.{p.pageNumber}</span>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--color-neutral-700)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {p.chars.toLocaleString("en-US")} chars
                    </span>
                    <span
                      className="tag"
                      style={
                        p.hasText
                          ? { background: "var(--color-neutral-200)", color: "var(--color-neutral-800)" }
                          : { background: "var(--color-accent)", color: "var(--color-bg)", fontWeight: 800 }
                      }
                    >
                      {p.hasText ? "Native text" : "No text layer"}
                    </span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {p.text || "(no text layer: send this page to Image to Text)"}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                minHeight: 420,
                background: "var(--color-surface)",
                display: "flex",
                alignItems: "flex-end",
                padding: "var(--space-4)",
                fontSize: "0.9375rem",
                color: "var(--color-neutral-700)",
              }}
            >
              The extracted text appears here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
