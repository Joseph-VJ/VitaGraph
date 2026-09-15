import React from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Marginalia } from "../components/gallery";

export const InsightsPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-title text-[var(--bone)]">Biomedical Insights & Graph Analysis</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Global network topology, community modularity, and cross-report evidence synthesis.
          </p>
        </div>
        <Marginalia
          text="Better data. Healthier decisions."
          sketch="leaf"
        />
      </div>

      {/* Grid of 4 Insight Cards (§9.7) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Louvain Community Card */}
        <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)] text-base">
                Community Modularity (Louvain)
              </h3>
              <Badge variant="verdigris">Q = 0.42</Badge>
            </div>

            <p className="type-meta text-[var(--dim)] text-xs mb-4">
              Partitioning of 214 biomedical entities into 3 densely connected clinical clusters.
            </p>

            <div className="space-y-3 py-2 border-y border-[var(--line-faint)] text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--cornflower)]" />
                  <span className="type-label text-[var(--bone)]">Cardiac Function</span>
                </div>
                <span className="type-mono-sm text-[var(--dim)]">5 core nodes · 38 edges</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--verdigris)]" />
                  <span className="type-label text-[var(--bone)]">Renal Physiology</span>
                </div>
                <span className="type-mono-sm text-[var(--dim)]">4 core nodes · 26 edges</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--lilac)]" />
                  <span className="type-label text-[var(--bone)]">SGLT2 / ACE Therapy</span>
                </div>
                <span className="type-mono-sm text-[var(--dim)]">4 core nodes · 32 edges</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 flex justify-end">
            <Link to="/graph">
              <Button variant="ghost" className="h-7 text-xs">
                Inspect clusters in 3D graph
              </Button>
            </Link>
          </div>
        </div>

        {/* 2. Degree & Eigenvector Centrality */}
        <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)] text-base">
                Centrality Hub Ranking
              </h3>
              <Badge variant="cornflower">Eigenvector</Badge>
            </div>

            <p className="type-meta text-[var(--dim)] text-xs mb-4">
              High-influence concepts with greatest cross-disciplinary connectivity.
            </p>

            <div className="space-y-2.5 py-2 border-y border-[var(--line-faint)] text-xs">
              {[
                { name: "Heart Failure", role: "Clinical Hub", score: "0.942" },
                { name: "Creatinine", role: "Biomarker Hub", score: "0.884" },
                { name: "SGLT2 Inhibitor", role: "Therapy Hub", score: "0.841" },
                { name: "eGFR", role: "Renal Function", score: "0.793" },
              ].map((hub, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <span className="type-body font-medium text-[var(--bone)] block">
                      {hub.name}
                    </span>
                    <span className="type-meta text-[var(--dim)] text-[10px]">
                      {hub.role}
                    </span>
                  </div>
                  <span className="type-mono-sm text-[var(--verdigris)] font-semibold">
                    {hub.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 flex justify-end">
            <Link to="/graph">
              <Button variant="ghost" className="h-7 text-xs">
                Filter by hub
              </Button>
            </Link>
          </div>
        </div>

        {/* 3. Predicate Distribution */}
        <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)] text-base">
                Relationship Predicate Frequencies
              </h3>
              <Badge variant="ochre">486 edges</Badge>
            </div>

            <div className="space-y-3 py-2 text-xs">
              {[
                { name: "indicates", pct: 34, color: "bg-[var(--verdigris)]" },
                { name: "measures", pct: 26, color: "bg-[var(--ochre)]" },
                { name: "treats", pct: 20, color: "bg-[var(--lilac)]" },
                { name: "increases_risk", pct: 12, color: "bg-[var(--madder)]" },
                { name: "leads_to", pct: 8, color: "bg-[var(--cornflower)]" },
              ].map((p, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="type-mono-sm text-[var(--bone)] font-mono">{p.name}</span>
                    <span className="type-mono-sm text-[var(--dim)]">{p.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--ink-700)] overflow-hidden">
                    <div
                      style={{ width: `${p.pct}%` }}
                      className={`h-full ${p.color} rounded-full`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--line-faint)]">
            <span className="type-meta text-[var(--faint)] text-[11px]">
              Extracted via biomedical relation extraction pipeline
            </span>
          </div>
        </div>

        {/* 4. Cross-Study Synthesis */}
        <div className="p-6 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)] text-base">
                Literature Consensus Shift
              </h3>
              <Badge variant="verdigris">High agreement</Badge>
            </div>

            <div className="space-y-3 py-2 text-xs">
              <p className="type-reading text-[var(--bone)] text-sm leading-relaxed">
                Across 2021–2024 literature (NEJM, Lancet, AHA guidelines), evidence demonstrates consistent cardiorenal protective effects of SGLT2 inhibition across both reduced (HFrEF) and preserved (HFpEF) ejection fraction cohorts.
              </p>

              <div className="p-3 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
                <span className="type-label text-[var(--dim)] text-[11px] block mb-1">
                  Key Meta-analytic finding
                </span>
                <p className="type-reading italic text-[var(--bone)] text-xs">
                  "26% relative risk reduction in composite cardiovascular death or heart failure hospitalization (HR 0.74, 95% CI 0.62–0.88)."
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex justify-end">
            <Link to="/ask">
              <Button variant="ghost" className="h-7 text-xs">
                Query evidence in Ask
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Causality Footnote per DESIGN.md §9.7 */}
      <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
        <p className="type-quote text-[var(--dim)] text-xs italic">
          "Graph associations indicate statistical and literature co-occurrence; they do not establish unmeasured biological causality."
        </p>
      </div>
    </div>
  );
};
