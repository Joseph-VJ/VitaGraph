import React from "react";
import {
  LED,
  Badge,
  FlagTag,
  DeltaChip,
  Button,
  IconButton,
  Input,
  Select,
  StatTile,
  SystemHealthRow,
  SparklineCard,
  ActivityRow,
  Dropzone,
  PipelineStepper,
  QualityBar,
  ManifestRow,
  QuarantineRow,
  GraphStage,
  AskBar,
  ThinkingDetailsPanel,
  DocumentPanel,
  PaperSlip,
  QuestionCard,
  AnswerBlock,
  RefusalCard,
  EmptyState,
  LoadingState,
  ErrorState,
  UncertainState,
  Marginalia,
  Breadcrumb,
} from "../components/gallery";

export const GalleryPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--ink-900)] text-[var(--bone)] p-8 max-w-[1440px] mx-auto">
      {/* Gallery Header */}
      <header className="pb-6 mb-8 border-b border-[var(--line-strong)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="type-mono-sm px-2 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] text-[var(--verdigris)] border border-[var(--line-strong)]">
              ROUTE /gallery
            </span>
            <span className="type-mono-sm text-[var(--dim)]">·</span>
            <span className="type-mono-sm text-[var(--dim)]">DESIGN.md §7 Component Gallery (Items 1–26)</span>
          </div>
          <h1 className="type-display">Instrument & Paper — Gallery</h1>
          <p className="type-screen-sub mt-1">
            Every component in all designed states under theme instrument. Frozen tokens only.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="type-mono-sm text-[var(--dim)]">Quality Floor: 16 Gates Green</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-4)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
            <LED color="verdigris" live={true} />
            <span className="type-mono-sm text-[var(--verdigris)]">Gate 1 Active</span>
          </div>
        </div>
      </header>

      {/* Grid of components */}
      <div className="space-y-12">
        {/* 01. LED */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            01. led — §7.1 (8px circle, colors §4.1, live adds 2s breathe)
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-2">
              <LED color="verdigris" live={true} />
              <span className="type-mono-sm text-[var(--dim)]">ok / live (breathe)</span>
            </div>
            <div className="flex items-center gap-2">
              <LED color="verdigris" live={false} />
              <span className="type-mono-sm text-[var(--dim)]">ok (static)</span>
            </div>
            <div className="flex items-center gap-2">
              <LED color="ochre" />
              <span className="type-mono-sm text-[var(--dim)]">warn / disabled</span>
            </div>
            <div className="flex items-center gap-2">
              <LED color="madder" />
              <span className="type-mono-sm text-[var(--dim)]">fail / refused</span>
            </div>
            <div className="flex items-center gap-2">
              <LED color="cornflower" />
              <span className="type-mono-sm text-[var(--dim)]">info / new</span>
            </div>
            <div className="flex items-center gap-2">
              <LED color="faint" />
              <span className="type-mono-sm text-[var(--dim)]">idle</span>
            </div>
          </div>
        </section>

        {/* 02. BADGE */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            02. badge — §7.2 (radius 4, padding 2/8, mono-sm)
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="answered">answered</Badge>
            <Badge variant="refused">refused — diagnostic boundary</Badge>
            <Badge variant="insufficient_evidence">insufficient evidence</Badge>
            <Badge variant="educational">educational</Badge>
            <Badge variant="rejected">1 file rejected</Badge>
            <Badge variant="ingesting">Ingesting…</Badge>
            <Badge variant="completed">Completed in 4.8 s</Badge>
          </div>
        </section>

        {/* 03. FLAG TAG */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            03. flag tag — §7.3 (High/Low madder tint, paired with ochre mono value)
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <FlagTag value="428" unit="pg/mL" flag="High" />
            <FlagTag value="32" unit="%" flag="Low" />
            <FlagTag value="1.4" unit="mg/dL" flag="High" />
            <FlagTag value="48" unit="mL/min" flag="Low" />
            <FlagTag value="13.2" unit="g/dL" flag="Normal" />
          </div>
        </section>

        {/* 04. DELTA CHIP */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            04. delta chip — §7.4 (status deltas in verdigris, ochre, madder, cornflower)
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <DeltaChip type="improving" label="+0.1 improving" />
            <DeltaChip type="decrease" label="−6 slight decrease" />
            <DeltaChip type="increase" label="+0.3 increase" />
            <DeltaChip type="new" label="new result" />
          </div>
        </section>

        {/* 05. BUTTONS */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            05. buttons — §7.5 (primary, ghost, outline-danger, solid-danger, icon-button, 120ms hover)
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary button</Button>
              <Button variant="primary" loading>Loading</Button>
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="ghost">Ghost button</Button>
              <Button variant="outline-danger">Delete persona</Button>
              <Button variant="solid-danger">Retry</Button>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <span className="type-label text-[var(--dim)] mr-2">Icon buttons (28px square):</span>
              <IconButton size={28} title="Arrow glyph">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </IconButton>
              <IconButton size={28} title="Copy hash">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </IconButton>
              <IconButton size={28} title="Kebab menu">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </IconButton>
              <IconButton size={28} title="Zoom in">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </IconButton>
              <IconButton size={28} title="Locate">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </IconButton>
            </div>
          </div>
        </section>

        {/* 06. INPUTS / SELECTS */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            06. inputs / selects — §7.6 (height 36px, radius 6, 2px verdigris focus ring, paper mode 84px)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search documents, concepts..."
              icon={
                <svg className="w-4 h-4 text-[var(--dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              }
              shortcut="Ctrl K"
            />
            <Select
              options={[
                { value: "all", label: "All events" },
                { value: "reports", label: "Reports only" },
                { value: "tests", label: "Lab results" },
              ]}
            />
            <div className="flex items-center gap-3">
              <span className="type-label text-[var(--dim)]">Compact Paper select:</span>
              <Select
                compactPaper
                options={[
                  { value: "Paper", label: "Paper" },
                  { value: "Graph", label: "Graph" },
                ]}
              />
            </div>
          </div>
        </section>

        {/* 07. STAT TILE */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            07. stat tile — §7.7 (radius 10, padding 16, 6 metrics with tinted icons, type/stat value)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile type="doc" label="Reports" value="12" />
            <StatTile type="cube" label="Chunks" value="1,024" />
            <StatTile type="graph" label="Graph nodes" value="214" />
            <StatTile type="link" label="Edges" value="486" />
            <StatTile type="speech" label="Questions" value="37" />
            <StatTile type="shield" label="Refusals" value="4" />
          </div>
        </section>

        {/* 08. SYSTEM HEALTH ROW */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            08. system-health row — §7.8 (LED + name + status + latency mono-sm right)
          </div>
          <div className="max-w-md bg-[var(--ink-800)] rounded-[var(--r-6)] p-3 border border-[var(--line-strong)]">
            <SystemHealthRow name="FastAPI (:8000)" status="ok" latency="24 ms" />
            <SystemHealthRow name="Chroma (vector DB)" status="ok" latency="12 ms" />
            <SystemHealthRow name="SQLite (metadata)" status="ok" latency="6 ms" />
            <SystemHealthRow name="SSE (realtime)" status="live" latency="—" />
            <SystemHealthRow name="LLM (answering)" status="disabled" statusLabel="disabled by policy" latency="—" />
          </div>
        </section>

        {/* 09. SPARKLINE CARD */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            09. sparkline card — §7.9 (title row, SVG verdigris line, mono axis & footnote)
          </div>
          <div className="max-w-md">
            <SparklineCard />
          </div>
        </section>

        {/* 10. ACTIVITY ROW */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            10. activity row — §7.10 (2px left rule by class: indexed, answered, graph, refusal, dataset)
          </div>
          <div className="rounded-[var(--r-6)] border border-[var(--line-strong)] overflow-hidden">
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
              activityClass="dataset"
              timestamp="2026-09-09 09:14:05"
              eventName="Dataset added"
              details="Added dataset: Clinical Guidelines 2024"
              objectName="Guidelines_2024"
            />
          </div>
        </section>

        {/* 11. DROPZONE */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            11. dropzone — §7.11 (radius 14 dashed line-strong, 96px hand-drawn page SVG, Spectral 15 regular hint)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="type-label text-[var(--dim)] mb-2">Default state:</div>
              <Dropzone />
            </div>
            <div>
              <div className="type-label text-[var(--dim)] mb-2">Drag-over state (verdigris wash):</div>
              <Dropzone isDragOverDemo={true} />
            </div>
          </div>
        </section>

        {/* 12. PIPELINE STEPPER */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            12. pipeline stepper — §7.12 (6 nodes 28px: done, active with glow pulse, pending)
          </div>
          <div className="p-4 rounded-[var(--r-10)] bg-[var(--ink-900)] border border-[var(--line-strong)]">
            <PipelineStepper />
          </div>
        </section>

        {/* 13. QUALITY BAR */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            13. quality bar — §7.13 (track 96×4 ink-600 radius 2, verdigris for native, ochre for ocr)
          </div>
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="type-label text-[var(--dim)]">Native (94%):</span>
              <QualityBar percentage={94} method="native" />
            </div>
            <div className="flex items-center gap-3">
              <span className="type-label text-[var(--dim)]">OCR Scanned (68%):</span>
              <QualityBar percentage={68} method="ocr" />
            </div>
          </div>
        </section>

        {/* 14. MANIFEST ROW */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            14. manifest row — §7.14 (label dim left, value mono-sm right, copy button on SHA256)
          </div>
          <div className="max-w-md bg-[var(--ink-800)] rounded-[var(--r-6)] p-3 border border-[var(--line-strong)]">
            <ManifestRow label="File name" value="synthetic_panel_2025-06-20.pdf" />
            <ManifestRow label="SHA256" value="8f4a9c0d2b7e6f1c9d4a1e0b6c21" copyable={true} />
            <ManifestRow label="File size" value="214 KB" />
            <ManifestRow label="Pages" value="4" />
            <ManifestRow label="Report date" value="2025-06-20 (parsed)" />
            <ManifestRow label="Document type" value="Lab report (panel)" />
          </div>
        </section>

        {/* 15. QUARANTINE ROW */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            15. quarantine row — §7.15 (2px madder rule, doc icon, filename mono, reason meta, Retry)
          </div>
          <div className="max-w-xl">
            <QuarantineRow
              filename="corrupted_report_2025-06-18.pdf"
              reason="Reason: File is corrupted or not a valid PDF."
            />
          </div>
        </section>

        {/* 16. GRAPH STAGE */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            16. graph stage — §7.16 (frame radius 14, dot grid + vignette, hulls, legend, nodes, chips, card, minimap)
          </div>
          <GraphStage />
        </section>

        {/* 17. ASK BAR */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            17. ask bar — §7.17 (tab row with verdigris top rule, flex input, mode select, Send paper plane)
          </div>
          <AskBar />
        </section>

        {/* 18. THINKING DETAILS PANEL */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            18. thinking-details panel — §7.18 (header with badge & select, traces 01-06 with stage colors, fingerprint)
          </div>
          <ThinkingDetailsPanel />
        </section>

        {/* 19. DOCUMENT PANEL */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            19. document panel — §7.19 (header icon tile 40px, metadata with ·, tabs, DOI link, summary, slip, insights)
          </div>
          <div className="max-w-lg">
            <DocumentPanel />
          </div>
        </section>

        {/* 20. PAPER SLIP */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            20. paper slip — §7.20 (the paper voice: bg #EDE7DA, 22px folded corner, citation chip, Spectral italic quote)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="type-label text-[var(--dim)] mb-2">Standard citation slip:</div>
              <PaperSlip
                citation="p. 4, §2.3"
                quote="Treatment with the SGLT2 inhibitor resulted in a 26% lower risk of the composite of cardiovascular death or hospitalization for heart failure compared with placebo (hazard ratio 0.74, 95% CI 0.62–0.88)."
                authors="McMurray et al. (2023)"
                journal="NEJM"
              />
            </div>
            <div>
              <div className="type-label text-[var(--dim)] mb-2">Ask variant with similarity score bar:</div>
              <PaperSlip
                title="Dapagliflozin in Heart Failure with Reduced Ejection Fraction"
                citation="p. 2, span 310–355"
                quote="Dapagliflozin reduced the risk of hospitalization for heart failure by 26% compared with placebo (HR 0.74, 95% CI 0.62–0.88)."
                authors="McMurray et al. (2019)"
                journal="NEJM"
                similarity={0.89}
              />
            </div>
          </div>
        </section>

        {/* 21. QUESTION CARD */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            21. question card — §7.21 (avatar 28 verdigris initial, question, rewritten query block in ink-900)
          </div>
          <QuestionCard
            initial="V"
            question="What is the effect of SGLT2 inhibitors on hospitalization risk in heart failure patients?"
            date="Sep 9, 2026 14:28"
            category="educational"
            rewrittenQuery="slt2 inhibitors heart failure hospitalization risk efficacy outcomes"
          />
        </section>

        {/* 22. ANSWER BLOCK */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            22. answer block — §7.22 (header, badge, 4 part rows with underlined evidence links, embedded slips)
          </div>
          <AnswerBlock />
        </section>

        {/* 23. REFUSAL CARD */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            23. refusal card — §7.23 (madder shield icon, refused badge, verbatim boundary copy)
          </div>
          <RefusalCard />
        </section>

        {/* 24. STATE SET */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            24. state set — §7.24 (empty, loading shimmer 1.2s, error with 2px madder rule + Retry, uncertain)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmptyState quote="Every journey begins with a first record." actionLabel="Upload report" />
            <LoadingState rows={2} />
            <ErrorState message="Vector index connection refused. Offline cache in use." />
            <UncertainState note="Extracted value lacks explicit reference range. Marked uncertain." />
          </div>
        </section>

        {/* 25. MARGINALIA */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            25. marginalia — §7.25 / §9.10 (Spectral 15/22 italic, rotate −2°, 60% dim, hand-drawn sketches)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 p-4 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)]">
            <Marginalia text="Same data. Deeper understanding." sketch="mountains" />
            <Marginalia text="Same documents. Deeper insights." sketch="quill" />
            <Marginalia text="Same data. Kinder answers." sketch="leaf" />
            <Marginalia text="Better data. Healthier decisions." sketch="none" />
          </div>
        </section>

        {/* 26. BREADCRUMB */}
        <section className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          <div className="type-mono-sm text-[var(--dim)] mb-3 pb-2 border-b border-[var(--line-faint)]">
            26. breadcrumb — §7.26 (type/label, › chevrons dim, current page bone)
          </div>
          <div className="p-3 bg-[var(--ink-900)] rounded-[var(--r-6)] border border-[var(--line-strong)]">
            <Breadcrumb
              items={[
                { label: "Patients", href: "#" },
                { label: "Arjun R", href: "#" },
                { label: "Timeline", current: true },
              ]}
            />
          </div>
        </section>
      </div>

      {/* Footer Status Bar preview */}
      <footer className="mt-12 pt-4 border-t border-[var(--line-strong)] flex flex-wrap items-center justify-between text-[var(--dim)] type-mono-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <LED color="verdigris" live={true} />
            <span className="text-[var(--bone)]">System online</span>
          </div>
          <span>|</span>
          <span>Gallery QA: 26/26 Components rendered</span>
        </div>
        <div className="flex items-center gap-3">
          <span>v0.3.1</span>
          <span>·</span>
          <span>gen-service v2 · cfg 2026-08</span>
          <span>·</span>
          <span>Local mode</span>
        </div>
      </footer>
    </div>
  );
};
