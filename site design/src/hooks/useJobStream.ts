import { useState, useRef, useEffect, useCallback } from "react";
import type { PipelineStep } from "../components/gallery/PipelineStepper";

export interface JobStreamEvent {
  stage: string;
  description: string;
  subDescription?: string;
  latency?: string;
  status?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export type StreamStatus = "idle" | "connecting" | "streaming" | "completed" | "error";

export interface UseJobStreamReturn {
  status: StreamStatus;
  steps: PipelineStep[];
  currentStage: string | null;
  events: JobStreamEvent[];
  latestEvent: JobStreamEvent | null;
  error: string | null;
  eventCount: number;
  finalMetadata: Record<string, any> | null;
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
  const [finalMetadata, setFinalMetadata] = useState<Record<string, any> | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventQueueRef = useRef<JobStreamEvent[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const isDoneRef = useRef<boolean>(false);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Strict cleanup of EventSource connection and dwell timers
  const disconnect = useCallback(() => {
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
    const isEventFailure =
      evt.status === "failed" ||
      evt.status === "error" ||
      evt.metadata?.error ||
      evt.description?.startsWith("Error:");

    if (isEventFailure) {
      const errMsg =
        evt.metadata?.error ||
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
      setSteps((prev) => {
        const next = [...prev];
        if (evt.stage === "received") {
          next[0] = { name: "Received", value: evt.latency || "verified", status: "done" };
          next[1] = { name: "Extracted", value: "parsing layout…", status: "active" };
        } else if (evt.stage === "extracted") {
          next[0] = { name: "Received", value: "verified", status: "done" };
          next[1] = {
            name: "Extracted",
            value: evt.description?.match(/\d+ pages?/)?.[0] || "extracted",
            status: "done",
          };
          next[2] = { name: "Chunked", value: "chunking…", status: "active" };
        } else if (evt.stage === "chunked") {
          next[1] = { name: "Extracted", value: "text ready", status: "done" };
          next[2] = {
            name: "Chunked",
            value: evt.description?.match(/\d+ semantic sections|\d+ chunks/)?.[0] || "chunked",
            status: "done",
          };
          next[3] = { name: "Embedded", value: "embedding…", status: "active" };
        } else if (evt.stage === "embedded") {
          next[2] = { name: "Chunked", value: "sections ready", status: "done" };
          next[3] = { name: "Embedded", value: "384-dim", status: "done" };
          next[4] = { name: "Indexed", value: "indexing…", status: "active" };
        } else if (evt.stage === "indexed") {
          next[3] = { name: "Embedded", value: "384-dim", status: "done" };
          next[4] = { name: "Indexed", value: "ChromaDB ok", status: "done" };
          next[5] = { name: "Graphed", value: "aligning graph…", status: "active" };
        } else if (evt.stage === "graphed") {
          next[4] = { name: "Indexed", value: "ChromaDB ok", status: "done" };
          next[5] = { name: "Graphed", value: "NetworkX mapped", status: "done" };
        } else if (evt.stage === "done") {
          const pageCount = evt.metadata?.pages || evt.metadata?.report?.page_count || 1;
          const chunkCount = evt.metadata?.chunks || evt.metadata?.report?.chunk_count || 1;
          const reportId = evt.metadata?.report_id || evt.metadata?.report?.id;

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
          return [
            { name: "Received", value: "verified", status: "done" },
            { name: "Extracted", value: `${pageCount} pages`, status: "done" },
            { name: "Chunked", value: `${chunkCount} chunks`, status: "done" },
            { name: "Embedded", value: "384-dim", status: "done" },
            { name: "Indexed", value: "ChromaDB ok", status: "done" },
            { name: "Graphed", value: "NetworkX mapped", status: "done" },
          ];
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
        { name: "Received", value: "uploading…", status: "active" },
        { name: "Extracted", value: "pending", status: "pending" },
        { name: "Chunked", value: "pending", status: "pending" },
        { name: "Embedded", value: "pending", status: "pending" },
        { name: "Indexed", value: "pending", status: "pending" },
        { name: "Graphed", value: "pending", status: "pending" },
      ]);

      const backendUrl = "http://127.0.0.1:8000";
      const es = new EventSource(`${backendUrl}/api/jobs/${jobId}/events`);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus("streaming");
      };

      es.onmessage = (e) => {
        if (!isMountedRef.current) return;
        try {
          const evt: JobStreamEvent = JSON.parse(e.data);
          if (evt && (evt.stage || evt.status)) {
            if (evt.stage === "done" || evt.status === "completed" || evt.status === "error" || evt.status === "failed") {
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

      es.onerror = () => {
        if (isDoneRef.current) {
          disconnect();
          return;
        }
        disconnect();
        if (!isMountedRef.current) return;
        const errMessage = "Backend connection lost. Pipeline interrupted mid-upload.";
        setError(errMessage);
        setStatus("error");
        setSteps((prev) =>
          prev.map((s) =>
            s.status === "active" ? { ...s, value: "interrupted", status: "pending" } : s
          )
        );
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
