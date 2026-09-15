import React from "react";
import {
  StatTile,
  ActivityRow,
  SystemHealthRow,
  SparklineCard,
  LED,
  Button,
  IconButton,
} from "../components/gallery";

export const HomePage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Header Marginalia (§9.1) */}
      <div className="flex items-center justify-between">
        <div />
        <span className="type-marginalia text-[14px]">
          Same data. Deeper understanding.
        </span>
      </div>

      {/* Grid: Main 1fr + Rail 360px (§6, §9.1) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Main Column (1fr) */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          {/* Stat Row (6 Tiles) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatTile type="doc" label="Reports" value="12" />
            <StatTile type="cube" label="Chunks" value="1,024" />
            <StatTile type="graph" label="Graph nodes" value="214" />
            <StatTile type="link" label="Edges" value="486" />
            <StatTile type="speech" label="Questions" value="37" />
            <StatTile type="shield" label="Refusals" value="4" />
          </div>

          {/* Recent Activity Card */}
          <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-5 flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--line-faint)]">
              <h3 className="type-card-title text-[var(--bone)]">Recent activity</h3>
              <Button variant="ghost" className="h-7 px-2.5 text-[12px]">
                View all
              </Button>
            </div>

            {/* Column Headers */}
            <div className="flex items-center justify-between py-1.5 px-3 type-label text-[var(--dim)] border-b border-[var(--line-faint)]">
              <span className="w-36 flex-shrink-0">Time</span>
              <span className="w-40 flex-shrink-0">Event</span>
              <span className="flex-1 min-w-0">Details</span>
              <span className="w-40 text-right">Target</span>
            </div>

            {/* Activity Rows */}
            <div className="divide-y divide-[var(--line-faint)]">
              <ActivityRow
                activityClass="indexed"
                timestamp="2026-09-09 14:32:11"
                eventName="Report indexed"
                details="Indexed 24 chunks from NEJM_2023_HeartFailure.pdf"
                objectName="NEJM_2023_HeartFailure.pdf"
              />
              <ActivityRow
                activityClass="answered"
                timestamp="2026-09-09 14:28:03"
                eventName="Question answered"
                details="Generated answer with 4 citations (2 documents)"
                objectName="Type 2 diabetes"
              />
              <ActivityRow
                activityClass="graph"
                timestamp="2026-09-09 14:16:27"
                eventName="Graph updated"
                details="Added 18 nodes and 42 edges"
                objectName="Automatic"
              />
              <ActivityRow
                activityClass="refusal"
                timestamp="2026-09-09 13:52:10"
                eventName="Safety refusal"
                details="Declined to answer — outside diagnostic scope"
                objectName="User question"
              />
              <ActivityRow
                activityClass="indexed"
                timestamp="2026-09-09 13:41:09"
                eventName="Report indexed"
                details="Indexed 36 chunks from Lancet_2022_Diabetes.pdf"
                objectName="Lancet_2022_Diabetes.pdf"
              />
              <ActivityRow
                activityClass="answered"
                timestamp="2026-09-09 12:18:44"
                eventName="Question answered"
                details="Generated answer with 3 citations"
                objectName="Metformin and CKD"
              />
              <ActivityRow
                activityClass="graph"
                timestamp="2026-09-09 11:03:21"
                eventName="Graph updated"
                details="Added 27 nodes and 63 edges"
                objectName="Automatic"
              />
              <ActivityRow
                activityClass="indexed"
                timestamp="2026-09-09 10:21:17"
                eventName="Report indexed"
                details="Indexed 18 chunks from WHO_2021_Hypertension.pdf"
                objectName="WHO_2021_Hypertension.pdf"
              />
              <ActivityRow
                activityClass="answered"
                timestamp="2026-09-09 09:56:38"
                eventName="Question answered"
                details="Generated answer with 5 citations"
                objectName="Vitamin D and immunity"
              />
              <ActivityRow
                activityClass="dataset"
                timestamp="2026-09-09 09:14:05"
                eventName="Dataset added"
                details="Added dataset: Clinical Guidelines 2024"
                objectName="Guidelines_2024"
              />
            </div>
          </div>
        </div>

        {/* Rail Column (360px §6) */}
        <div className="w-full lg:w-[360px] flex flex-col gap-6 flex-shrink-0">
          {/* System Health Card */}
          <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line-faint)] mb-2">
              <h3 className="type-card-title text-[var(--bone)]">System health</h3>
              <div className="flex items-center gap-1.5">
                <LED color="verdigris" live={true} />
                <span className="type-meta text-[var(--verdigris)]">
                  All systems operational
                </span>
              </div>
            </div>

            <div className="divide-y divide-[var(--line-faint)]">
              <SystemHealthRow name="FastAPI (:8000)" status="ok" latency="24 ms" />
              <SystemHealthRow name="Chroma (vector DB)" status="ok" latency="12 ms" />
              <SystemHealthRow name="SQLite (metadata)" status="ok" latency="6 ms" />
              <SystemHealthRow name="SSE (realtime)" status="live" latency="—" />
              <SystemHealthRow
                name="LLM (answering)"
                status="disabled"
                statusLabel="disabled by policy"
                latency="—"
              />
            </div>
          </div>

          {/* Retrieval Latency Sparkline */}
          <SparklineCard />

          {/* Continue Card (§9.1) */}
          <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-4 flex flex-col gap-4">
            <h3 className="type-card-title text-[var(--bone)]">Continue</h3>

            {/* Last open document */}
            <div>
              <div className="type-meta text-[var(--dim)] mb-1.5">Last open document</div>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-faint)]">
                <div className="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
                  <svg className="w-4 h-4 text-[var(--dim)] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="type-body text-[12.5px] text-[var(--bone)] font-medium truncate">
                      NEJM_2023_HeartFailure.pdf
                    </div>
                    <div className="type-meta text-[var(--dim)] mt-0.5">
                      New England Journal of Medicine · 2023 · 18 pages
                    </div>
                  </div>
                </div>
                <IconButton size={28} title="Open document">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </IconButton>
              </div>
            </div>

            {/* Last question */}
            <div>
              <div className="type-meta text-[var(--dim)] mb-1.5">Last question</div>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/50 border border-[var(--line-faint)]">
                <div className="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
                  <svg className="w-4 h-4 text-[var(--dim)] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="type-body text-[12.5px] text-[var(--bone)] font-medium line-clamp-2">
                      What is the effect of SGLT2 inhibitors on hospitalization risk in heart failure?
                    </div>
                    <div className="type-meta text-[var(--dim)] mt-0.5">
                      Answered 14:28 · 4 citations
                    </div>
                  </div>
                </div>
                <IconButton size={28} title="Open question">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
