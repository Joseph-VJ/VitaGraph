// Builds the AI Agent's activity feed (what it did, in order) from stream events.
// Pure functions: the live stream and a reopened conversation go through the same code.

import type { AgentEvidence, TrajectoryItem, TrajectoryKind } from "../hooks/useAgentChat";

type Json = Record<string, unknown>;

export function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clip(value: unknown): string {
  return String(value ?? "").trim().slice(0, 80);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

// Plain words for each tool; never an empty quote.
export function toolLabel(tool: string, args: Json): string {
  switch (tool) {
    case "search_reports":
    case "search_chroma": {
      const query = clip(args.query);
      return query ? `Searched your reports for "${query}"` : "Searched your reports";
    }
    case "list_reports":
      return "Listed your reports";
    case "calculate": {
      const expression = clip(args.expression);
      return expression ? `Calculated ${expression}` : "Calculated";
    }
    case "get_measurements":
      return "Read the values of a report";
    case "graph_lookup":
    case "query_networkx_graph": {
      const concept = clip(args.concept);
      return concept ? `Looked up "${concept}" in the knowledge graph` : "Looked through the knowledge graph";
    }
    default:
      return "Used a tool";
  }
}

export function toolSummary(tool: string, result: Json): { detail: string; failed: boolean } {
  if (typeof result.error === "string") return { detail: result.error, failed: true };
  if (tool === "search_reports" || tool === "search_chroma") {
    const count = Array.isArray(result.evidence) ? result.evidence.length : 0;
    const base = plural(count, "passage found", "passages found");
    return { detail: typeof result.fallback === "string" ? `${base} (opening of the report: nothing matched closely)` : base, failed: false };
  }
  if (tool === "calculate") {
    const text = typeof result.text === "string" ? result.text : "";
    const at = text.lastIndexOf("= ");
    return { detail: at >= 0 ? `= ${text.slice(at + 2)}` : "Done", failed: false };
  }
  if (tool === "list_reports") {
    return { detail: plural(Array.isArray(result.reports) ? result.reports.length : 0, "report", "reports"), failed: false };
  }
  if (tool === "get_measurements") {
    return { detail: plural(Array.isArray(result.measurements) ? result.measurements.length : 0, "value", "values"), failed: false };
  }
  return { detail: "Done", failed: false };
}

function isEvidence(value: unknown): value is AgentEvidence {
  const record = asRecord(value);
  return typeof record.ref === "number" && typeof record.chunk_id === "string";
}

/** Evidence cards carried by a search result. */
export function evidenceFrom(tool: string, result: Json): AgentEvidence[] {
  return (tool === "search_reports" || tool === "search_chroma") && Array.isArray(result.evidence)
    ? result.evidence.filter(isEvidence)
    : [];
}

/** A running row of these kinds ends as soon as something else happens. */
export function closeRunning(items: TrajectoryItem[], kinds: TrajectoryKind[]): TrajectoryItem[] {
  if (!items.some((i) => i.status === "running" && kinds.includes(i.kind))) return items;
  return items.map((i) => (i.status === "running" && kinds.includes(i.kind) ? { ...i, status: "done" as const } : i));
}

export function settleItems(items: TrajectoryItem[]): TrajectoryItem[] {
  return items.map((i) => (i.status === "running" ? { ...i, status: "done" as const } : i));
}

export interface FeedContext {
  /** A new unique row id. */
  id: () => string;
  /** Time for live clocks; null when replaying a saved conversation. */
  now: number | null;
}

/** Apply one stream event (not text or stats) to the feed. */
export function applyFeedEvent(items: TrajectoryItem[], event: string, p: Json, ctx: FeedContext): TrajectoryItem[] {
  switch (event) {
    case "status": {
      const phase = String(p.phase ?? "");
      const message = String(p.message ?? "");
      if (!message) return items;
      if (phase === "starting") {
        return [...items, { id: ctx.id(), kind: "status", label: message, detail: "", status: "running", startedAt: ctx.now ?? undefined }];
      }
      const closed = closeRunning(items, ["status"]);
      if (phase === "retrying") {
        const attempt = numberOrNull(p.attempt);
        const label = attempt === null ? message : `${message} (attempt ${attempt})`;
        return [...closed, { id: ctx.id(), kind: "status", label, detail: "", status: "done" }];
      }
      return closed;
    }

    case "step":
      // Steps are shown through their model calls; a new step only ends the start-up row.
      return p.phase === "start" ? closeRunning(items, ["status"]) : closeRunning(items, ["reasoning"]);

    case "model": {
      const call = numberOrNull(p.call) ?? 0;
      const rowId = `model_${call}`;
      if (p.phase === "start") {
        if (items.some((i) => i.id === rowId)) return items;
        return [
          ...closeRunning(items, ["status", "reasoning"]),
          { id: rowId, kind: "model", label: call > 1 ? "Model is reading the results" : "Model is thinking", detail: "", status: "running", startedAt: ctx.now ?? undefined },
        ];
      }
      const base = items.some((i) => i.id === rowId)
        ? items
        : [...items, { id: rowId, kind: "model" as const, label: "Model", detail: "", status: "running" as const }];
      if (p.phase === "error") {
        return base.map((i) =>
          i.id === rowId ? { ...i, status: "failed" as const, detail: String(p.message ?? "The model did not answer.") } : i
        );
      }
      return closeRunning(base, ["reasoning"]).map((i) =>
        i.id === rowId
          ? {
              ...i,
              status: "done" as const,
              label: call > 1 ? "Model read the results" : "Model finished thinking",
              meta: {
                ms: numberOrNull(p.ms),
                firstMs: numberOrNull(p.first_ms),
                inputTokens: numberOrNull(p.input_tokens),
                outputTokens: numberOrNull(p.output_tokens),
                toolCalls: numberOrNull(p.tool_calls) ?? 0,
              },
            }
          : i
      );
    }

    case "thinking": {
      const text = String(p.thinking ?? "");
      if (!text) return items;
      const next = items.slice();
      const last = next[next.length - 1];
      if (last && last.kind === "reasoning" && last.status === "running") {
        next[next.length - 1] = { ...last, detail: last.detail + text };
      } else {
        next.push({ id: ctx.id(), kind: "reasoning", label: "Thinking", detail: text, status: "running" });
      }
      return next;
    }

    case "note": {
      const text = String(p.text ?? "").trim();
      return text ? [...closeRunning(items, ["reasoning"]), { id: ctx.id(), kind: "note", label: "", detail: text, status: "done" }] : items;
    }

    case "tool_call": {
      const callId = String(p.id ?? ctx.id());
      const tool = String(p.tool ?? "");
      const args = asRecord(p.arguments);
      const closed = closeRunning(items, ["status", "reasoning"]);
      if (closed.some((i) => i.id === callId)) return closed;
      return [
        ...closed,
        { id: callId, kind: "tool", label: toolLabel(tool, args), detail: "", status: "running", tool, args, result: null, durationMs: null, startedAt: ctx.now ?? undefined },
      ];
    }

    case "tool_result": {
      const callId = String(p.id ?? "");
      const tool = String(p.tool ?? "");
      const result = asRecord(p.result);
      const { detail, failed } = toolSummary(tool, result);
      const failedFlag = failed || p.is_error === true;
      const durationMs = numberOrNull(p.duration_ms);
      return items.map((i) =>
        i.id === callId ? { ...i, detail, result, durationMs, status: failedFlag ? ("failed" as const) : ("done" as const) } : i
      );
    }

    default:
      return items;
  }
}

/** Event type of one saved feed item (older saves had no `event` field). */
function savedEventType(raw: Json): string {
  if (typeof raw.event === "string") return raw.event;
  if ("arguments" in raw) return "tool_call";
  if ("result" in raw) return "tool_result";
  if ("thinking" in raw) return "thinking";
  return "";
}

/** Rebuild the feed of a saved turn by replaying its stored events. */
export function replaySavedFeed(saved: unknown): TrajectoryItem[] {
  if (!Array.isArray(saved)) return [];
  let n = 0;
  const ctx: FeedContext = { id: () => `saved_${n++}`, now: null };
  let items: TrajectoryItem[] = [];
  for (const entry of saved) {
    const raw = asRecord(entry);
    const type = savedEventType(raw);
    if (type === "model") {
      const call = numberOrNull(raw.call) ?? n;
      items = applyFeedEvent(items, "model", { phase: "start", call }, ctx);
      items = applyFeedEvent(items, "model", raw, ctx);
    } else if (type) {
      items = applyFeedEvent(items, type, raw, ctx);
    }
  }
  return settleItems(items);
}
