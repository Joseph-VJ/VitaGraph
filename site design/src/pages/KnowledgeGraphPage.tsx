import React, { useState } from "react";
import {
  GraphStage,
  AskBar,
  ThinkingDetailsPanel,
  DocumentPanel,
} from "../components/gallery";

export const KnowledgeGraphPage: React.FC = () => {
  const [showThinking, setShowThinking] = useState(true);

  const handleAsk = (query: string, mode: string) => {
    console.log("Ask query:", query, "mode:", mode);
    setShowThinking(true);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      {/* Main Column (1fr) */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
        {/* Graph Stage (§7.16) */}
        <GraphStage />

        {/* Ask Bar (§7.17) */}
        <AskBar onSend={handleAsk} />

        {/* Thinking Details Panel (§7.18) */}
        {showThinking && (
          <ThinkingDetailsPanel className="mt-1" />
        )}
      </div>

      {/* Right Panel (400px) */}
      <div className="w-full lg:w-[400px] flex-shrink-0">
        <DocumentPanel />
      </div>
    </div>
  );
};
