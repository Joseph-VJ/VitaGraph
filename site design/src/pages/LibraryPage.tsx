import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  IconButton,
  Marginalia,
  EmptyState,
  ErrorState,
} from "../components/gallery";
import { useActiveUser } from "../context/UserContext";
import { reportsApi } from "../api/reports";
import type { Report } from "../types";
import { setNavDirection, getNavDirection, transitionNavigate } from "../motion/navigation";
import { flip } from "../motion/flip";
import { Sequence } from "../motion/sequence";
import { Odometer } from "../motion/fx/Odometer";
import { governor } from "../motion/quality";
import { isReducedMotion } from "../motion/features";

export const LibraryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";

  const isT0 = isReducedMotion() || governor.getState().tier === "T0";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatusFilter, setAppliedStatusFilter] = useState<string>("all");
  const [exitingIds, setExitingIds] = useState<string[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [navigatingRowId, setNavigatingRowId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsApi.list(effectiveUserId);
      setReports(data);
    } catch (err: any) {
      console.warn("Failed to load reports from backend:", err);
      setError("Failed to load reports: " + (err.message || "Network error"));
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
    new Sequence().wait(1500).addAction(() => setCopiedHash(null)).play();
  };

  const matchesCriteria = (rep: Report, sFilter: string, sQuery: string) => {
    const matchesStatus =
      sFilter === "all" ||
      (sFilter === "ready" && rep.status === "ready") ||
      (sFilter === "failed" && rep.status === "failed");
    const matchesSearch =
      rep.original_filename.toLowerCase().includes(sQuery.toLowerCase()) ||
      rep.file_hash.toLowerCase().includes(sQuery.toLowerCase()) ||
      (rep.report_date && rep.report_date.toLowerCase().includes(sQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  };

  // Exit-aware FLIP on search/filter changes (§M4.4)
  const runFilterWithExit = (nextSearch: string, nextStatus: string) => {
    const currentVisible = reports.filter((rep) =>
      matchesCriteria(rep, appliedStatusFilter, appliedSearch)
    );
    const nextMatches = new Set(
      reports
        .filter((rep) => matchesCriteria(rep, nextStatus, nextSearch))
        .map((r) => r.id)
    );

    const leaving = currentVisible.filter((r) => !nextMatches.has(r.id)).map((r) => r.id);

    if (leaving.length > 0 && !isT0) {
      setExitingIds(leaving);
      new Sequence()
        .wait(180)
        .addAction(() => {
          if (listRef.current) {
            flip(
              listRef.current,
              () => {
                setAppliedSearch(nextSearch);
                setAppliedStatusFilter(nextStatus);
                setExitingIds([]);
              },
              { spring: "weighted", capMs: 240 }
            );
          } else {
            setAppliedSearch(nextSearch);
            setAppliedStatusFilter(nextStatus);
            setExitingIds([]);
          }
        })
        .play();
    } else {
      if (listRef.current && !isT0) {
        flip(
          listRef.current,
          () => {
            setAppliedSearch(nextSearch);
            setAppliedStatusFilter(nextStatus);
          },
          { spring: "weighted", capMs: 240 }
        );
      } else {
        setAppliedSearch(nextSearch);
        setAppliedStatusFilter(nextStatus);
      }
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    runFilterWithExit(val, statusFilter);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    runFilterWithExit(search, val);
  };

  // Target navigation morph (§M4.4)
  const handleNavigateRow = (target: string, docId: string) => {
    setNavigatingRowId(docId);
    setNavDirection(getNavDirection(location.pathname, target));
    transitionNavigate(navigate, target, {
      direction: getNavDirection(location.pathname, target),
    });
  };

  const filteredReports = reports.filter((rep) =>
    matchesCriteria(rep, appliedStatusFilter, appliedSearch)
  );

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
              onClick={() => handleStatusChange(tab.id)}
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

      {error && (
        <ErrorState
          message={error}
          onRetry={loadReports}
          className="mb-2"
        />
      )}

      {/* Overview Stat Strip (§9.4, §M4.4 Odometers) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total indexed</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            <Odometer value={reports.length} duration={480} testId="odo-total-indexed" />
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Clinical panels & lab reports
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total chunks</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            <Odometer value={totalChunks} duration={480} testId="odo-total-chunks" />
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            Vector-embedded in ChromaDB
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Extraction quality</span>
          <span className="type-stat text-2xl font-mono text-[var(--verdigris)] mt-1 flex items-center">
            <Odometer value={qualityRate} duration={480} testId="odo-extraction-quality" />%
          </span>
          <span className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
            {readyCount} native verified
          </span>
        </div>

        <div className="p-3.5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] flex flex-col">
          <span className="type-label text-[var(--dim)]">Total pages</span>
          <span className="type-stat text-2xl font-mono text-[var(--bone)] mt-1">
            <Odometer value={totalPages} duration={480} testId="odo-total-pages" />
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
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search reports by filename, date, or SHA-256 hash..."
            className="w-full bg-transparent type-body text-[var(--bone)] placeholder-[var(--faint)] focus:outline-none text-sm"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="text-xs text-[var(--dim)] hover:text-[var(--bone)]"
            >
              Clear
            </button>
          )}
        </div>

        <Link to="/compare" viewTransition onClick={() => setNavDirection(getNavDirection(location.pathname, "/compare"))}>
          <Button variant="ghost" className="h-10 px-4 text-xs">
            <span>Compare reports</span>
          </Button>
        </Link>

        <Link to="/upload" viewTransition onClick={() => setNavDirection(getNavDirection(location.pathname, "/upload"))}>
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
      <div ref={listRef} data-testid="library-reports-list" className="space-y-3">
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
          <EmptyState
            quote="No reports found matching your criteria. Upload a clinical panel to expand your knowledge graph."
            actionLabel="Upload your first report"
            onAction={() => {
              setNavDirection(getNavDirection(location.pathname, "/upload"));
              transitionNavigate(navigate, "/upload");
            }}
          />
        ) : (
          filteredReports.map((doc, idx) => {
            const isExiting = exitingIds.includes(doc.id);
            const isNavigating = navigatingRowId === doc.id;
            return (
              <div
                key={doc.id}
                data-testid={`library-row-${doc.id}`}
                style={{ animationDelay: `${Math.min(idx * 24, 240)}ms` }}
                className={`p-5 rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-strong)] hover:border-[var(--dim)] transition-all duration-[120ms] ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isExiting || isNavigating ? "m-exit" : "m-enter"
                }`}
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
                      <h3
                        style={{
                          viewTransitionName:
                            isNavigating && !isT0 ? "report-title" : undefined,
                        }}
                        className="type-title text-[var(--bone)] text-base font-medium truncate"
                      >
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
                  <Button
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => handleNavigateRow("/compare", doc.id)}
                    data-testid={`library-compare-btn-${doc.id}`}
                  >
                    Compare
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => handleNavigateRow("/graph", doc.id)}
                    data-testid={`library-graph-btn-${doc.id}`}
                  >
                    Graph
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => handleNavigateRow("/ask", doc.id)}
                    data-testid={`library-ask-btn-${doc.id}`}
                  >
                    Ask RAG
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
