import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  IconButton,
  Marginalia,
} from "../components/gallery";

interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  source: string;
  category: "trial" | "panel" | "guideline" | "review";
  categoryLabel: string;
  pages: number;
  chunks: number;
  method: "native" | "ocr";
  doi?: string;
  fileHash: string;
  date: string;
  graphLinked: boolean;
}

const documentsData: DocumentItem[] = [
  {
    id: "doc-1",
    title: "SGLT2 Inhibitors in Patients with Heart Failure with Reduced Ejection Fraction",
    filename: "NEJM_2023_HeartFailure.pdf",
    source: "McMurray et al. · New England Journal of Medicine, 2023",
    category: "trial",
    categoryLabel: "Clinical trial",
    pages: 18,
    chunks: 214,
    method: "native",
    doi: "10.1056/NEJMoa2211931",
    fileHash: "8f4a3e9c0d2b7e6f1c9d4a1e0b6c7f13",
    date: "2023-03-02",
    graphLinked: true,
  },
  {
    id: "doc-2",
    title: "Comprehensive Metabolic Panel & Lipid Profile (Follow-up)",
    filename: "synthetic_panel_2025-06-20.pdf",
    source: "Subject: Arjun R (VG-2026-001) · Follow-up visit",
    category: "panel",
    categoryLabel: "Lab panel",
    pages: 4,
    chunks: 118,
    method: "ocr",
    fileHash: "8f4a9c0d2b7e6f1c9d4a1e0b6c21a4f0",
    date: "2025-06-20",
    graphLinked: true,
  },
  {
    id: "doc-3",
    title: "Initial Lab Panel & Biomarker Screen (Baseline)",
    filename: "synthetic_panel_2025-01-15.pdf",
    source: "Subject: Arjun R (VG-2026-001) · Enrollment baseline",
    category: "panel",
    categoryLabel: "Lab panel",
    pages: 4,
    chunks: 96,
    method: "native",
    fileHash: "a3f2e9c0d2b7e6f1c9d4a1e0b6c7f13d",
    date: "2025-01-15",
    graphLinked: true,
  },
  {
    id: "doc-4",
    title: "Empagliflozin in Patients with Heart Failure and Preserved Ejection Fraction",
    filename: "Lancet_2022_HFpEF.pdf",
    source: "Anker et al. · The Lancet, 2022",
    category: "trial",
    categoryLabel: "Clinical trial",
    pages: 14,
    chunks: 176,
    method: "native",
    doi: "10.1016/S0140-6736(22)01103-8",
    fileHash: "7d1b8e4f2a9c3d5e0f1b2c4d6a8e0f12",
    date: "2022-08-27",
    graphLinked: true,
  },
  {
    id: "doc-5",
    title: "2024 AHA/ACC/HFSA Guideline for the Management of Heart Failure",
    filename: "Guidelines_2024_AHA_ACC.pdf",
    source: "American Heart Association & American College of Cardiology",
    category: "guideline",
    categoryLabel: "Clinical guideline",
    pages: 32,
    chunks: 312,
    method: "native",
    fileHash: "5c9e2b1a4d7f0e3b6a9c2e5f8b1d4a70",
    date: "2024-04-15",
    graphLinked: true,
  },
  {
    id: "doc-6",
    title: "Guideline for the Pharmacological Treatment of Hypertension in Adults",
    filename: "WHO_2021_Hypertension.pdf",
    source: "World Health Organization Clinical Guidelines",
    category: "guideline",
    categoryLabel: "Clinical guideline",
    pages: 10,
    chunks: 108,
    method: "native",
    fileHash: "3f8a1c9e5b2d7a0f4e6c8b1d3a5e7f90",
    date: "2021-09-10",
    graphLinked: true,
  },
];

export const LibraryPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const filteredDocs = documentsData.filter((doc) => {
    const matchesCategory =
      categoryFilter === "all" || doc.category === categoryFilter;
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.filename.toLowerCase().includes(search.toLowerCase()) ||
      doc.source.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top action row with search, filter tabs, and marginalia */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter categories */}
        <div className="flex items-center gap-1.5 p-1 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          {[
            { id: "all", label: "All documents (6)" },
            { id: "trial", label: "Clinical trials (2)" },
            { id: "panel", label: "Lab panels (2)" },
            { id: "guideline", label: "Guidelines (2)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1 rounded-[var(--r-4)] type-label transition-all duration-[120ms] ease-out ${
                categoryFilter === tab.id
                  ? "bg-[var(--ink-700)] text-[var(--bone)] shadow-sm"
                  : "text-[var(--dim)] hover:text-[var(--bone)] hover:bg-[var(--ink-700)]/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Marginalia
          text="Same documents. Deeper insights."
          sketch="compass"
        />
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total indexed</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            {documentsData.length}
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Peer-reviewed & lab panels
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total chunks</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            1,024
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Embedded with cosine index
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Extraction quality</span>
          <span className="type-stat text-2xl font-mono text-[var(--verdigris)] mt-1">
            92.4%
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            5 native · 1 OCR fallback
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Storage footprint</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            4.2 MB
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Encrypted local SQLite/Chroma
          </span>
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] focus-within:border-[var(--verdigris)] transition-colors duration-[120ms]">
          <svg className="w-4 h-4 text-[var(--dim)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, filename, author, or DOI..."
            className="w-full bg-transparent type-body text-[var(--bone)] placeholder-[var(--faint)] focus:outline-none text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs text-[var(--dim)] hover:text-[var(--bone)]"
            >
              Clear
            </button>
          )}
        </div>

        <Link to="/upload">
          <Button variant="primary" className="h-10 px-4">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Upload report</span>
          </Button>
        </Link>
      </div>

      {/* Documents List */}
      <div className="space-y-3">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] hover:border-[var(--dim)] transition-all duration-[120ms] ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            {/* Left: Document Info */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-[var(--r-6)] bg-[var(--ink-700)] flex items-center justify-center text-[var(--verdigris)] flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="type-title text-[var(--bone)] text-base font-medium truncate">
                    {doc.title}
                  </h3>
                  <Badge
                    variant={
                      doc.category === "trial"
                        ? "cornflower"
                        : doc.category === "panel"
                        ? "verdigris"
                        : "ochre"
                    }
                  >
                    {doc.categoryLabel}
                  </Badge>
                  <Badge variant={doc.method === "native" ? "verdigris" : "ochre"}>
                    {doc.method}
                  </Badge>
                </div>

                <div className="type-meta text-[var(--dim)] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[var(--bone)] font-mono text-xs">{doc.filename}</span>
                  <span>·</span>
                  <span>{doc.source}</span>
                  {doc.doi && (
                    <>
                      <span>·</span>
                      <span className="type-mono-sm text-[var(--verdigris)]">DOI: {doc.doi}</span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                  <span className="type-mono-sm text-[var(--dim)]">
                    <strong className="text-[var(--bone)]">{doc.pages}</strong> pages
                  </span>
                  <span className="text-[var(--faint)]">·</span>
                  <span className="type-mono-sm text-[var(--dim)]">
                    <strong className="text-[var(--bone)]">{doc.chunks}</strong> chunks
                  </span>
                  <span className="text-[var(--faint)]">·</span>
                  <span className="type-mono-sm text-[var(--faint)] flex items-center gap-1">
                    SHA256: {doc.fileHash.substring(0, 12)}…
                    <IconButton
                      size={18}
                      title="Copy SHA256"
                      onClick={() => handleCopyHash(doc.fileHash)}
                      className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)]"
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </IconButton>
                    {copiedHash === doc.fileHash && (
                      <span className="text-[var(--verdigris)] text-[10px]">Copied</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[var(--line-faint)]">
              <Link to="/graph">
                <Button variant="ghost" className="h-8 text-xs">
                  Explore graph
                </Button>
              </Link>
              <Link to="/ask">
                <Button variant="ghost" className="h-8 text-xs">
                  Ask RAG
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
