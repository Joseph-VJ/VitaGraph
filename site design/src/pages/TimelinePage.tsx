import React, { useState } from "react";
import {
  Badge,
  LED,
  DeltaChip,
  Button,
  IconButton,
  Marginalia,
} from "../components/gallery";

export const TimelinePage: React.FC = () => {
  const [filter, setFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText("VG-2026-001");
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Controls / Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="event-filter" className="type-label text-[var(--dim)]">
            Show:
          </label>
          <select
            id="event-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 px-3 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] text-[var(--bone)] type-label focus:outline-none focus:border-[var(--verdigris)] transition-colors duration-[120ms] ease-out"
          >
            <option value="all">All events</option>
            <option value="reports">Lab reports only</option>
            <option value="questions">Questions & RAG</option>
            <option value="graph">Graph updates</option>
          </select>
          <span className="type-meta text-[var(--dim)]">
            Showing 2 report panels and 4 derived events
          </span>
        </div>

        <Marginalia
          text="Same data. Kinder answers."
          sketch="leaf"
          size={20}
        />
      </div>

      {/* Main Grid: Spine Timeline (flex-1) + Patient Rail (360px) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Timeline Spine Column */}
        <div className="flex-1 flex flex-col min-w-0 w-full relative pl-6 border-l-2 border-[var(--line-strong)] space-y-10">
          
          {/* BLOCK 1: June 20, 2025 (Latest Follow-up) */}
          <div className="relative">
            {/* Spine Node Dot */}
            <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[var(--verdigris)] border-4 border-[var(--ink-900)] shadow-[0_0_8px_rgba(121,184,166,0.5)]" />

            {/* Block Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="type-mono text-[var(--bone)] font-medium text-base">
                  2025-06-20
                </span>
                <Badge variant="verdigris">Latest panel</Badge>
                <span className="type-meta text-[var(--dim)]">Follow-up visit (6 months)</span>
              </div>
              <span className="type-mono-sm text-[var(--faint)]">118 chunks · sha256: 8f4a…c21</span>
            </div>

            {/* Report Card */}
            <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-[var(--r-6)] bg-[var(--ink-700)] flex items-center justify-center text-[var(--verdigris)] flex-shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="type-title text-[var(--bone)]">
                      Comprehensive Metabolic Panel & Lipid Profile
                    </h4>
                    <p className="type-meta text-[var(--dim)] mt-0.5">
                      synthetic_panel_2025-06-20.pdf · 4 pages · Parsed by Surya-OCR
                    </p>
                  </div>
                </div>
                <Button variant="ghost" className="text-xs h-8">
                  View report
                </Button>
              </div>

              {/* Sub-events inside June block */}
              <div className="mt-4 pt-4 border-t border-[var(--line-faint)] flex flex-col gap-2.5">
                <div className="flex items-center gap-2 type-meta text-[var(--dim)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--verdigris)]" />
                  <span className="type-label text-[var(--bone)]">Graph updated</span>
                  <span>—</span>
                  <span>Extracted 18 entities, 34 edges linked to clinical ontology</span>
                </div>

                <div className="p-3 bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-faint)] flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="type-label text-[var(--dim)] text-[11px] block mb-0.5">
                      Researcher question
                    </span>
                    <p className="type-reading italic text-[var(--bone)] text-sm">
                      "How has kidney function changed between January and June?"
                    </p>
                  </div>
                  <Button variant="ghost" className="text-[11px] h-7 px-2.5 flex-shrink-0">
                    Show answer
                  </Button>
                </div>
              </div>

              {/* Longitudinal Observation Rows (§9.5) */}
              <div className="mt-4 pt-4 border-t border-[var(--line-faint)]">
                <span className="type-label text-[var(--dim)] block mb-3">
                  Measurements & longitudinal deltas
                </span>
                <div className="space-y-2">
                  {/* Hemoglobin */}
                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                    <div className="flex items-center gap-3">
                      <span className="type-body font-medium text-[var(--bone)] w-28">
                        Hemoglobin
                      </span>
                      <span className="type-mono-sm text-[var(--dim)]">
                        13.1 → <span className="text-[var(--bone)] font-semibold">13.2</span> g/dL
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <DeltaChip type="improving" label="+0.1 improving" />
                      <span className="type-mono-sm text-[var(--faint)]">Ref: p. 2</span>
                    </div>
                  </div>

                  {/* eGFR */}
                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                    <div className="flex items-center gap-3">
                      <span className="type-body font-medium text-[var(--bone)] w-28">
                        eGFR
                      </span>
                      <span className="type-mono-sm text-[var(--dim)]">
                        78 → <span className="text-[var(--ochre)] font-semibold">72</span> mL/min
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <DeltaChip type="decrease" label="−6 slight decrease" />
                      <span className="type-mono-sm text-[var(--faint)]">Ref: p. 3</span>
                    </div>
                  </div>

                  {/* HbA1c */}
                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                    <div className="flex items-center gap-3">
                      <span className="type-body font-medium text-[var(--bone)] w-28">
                        HbA1c
                      </span>
                      <span className="type-mono-sm text-[var(--dim)]">
                        6.8 → <span className="text-[var(--madder)] font-semibold">7.1</span> %
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <DeltaChip type="increase" label="+0.3 increase" />
                      <span className="type-mono-sm text-[var(--faint)]">Ref: p. 4</span>
                    </div>
                  </div>

                  {/* Vitamin D (New result) */}
                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                    <div className="flex items-center gap-3">
                      <span className="type-body font-medium text-[var(--bone)] w-28">
                        Vitamin D
                      </span>
                      <span className="type-mono-sm text-[var(--dim)]">
                        — → <span className="text-[var(--cornflower)] font-semibold">24</span> ng/mL
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <DeltaChip type="new" label="new result" />
                      <span className="type-mono-sm text-[var(--faint)]">Ref: p. 4</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCK 2: January 15, 2025 (Baseline) */}
          <div className="relative">
            {/* Spine Node Dot */}
            <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[var(--ink-600)] border-4 border-[var(--ink-900)]" />

            {/* Block Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="type-mono text-[var(--bone)] font-medium text-base">
                  2025-01-15
                </span>
                <Badge variant="dim">Baseline panel</Badge>
                <span className="type-meta text-[var(--dim)]">Initial enrollment checkup</span>
              </div>
              <span className="type-mono-sm text-[var(--faint)]">96 chunks · sha256: a3f2…9c1d</span>
            </div>

            {/* Report Card */}
            <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-[var(--r-6)] bg-[var(--ink-700)] flex items-center justify-center text-[var(--dim)] flex-shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="type-title text-[var(--bone)]">
                      Initial Lab Panel & Biomarker Screen
                    </h4>
                    <p className="type-meta text-[var(--dim)] mt-0.5">
                      synthetic_panel_2025-01-15.pdf · 4 pages · Parsed by PyPDF/Surya
                    </p>
                  </div>
                </div>
                <Button variant="ghost" className="text-xs h-8">
                  View report
                </Button>
              </div>

              {/* Sub-events inside January block */}
              <div className="mt-4 pt-4 border-t border-[var(--line-faint)] flex flex-col gap-2.5">
                <div className="flex items-center gap-2 type-meta text-[var(--dim)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-600)]" />
                  <span className="type-label text-[var(--bone)]">Graph updated</span>
                  <span>—</span>
                  <span>Extracted 14 entities, 28 edges linked</span>
                </div>

                <div className="p-3 bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-faint)] flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="type-label text-[var(--dim)] text-[11px] block mb-0.5">
                      Researcher question
                    </span>
                    <p className="type-reading italic text-[var(--bone)] text-sm">
                      "What does elevated creatinine indicate in this panel?"
                    </p>
                  </div>
                  <Button variant="ghost" className="text-[11px] h-7 px-2.5 flex-shrink-0">
                    Show answer
                  </Button>
                </div>
              </div>

              {/* Baseline Observations */}
              <div className="mt-4 pt-4 border-t border-[var(--line-faint)]">
                <span className="type-label text-[var(--dim)] block mb-3">
                  Baseline readings
                </span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                    <span className="type-body text-[var(--bone)]">Hemoglobin</span>
                    <div className="flex items-center gap-3">
                      <span className="type-mono-sm text-[var(--bone)]">13.1 g/dL</span>
                      <Badge variant="verdigris">Normal</Badge>
                      <span className="type-mono-sm text-[var(--faint)]">Ref: p. 2</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                    <span className="type-body text-[var(--bone)]">eGFR</span>
                    <div className="flex items-center gap-3">
                      <span className="type-mono-sm text-[var(--bone)]">78 mL/min/1.73m²</span>
                      <Badge variant="verdigris">Normal</Badge>
                      <span className="type-mono-sm text-[var(--faint)]">Ref: p. 3</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] bg-[var(--ink-700)]/30 border border-[var(--line-faint)]">
                    <span className="type-body text-[var(--bone)]">HbA1c</span>
                    <div className="flex items-center gap-3">
                      <span className="type-mono-sm text-[var(--bone)]">6.8 %</span>
                      <Badge variant="ochre">Elevated</Badge>
                      <span className="type-mono-sm text-[var(--faint)]">Ref: p. 4</span>
                    </div>
                  </div>

                  {/* Missing in January (§9.5: dashed missing row) */}
                  <div className="flex items-center justify-between p-2.5 rounded-[var(--r-6)] border border-dashed border-[var(--line-strong)] bg-transparent">
                    <span className="type-quote-sm italic text-[var(--dim)]">
                      Vitamin D — Not present in January report
                    </span>
                    <span className="type-mono-sm text-[var(--faint)]">N/A</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Rail (360px): Patient / Persona & Summary */}
        <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-6">
          {/* Patient Persona Card (§9.5) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)]">Patient persona</h3>
              <Badge variant="verdigris">Active</Badge>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[var(--ink-700)] border border-[var(--line-strong)] flex items-center justify-center text-lg font-medium text-[var(--verdigris)]">
                AR
              </div>
              <div>
                <h4 className="type-title text-[var(--bone)]">Arjun R</h4>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="type-mono-sm text-[var(--dim)]">VG-2026-001</span>
                  <IconButton
                    size={20}
                    title={copiedId ? "Copied" : "Copy ID"}
                    onClick={handleCopyId}
                    className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)]"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </IconButton>
                </div>
              </div>
            </div>

            <div className="space-y-2 py-2 border-y border-[var(--line-faint)]">
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--dim)]">Date of birth</span>
                <span className="type-mono-sm text-[var(--bone)]">1994-08-12 (32 y/o)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--dim)]">Sex</span>
                <span className="type-mono-sm text-[var(--bone)]">Male</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--dim)]">Consent</span>
                <div className="flex items-center gap-1.5">
                  <LED status="online" size={7} />
                  <span className="type-mono-sm text-[var(--verdigris)]">Accepted · 2026-02-10</span>
                </div>
              </div>
            </div>

            {/* Note box */}
            <div className="mt-4 p-2.5 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-faint)]">
              <p className="type-quote-sm italic text-[var(--dim)] text-xs">
                "Synthetic persona for research use only."
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line-faint)]">
              <Button variant="solid-danger" className="w-full justify-center text-xs h-8">
                Delete persona
              </Button>
            </div>
          </div>

          {/* Report Versions Table (§9.5) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <h3 className="type-title text-[var(--bone)] mb-3 pb-2 border-b border-[var(--line-faint)]">
              Report versions (2)
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-[var(--r-6)] bg-[var(--ink-700)]/40 border border-[var(--line-faint)]">
                <div>
                  <span className="type-mono-sm text-[var(--bone)] block">2025-06-20</span>
                  <span className="type-meta text-[var(--dim)] text-[11px]">4 pages · 118 chunks</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LED status="online" size={6} />
                  <span className="type-label text-[var(--verdigris)] text-xs">Indexed</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-[var(--r-6)] bg-[var(--ink-700)]/20 border border-[var(--line-faint)]">
                <div>
                  <span className="type-mono-sm text-[var(--bone)] block">2025-01-15</span>
                  <span className="type-meta text-[var(--dim)] text-[11px]">4 pages · 96 chunks</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LED status="online" size={6} />
                  <span className="type-label text-[var(--verdigris)] text-xs">Indexed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Observations Summary Card (§9.5) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="mb-3 pb-2 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)]">Key observations</h3>
              <p className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
                Longitudinal shifts across panels
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">Hemoglobin</span>
                <span className="type-mono-sm text-[var(--verdigris)]">+0.1 g/dL Improving</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">eGFR</span>
                <span className="type-mono-sm text-[var(--ochre)]">−6 mL/min Decreasing</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">HbA1c</span>
                <span className="type-mono-sm text-[var(--madder)]">+0.3 % Increasing</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-body text-xs text-[var(--dim)]">Vitamin D</span>
                <span className="type-mono-sm text-[var(--cornflower)]">24 ng/mL New</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line-faint)]">
              <Button variant="ghost" className="w-full justify-center text-xs h-8">
                View in graph
              </Button>
            </div>
          </div>

          {/* Related Tools (§9.5) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <h3 className="type-title text-[var(--bone)] mb-3 pb-2 border-b border-[var(--line-faint)]">
              Related actions
            </h3>
            <div className="flex flex-col gap-2">
              <Button variant="ghost" className="justify-between text-xs h-8 w-full">
                <span>Compare reports</span>
                <span className="text-[var(--dim)]">›</span>
              </Button>
              <Button variant="ghost" className="justify-between text-xs h-8 w-full">
                <span>Export longitudinal data</span>
                <span className="text-[var(--dim)]">›</span>
              </Button>
              <Button variant="ghost" className="justify-between text-xs h-8 w-full">
                <span>Patient summary (PDF)</span>
                <span className="text-[var(--dim)]">›</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
