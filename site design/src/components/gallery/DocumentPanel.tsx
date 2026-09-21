import React, { useState } from "react";
import { Button, IconButton } from "./Buttons";
import { PaperSlip } from "./PaperSlip";
import type { GraphNode } from "../../api/graph";

interface DocumentPanelProps {
  className?: string;
  selectedNode?: GraphNode | null;
  reportFilename?: string | null;
  onClose?: () => void;
}

export const DocumentPanel: React.FC<DocumentPanelProps> = ({
  className = "",
  selectedNode,
  reportFilename = "NEJM_2023_HeartFailure.pdf",
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("Overview");

  const tabs = ["Overview", "Evidence (8)", "Related nodes (6)"];

  const title = selectedNode?.label || selectedNode?.id || reportFilename || "Health Record";
  const subtitle = selectedNode
    ? `${selectedNode.type || "Concept"} · Page ${selectedNode.page || 1}`
    : "VitaGraph Evidence Explorer";

  return (
    <div
      className={`rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header with shared-element view transition (§7.3, §M5.15) */}
        <div
          data-testid="document-panel-header"
          style={{
            viewTransitionName: selectedNode ? "node-detail-header" : undefined,
          }}
          className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--line-faint)] mb-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[var(--r-6)] bg-[var(--ink-700)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--bone)] flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="font-['Spectral'] text-[16px] leading-[22px] font-semibold text-[var(--bone)] truncate max-w-[240px]">
                {title}
              </h3>
              <div className="type-meta text-[var(--dim)] mt-0.5 truncate">
                {subtitle}
              </div>
            </div>
          </div>

          {onClose && selectedNode ? (
            <IconButton
              size={28}
              title="Deselect Node (Esc)"
              onClick={onClose}
              data-testid="document-panel-close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          ) : (
            <IconButton size={28} title="Actions">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </IconButton>
          )}
        </div>

        {/* Tab Row (underline-active §7.19) */}
        <div className="flex border-b border-[var(--line-faint)] mb-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-3.5 type-label transition-colors duration-[120ms] relative cursor-pointer ${
                  isActive
                    ? "text-[var(--bone)] border-b-2 border-b-[var(--verdigris)] -mb-[1px]"
                    : "text-[var(--dim)] hover:text-[var(--bone)]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Key-info rows */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">Node Type</span>
            <span className="text-[var(--bone)] capitalize">
              {selectedNode?.type || "Report Document"}
            </span>
          </div>
          <div className="flex justify-between type-body text-[12.5px]">
            <span className="text-[var(--dim)]">Source Document</span>
            <span className="text-[var(--bone)] truncate max-w-[180px]">
              {selectedNode?.report_id || reportFilename}
            </span>
          </div>
          {selectedNode?.value !== undefined && (
            <div className="flex justify-between type-body text-[12.5px]">
              <span className="text-[var(--dim)]">Extracted Value</span>
              <span className="text-[var(--verdigris)] font-medium">
                {selectedNode.value} {selectedNode.unit || ""}
              </span>
            </div>
          )}
          {selectedNode?.betweenness !== undefined && (
            <div className="flex justify-between type-body text-[12.5px]">
              <span className="text-[var(--dim)]">Network Centrality</span>
              <span className="text-[var(--ochre)] font-mono">
                {selectedNode.betweenness.toFixed(3)}
              </span>
            </div>
          )}
        </div>

        {/* Paper Slips (§7.15) */}
        <div className="space-y-3">
          <div className="type-meta text-[var(--dim)] mb-1">
            {selectedNode ? "Provenance Snippet" : "Key Evidence"}
          </div>
          <PaperSlip
            quote={
              selectedNode?.label
                ? `Observation identified for ${selectedNode.label}: extracted from clinical laboratory panel with high-confidence topological alignment.`
                : "Serum biomarker analysis identified within standard diagnostic interval across longitudinal observations."
            }
            authors="Clinical Laboratory Panel"
            citation={selectedNode ? `Page ${selectedNode.page || 1}` : "p. 3, §2.1"}
            similarity={0.94}
          />
        </div>
      </div>

      {/* Footer action (§7.19) */}
      <div className="pt-4 border-t border-[var(--line-faint)] flex items-center justify-between mt-6">
        <Button variant="ghost">View in Library</Button>
        <Button variant="primary">Explore Subgraph</Button>
      </div>
    </div>
  );
};
