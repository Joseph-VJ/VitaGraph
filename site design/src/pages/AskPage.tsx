import React, { useState } from "react";
import {
  QuestionCard,
  AnswerBlock,
  RefusalCard,
  Button,
  IconButton,
  Select,
} from "../components/gallery";

export const AskPage: React.FC = () => {
  const [activeDrawerTab, setActiveDrawerTab] = useState("Thinking details");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [followUp, setFollowUp] = useState("");
  const [mode, setMode] = useState("Paper");

  const drawerTabs = ["Thinking details", "Graph context", "Related questions"];

  const retrievedChunks = [
    { id: "01", doc: "NEJM_2019_DAPA.pdf", page: "p. 2", score: "0.89" },
    { id: "02", doc: "NEJM_2021_EMPEROR.pdf", page: "p. 5", score: "0.86" },
    { id: "03", doc: "Lancet_2022_HFpEF.pdf", page: "p. 3", score: "0.82" },
    { id: "04", doc: "Guidelines_2024.pdf", page: "p. 12", score: "0.78" },
    { id: "05", doc: "MetaAnalysis_2023.pdf", page: "p. 7", score: "0.71" },
  ];

  const graphNodes = [
    "SGLT2 inhibitor",
    "Heart failure",
    "Hospitalization",
    "HFrEF",
    "HFpEF",
    "Cardiovascular risk",
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      {/* Main Conversation Stream (1fr) */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
        {/* Thread 1: Answered Question */}
        <div className="space-y-4">
          <QuestionCard
            initial="V"
            question="What is the effect of SGLT2 inhibitors on hospitalization risk in heart failure patients?"
            date="Sep 9, 2026 14:28"
            category="educational"
            rewrittenQuery="slt2 inhibitors heart failure hospitalization risk efficacy outcomes"
          />

          <AnswerBlock elapsedTime="4.8 s" />

          {/* Follow-up input row */}
          <div className="rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-2 flex items-center gap-2">
            <input
              type="text"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Ask a follow-up question…"
              className="flex-1 bg-transparent px-3 py-1.5 type-body text-[var(--bone)] placeholder-[var(--faint)] focus:outline-none"
            />
            <Select
              compactPaper
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              options={[
                { value: "Paper", label: "Paper" },
                { value: "Graph", label: "Graph" },
              ]}
            />
            <Button variant="primary" className="h-8 px-3">
              <svg className="w-3.5 h-3.5 rotate-45 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              <span>Send</span>
            </Button>
          </div>
        </div>

        {/* Thread 2: Designed Refusal Boundary */}
        <div className="pt-2">
          <RefusalCard
            initial="V"
            question="Can you tell me if I should stop taking metformin based on my creatinine level?"
            date="Sep 9, 2026 13:52"
            refusalText="I can't provide personal medical advice or make treatment decisions. This goes beyond the scope of analysis of the provided reports. Please consult a qualified healthcare professional who can consider your full medical history."
          />
        </div>
      </div>

      {/* Right Drawer (400px Collapsible §9.4) */}
      {isDrawerOpen && (
        <aside className="w-full lg:w-[400px] flex-shrink-0 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col justify-between">
          <div>
            {/* Drawer Header with Close button */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line-faint)] mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--verdigris)]" />
                <span className="type-card-title text-[15px] text-[var(--bone)]">
                  Completed in 4.8 s
                </span>
              </div>
              <IconButton
                size={24}
                title="Collapse drawer"
                onClick={() => setIsDrawerOpen(false)}
                className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </IconButton>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-[var(--line-faint)] mb-4">
              {drawerTabs.map((tab) => {
                const isActive = activeDrawerTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveDrawerTab(tab)}
                    className={`py-2 px-3 type-label transition-colors duration-[120ms] relative cursor-pointer ${
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

            {/* Tab 1: Execution Trace (SSE Events) */}
            {activeDrawerTab === "Thinking details" && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between type-meta text-[var(--dim)] mb-2">
                    <span>Execution trace (SSE events)</span>
                  </div>
                  <div className="divide-y divide-[var(--line-faint)] space-y-1">
                    <div className="pt-1.5 pb-1">
                      <div className="flex items-center justify-between type-mono-sm">
                        <span className="text-[var(--verdigris)] font-medium">[question_interpreted]</span>
                        <span className="text-[var(--dim)]">182 ms</span>
                      </div>
                      <div className="type-meta text-[var(--dim)] mt-0.5">
                        Parsed intent and detected domain: cardiology
                      </div>
                    </div>

                    <div className="pt-1.5 pb-1">
                      <div className="flex items-center justify-between type-mono-sm">
                        <span className="text-[var(--verdigris)] font-medium">[chunks_selected]</span>
                        <span className="text-[var(--dim)]">416 ms</span>
                      </div>
                      <div className="type-meta text-[var(--dim)] mt-0.5">
                        Retrieved top 24 chunks (bm25 + vector)
                      </div>
                    </div>

                    <div className="pt-1.5 pb-1">
                      <div className="flex items-center justify-between type-mono-sm">
                        <span className="text-[var(--ochre)] font-medium">[graph_subgraph_built]</span>
                        <span className="text-[var(--dim)]">612 ms</span>
                      </div>
                      <div className="type-meta text-[var(--dim)] mt-0.5">
                        Built subgraph with 42 nodes and 96 edges
                      </div>
                    </div>

                    <div className="pt-1.5 pb-1">
                      <div className="flex items-center justify-between type-mono-sm">
                        <span className="text-[var(--cornflower)] font-medium">[citation_check_completed]</span>
                        <span className="text-[var(--dim)]">398 ms</span>
                      </div>
                      <div className="type-meta text-[var(--dim)] mt-0.5">
                        Validated citations and page spans
                      </div>
                    </div>

                    <div className="pt-1.5 pb-1">
                      <div className="flex items-center justify-between type-mono-sm">
                        <span className="text-[var(--madder)] font-medium">[generation_completed]</span>
                        <span className="text-[var(--dim)]">1,482 ms</span>
                      </div>
                      <div className="type-meta text-[var(--dim)] mt-0.5">
                        Generated answer (612 tokens)
                      </div>
                    </div>

                    <div className="pt-1.5 pb-1">
                      <div className="flex items-center justify-between type-mono-sm">
                        <span className="text-[var(--lilac)] font-medium">[safety_check_completed]</span>
                        <span className="text-[var(--dim)]">164 ms</span>
                      </div>
                      <div className="type-meta text-[var(--dim)] mt-0.5">
                        No safety issues detected
                      </div>
                    </div>
                  </div>

                  {/* Fingerprint */}
                  <div className="pt-2 mt-2 border-t border-[var(--line-faint)] flex items-center justify-between">
                    <span className="type-meta text-[var(--dim)]">trace fingerprint</span>
                    <span className="type-mono-sm text-[var(--dim)] truncate max-w-[210px]">
                      sha256:8f4a9c0d2b7e6f1c9d4a1e0b6c21
                    </span>
                  </div>
                </div>

                {/* Retrieved chunks top-5 */}
                <div className="pt-3 border-t border-[var(--line-faint)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="type-card-title text-[14px] text-[var(--bone)]">
                      Retrieved chunks (top 5)
                    </span>
                    <button className="type-mono-sm text-[var(--dim)] hover:text-[var(--bone)]">
                      View all
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {retrievedChunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className="flex items-center justify-between p-2 rounded-[var(--r-4)] bg-[var(--ink-700)]/40 border border-[var(--line-faint)] type-mono-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[var(--faint)]">{chunk.id}</span>
                          <span className="text-[var(--bone)] truncate">{chunk.doc}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[var(--dim)]">{chunk.page}</span>
                          <span className="text-[var(--verdigris)] font-medium">{chunk.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Graph Context */}
                <div className="pt-3 border-t border-[var(--line-faint)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="type-card-title text-[14px] text-[var(--bone)]">
                      Graph context
                    </span>
                    <Button variant="ghost" className="h-7 px-2 text-[11px]">
                      Show subgraph
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {graphNodes.map((node) => (
                      <span
                        key={node}
                        className="px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] border border-[var(--line-strong)] type-label text-[11.5px] text-[var(--bone)]"
                      >
                        {node}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Marginalia */}
          <div className="mt-6 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-marginalia text-[13px]">
              Same data. Deeper understanding.
            </span>
          </div>
        </aside>
      )}
    </div>
  );
};
