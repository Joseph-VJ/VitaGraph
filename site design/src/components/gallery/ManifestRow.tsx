import React, { useState } from "react";
import { IconButton } from "./Buttons";

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

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`flex items-center justify-between py-2 border-b border-[var(--line-faint)] last:border-b-0 ${className}`}
    >
      <span className="type-label text-[var(--dim)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="type-mono-sm text-[var(--bone)]">{value}</span>
        {copyable && (
          <IconButton
            size={22}
            title={copied ? "Copied" : "Copy hash"}
            onClick={handleCopy}
            className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)]"
          >
            {copied ? (
              <svg className="w-3 h-3 text-[var(--verdigris)]" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
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
