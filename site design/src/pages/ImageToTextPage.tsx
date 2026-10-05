import React, { useState, useRef, useEffect, useCallback } from "react";
import { BASE_URL } from "../api/client";

interface OcrLine {
  text: string;
  confidence: number;
  box: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

interface OcrResult {
  engine: string;
  width: number;
  height: number;
  elapsed_ms: number;
  mean_confidence: number;
  text: string;
  lines: OcrLine[];
}

export const ImageToTextPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imageBitmap, setImageBitmap] = useState<HTMLImageElement | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Choose an image.");
  const [engineAvailable, setEngineAvailable] = useState<boolean | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check OCR engine status
  const checkStatus = useCallback(() => {
    fetch(`${BASE_URL}/api/tools/ocr/status`)
      .then((res) => res.json())
      .then((data) => {
        setEngineAvailable(Boolean(data.available));
        if (!data.available) {
          setErrorMsg("No OCR engine is installed on this machine (rapidocr-onnxruntime).");
        } else {
          setErrorMsg(null);
        }
      })
      .catch(() => {
        setEngineAvailable(false);
        setErrorMsg("OCR service is unavailable.");
      });
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = imageBitmap.naturalWidth;
    canvas.height = imageBitmap.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageBitmap, 0, 0);

    if (showBoxes && result && result.lines) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "currentColor";
      ctx.lineWidth = Math.max(2, Math.round(canvas.width / 500));
      ctx.strokeStyle = accent;
      ctx.fillStyle = "rgba(201, 42, 42, 0.15)";

      for (const line of result.lines) {
        if (!line.box) continue;
        const x = line.box.x0 * canvas.width;
        const y = line.box.y0 * canvas.height;
        const w = (line.box.x1 - line.box.x0) * canvas.width;
        const h = (line.box.y1 - line.box.y0) * canvas.height;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
    }
  }, [imageBitmap, showBoxes, result]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);
    setResult(null);
    setIsReading(true);
    setStatusMsg(`Reading ${selectedFile.name}...`);

    // Load image into an HTMLImageElement for canvas drawing
    const img = new Image();
    const objectUrl = URL.createObjectURL(selectedFile);
    img.onload = () => {
      setImageBitmap(img);
    };
    img.src = objectUrl;

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${BASE_URL}/api/tools/ocr`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `OCR failed with status ${response.status}`);
      }

      const data: OcrResult = await response.json();
      setResult(data);
      setStatusMsg(`Completed in ${data.elapsed_ms} ms (${data.lines.length} lines recognized)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatusMsg("Recognition failed.");
    } finally {
      setIsReading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    setStatusMsg("Copied to clipboard.");
  };

  const handleDownload = () => {
    if (!result) return;
    const sourceName = file?.name || "image";
    const content = `# Image to text\n\nSource: ${sourceName}\nLines: ${result.lines.length}\nMean confidence: ${result.mean_confidence.toFixed(1)}%\n\n${result.text}\n`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "image-to-text.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const charsCount = result ? result.text.length : 0;

  return (
    <div
      data-screen-label="Image to Text"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >

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
          if (f && !isReading) processFile(f);
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
          <div style={{ fontSize: "1.125rem", fontWeight: 800 }}>Choose an image</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            PNG or JPG. It is read by the OCR engine on this computer and is never stored.
          </div>
        </div>

        <label className="btn btn-primary" style={{ cursor: isReading || engineAvailable === false ? "not-allowed" : "pointer", gap: "var(--space-6)" }}>
          Choose image
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
            accept="image/png,image/jpeg,image/webp"
            disabled={isReading || engineAvailable === false}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Status line */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", fontSize: "0.9375rem", fontWeight: 600 }}>
        <span>{statusMsg}</span>
        {isReading && (
          <span className="tag tag-neutral" style={{ fontWeight: 800 }}>
            Processing
          </span>
        )}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div
          style={{
            background: "var(--color-accent-100)",
            borderTop: "2px solid var(--color-accent)",
            padding: "var(--space-4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: "var(--color-accent-800)" }}>Recognition error</div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-accent-700)" }}>{errorMsg}</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (file) processFile(file);
              else checkStatus();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Stats row with top and bottom 2px rules */}
      {result && (
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
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {result.lines.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>lines read</div>
          </div>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {charsCount.toLocaleString("en-US")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>characters</div>
          </div>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {result.mean_confidence.toFixed(1)}%
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-700)" }}>mean confidence</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
            <button type="button" className="btn btn-secondary" onClick={handleCopy}>
              Copy text
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDownload}>
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
            {result && (
              <button
                type="button"
                onClick={() => setShowBoxes(!showBoxes)}
                className={showBoxes ? "btn btn-primary" : "btn btn-secondary"}
                style={{ fontSize: "0.75rem", padding: "var(--space-1) var(--space-2)" }}
              >
                {showBoxes ? "Hide boxes" : "Show boxes"}
              </button>
            )}
          </div>
          {file && imageBitmap ? (
            <div style={{ background: "var(--color-surface)", padding: "var(--space-2)" }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block" }} />
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
              The original image appears here.
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
          {result ? (
            <div
              style={{
                background: "var(--color-surface)",
                padding: "var(--space-4)",
                minHeight: 420,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  fontSize: "0.9375rem",
                  lineHeight: 1.7,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {result.lines.map((line, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>{line.text}</span>
                    {line.confidence < 70 && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.6875rem",
                          fontWeight: 800,
                          letterSpacing: "0.05em",
                          color: "var(--color-accent-700)",
                          textTransform: "uppercase",
                        }}
                      >
                        needs review
                      </span>
                    )}
                  </div>
                ))}
              </pre>
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
              The recognized text appears here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
