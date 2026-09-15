import React from "react";
import { Link } from "react-router-dom";
import { Badge, LED, Button, Marginalia } from "../components/gallery";

export const DatasetsPage: React.FC = () => {
  const datasets = [
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
  ];

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

      {/* Datasets Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datasets.map((ds, idx) => (
          <div
            key={idx}
            className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] hover:border-[var(--dim)] transition-all duration-[120ms] ease-out flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <LED color="verdigris" live={ds.status === "online"} />
                  <span className="type-label text-[var(--bone)] font-medium">
                    {ds.name}
                  </span>
                </div>
                <Badge variant="verdigris">{ds.statusLabel}</Badge>
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
            </div>

            <div className="mt-4 pt-3 flex items-center justify-between">
              <span className="type-mono-sm text-[var(--faint)] text-[11px]">
                Zero cloud egress · Local only
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="h-7 text-xs">
                  Verify integrity
                </Button>
                <Link to="/graph">
                  <Button variant="ghost" className="h-7 text-xs">
                    Inspect
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
