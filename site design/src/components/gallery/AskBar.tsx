import React, { useState } from "react";
import { Button } from "./Buttons";
import { Select } from "./Input";
import { DetentPress } from "../../motion/fx/DetentPress";
import { playDetent } from "../../motion/audio";

interface AskBarProps {
  onSend?: (query: string, mode: string) => void;
  defaultValue?: string;
  className?: string;
}

export const AskBar: React.FC<AskBarProps> = ({
  onSend,
  defaultValue = "What is the effect of SGLT2 inhibitors on hospitalization risk in heart failure?",
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState("Ask");
  const [query, setQuery] = useState(defaultValue);
  const [mode, setMode] = useState("Paper");

  const tabs = ["Ask", "Summarize", "Compare", "Find evidence"];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      playDetent();
      onSend?.(query, mode);
    }
  };

  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] overflow-hidden ${className}`}
    >
      {/* Tab Row */}
      <div className="flex border-b border-[var(--line-faint)] bg-[var(--ink-900)]/60">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <DetentPress key={tab}>
              <button
                onClick={() => {
                  playDetent();
                  setActiveTab(tab);
                }}
                className={`px-4 py-2 type-label transition-colors duration-[120ms] relative cursor-pointer ${
                  isActive
                    ? "text-[var(--bone)] bg-[var(--ink-700)] border-t-2 border-t-[var(--verdigris)]"
                    : "text-[var(--dim)] hover:text-[var(--bone)] hover:bg-[var(--ink-800)] border-t-2 border-t-transparent"
                }`}
              >
                {tab}
              </button>
            </DetentPress>
          );
        })}
      </div>

      {/* Input Row */}
      <div className="p-2.5 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your reports..."
          className="flex-1 bg-transparent px-2.5 py-1.5 type-body text-[var(--bone)] placeholder-[var(--faint)] focus:outline-none"
        />

        {/* Mode select (84px per §7.6) */}
        <Select
          compactPaper
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          options={[
            { value: "Paper", label: "Paper" },
            { value: "Graph", label: "Graph" },
            { value: "Raw", label: "Raw" },
          ]}
        />

        {/* Primary Send Button with paper-plane glyph */}
        <DetentPress>
          <Button
            variant="primary"
            onClick={() => {
              playDetent();
              onSend?.(query, mode);
            }}
            className="flex items-center gap-1.5 px-3.5"
          >
            <svg
              className="w-3.5 h-3.5 rotate-45 -mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            <span>Send</span>
          </Button>
        </DetentPress>
      </div>
    </div>
  );
};
