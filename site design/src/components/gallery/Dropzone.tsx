import React, { useState, useEffect, useRef } from "react";
import { Button } from "./Buttons";
import { governor, isReducedMotion } from "../../motion";

interface DropzoneProps {
  onFileSelect?: (file: File) => void;
  file?: File | null;
  isDragOverDemo?: boolean;
  className?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  file,
  isDragOverDemo = false,
  className = "",
}) => {
  const [isWindowDrag, setIsWindowDrag] = useState(false);
  const [isLocalDrag, setIsLocalDrag] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const activeFile = file || droppedFile;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);

  const isT0 = governor.getState().tier === "T0" || isReducedMotion();
  const isDragging = isLocalDrag || isWindowDrag || isDragOverDemo;

  // Window-level drag lifecycle (§M7.2)
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer?.types?.includes("Files")) {
        setIsWindowDrag(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsWindowDrag(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsWindowDrag(false);
    };

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  const handleChoose = () => {
    fileInputRef.current?.click();
  };

  const handleIncomingFile = (file: File) => {
    setDroppedFile(file);
    onFileSelect?.(file);
  };

  return (
    <div
      data-testid="upload-dropzone"
      data-drag-state={isDragging ? "active" : "idle"}
      onDragOver={(e) => {
        e.preventDefault();
        setIsLocalDrag(true);
      }}
      onDragLeave={() => setIsLocalDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsLocalDrag(false);
        setIsWindowDrag(false);
        dragCounterRef.current = 0;
        if (e.dataTransfer.files?.[0]) {
          handleIncomingFile(e.dataTransfer.files[0]);
        }
      }}
      className={`relative rounded-[var(--r-14)] border-2 border-dashed transition-colors duration-[120ms] p-8 flex flex-col items-center justify-center text-center select-none overflow-hidden ${
        isDragging
          ? "border-[var(--verdigris)] bg-[rgba(121,184,166,0.06)]"
          : "border-[var(--line-strong)] bg-[var(--ink-800)]/30 hover:border-[var(--dim)]"
      } ${className}`}
    >
      {/* Dashed border stroke-dashoffset march at 12 px/s (only during active drag, state-bound, §M7.2) */}
      {isDragging && !isT0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-[var(--r-14)]">
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="14"
            fill="none"
            stroke="var(--verdigris)"
            strokeWidth="2"
            strokeDasharray="6 6"
            className="animate-dash-march"
          />
        </svg>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.txt"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleIncomingFile(e.target.files[0]);
          }
        }}
      />

      {/* Hand-drawn style page icon (96px) — lifts -4px on paper spring (§M7.2) */}
      <div
        style={
          isDragging && !isT0
            ? {
                transform: "translateY(-4px)",
                transition: "transform var(--m-base, 240ms) var(--ease-paper, cubic-bezier(0.16, 1, 0.30, 1))",
              }
            : {
                transform: "translateY(0px)",
                transition: "transform var(--m-base, 240ms) var(--ease-paper, cubic-bezier(0.16, 1, 0.30, 1))",
              }
        }
        className="mb-4 text-[var(--dim)]"
      >
        <svg
          className="w-24 h-24 stroke-current"
          viewBox="0 0 96 96"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Paper outline */}
          <rect x="22" y="14" width="52" height="68" rx="6" stroke="currentColor" fill="none" />
          {/* Folded / header lines */}
          <line x1="32" y1="26" x2="64" y2="26" stroke="currentColor" opacity="0.6" />
          <line x1="32" y1="34" x2="64" y2="34" stroke="currentColor" opacity="0.6" />
          <line x1="32" y1="42" x2="52" y2="42" stroke="currentColor" opacity="0.6" />
          {/* Hand-drawn mini graph sketch inside */}
          <circle cx="36" cy="60" r="3" stroke="currentColor" fill="none" />
          <circle cx="50" cy="54" r="3" stroke="currentColor" fill="none" />
          <circle cx="60" cy="62" r="3" stroke="currentColor" fill="none" />
          <line x1="39" y1="59" x2="47" y2="55" stroke="currentColor" opacity="0.7" />
          <line x1="53" y1="55" x2="57" y2="61" stroke="currentColor" opacity="0.7" />
        </svg>
      </div>

      {/* Quote-style hint in regular Spectral 15 (§7.11) */}
      <p className="font-['Spectral'] text-[15px] leading-6 font-normal text-[var(--bone)] mb-4 max-w-md">
        Drop a report PDF. VitaGraph reads it page by page.
      </p>

      {/* Drop file chip landing (§M7.2: scale .96->1 detent, --m-instant) */}
      {activeFile && (
        <div className={`mb-4 px-3 py-1.5 rounded-[var(--r-6)] bg-[var(--ink-700)] border border-[var(--verdigris)] text-[var(--bone)] flex items-center gap-2 type-mono-sm ${!isT0 ? "animate-chip-land" : ""}`}>
          <span className="w-2 h-2 rounded-full bg-[var(--verdigris)]" />
          <span className="truncate max-w-xs">{activeFile.name}</span>
          <span className="text-[var(--dim)]">({(activeFile.size / 1024).toFixed(0)} KB)</span>
        </div>
      )}

      {/* Primary button */}
      <Button variant="primary" className="mb-2" onClick={handleChoose}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 11v6" />
          <path d="M9 14l3-3 3 3" />
        </svg>
        <span>Choose files</span>
      </Button>

      {/* Meta subtext */}
      <span className="type-meta text-[var(--dim)] mb-4">
        or drag and drop here
      </span>

      {/* Footnote — fades to 'Release to ingest.' during drag (§M7.2) */}
      <span className="type-mono-sm text-[var(--faint)] transition-opacity duration-[180ms]">
        {isDragging ? "Release to ingest." : "Supports PDF · Max 50 MB · Encrypted in transit"}
      </span>
    </div>
  );
};
