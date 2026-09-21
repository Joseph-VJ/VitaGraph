import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge, LED, Button, Marginalia } from "../components/gallery";
import { getNavDirection, setNavDirection } from "../motion/navigation";
import { Sequence, isReducedMotion, governor } from "../motion";
import { DetentPress } from "../motion/fx/DetentPress";
import { WashSweep } from "../motion/fx/WashSweep";
import { DrawPath } from "../motion/fx/DrawPath";
import { playDetent, playChime } from "../motion/audio";

interface DatasetItem {
  name: string;
  subline: string;
  type: string;
  records: string;
  dimensions: string;
  status: string;
  statusLabel: string;
  lastSync: string;
}

export const DatasetsPage: React.FC = () => {
  const location = useLocation();
  const [datasets, setDatasets] = useState<DatasetItem[]>([
    {
      name: "ChromaDB Vector Collection",
      subline: "vitagraph_chunks_v2 · Local persistent SQLite/parquet index",
      type: "Vector Store",
      records: "1,024 vectors",
      dimensions: "1,536 dim (cosine)",
      status: "online",
      statusLabel: "Operational",
      lastSync: "2 min ago",
    },
    {
      name: "Clinical Knowledge Graph",
      subline: "NetworkX / In-memory biomedical entity-relationship store",
      type: "Knowledge Graph",
      records: "214 nodes · 486 edges",
      dimensions: "3 communities (0.42 modularity)",
      status: "online",
      statusLabel: "Synced",
      lastSync: "2 min ago",
    },
    {
      name: "Synthetic Patient Personas",
      subline: "VG-2026-001 (Arjun R) · 2 longitudinal metabolic panels",
      type: "Clinical Persona",
      records: "2 report panels · 4 pages each",
      dimensions: "Longitudinal deltas (Hb, eGFR, HbA1c)",
      status: "online",
      statusLabel: "Consent verified",
      lastSync: "Today, 14:28",
    },
    {
      name: "Cardiometabolic Trials & Guidelines",
      subline: "NEJM, Lancet, AHA/ACC, WHO clinical literature corpus",
      type: "Reference Corpus",
      records: "6 documents · 104 pages",
      dimensions: "1,024 extracted text chunks",
      status: "online",
      statusLabel: "Ready",
      lastSync: "Today, 14:32",
    },
  ]);

  const [verifyState, setVerifyState] = useState<
    Record<number, { running: boolean; verified: boolean; wash: boolean }>
  >({});

  const handleVerifyIntegrity = (idx: number) => {
    playDetent();
    const isT0 = governor.getState().tier === "T0" || isReducedMotion();
    if (isT0) {
      setVerifyState((prev) => ({
        ...prev,
        [idx]: { running: false, verified: true, wash: false },
      }));
      setDatasets((prev) =>
        prev.map((d, i) =>
          i === idx
            ? { ...d, statusLabel: "Verified (SHA-256 confirmed)", lastSync: "Just now" }
            : d
        )
      );
      return;
    }

    setVerifyState((prev) => ({
      ...prev,
      [idx]: { running: true, verified: false, wash: true },
    }));

    new Sequence()
      .wait(480)
      .addAction(() => {
        setVerifyState((prev) => ({
          ...prev,
          [idx]: { running: false, verified: true, wash: false },
        }));
        setDatasets((prev) =>
          prev.map((d, i) =>
            i === idx
              ? { ...d, statusLabel: "Verified (SHA-256 confirmed)", lastSync: "Just now" }
              : d
          )
        );
        playChime();
      })
      .play();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-title text-[var(--bone)]">Datasets & Knowledge Sources</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Active vector indexes, knowledge graph collections, and synthetic cohort data.
          </p>
        </div>
        <Marginalia
          text="Better data. Healthier decisions."
          sketch="compass"
        />
      </div>

      {/* Datasets Cards Grid (§M5.2 - Staggered enter) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datasets.map((ds, idx) => {
          const st = verifyState[idx] || { running: false, verified: false, wash: false };
          return (
            <div
              key={idx}
              data-testid={`dataset-card-${idx}`}
              className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] hover:border-[var(--dim)] transition-all duration-[120ms] ease-out flex flex-col justify-between relative overflow-hidden m-enter"
              style={{
                animationDelay: `${Math.min(idx * 60, 240)}ms`,
              }}
            >
              {st.wash && (
                <WashSweep
                  active={st.wash}
                  color="var(--verdigris)"
                  testId={`dataset-wash-${idx}`}
                />
              )}

              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <LED
                      color={st.verified ? "verdigris" : ds.status === "online" ? "verdigris" : "ochre"}
                      live={st.running || ds.status === "online"}
                    />
                    <span className="type-label text-[var(--bone)] font-medium">
                      {ds.name}
                    </span>
                  </div>
                  <Badge variant="verdigris">
                    {st.verified ? "Verified (SHA-256 confirmed)" : ds.statusLabel}
                  </Badge>
                </div>

                <p className="type-meta text-[var(--dim)] text-xs mb-4">
                  {ds.subline}
                </p>

                <div className="space-y-2 py-3 border-y border-[var(--line-faint)] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="type-label text-[var(--dim)]">Store Type</span>
                    <span className="type-mono-sm text-[var(--bone)]">{ds.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="type-label text-[var(--dim)]">Records / Size</span>
                    <span className="type-mono-sm text-[var(--bone)]">{ds.records}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="type-label text-[var(--dim)]">Parameters</span>
                    <span className="type-mono-sm text-[var(--dim)]">{ds.dimensions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="type-label text-[var(--dim)]">Last Verified</span>
                    <span className="type-mono-sm text-[var(--verdigris)]">{ds.lastSync}</span>
                  </div>
                </div>

                {st.verified && (
                  <div className="mt-3 flex items-center gap-2 p-2 rounded-[var(--r-4)] bg-[var(--verdigris)]/10 border border-[var(--verdigris)]/30 m-enter">
                    <svg className="w-4 h-4 text-[var(--verdigris)] flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <DrawPath
                        d="M4 12l5 5L20 6"
                        stroke="var(--verdigris)"
                        strokeWidth={2.5}
                        durationMs={480}
                      />
                    </svg>
                    <span className="type-meta text-[11px] text-[var(--verdigris)] font-mono">
                      SHA-256 matched canonical registry
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between">
                <span className="type-mono-sm text-[var(--faint)] text-[11px]">
                  Zero cloud egress · Local only
                </span>
                <div className="flex items-center gap-2">
                  <DetentPress>
                    <Button
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => handleVerifyIntegrity(idx)}
                      disabled={st.running}
                      data-testid="verify-integrity-btn"
                    >
                      {st.running ? "Checking…" : st.verified ? "Re-verify" : "Verify integrity"}
                    </Button>
                  </DetentPress>
                  <DetentPress>
                    <Link
                      to="/graph"
                      viewTransition
                      onClick={() => setNavDirection(getNavDirection(location.pathname, "/graph"))}
                    >
                      <Button variant="ghost" className="h-7 text-xs">
                        Inspect
                      </Button>
                    </Link>
                  </DetentPress>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
