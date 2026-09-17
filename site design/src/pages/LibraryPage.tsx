import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  IconButton,
  Marginalia,
} from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { reportsApi } from "../api/reports";
import type { Report } from "../types";

export const LibraryPage: React.FC = () => {
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportsApi.list(effectiveUserId);
      setReports(data);
    } catch (err) {
      console.warn("Failed to load reports from backend:", err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const filteredReports = reports.filter((rep) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "ready" && rep.status === "ready") ||
      (statusFilter === "failed" && rep.status === "failed");
    const matchesSearch =
      rep.original_filename.toLowerCase().includes(search.toLowerCase()) ||
      rep.file_hash.toLowerCase().includes(search.toLowerCase()) ||
      (rep.report_date && rep.report_date.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const totalChunks = reports.reduce((acc, r) => acc + (r.chunk_count || 0), 0);
  const totalPages = reports.reduce((acc, r) => acc + (r.page_count || 1), 0);
  const readyCount = reports.filter((r) => r.status === "ready").length;
  const qualityRate = reports.length > 0 ? Math.round((readyCount / reports.length) * 100) : 100;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top action row with filter tabs and marginalia */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter categories */}
        <div className="flex items-center gap-1.5 p-1 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)]">
          {[
            { id: "all", label: `All reports (${reports.length})` },
            { id: "ready", label: `Indexed & ready (${readyCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-[var(--r-4)] type-label transition-all duration-[120ms] ease-out ${
                statusFilter === tab.id
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

      {/* Overview Stat Strip (§9.4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total indexed</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            {reports.length}
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Clinical panels & lab reports
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total chunks</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            {totalChunks}
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Vector-embedded in ChromaDB
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Extraction quality</span>
          <span className="type-stat text-2xl font-mono text-[var(--verdigris)] mt-1">
            {qualityRate}%
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            {readyCount} native verified
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total pages</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            {totalPages}
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Preserved layout & provenance
          </span>
        </div>
      </div>

      {/* Search Input Filter & Action */}
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
            placeholder="Search reports by filename, date, or SHA-256 hash..."
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

        <Link to="/compare">
          <Button variant="ghost" className="h-10 px-4 text-xs">
            <span>Compare reports</span>
          </Button>
        </Link>

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

      {/* Reports List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-[var(--r-6)] skeleton-shimmer flex-shrink-0" />
                  <div className="min-w-0 flex-1 flex flex-col gap-2">
                    <div className="h-4 w-56 rounded-[var(--r-4)] skeleton-shimmer" />
                    <div className="h-3 w-40 rounded-[var(--r-4)] skeleton-shimmer" />
                  </div>
                </div>
                <div className="h-8 w-24 rounded-[var(--r-6)] skeleton-shimmer" />
              </div>
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-center bg-[var(--ink-800)] rounded-[var(--r-10)] border border-[var(--line-strong)] text-[var(--dim)]">
            <p className="type-body">No reports found matching your criteria.</p>
            <Link to="/upload" className="mt-3 inline-block">
              <Button variant="primary" className="text-xs">Upload your first report</Button>
            </Link>
          </div>
        ) : (
          filteredReports.map((doc, idx) => (
            <div
              key={doc.id}
              data-testid={`library-row-${doc.id}`}
              style={{ animationDelay: `${Math.min(idx * 24, 240)}ms` }}
              className="p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] hover:border-[var(--dim)] transition-all duration-[120ms] ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 m-enter"
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
                      {doc.original_filename.replace(/\.pdf$/i, "").replace(/_/g, " ")}
                    </h3>
                    <Badge variant="verdigris">Lab report</Badge>
                    <Badge variant={doc.status === "ready" ? "verdigris" : "ochre"}>
                      {doc.status}
                    </Badge>
                    {doc.version > 1 && (
                      <Badge variant="dim">v{doc.version}</Badge>
                    )}
                  </div>

                  <div className="type-meta text-[var(--dim)] flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[var(--bone)] font-mono text-xs">{doc.original_filename}</span>
                    <span>·</span>
                    <span>Persona: {effectiveUserId}</span>
                    <span>·</span>
                    <span>
                      Date: {doc.report_date || doc.upload_time.split("T")[0]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                    <span className="type-mono-sm text-[var(--dim)]">
                      <strong className="text-[var(--bone)]">{doc.page_count || 1}</strong> {doc.page_count === 1 ? "page" : "pages"}
                    </span>
                    <span className="text-[var(--faint)]">·</span>
                    <span className="type-mono-sm text-[var(--dim)]">
                      <strong className="text-[var(--bone)]">{doc.chunk_count ?? 1}</strong> chunks
                    </span>
                    <span className="text-[var(--faint)]">·</span>
                    <span className="type-mono-sm text-[var(--faint)] flex items-center gap-1">
                      SHA256: {doc.file_hash.substring(0, 12)}…
                      {copiedHash === doc.file_hash ? (
                        <span className="text-[var(--verdigris)] text-[11px] flex items-center gap-1 font-mono">
                          <svg className="w-3 h-3 text-[var(--verdigris)] animate-draw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Copied
                        </span>
                      ) : (
                        <IconButton
                          size={18}
                          title="Copy SHA256"
                          onClick={() => handleCopyHash(doc.file_hash)}
                          className="border-transparent bg-transparent hover:bg-[var(--ink-700)] text-[var(--dim)] hover:text-[var(--bone)]"
                          data-testid={`copy-sha-${doc.id}`}
                        >
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </IconButton>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[var(--line-faint)]">
                <Link to="/compare">
                  <Button variant="ghost" className="h-8 text-xs">
                    Compare
                  </Button>
                </Link>
                <Link to="/graph">
                  <Button variant="ghost" className="h-8 text-xs">
                    Graph
                  </Button>
                </Link>
                <Link to="/ask">
                  <Button variant="ghost" className="h-8 text-xs">
                    Ask RAG
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
