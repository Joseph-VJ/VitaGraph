import React, { useState } from "react";
import { IconButton } from "./Buttons";
import { governor, isReducedMotion } from "../../motion";

interface ManifestRowProps {
  label: string;
  value: string;
  copyable?: boolean;
  className?: string;
}

export const ManifestRow: React.FC<ManifestRowProps> = ({
  label,
  value,
  copyable = false,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const isT0 = governor.getState().tier === "T0" || isReducedMotion();

  const handleCopy = () => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value).catch(() => {});
      }
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`flex items-center justify-between py-2 border-b border-[var(--line-faint)] last:border-b-0 ${className}`}
    >
      <span className="type-label text-[var(--dim)]">{label}</span>
      <div className="flex items-center gap-1.5">
        {label === "SHA-256" ? (
          <div className="relative inline-block pb-0.5">
            <span className="type-mono-sm text-[var(--bone)]">{value}</span>
            <div
              className={`absolute bottom-0 left-0 w-full h-[2px] bg-[var(--verdigris)] origin-left ${
                !isT0 ? "animate-underline-draw" : ""
              }`}
              style={{ transformOrigin: "left" }}
            />
          </div>
        ) : (
          <span className="type-mono-sm text-[var(--bone)]">{value}</span>
        )}
        {copyable && (
          <IconButton
            data-testid="copy-hash-btn"
            size={22}
            title={copied ? "Copied" : "Copy hash"}
            onClick={handleCopy}
            className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)]"
          >
            {copied ? (
              <svg
                className={`w-3.5 h-3.5 text-[var(--verdigris)] ${!isT0 ? "animate-chip-land" : ""}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  d="M4 10.5l4 4 8-8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={!isT0 ? "animate-draw-check" : ""}
                  style={{ strokeDasharray: 24 }}
                />
              </svg>
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </IconButton>
        )}
      </div>
    </div>
  );
};
