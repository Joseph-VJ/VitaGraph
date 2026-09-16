import React, { useState, useRef } from "react";
import { Button } from "./Buttons";

interface DropzoneProps {
  onFileSelect?: (file: File) => void;
  isDragOverDemo?: boolean;
  className?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  isDragOverDemo = false,
  className = "",
}) => {
  const [isDragOver, setIsDragOver] = useState(isDragOverDemo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChoose = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files?.[0]) {
          onFileSelect?.(e.dataTransfer.files[0]);
        }
      }}
      className={`rounded-[var(--r-14)] border-2 border-dashed transition-all duration-[120ms] ease-out p-8 flex flex-col items-center justify-center text-center select-none ${
        isDragOver || isDragOverDemo
          ? "border-[var(--verdigris)] bg-[rgba(121,184,166,0.06)]"
          : "border-[var(--line-strong)] bg-[var(--ink-800)]/30 hover:border-[var(--dim)]"
      } ${className}`}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.txt"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onFileSelect?.(e.target.files[0]);
          }
        }}
      />

      {/* Hand-drawn style page icon (96px) */}
      <div className="mb-4 text-[var(--dim)]">
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

      {/* Footnote */}
      <span className="type-mono-sm text-[var(--faint)]">
        Supports PDF · Max 50 MB · Encrypted in transit
      </span>
    </div>
  );
};
