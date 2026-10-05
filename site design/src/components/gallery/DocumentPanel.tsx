// Node inspector: DocumentPanel shows real provenance in the Modernist design.
// Real facts from the API: chunk text, report details, measurement source passage,
// and "Uncertain" for uncertainty nodes.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GraphNode, GraphResponse } from "../../api/graph";
import { type ChunkDetail, type MeasurementRow, reportsApi } from "../../api/reports";
import type { Report } from "../../types";
import { PageState } from "../ui/PageState";
import { Tag } from "../ui/Tag";

export interface DocumentPanelProps {
  selectedNode?: GraphNode | null;
  graph?: GraphResponse | null;
  reports?: Report[];
  onClose?: () => void;
  className?: string;
  userId?: string | null;
  reportFilename?: string | null;
  morphing?: boolean;
}

const KIND_NAMES: Record<string, string> = {
  person: "Subject",
  report: "Report",
  category: "Panel",
  section: "Document section",
  test: "Biomarker",
  measurement: "Measurement",
  uncertainty: "Uncertain",
  chunk: "Text fragment",
  date: "Date",
};

function kindName(type?: string): string {
  const t = (type || "").toLowerCase();
  return KIND_NAMES[t] ?? (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Node");
}

export const DocumentPanel: React.FC<DocumentPanelProps> = ({
  selectedNode,
  graph,
  reports = [],
  onClose,
  className = "",
  userId,
}) => {
  const navigate = useNavigate();

  // Chunk state for chunk & uncertainty nodes
  const [chunkData, setChunkData] = useState<ChunkDetail | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [chunkError, setChunkError] = useState<string | null>(null);

  // Measurement provenance matching state
  const [matchedSource, setMatchedSource] = useState<{
    reportFilename: string;
    page: number;
    charStart: number;
    charEnd: number;
  } | null>(null);
  const [sourceMatchingDone, setSourceMatchingDone] = useState(false);

  // Load chunk passage when selectedNode is chunk or uncertainty
  useEffect(() => {
    if (!selectedNode || !userId) {
      setChunkData(null);
      setChunkLoading(false);
      setChunkError(null);
      return;
    }
    const type = (selectedNode.type || "").toLowerCase();
    if (type !== "chunk" && type !== "uncertainty") {
      setChunkData(null);
      setChunkLoading(false);
      setChunkError(null);
      return;
    }

    const reportId = selectedNode.report_id;
    const chunkId = selectedNode.chunk_id;
    if (!reportId || !chunkId) {
      setChunkData(null);
      setChunkLoading(false);
      setChunkError("Missing report ID or chunk ID.");
      return;
    }

    let cancelled = false;
    setChunkLoading(true);
    setChunkError(null);
    setChunkData(null);

    reportsApi
      .chunk(userId, reportId, chunkId)
      .then((res) => {
        if (!cancelled) {
          setChunkData(res);
          setChunkLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setChunkError(err instanceof Error ? err.message : String(err));
          setChunkLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNode, userId]);

  // Find measurement source passage
  useEffect(() => {
    if (!selectedNode || !userId || !graph) {
      setMatchedSource(null);
      setSourceMatchingDone(false);
      return;
    }
    const type = (selectedNode.type || "").toLowerCase();
    if (type !== "measurement") {
      setMatchedSource(null);
      setSourceMatchingDone(false);
      return;
    }

    let cancelled = false;
    setMatchedSource(null);
    setSourceMatchingDone(false);

    // 1. Find the connected test node through HAS_MEASUREMENT edge
    const hasMeasEdge = graph.edges?.find(
      (e) => e.relation === "HAS_MEASUREMENT" && e.target === selectedNode.id
    );
    const testNode = hasMeasEdge
      ? graph.nodes?.find((n) => n.id === hasMeasEdge.source)
      : null;
    const testName = (testNode?.test_name || testNode?.label || "").trim().toLowerCase();

    // 2. Find the reports whose printed report_date equals the node's date
    const nodeDate = selectedNode.date;
    const dateReports = reports.filter(
      (r) => r.report_date && r.report_date === nodeDate
    );

    if (!testName || dateReports.length === 0) {
      setSourceMatchingDone(true);
      return;
    }

    // 3. Call reportsApi.measurements for each date report
    Promise.all(
      dateReports.map(async (r) => {
        try {
          const rows = await reportsApi.measurements(r.id);
          return { report: r, rows };
        } catch {
          return { report: r, rows: [] as MeasurementRow[] };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const matchingRows: Array<{
        reportFilename: string;
        page: number;
        charStart: number;
        charEnd: number;
      }> = [];

      for (const { report, rows } of results) {
        for (const row of rows) {
          const rowName = (row.test_name || "").trim().toLowerCase();
          const rowUnit = (row.unit || "").trim().toLowerCase();
          const nodeUnit = (selectedNode.unit || "").trim().toLowerCase();

          if (
            rowName === testName &&
            row.value === selectedNode.value &&
            rowUnit === nodeUnit
          ) {
            matchingRows.push({
              reportFilename: report.original_filename,
              page: row.page_number,
              charStart: row.char_start,
              charEnd: row.char_end,
            });
          }
        }
      }

      // 4. With exactly one match, show it. Otherwise show failure message
      if (matchingRows.length === 1) {
        setMatchedSource(matchingRows[0]);
      } else {
        setMatchedSource(null);
      }
      setSourceMatchingDone(true);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedNode, userId, graph, reports]);

  // Connection count for test or generic nodes
  const connectionCount = useMemo(() => {
    if (!selectedNode || !graph?.edges) return 0;
    return graph.edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    ).length;
  }, [selectedNode, graph]);

  // Number of measurements linked to test node
  const testMeasurementCount = useMemo(() => {
    if (!selectedNode || !graph?.edges) return 0;
    return graph.edges.filter(
      (e) => e.source === selectedNode.id && e.relation === "HAS_MEASUREMENT"
    ).length;
  }, [selectedNode, graph]);

  // Matched report info for "report" node
  const matchedReport = useMemo(() => {
    if (!selectedNode) return null;
    const type = (selectedNode.type || "").toLowerCase();
    if (type !== "report") return null;
    const repId = selectedNode.report_id || selectedNode.id.replace(/^rep_/, "");
    return (
      reports.find(
        (r) =>
          r.id === repId ||
          selectedNode.id.includes(r.id) ||
          (r.original_filename && selectedNode.label.includes(r.original_filename))
      ) || null
    );
  }, [selectedNode, reports]);

  const title = selectedNode?.label || selectedNode?.id || "Node details";
  const kicker = selectedNode ? kindName(selectedNode.type) : "Inspector";

  return (
    <section
      aria-label="Node details"
      className={`bg-[var(--color-surface)] border-t-2 border-[var(--color-text)] p-4 flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header row */}
        <div
          data-testid="document-panel-header"
          className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--color-divider)] mb-3"
        >
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-accent-700)] mb-0.5">
              {kicker}
            </div>
            <h2 className="text-[17px] font-extrabold text-[var(--color-text)] leading-tight truncate">
              {title}
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              className="btn btn-ghost text-[13px] px-2 py-1 flex-shrink-0 cursor-pointer"
              onClick={onClose}
              data-testid="document-panel-close"
            >
              Close
            </button>
          )}
        </div>

        {/* Body by node type */}
        {!selectedNode ? (
          <div className="py-8 text-center text-[13px] text-[var(--color-neutral-700)]">
            Select a node to see where it comes from.
          </div>
        ) : (
          <div className="space-y-3 text-[13px] text-[var(--color-text)]">
            {/* report */}
            {selectedNode.type === "report" && (
              <div className="space-y-3">
                <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Filename</span>
                  <span className="font-semibold text-right truncate max-w-[200px]" title={matchedReport?.original_filename || selectedNode.label}>
                    {matchedReport?.original_filename || selectedNode.label}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Date</span>
                  <span className="font-semibold">{matchedReport?.report_date || "Undated"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Pages</span>
                  <span className="font-semibold">
                    {matchedReport?.page_count !== undefined ? `${matchedReport.page_count} pages` : "Unknown"}
                  </span>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    className="btn btn-primary w-full cursor-pointer"
                    onClick={() => navigate("/library")}
                  >
                    Open in library
                  </button>
                </div>
              </div>
            )}

            {/* chunk and uncertainty */}
            {(selectedNode.type === "chunk" || selectedNode.type === "uncertainty") && (
              <div className="space-y-3">
                {selectedNode.type === "uncertainty" && (
                  <div className="space-y-1.5 p-2.5 bg-[var(--color-bg)] border border-[var(--color-divider)]">
                    <div className="flex items-center gap-2">
                      <Tag tone="uncertain">Uncertain</Tag>
                    </div>
                    <p className="text-[12px] text-[var(--color-neutral-700)] leading-normal">
                      No value could be read from this passage, so it is kept as uncertain.
                    </p>
                  </div>
                )}

                {chunkLoading ? (
                  <PageState kind="loading" title="Loading the passage" />
                ) : chunkError ? (
                  <PageState kind="error" title="The passage could not be loaded" detail={chunkError} />
                ) : chunkData ? (
                  <div className="space-y-2">
                    <div className="text-[12px] font-semibold text-[var(--color-neutral-700)]">
                      Page {chunkData.page_number}, characters {chunkData.char_start}–{chunkData.char_end}
                    </div>
                    <div className="p-3 bg-[var(--color-bg)] border border-[var(--color-divider)] text-[12px] font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {chunkData.text}
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] text-[var(--color-neutral-700)]">
                    Page {selectedNode.page ?? 1}
                  </div>
                )}
              </div>
            )}

            {/* measurement */}
            {selectedNode.type === "measurement" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Value</span>
                  <span className="font-extrabold text-[15px]">
                    {selectedNode.value} {selectedNode.unit || ""}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Flag</span>
                  <Tag tone={selectedNode.flag === "LOW" || selectedNode.flag === "HIGH" ? "hot" : "neutral"}>
                    {selectedNode.flag || "NORMAL"}
                  </Tag>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Date</span>
                  <span className="font-semibold">{selectedNode.date || "Undated"}</span>
                </div>

                <div className="pt-2 space-y-1">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-neutral-700)]">
                    Source Provenance
                  </div>
                  {sourceMatchingDone ? (
                    matchedSource ? (
                      <div className="p-2.5 bg-[var(--color-bg)] border border-[var(--color-divider)] text-[12px] space-y-1">
                        <div className="font-semibold text-[var(--color-text)] truncate">
                          {matchedSource.reportFilename}
                        </div>
                        <div className="text-[var(--color-neutral-700)] font-mono">
                          Page {matchedSource.page}, chars {matchedSource.charStart}–{matchedSource.charEnd}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-[var(--color-bg)] border border-[var(--color-divider)] text-[12px] text-[var(--color-neutral-700)]">
                        The source passage could not be matched exactly.
                      </div>
                    )
                  ) : (
                    <div className="text-[12px] text-[var(--color-neutral-700)]">
                      Matching source passage...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* test */}
            {selectedNode.type === "test" && (
              <div className="space-y-3">
                <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Biomarker</span>
                  <span className="font-semibold">{selectedNode.test_name || selectedNode.label}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Category</span>
                  <span className="font-semibold">{selectedNode.category || "General"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                  <span className="text-[var(--color-neutral-700)]">Measurements</span>
                  <span className="font-semibold">{testMeasurementCount} recorded</span>
                </div>
              </div>
            )}

            {/* Any other type */}
            {selectedNode.type !== "report" &&
              selectedNode.type !== "chunk" &&
              selectedNode.type !== "uncertainty" &&
              selectedNode.type !== "measurement" &&
              selectedNode.type !== "test" && (
                <div className="space-y-3">
                  <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                    <span className="text-[var(--color-neutral-700)]">Label</span>
                    <span className="font-semibold">{selectedNode.label}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-divider)]">
                    <span className="text-[var(--color-neutral-700)]">Connections</span>
                    <span className="font-semibold">{connectionCount}</span>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </section>
  );
};

export default DocumentPanel;
