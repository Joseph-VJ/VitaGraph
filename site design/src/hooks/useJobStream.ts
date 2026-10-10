import { useState, useRef, useEffect, useCallback } from "react";
import type { PipelineStep } from "../components/gallery/PipelineStepper";
import { BASE_URL } from "../api/client";
import { getActivity, setActivity } from "../lib/appActivity";

export interface JobStreamEvent {
  stage: string;
  description: string;
  subDescription?: string;
  latency?: string;
  status?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export type StreamStatus = "idle" | "connecting" | "streaming" | "completed" | "error";

export interface FinalJobMetadata {
  pages?: number | null;
  chunks?: number | null;
  reportId?: string | null;
  [key: string]: unknown;
}

export interface UseJobStreamReturn {
  status: StreamStatus;
  steps: PipelineStep[];
  currentStage: string | null;
  events: JobStreamEvent[];
  latestEvent: JobStreamEvent | null;
  error: string | null;
  eventCount: number;
  finalMetadata: FinalJobMetadata | null;
  activeJobId: string | null;
  connect: (jobId: string) => void;
  disconnect: () => void;
  reset: () => void;
}

const INITIAL_STEPS: PipelineStep[] = [
  { name: "Received", value: "pending", status: "pending" },
  { name: "Extracted", value: "pending", status: "pending" },
  { name: "Chunked", value: "pending", status: "pending" },
  { name: "Embedded", value: "pending", status: "pending" },
  { name: "Indexed", value: "pending", status: "pending" },
  { name: "Graphed", value: "pending", status: "pending" },
];

export function useJobStream(): UseJobStreamReturn {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [events, setEvents] = useState<JobStreamEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<JobStreamEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [finalMetadata, setFinalMetadata] = useState<FinalJobMetadata | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventQueueRef = useRef<JobStreamEvent[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const isDoneRef = useRef<boolean>(false);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strict cleanup of EventSource connection and dwell timers
  const disconnect = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    eventQueueRef.current = [];
    isProcessingQueueRef.current = false;
  }, []);

  const reset = useCallback(() => {
    disconnect();
    if (!isMountedRef.current) return;
    setStatus("idle");
    setSteps(INITIAL_STEPS);
    setCurrentStage(null);
    setEvents([]);
    setLatestEvent(null);
    setError(null);
    setEventCount(0);
    setFinalMetadata(null);
    setActiveJobId(null);
  }, [disconnect]);

  // Lifecycle memory-leak prevention
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (getActivity().upload && !isDoneRef.current) {
        setActivity({ upload: null });
      }
      disconnect();
    };
  }, [disconnect]);

  const processQueue = useCallback(() => {
    if (!isMountedRef.current) return;

    if (eventQueueRef.current.length === 0) {
      isProcessingQueueRef.current = false;
      return;
    }
    isProcessingQueueRef.current = true;
    const evt = eventQueueRef.current.shift();
    if (!evt) {
      isProcessingQueueRef.current = false;
      return;
    }

    setEventCount((prev) => prev + 1);
    setLatestEvent(evt);
    setEvents((prev) => [...prev, evt]);
    if (evt.stage) {
      setCurrentStage(evt.stage);
    }

    // Check for explicit error/failed status in any event
    const metaError =
      typeof evt.metadata?.error === "string" ? evt.metadata.error : null;
    const isEventFailure =
      evt.status === "failed" ||
      evt.status === "error" ||
      Boolean(metaError) ||
      (typeof evt.description === "string" && evt.description.startsWith("Error:"));

    if (isEventFailure) {
      setActivity({ upload: null });
      const errMsg =
        metaError ||
        evt.description ||
        "Corrupted document structure or unreadable text layers.";
      setError(errMsg);
      setStatus("error");
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "active" ? { ...s, value: "quarantined", status: "pending" } : s
        )
      );
      disconnect();
      return;
    }

    if (evt.stage) {
      if (evt.stage === "received" || evt.stage === "extracting") {
        setActivity({ upload: { stage: 0 } });
      } else if (evt.stage === "extracted") {
        setActivity({ upload: { stage: 1 } });
      } else if (evt.stage === "chunked") {
        setActivity({ upload: { stage: 2 } });
      } else if (evt.stage === "embedded") {
        setActivity({ upload: { stage: 3 } });
      } else if (evt.stage === "indexed" || evt.stage === "graphed") {
        setActivity({ upload: { stage: 4 } });
      } else if (evt.stage === "done") {
        setActivity({ upload: null, finished: getActivity().finished + 1 });
      }

      setSteps((prev) => {
        const next = [...prev];
        if (evt.stage === "received") {
          next[0] = { name: "Received", value: evt.latency || "stored", status: "done" };
          next[1] = { name: "Extracted", value: "running", status: "active" };
        } else if (evt.stage === "extracting") {
          const pageNum = typeof evt.metadata?.page_number === "number" ? evt.metadata.page_number : null;
          const totalPages = typeof evt.metadata?.total_pages === "number" ? evt.metadata.total_pages : null;
          const val = pageNum !== null && totalPages !== null ? `page ${pageNum} of ${totalPages}` : "running";
          next[1] = { name: "Extracted", value: val, status: "active" };
        } else if (evt.stage === "extracted") {
          const pageCount =
            typeof evt.metadata?.page_count === "number"
              ? evt.metadata.page_count
              : typeof evt.metadata?.pages === "number"
                ? evt.metadata.pages
                : Array.isArray(evt.metadata?.pages)
                  ? evt.metadata.pages.length
                  : null;
          next[1] = {
            name: "Extracted",
            value: pageCount !== null ? `${pageCount} pages` : "running",
            status: "done",
          };
          next[2] = { name: "Chunked", value: "running", status: "active" };
        } else if (evt.stage === "chunked") {
          const totalChunks =
            typeof evt.metadata?.total_chunks === "number"
              ? evt.metadata.total_chunks
              : typeof evt.metadata?.chunks === "number"
                ? evt.metadata.chunks
                : null;
          next[2] = {
            name: "Chunked",
            value: totalChunks !== null ? `${totalChunks} chunks` : "running",
            status: "done",
          };
          next[3] = { name: "Embedded", value: "running", status: "active" };
        } else if (evt.stage === "embedded") {
          const count = typeof evt.metadata?.count === "number" ? evt.metadata.count : null;
          const dim = typeof evt.metadata?.dim === "number" ? evt.metadata.dim : null;
          const embedVal = count !== null && dim !== null ? `${count} vectors, ${dim} dimensions` : "running";
          next[3] = { name: "Embedded", value: embedVal, status: "done" };
          next[4] = { name: "Indexed", value: "running", status: "active" };
        } else if (evt.stage === "indexed") {
          const indexed = typeof evt.metadata?.indexed === "number" ? evt.metadata.indexed : null;
          next[4] = {
            name: "Indexed",
            value: indexed !== null ? `${indexed} indexed` : "running",
            status: "done",
          };
          next[5] = { name: "Graphed", value: "running", status: "active" };
        } else if (evt.stage === "graphed") {
          let graphVal = "running";
          if (evt.metadata?.error) {
            graphVal = "graph not built";
          } else {
            const nodes = typeof evt.metadata?.total_nodes === "number" ? evt.metadata.total_nodes : null;
            const edges = typeof evt.metadata?.total_edges === "number" ? evt.metadata.total_edges : null;
            if (nodes !== null && edges !== null) {
              graphVal = `${nodes} nodes, ${edges} edges`;
            }
          }
          next[5] = { name: "Graphed", value: graphVal, status: "done" };
        } else if (evt.stage === "done") {
          const reportObj =
            typeof evt.metadata?.report === "object" && evt.metadata.report !== null
              ? (evt.metadata.report as Record<string, unknown>)
              : undefined;
          const pageCount =
            typeof evt.metadata?.pages === "number"
              ? evt.metadata.pages
              : typeof reportObj?.page_count === "number"
                ? reportObj.page_count
                : null;
          const chunkCount =
            typeof evt.metadata?.chunks === "number"
              ? evt.metadata.chunks
              : typeof reportObj?.chunk_count === "number"
                ? reportObj.chunk_count
                : null;
          const rawReportId = evt.metadata?.report_id ?? reportObj?.id;
          const reportId = typeof rawReportId === "string" ? rawReportId : (rawReportId ? String(rawReportId) : null);

          setFinalMetadata({
            pages: pageCount,
            chunks: chunkCount,
            reportId,
            ...(evt.metadata || {}),
          });

          setStatus("completed");
          window.dispatchEvent(new CustomEvent("vitagraph:job-done", { detail: evt }));

          try {
            localStorage.setItem(
              "vitagraph:last_job_done",
              JSON.stringify({ time: Date.now(), stage: "done", reportId })
            );
          } catch {}

          disconnect();
          return next.map((s) => ({ ...s, status: "done" as const }));
        }
        return next;
      });

      if (evt.stage === "done") {
        disconnect();
        return;
      }
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dwellMs = prefersReducedMotion ? 0 : 280;

    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }

    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null;
      if (isMountedRef.current) {
        processQueue();
      }
    }, dwellMs);
  }, [disconnect]);

  const connect = useCallback(
    (jobId: string) => {
      disconnect();
      setActiveJobId(jobId);
      setStatus("connecting");
      setError(null);
      setEvents([]);
      setLatestEvent(null);
      setEventCount(0);
      setFinalMetadata(null);
      setCurrentStage("received");
      isDoneRef.current = false;

      setSteps([
        { name: "Received", value: "running", status: "active" },
        { name: "Extracted", value: "pending", status: "pending" },
        { name: "Chunked", value: "pending", status: "pending" },
        { name: "Embedded", value: "pending", status: "pending" },
        { name: "Indexed", value: "pending", status: "pending" },
        { name: "Graphed", value: "pending", status: "pending" },
      ]);

      const backendUrl = BASE_URL;
      const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus("streaming");
      };

      const handleData = (raw: string) => {
        if (!isMountedRef.current) return;
        try {
          const evt: JobStreamEvent = JSON.parse(raw);
          if (evt && (evt.stage || evt.status)) {
            if (
              evt.stage === "done" ||
              evt.status === "completed" ||
              evt.status === "error" ||
              evt.status === "failed"
            ) {
              isDoneRef.current = true;
            }
            eventQueueRef.current.push(evt);
            if (!isProcessingQueueRef.current) {
              processQueue();
            }
          }
        } catch {
          // SSE comment or keep-alive
        }
      };

      es.onmessage = (e) => {
        handleData(e.data);
      };

      es.addEventListener("page_extracted", (e: Event) => {
        const me = e as MessageEvent;
        if (typeof me.data === "string") {
          handleData(me.data);
        }
      });

      es.addEventListener("completed", (e: Event) => {
        const me = e as MessageEvent;
        if (typeof me.data === "string") {
          handleData(me.data);
        }
      });

      // The SSE socket can drop while the backend is busy extracting/embedding, even though the
      // job keeps running. Before declaring failure, ask the job endpoint what really happened.
      const failInterrupted = () => {
        if (!isMountedRef.current || isDoneRef.current) return;
        disconnect();
        setActivity({ upload: null });
        setError("Backend connection lost. Pipeline interrupted mid-upload.");
        setStatus("error");
        setSteps((prev) =>
          prev.map((s) =>
            s.status === "active" ? { ...s, value: "interrupted", status: "pending" } : s
          )
        );
      };

      const recover = (attempt: number) => {
        recoveryTimerRef.current = setTimeout(async () => {
          recoveryTimerRef.current = null;
          if (!isMountedRef.current || isDoneRef.current) return;
          try {
            const res = await fetch(`${backendUrl}/api/jobs/${jobId}/result`);
            if (!isMountedRef.current || isDoneRef.current) return;
            if (res.ok) {
              const body = await res.json();
              if (body.status === "completed" && body.result) {
                isDoneRef.current = true;
                eventQueueRef.current.push({
                  stage: "done",
                  description: "Pipeline completed",
                  status: "completed",
                  metadata: {
                    pages: body.result.page_count,
                    chunks: body.result.chunk_count,
                    report_id: body.result.id,
                    report: body.result,
                  },
                });
                if (!isProcessingQueueRef.current) processQueue();
                return;
              }
              if (body.status === "error") {
                isDoneRef.current = true;
                eventQueueRef.current.push({
                  stage: "done",
                  description: `Error: ${body.error || "Pipeline failed"}`,
                  status: "failed",
                  metadata: { error: body.error || "Pipeline failed" },
                });
                if (!isProcessingQueueRef.current) processQueue();
                return;
              }
            }
          } catch {
            // backend unreachable; keep retrying until the attempt budget runs out
          }
          if (attempt < 40) recover(attempt + 1);
          else failInterrupted();
        }, 1500);
      };

      es.onerror = (e: Event) => {
        if ("data" in e && typeof (e as MessageEvent).data === "string" && (e as MessageEvent).data.length > 0) {
          handleData((e as MessageEvent).data);
          return;
        }
        if (isDoneRef.current) {
          // The server closes the stream once it has sent everything. Close the socket only: events that are
          // still waiting in the queue must still be shown (disconnect() would throw them away).
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          return;
        }
        // Stop the browser's auto-reconnect (it would replay and duplicate events) and poll instead.
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        if (!recoveryTimerRef.current && isMountedRef.current) recover(0);
      };
    },
    [disconnect, processQueue]
  );

  return {
    status,
    steps,
    currentStage,
    events,
    latestEvent,
    error,
    eventCount,
    finalMetadata,
    activeJobId,
    connect,
    disconnect,
    reset,
  };
}
