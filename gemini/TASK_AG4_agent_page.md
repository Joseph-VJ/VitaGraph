# TASK AG4: the AI Agent page (the old Ask page is replaced completely; T09b is folded in)

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report 5b**, **quality bar 5c**, **5d: the AI API may be blocked, never work around it**). Read `gemini/reviews/TASK_AG3_review.md`, `gemini/reviews/TASK_AG3b_review.md` and `gemini/reviews/TASK_09a_review.md`. Then LOOK at `design/reference/screens/02_Ask.png` and read `design/reference/app-v3-source.html` lines 499-590: the AI Agent page keeps that visual language (960 px centred column, question bubble with a 2 px top rule, sticky composer, flat Modernist look) and adds the agent parts.

This task is **frontend only**. Do not touch `vitagraph/backend/`. The backend route `POST /api/agent/stream` already exists and is accepted; its event contract is in section "The stream contract" below. Habits the reviews ask for: copy line counts from `git diff --stat`, believe the output when it contradicts your checklist, answer PARTIAL when evidence is partial, never print `.env` or a key, list every visual oddity you see.

## What this task delivers
1. **The Ask page is gone.** The route is now `/agent`, page title and sidebar label **"AI Agent"**. `/ask` stays only as a redirect (it keeps the query string, because the Upload page and the header search used `/ask?report=` and `/ask?q=`; both are switched to `/agent`).
2. **A new hook `useAgentChat`** that consumes `POST /api/agent/stream` (fetch + ReadableStream + AbortController, full cleanup on unmount).
3. **Harness-style UI**: a *trajectory* panel per question (steps, reasoning, retries, tool-call cards with arguments, result summary and raw result), a *live stats strip* (steps, tool calls, time, tokens only when the backend sent them), the streamed Markdown answer with **citation chips** `[n]`, the **highlighted passage slip**, and the **Evidence / Limitations / Safety** columns (this is the former Task 09b, folded in).
4. **Dead code removed**: the old Ask components, the old chat hook, and the unused `components/agent/*` + `useAgentStream.ts` (nobody imports them; you prove it with grep before deleting).

No provider or model name may appear anywhere in the UI. The page says "AI Agent" only.

## The stream contract (what the backend sends; do not change the backend)
SSE frames `event: <type>` + `data: {...envelope...}`; the typed payload is `envelope.metadata`; `envelope.stage` is `"done"` ONLY on the last frame. Event types and metadata:
| event | metadata |
|---|---|
| `status` | `{phase: "starting"\|"working"\|"retrying", message: string, attempt?: number}` |
| `thinking` | `{thinking: string}` |
| `step` | `{phase: "start"\|"end", step: number}` |
| `tool_call` | `{id: string, tool: string, arguments: object, step: number}`; `tool` is `search_reports`, `list_reports`, `get_measurements` or `graph_lookup` (the offline path uses `search_chroma`) |
| `tool_result` | `{id: string, tool: string, result: object, is_error?: boolean, duration_ms?: number}` |
| `text_delta` | `{delta: string}` (the answer arrives one agent step at a time, not token by token) |
| `stats` | `{turns, steps, tool_calls, elapsed_ms, input_tokens?, output_tokens?, reasoning_tokens?}` (token keys only when reported) |
| `completed` (stage generation) | `{status: "answered"\|"refused"\|"insufficient_evidence", summary_text, evidence: card[], evidence_count, safety_passed, safety_note\|null, ai_status: "ok"\|"not_used", session_title\|null, conversation_id}` |
| `completed` (stage done, last) | `{status, ai_status, evidence_count, question_id, conversation_id, session_title}` |
| `error` (stage done, last) | `{status: "error", message, diagnostic}`; show only `message`, never `diagnostic` (it can carry gateway text) |

An evidence card is `{ref, chunk_id, report_id, report_filename, report_date, page_number, snippet, score, char_start, char_end}`. Request body: `{user_id, messages: [{role, content}...], conversation_id, report_id?}` (the whole conversation, the last message is the new question; `conversation_id` must match `^[A-Za-z0-9_-]{1,64}$`).

## Files you may change (closed list)
**Delete (`git rm`, after the grep proof in Step 1):**
`site design/src/pages/AskPage.tsx`, `site design/src/hooks/useChatStream.ts`, `site design/src/hooks/useAgentStream.ts`, `site design/src/components/ask/AnswerMarkdown.tsx`, `site design/src/components/ask/StepsPanel.tsx`, `site design/src/components/agent/AgentThoughtTree.tsx`, `site design/src/components/agent/ChatComposer.tsx`, `site design/src/components/agent/ChatTurn.tsx`, `site design/src/components/agent/DocumentPane.tsx`, `site design/src/components/agent/PaperAnswer.tsx`, `site design/src/components/agent/chatTypes.ts`.
**Create:** `site design/src/hooks/useAgentChat.ts`, `site design/src/pages/AgentPage.tsx`, `site design/src/components/agent/AnswerMarkdown.tsx`, `site design/src/components/agent/PassageSlip.tsx`, `site design/src/components/agent/EvidenceModules.tsx`, `site design/src/components/agent/TrajectoryPanel.tsx`.
**Edit:** `site design/src/App.tsx`, `site design/src/components/shell/Sidebar.tsx`, `site design/src/components/shell/AppShell.tsx`, `site design/src/components/shell/Header.tsx`, `site design/src/motion/navigation.ts`, `site design/src/pages/UploadPage.tsx` (only the two `navigate` targets), `site design/src/index.css` (one block appended).
**Also:** NEW `gemini/reports/TASK_AG4_report.md`, screenshots `gemini/shots/ag4-*.png`.
Everything else is forbidden (no backend, no `docs/`, no `design/`, no other pages, no `tsconfig.tsbuildinfo` staging). Do not add npm packages.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
Branch `redesign/modernist-app`; the build exits 0.

## Step 1: prove the files to delete are dead, then delete
Run (from `site design`) and paste the output:
```
Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'useAgentStream|components/agent|useChatStream|components/ask|AskPage' | Select-Object Path,LineNumber,Line
```
Expected: matches only inside the files you are about to delete, plus `src/App.tsx` (the `AskPage` import and route). If any OTHER file imports one of the deleted modules, STOP and report BLOCKED with the list. Then:
```
git rm "site design/src/hooks/useAgentStream.ts" "site design/src/components/agent/AgentThoughtTree.tsx" "site design/src/components/agent/ChatComposer.tsx" "site design/src/components/agent/ChatTurn.tsx" "site design/src/components/agent/DocumentPane.tsx" "site design/src/components/agent/PaperAnswer.tsx" "site design/src/components/agent/chatTypes.ts" "site design/src/components/ask/AnswerMarkdown.tsx" "site design/src/components/ask/StepsPanel.tsx"
git mv "site design/src/hooks/useChatStream.ts" "site design/src/hooks/useAgentChat.ts"
git mv "site design/src/pages/AskPage.tsx" "site design/src/pages/AgentPage.tsx"
```
(The two moves keep Git history; you rewrite both files below. The build is red until the end of Step 8: that is expected.)

## Step 2: the hook `site design/src/hooks/useAgentChat.ts`
Start from the moved file (the old chat hook; read it fully). KEEP its structure and its cleanup discipline exactly: `commit`, `patch`, `flushNow` (requestAnimationFrame coalescing of `text_delta`), `teardown` (abort the controller, cancel the frame), the mount effect that tears everything down on unmount, `fail`, `stop`, `reset`, the SSE parser loop (blocks split on a blank line, `:` comment lines skipped, `event:`/`data:` lines, `event_type` fallback, `sawTerminal` rule, the three catch messages). RENAME and CHANGE exactly as follows.

**2a. Replace the exported types and the top comment** (the first lines through `UseChatStreamReturn`) with:
```ts
import { useCallback, useEffect, useRef, useState } from "react";

// Consumes POST /api/agent/stream. EventSource is GET-only, so the stream is read through fetch + ReadableStream
// and torn down with an AbortController (same cleanup discipline as useJobStream).
// The hook owns the whole conversation: every call to send() appends one entry and streams into it, and the
// earlier answered entries are sent back to the backend as the conversation memory.

import { BASE_URL } from "../api/client";

export interface AgentEvidence {
  ref: number;
  chunk_id: string;
  report_id: string;
  report_filename: string;
  report_date: string | null;
  page_number: number;
  snippet: string;
  score: number;
  char_start: number | null;
  char_end: number | null;
}

export type TrajectoryKind = "status" | "step" | "reasoning" | "tool";
export type TrajectoryStatus = "running" | "done" | "failed";

export interface TrajectoryItem {
  id: string;
  kind: TrajectoryKind;
  label: string;
  detail: string;
  status: TrajectoryStatus;
  tool?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  durationMs?: number | null;
}

export interface AgentStats {
  steps: number;
  toolCalls: number;
  elapsedMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}

export type EntryStatus = "streaming" | "answered" | "refused" | "insufficient_evidence" | "error" | "stopped";

export interface AgentEntry {
  id: string;
  question: string;
  startedAt: number;
  endedAt: number | null;
  status: EntryStatus;
  answer: string;
  trajectory: TrajectoryItem[];
  stats: AgentStats | null;
  evidence: AgentEvidence[];
  withheld: boolean;
  safetyNote: string | null;
  aiStatus: string | null;
  title: string | null;
  error: string | null;
}

export interface UseAgentChatReturn {
  entries: AgentEntry[];
  isStreaming: boolean;
  send: (userId: string, text: string, reportId?: string | null) => void;
  stop: () => void;
  reset: () => void;
}
```
Rename `ChatEntry` to `AgentEntry`, `ChatEvidence` to `AgentEvidence`, `useChatStream` to `useAgentChat`, `UseChatStreamReturn` to `UseAgentChatReturn` everywhere in the file. Remove `ChatStep`, `StepKind`, `StepStatus`, `closeThinking`, `settleSteps`, the `thinkingOpenRef` and `fallbackNotice`.

**2b. Replace the helper functions** (`isEvidence` stays; replace `toolLabel`, `toolDetail`, `closeThinking`, `settleSteps`) with:
```ts
function clip(value: unknown): string {
  return String(value ?? "").trim().slice(0, 80);
}

// Plain words for each tool; never an empty quote.
function toolLabel(tool: string, args: Json): string {
  switch (tool) {
    case "search_reports":
    case "search_chroma": {
      const query = clip(args.query);
      return query ? `Searched your reports for "${query}"` : "Searched your reports";
    }
    case "list_reports":
      return "Listed your reports";
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

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

function toolSummary(tool: string, result: Json): { detail: string; failed: boolean } {
  if (typeof result.error === "string") return { detail: result.error, failed: true };
  if (tool === "search_reports" || tool === "search_chroma") {
    return { detail: plural(Array.isArray(result.evidence) ? result.evidence.length : 0, "passage found", "passages found"), failed: false };
  }
  if (tool === "list_reports") {
    return { detail: plural(Array.isArray(result.reports) ? result.reports.length : 0, "report", "reports"), failed: false };
  }
  if (tool === "get_measurements") {
    return { detail: plural(Array.isArray(result.measurements) ? result.measurements.length : 0, "value", "values"), failed: false };
  }
  return { detail: "Done", failed: false };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// A running reasoning or status row is finished as soon as something else happens.
function closeRunning(items: TrajectoryItem[], kinds: TrajectoryKind[]): TrajectoryItem[] {
  if (!items.some((i) => i.status === "running" && kinds.includes(i.kind))) return items;
  return items.map((i) => (i.status === "running" && kinds.includes(i.kind) ? { ...i, status: "done" as const } : i));
}

function settle(entry: AgentEntry): AgentEntry {
  return { ...entry, trajectory: entry.trajectory.map((i) => (i.status === "running" ? { ...i, status: "done" as const } : i)) };
}
```
`fail` must call `settle` instead of `settleSteps`; `stop` too.

**2c. In `send`:** the new entry literal becomes
```ts
{
  id,
  question,
  startedAt: Date.now(),
  endedAt: null,
  status: "streaming",
  answer: "",
  trajectory: [],
  stats: null,
  evidence: [],
  withheld: false,
  safetyNote: null,
  aiStatus: null,
  title: null,
  error: null,
},
```
Add `const conversationIdRef = useRef<string | null>(null);` next to the other refs. In `send`, before building the request: `if (!conversationIdRef.current) conversationIdRef.current = \`conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}\`;`. In `reset()` set `conversationIdRef.current = null`. The `fetch` becomes:
```ts
const res = await fetch(`${BASE_URL}/api/agent/stream`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
  body: JSON.stringify({
    user_id: userId,
    messages,
    conversation_id: conversationIdRef.current,
    ...(reportId ? { report_id: reportId } : {}),
  }),
  signal: controller.signal,
});
if (!res.ok || !res.body) throw new Error(`The AI Agent could not start (HTTP ${res.status}).`);
```
The "Cannot reach the VitaGraph backend. Is it running?" message and the other catch messages stay. Remove `thinkingOpenRef` lines in `send` and `reset`; keep `stepSeqRef`.

**2d. Replace the whole `handleEvent` callback** with exactly:
```ts
const handleEvent = useCallback(
  (id: string, event: string, data: unknown) => {
    const p = payloadOf(data);
    switch (event) {
      case "status": {
        const phase = String(p.phase ?? "");
        const message = String(p.message ?? "");
        if (!message) break;
        patch(id, (e) => {
          if (phase === "starting") {
            return { ...e, trajectory: [...e.trajectory, { id: `status_${stepSeqRef.current++}`, kind: "status", label: message, detail: "", status: "running" }] };
          }
          const closed = closeRunning(e.trajectory, ["status"]);
          if (phase === "retrying") {
            const attempt = numberOrNull(p.attempt);
            const label = attempt === null ? message : `${message} (attempt ${attempt})`;
            return { ...e, trajectory: [...closed, { id: `status_${stepSeqRef.current++}`, kind: "status", label, detail: "", status: "done" }] };
          }
          return { ...e, trajectory: closed };
        });
        break;
      }
      case "step": {
        const step = numberOrNull(p.step);
        if (step === null) break;
        const rowId = `step_${step}`;
        if (p.phase === "start") {
          patch(id, (e) => {
            const closed = closeRunning(e.trajectory, ["status", "reasoning"]);
            if (closed.some((i) => i.id === rowId)) return { ...e, trajectory: closed };
            return { ...e, trajectory: [...closed, { id: rowId, kind: "step", label: `Step ${step}`, detail: "", status: "running" }] };
          });
        } else {
          patch(id, (e) => ({
            ...e,
            trajectory: closeRunning(e.trajectory, ["reasoning"]).map((i) => (i.id === rowId ? { ...i, status: "done" as const } : i)),
          }));
        }
        break;
      }
      case "thinking": {
        const text = String(p.thinking ?? "");
        if (!text) break;
        patch(id, (e) => {
          const items = e.trajectory.slice();
          const last = items[items.length - 1];
          if (last && last.kind === "reasoning" && last.status === "running") {
            items[items.length - 1] = { ...last, detail: last.detail + text };
          } else {
            items.push({ id: `think_${stepSeqRef.current++}`, kind: "reasoning", label: "Reasoning", detail: text, status: "running" });
          }
          return { ...e, trajectory: items };
        });
        break;
      }
      case "tool_call": {
        const callId = String(p.id ?? `call_${stepSeqRef.current++}`);
        const tool = String(p.tool ?? "");
        const args = asRecord(p.arguments);
        patch(id, (e) => {
          const closed = closeRunning(e.trajectory, ["status", "reasoning"]);
          if (closed.some((i) => i.id === callId)) return { ...e, trajectory: closed };
          return {
            ...e,
            trajectory: [...closed, { id: callId, kind: "tool", label: toolLabel(tool, args), detail: "", status: "running", tool, args, result: null, durationMs: null }],
          };
        });
        break;
      }
      case "tool_result": {
        const callId = String(p.id ?? "");
        const tool = String(p.tool ?? "");
        const result = asRecord(p.result);
        const { detail, failed } = toolSummary(tool, result);
        const failedFlag = failed || p.is_error === true;
        const cards = (tool === "search_reports" || tool === "search_chroma") && Array.isArray(result.evidence) ? result.evidence.filter(isEvidence) : [];
        const durationMs = numberOrNull(p.duration_ms);
        patch(id, (e) => {
          const byRef = new Map(e.evidence.map((c) => [c.ref, c]));
          cards.forEach((c) => byRef.set(c.ref, c));
          return {
            ...e,
            trajectory: e.trajectory.map((i) =>
              i.id === callId ? { ...i, detail, result, durationMs, status: failedFlag ? ("failed" as const) : ("done" as const) } : i
            ),
            evidence: Array.from(byRef.values()).sort((a, b) => a.ref - b.ref),
          };
        });
        break;
      }
      case "text_delta": {
        const delta = String(p.delta ?? "");
        if (!delta) break;
        patch(id, (e) => ({ ...e, trajectory: closeRunning(e.trajectory, ["status", "reasoning"]) }));
        bufferRef.current += delta;
        if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushNow);
        break;
      }
      case "stats": {
        patch(id, (e) => ({
          ...e,
          stats: {
            steps: numberOrNull(p.steps) ?? 0,
            toolCalls: numberOrNull(p.tool_calls) ?? 0,
            elapsedMs: numberOrNull(p.elapsed_ms) ?? 0,
            inputTokens: numberOrNull(p.input_tokens),
            outputTokens: numberOrNull(p.output_tokens),
          },
        }));
        break;
      }
      case "error": {
        flushNow();
        fail(id, String(p.message ?? "The AI Agent could not finish this answer."));
        break;
      }
      case "completed": {
        flushNow();
        if (asRecord(data).stage === "done") {
          patch(id, (e) => settle({ ...e, status: e.status === "streaming" ? "answered" : e.status, endedAt: e.endedAt ?? Date.now() }));
        } else {
          const status: EntryStatus =
            p.status === "refused" ? "refused" : p.status === "insufficient_evidence" ? "insufficient_evidence" : "answered";
          patch(id, (e) => ({
            ...e,
            status,
            answer: e.answer.trim() ? e.answer : String(p.summary_text ?? ""),
            evidence: Array.isArray(p.evidence) ? p.evidence.filter(isEvidence) : e.evidence,
            withheld: p.safety_passed === false,
            safetyNote: typeof p.safety_note === "string" ? p.safety_note : null,
            aiStatus: typeof p.ai_status === "string" ? p.ai_status : null,
            title: typeof p.session_title === "string" && p.session_title.trim() ? p.session_title.trim() : null,
          }));
        }
        break;
      }
      default:
        break;
    }
  },
  [patch, fail, flushNow]
);
```
Rules: `any` is forbidden; no unused imports or variables (the build runs `tsc -b`); no `model_fallback` case (the backend never sends it).

## Step 3: the answer, passage slip and evidence columns (the former Task 09b)
Open `gemini/TASK_09b_ask_citations.md`. Create these three files by copying the code blocks of its **Step 3** (AnswerMarkdown), **Step 4** (PassageSlip) and **Step 5** (EvidenceModules) EXACTLY, into `site design/src/components/agent/` (same file names), with ONLY these substitutions:
- every `import type { ChatEvidence } from "../../hooks/useChatStream"` becomes `import type { AgentEvidence } from "../../hooks/useAgentChat"` and every `ChatEvidence` becomes `AgentEvidence`;
- the class name / test id prefix `ask-` becomes `agent-`: `ask-cite` to `agent-cite`, `ask-evidence-row` to `agent-evidence-row`, `data-testid="ask-slip"` to `agent-slip`, `data-testid="ask-modules"` to `agent-modules`.
- in `EvidenceModules.tsx` the limitations sentence `The assistant can misread a table or a scan, so check the highlighted passage.` becomes `The AI Agent can misread a table or a scan, so check the highlighted passage.`
Nothing else changes (the `../../types` import of `ReportPage` is correct at this depth).

## Step 4: `site design/src/components/agent/TrajectoryPanel.tsx` (new; copy exactly)
```tsx
import React, { useEffect, useState } from "react";
import type { AgentEntry, TrajectoryItem } from "../../hooks/useAgentChat";

const RAW_LIMIT = 4000;

const markerColor = (status: TrajectoryItem["status"]): string =>
  status === "running" ? "var(--color-accent)" : status === "failed" ? "var(--color-accent-700)" : "var(--color-text)";

const Marker: React.FC<{ status: TrajectoryItem["status"] }> = ({ status }) => (
  <span
    aria-hidden="true"
    style={{
      display: "block",
      width: 12,
      height: 12,
      flex: "none",
      boxSizing: "border-box",
      border: `2px solid ${markerColor(status)}`,
      background: status === "failed" ? "transparent" : markerColor(status),
    }}
  />
);

const labelStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

const valueStyle: React.CSSProperties = { fontSize: "1.125rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" };

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  padding: "var(--space-1) 0",
  fontSize: "0.875rem",
};

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

// A clock that only runs while the agent is working, and is always cleared.
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

const ToolCard: React.FC<{ item: TrajectoryItem }> = ({ item }) => {
  const [raw, setRaw] = useState(false);
  const args = Object.entries(item.args ?? {}).filter(([, value]) => value !== "" && value !== null && value !== undefined);
  const rawText = item.result ? JSON.stringify(item.result, null, 2).slice(0, RAW_LIMIT) : "";
  return (
    <div
      data-testid="agent-tool-card"
      style={{ border: "1px solid var(--color-divider)", background: "var(--color-surface)", padding: "var(--space-3)", marginTop: "var(--space-1)" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800 }}>{item.label}</span>
        <span style={labelStyle}>
          {item.tool}
          {item.durationMs !== null && item.durationMs !== undefined ? ` · ${item.durationMs} ms` : ""}
        </span>
      </div>
      {args.length > 0 ? (
        <div style={{ marginTop: "var(--space-2)" }}>
          <div style={labelStyle}>Arguments</div>
          {args.map(([key, value]) => (
            <div key={key} style={{ overflowWrap: "anywhere" }}>
              <span style={{ fontWeight: 800 }}>{key}</span>: {formatValue(value)}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: "var(--space-2)" }}>
        <div style={labelStyle}>Result</div>
        <div style={{ overflowWrap: "anywhere", color: item.status === "failed" ? "var(--color-accent-700)" : "var(--color-text)" }}>
          {item.status === "running" ? "Waiting for the result" : item.detail || "Done"}
        </div>
      </div>
      {item.result ? (
        <div style={{ marginTop: "var(--space-2)" }}>
          <button
            type="button"
            data-testid="agent-raw-toggle"
            aria-expanded={raw}
            onClick={() => setRaw(!raw)}
            style={{
              appearance: "none",
              cursor: "pointer",
              border: 0,
              padding: 0,
              background: "transparent",
              color: "var(--color-accent-700)",
              fontSize: "0.8125rem",
              fontWeight: 800,
            }}
          >
            {raw ? "Hide raw result" : "Show raw result"}
          </button>
          {raw ? (
            <pre
              data-testid="agent-raw"
              style={{
                margin: "var(--space-2) 0 0",
                fontFamily: "inherit",
                fontSize: "0.8125rem",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                maxHeight: 280,
                overflow: "auto",
              }}
            >
              {rawText}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const Cell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ padding: "var(--space-2) var(--space-4) var(--space-2) 0", minWidth: 0 }}>
    <div style={labelStyle}>{label}</div>
    <div style={valueStyle}>{value}</div>
  </div>
);

export const TrajectoryPanel: React.FC<{ entry: AgentEntry }> = ({ entry }) => {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const streaming = entry.status === "streaming";
  const now = useNow(streaming);
  if (entry.trajectory.length === 0 && !streaming) return null;

  const open = toggled ?? streaming;
  const steps = entry.stats?.steps ?? entry.trajectory.filter((i) => i.kind === "step").length;
  const toolCalls = entry.stats?.toolCalls ?? entry.trajectory.filter((i) => i.kind === "tool").length;
  const elapsedMs = streaming ? now - entry.startedAt : entry.stats?.elapsedMs ?? (entry.endedAt ?? entry.startedAt) - entry.startedAt;
  const seconds = (Math.max(0, elapsedMs) / 1000).toFixed(1);
  const stepsText = steps === 1 ? "1 step" : `${steps} steps`;
  const callsText = toolCalls === 1 ? "1 tool call" : `${toolCalls} tool calls`;
  const label = streaming ? "Working" : `Worked for ${seconds} s · ${stepsText} · ${callsText}`;
  const tokens = entry.stats && entry.stats.inputTokens !== null && entry.stats.outputTokens !== null ? entry.stats : null;

  return (
    <div style={{ border: "2px solid var(--color-divider)", marginBottom: "var(--space-4)" }} data-testid="agent-trajectory">
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        style={{
          appearance: "none",
          width: "100%",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-2) var(--space-4)",
          border: 0,
          background: "transparent",
          color: "var(--color-text)",
          fontSize: "0.9375rem",
          fontWeight: 800,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--color-accent-700)", fontSize: "0.8125rem" }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div style={{ borderTop: "2px solid var(--color-divider)" }}>
          <div
            data-testid="agent-stats"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", padding: "0 var(--space-4)", borderBottom: "1px solid var(--color-divider)" }}
          >
            <Cell label="Steps" value={String(steps)} />
            <Cell label="Tool calls" value={String(toolCalls)} />
            <Cell label="Time" value={`${seconds} s`} />
            {tokens ? <Cell label="Tokens" value={`${tokens.inputTokens} in · ${tokens.outputTokens} out`} /> : null}
          </div>
          <div style={{ padding: "var(--space-2) var(--space-4)" }}>
            {entry.trajectory.map((item) => (
              <div key={item.id} data-row={item.kind} style={rowStyle}>
                <span style={{ display: "flex", paddingTop: 3 }}>
                  <Marker status={item.status} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  {item.kind === "tool" ? (
                    <ToolCard item={item} />
                  ) : item.kind === "step" ? (
                    <span style={labelStyle}>{item.label}</span>
                  ) : (
                    <>
                      <span style={{ fontWeight: 800 }}>{item.label}</span>
                      {item.detail.trim() ? (
                        <span
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            color: "var(--color-neutral-700)",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.detail.trim()}
                        </span>
                      ) : null}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
```

## Step 5: the page `site design/src/pages/AgentPage.tsx`
Replace the ENTIRE file with the code of **Step 6 of `gemini/TASK_09b_ask_citations.md`** (the full `AskPage.tsx`), then apply EXACTLY these edits (and nothing else):
1. Imports: `import { useAgentChat, type AgentEntry } from "../hooks/useAgentChat";`, `import { AnswerMarkdown, citedRefs } from "../components/agent/AnswerMarkdown";`, `import { EvidenceModules } from "../components/agent/EvidenceModules";`, `import { PassageSlip } from "../components/agent/PassageSlip";`, `import { TrajectoryPanel } from "../components/agent/TrajectoryPanel";` (remove the `StepsPanel` import, the `useChatStream` import).
2. Rename the exported component `AskPage` to `AgentPage`; `ChatEntry` to `AgentEntry`; `useChatStream()` to `useAgentChat()`; in `EntryView` replace `<StepsPanel entry={entry} />` by `<TrajectoryPanel entry={entry} />`.
3. `data-screen-label="Ask"` becomes `data-screen-label="AI Agent"`. Test ids: `ask-page` to `agent-page`, `ask-empty` to `agent-empty`, `ask-entry` to `agent-entry`, `ask-answer` to `agent-answer`, `ask-composer` to `agent-composer`, `ask-input` to `agent-input`, `ask-new-chat` to `agent-new-chat`, `scope-chip` to `agent-scope-chip`, `conversation-threads` to `agent-threads`.
4. Empty state: under the heading `What would you like to know?` add, before the suggestion list, this paragraph: `<p style={{ margin: 0, color: "var(--color-neutral-700)", maxWidth: "62ch" }}>The AI Agent reads only your own reports. It searches them, shows each step it takes, and cites the passages behind every answer.</p>`.
5. Composer placeholder: `"Ask the AI Agent about a value, a trend or a report"` when ready; `"Upload a report to start asking"` otherwise.
6. In `EntryView`, directly ABOVE the answer `body` (i.e. just before `{body}` in the returned JSX) add a line for answers produced without the AI:
```tsx
{entry.status === "answered" && entry.aiStatus === "not_used" ? (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "baseline", paddingBottom: "var(--space-3)" }}>
    <span className="tag tag-neutral" style={{ fontWeight: 800 }}>Evidence only</span>
    <span style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>{entry.safetyNote ?? "The AI Agent was not used for this answer."}</span>
  </div>
) : null}
```
7. The "Could not finish" card shows `entry.error` only (it already does). The word "assistant" must not appear in the visible copy; use "AI Agent".
Do not add any other behaviour. In particular keep: the persona-change reset effect, the `?q=` prefill effect, the `?report=` scope chip, suggestions from the real graph, the pages cache with failed loads not cached, the follow-the-answer scrolling, Send/Stop, New chat.

## Step 6: wire the app (exact edits)
1. `site design/src/App.tsx`: replace `import { AskPage } from "./pages/AskPage";` by `import { AgentPage } from "./pages/AgentPage";`; change `import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";` to also import `useLocation`; add above `export const App`:
```tsx
// The old /ask address keeps working: same query string, new route.
const AskRedirect: React.FC = () => {
  const { search } = useLocation();
  return <Navigate to={`/agent${search}`} replace />;
};
```
and replace the line `<Route path="/ask" element={<AskPage />} />` by these two lines:
```tsx
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/ask" element={<AskRedirect />} />
```
2. `site design/src/components/shell/Sidebar.tsx`: replace the `ask` nav item by
```tsx
        { id: "agent", path: "/agent", label: "AI Agent", sublabel: "Answers with evidence", live: true,
          icon: <Icon d="M4 17l6-6-6-6M12 19h8" /> },
```
3. `site design/src/components/shell/AppShell.tsx`: in `ROUTE_TITLES` replace `"/ask": "Ask Questions",` by `"/agent": "AI Agent",`; in `OWN_LAYOUT` replace `"/ask"` by `"/agent"`; on the line containing `location.pathname === "/ask"` (twice) replace `"/ask"` by `"/agent"`.
4. `site design/src/components/shell/Header.tsx`: replace the `case "/ask"` line by `case "/agent": return { title: "AI Agent", sub: "Ask in plain words. The agent searches your reports and shows its work." };`; in `submitSearch` change `` `/ask?q=${encodeURIComponent(text)}` `` to `` `/agent?q=${encodeURIComponent(text)}` ``; the comment above it: "hands the text to the AI Agent".
5. `site design/src/motion/navigation.ts`: the item `{ id: "ask", path: "/ask", label: "Ask Questions", ... }` becomes `{ id: "agent", path: "/agent", label: "AI Agent", ... }` (keep its `reason`); in `ROUTE_INDEX` replace `"/ask": 3,` by `"/agent": 3,`.
6. `site design/src/pages/UploadPage.tsx`: the two navigations `` `/ask?report=${...}` `` and `"/ask"` become `` `/agent?report=${...}` `` and `"/agent"` (nothing else in that file changes).
7. `site design/src/index.css`: append at the very end (after one blank line):
```css
/* AI Agent page: hover states of the citation chips and the evidence rows. */
.agent-cite:hover {
  background: var(--color-text);
}
.agent-evidence-row:hover {
  color: var(--color-accent-700);
}
```

## Step 7: static checks (paste the output)
1. `npm run build` exits 0 (paste the last 3 lines).
2. `Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'useChatStream|useAgentStream|components/ask|AskPage|"/ask"|/ask\?'` prints only the `AskRedirect` route line in `App.tsx` (the `"/ask"` path of the redirect) and nothing else.
3. `Select-String -Path src\pages\AgentPage.tsx,src\hooks\useAgentChat.ts,src\components\agent\*.tsx -Pattern 'rounded|Spectral|backdrop|#[0-9a-fA-F]{3,6}'` prints nothing.
4. `Select-String -Path src\pages\AgentPage.tsx,src\hooks\useAgentChat.ts,src\components\agent\*.tsx -Pattern 'gemini|agentrouter|deepseek|claude|gpt|openai'` prints nothing (Select-String is case-insensitive by default).
4b. `Select-String -Path src\pages\AgentPage.tsx,src\hooks\useAgentChat.ts,src\components\agent\*.tsx -Pattern 'assistant'` prints ONLY the lines in `useAgentChat.ts` that build the request history (`role: "assistant"`); the word must not occur in any visible text.
5. `git status --short` lists only the closed-list paths (plus `tsconfig.tsbuildinfo`, never staged and untracked reference files).

## Step 8: browser verification
Start the backend (`cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, background) and the frontend (`cd "site design"; npm run dev -- --port 5173`, background); wait 12 s. Use ONLY the throwaway persona **"Empty Test Persona"** (`usr_51f14542d71a`; it holds sample reports). The AI gateway may reject requests (content filter or blocked): per RULES 5d never work around it; the UI states are therefore verified with MOCKED stream bodies built from REAL report data (part M below), and the real gateway is tried separately (part L).

Save this script as `$env:TEMP\agent_check_ag4.py` (NOT in the repo) and run `$env:PYTHONIOENCODING="utf-8"; python $env:TEMP\agent_check_ag4.py "F:\kiruthika\kiruthika final project\gemini\shots" usr_51f14542d71a`:
```python
import json, sys, urllib.request
from playwright.sync_api import sync_playwright

SHOTS = sys.argv[1]
USER_ID = sys.argv[2]
BASE = "http://localhost:5173"
API = "http://127.0.0.1:8000"
COMPOSER = '[data-testid="agent-composer"]'
INPUT = '[data-testid="agent-input"]'
SEND = COMPOSER + ' button[type="submit"]'
ENTRY = '[data-testid="agent-entry"]'
SLIP = '[data-testid="agent-slip"]'
IDLE = """() => !Array.from(document.querySelectorAll('[data-testid="agent-composer"] button')).some(b => /^Stop/.test(b.innerText.trim()))"""
CORS = {"content-type": "text/event-stream", "access-control-allow-origin": "*",
        "access-control-allow-headers": "*", "access-control-allow-methods": "*"}


def get_json(url):
    with urllib.request.urlopen(url) as res:
        return json.loads(res.read().decode("utf-8"))


def body(events):
    out, n = [], 0
    for event, meta, last in events:
        n += 1
        env = {"index": f"{n:02d}", "stage": "done" if last else "generation", "description": "", "subDescription": "",
               "latency": "", "timestamp": 0, "metadata": meta, "event_type": event, "event": event}
        out.append(f"event: {event}\ndata: {json.dumps(env)}\n\n")
    return "".join(out)


def mock(page, events):
    page.unroute("**/api/agent/stream")
    text = body(events)
    page.route("**/api/agent/stream", lambda r: r.fulfill(status=200, headers=CORS, body=text))


def ask(page, text):
    before = page.locator(ENTRY).count()
    page.fill(INPUT, text)
    page.click(SEND)
    page.wait_for_function("n => document.querySelectorAll('[data-testid=\"agent-entry\"]').length > n", arg=before, timeout=20000)
    page.wait_for_function(IDLE, timeout=150000)
    page.wait_for_timeout(500)


def open_trajectory(page):
    btn = page.locator('[data-testid="agent-trajectory"] > button').last
    if btn.get_attribute("aria-expanded") != "true":
        btn.click()
    page.wait_for_timeout(200)


ROWS = """() => { const t = Array.from(document.querySelectorAll('[data-testid="agent-trajectory"]')).pop();
  return Array.from(t.querySelectorAll('[data-row]')).map(r => r.getAttribute('data-row') + ': ' + r.innerText.split('\\n')[0]); }"""
SLIP_PARTS = """() => { const s = document.querySelector('[data-testid="agent-slip"]'); const m = s.querySelector('mark');
  return { parts: Array.from(s.firstElementChild.children).map(c => c.textContent), mark: m ? m.textContent : null }; }"""

# ---- real data for the mocked turns: one measurement whose span is exact, and the stored page text
reports = get_json(f"{API}/api/reports?user_id={USER_ID}")
rep = None
for r in reports:
    meas = get_json(f"{API}/api/reports/{r['id']}/measurements")
    ok = [m for m in meas if m.get("span_exact") and m.get("char_start") is not None and m.get("char_end") is not None]
    if ok:
        rep, m = r, ok[0]
        break
assert rep, "the persona needs a report with an exact measurement span"
pages = get_json(f"{API}/api/reports/{rep['id']}/pages")
page_text = next(pg for pg in pages if pg["page_number"] == m["page_number"])["extracted_text"]
CARD = {"ref": 1, "chunk_id": m["chunk_id"], "report_id": rep["id"], "report_filename": rep["original_filename"],
        "report_date": rep.get("report_date"), "page_number": m["page_number"], "snippet": page_text[m["char_start"]:m["char_end"]],
        "score": 0.91, "char_start": m["char_start"], "char_end": m["char_end"]}
EXPECTED = page_text[m["char_start"]:m["char_end"]]
ANSWER = f"Your {m['test_name']} was {m['value']} {m.get('unit') or ''} [1]. A second number [7] has no passage behind it."
GOOD = [
    ("status", {"phase": "starting", "message": "Starting the AI Agent"}, False),
    ("status", {"phase": "working", "message": "The agent is working"}, False),
    ("step", {"phase": "start", "step": 1}, False),
    ("thinking", {"thinking": "I will search the reports for this value."}, False),
    ("tool_call", {"id": "call_a", "tool": "search_reports", "arguments": {"query": m["test_name"], "top_k": 5}, "step": 1}, False),
    ("tool_result", {"id": "call_a", "tool": "search_reports", "result": {"evidence": [CARD]}, "is_error": False, "duration_ms": 120}, False),
    ("step", {"phase": "end", "step": 1}, False),
    ("stats", {"turns": 1, "steps": 1, "tool_calls": 1, "elapsed_ms": 1500}, False),
    ("step", {"phase": "start", "step": 2}, False),
    ("text_delta", {"delta": ANSWER}, False),
    ("step", {"phase": "end", "step": 2}, False),
    ("stats", {"turns": 1, "steps": 2, "tool_calls": 1, "elapsed_ms": 3400, "input_tokens": 812, "output_tokens": 140, "reasoning_tokens": 60}, False),
    ("completed", {"status": "answered", "summary_text": ANSWER, "classification": "educational", "evidence": [CARD], "evidence_count": 1,
                   "safety_passed": True, "safety_note": None, "ai_status": "ok", "session_title": "Value lookup", "conversation_id": "conv_x"}, False),
    ("completed", {"status": "answered", "ai_status": "ok", "evidence_count": 1, "question_id": "qst_x", "conversation_id": "conv_x", "session_title": "Value lookup"}, True),
]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script(f"localStorage.setItem('vitagraph_user_id','{USER_ID}')")
    page = ctx.new_page()
    console = []
    page.on("console", lambda msg: console.append((msg.type, msg.text[:160])) if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(("pageerror", str(e)[:160])))

    # ---- N: navigation, redirects, header
    page.goto(BASE + "/agent")
    page.wait_for_selector('[data-testid="agent-empty"]')
    side = page.evaluate("() => document.querySelector('aside').innerText.replace(/\\n/g, ' / ')")
    print("N1 page title:", page.locator("h1").first.inner_text(), "| sidebar has AI Agent:", "AI Agent" in side, "| sub-label:", "Answers with evidence" in side)
    print("N2 empty state mentions the agent:", "AI Agent reads only your own reports" in page.inner_text('[data-testid="agent-empty"]'))
    page.goto(BASE + "/ask?q=hello%20there")
    page.wait_for_selector(INPUT)
    page.wait_for_timeout(500)
    print("N3 /ask?q= redirects:", page.url, "| composer prefilled:", repr(page.input_value(INPUT)))
    page.goto(BASE + f"/ask?report={rep['id']}")
    page.wait_for_selector('[data-testid="agent-scope-chip"]')
    page.wait_for_timeout(500)
    print("N4 /ask?report= redirects:", page.url, "| scope chip:", page.inner_text('[data-testid="agent-scope-chip"]').replace("\n", " "))
    page.goto(BASE + "/agent")
    page.wait_for_selector('[data-testid="agent-empty"]')

    # ---- M1: a full mocked turn
    mock(page, GOOD)
    ask(page, "What was my value?")
    print("M1 header while collapsed:", page.inner_text('[data-testid="agent-trajectory"] > button').replace("\n", " "))
    open_trajectory(page)
    print("M1 rows:", page.evaluate(ROWS))
    print("M2 stats strip:", page.inner_text('[data-testid="agent-stats"]').replace("\n", " "), "| expected steps 2, tool calls 1, time 3.4 s, tokens 812 in 140 out")
    card = page.locator('[data-testid="agent-tool-card"]').first
    print("M3 tool card:", card.inner_text().replace("\n", " | "))
    page.click('[data-testid="agent-raw-toggle"]')
    raw = page.inner_text('[data-testid="agent-raw"]')
    print("M3 raw result toggled, contains chunk id:", CARD["chunk_id"] in raw)
    print("M4 chips:", page.locator(".agent-cite").all_inner_texts(), "| the unknown [7] stays plain text:", "[7]" in page.inner_text('[data-testid="agent-answer"]'))
    print("M5 columns:", page.evaluate("() => Array.from(document.querySelectorAll('[data-testid=\"agent-modules\"] > div')).map(d => d.firstElementChild.textContent)"))
    # nothing is cached yet: first the page text cannot be loaded (honest fallback), then the network is back
    page.route("**/api/reports/*/pages", lambda r: r.abort())
    page.click(".agent-cite >> nth=0")
    page.wait_for_selector(SLIP)
    page.wait_for_timeout(800)
    print("M6 page text blocked, the slip says:", page.inner_text(SLIP)[-130:].replace("\n", " "))
    page.unroute("**/api/reports/*/pages")
    page.click(".agent-cite >> nth=0")   # close
    page.click(".agent-cite >> nth=0")   # open again: a failed load must not be remembered
    page.wait_for_selector(SLIP + " mark", timeout=10000)
    print("M6 after the network is back the passage is highlighted: True")
    slip = page.evaluate(SLIP_PARTS)
    print("M6 slip head:", " | ".join(slip["parts"]))
    print("M6 highlighted text equals stored page text:", slip["mark"] == EXPECTED, "| length", len(EXPECTED))
    page.screenshot(path=SHOTS + r"\ag4-answer-1440.png")
    page.click(".agent-cite >> nth=0")
    print("M7 slips after closing:", page.locator(SLIP).count())
    page.click(".agent-evidence-row >> nth=0")
    page.wait_for_selector(SLIP)
    print("M7 evidence row opens a slip, aria-expanded:", page.get_attribute(".agent-evidence-row >> nth=0", "aria-expanded"))

    # ---- M9: refusal, withheld, error, evidence-only
    page.click('[data-testid="agent-new-chat"]')
    mock(page, [("text_delta", {"delta": "This request falls outside the boundary."}, False),
                ("completed", {"status": "refused", "summary_text": "This request falls outside the boundary.", "classification": "out_of_bounds", "evidence": [], "evidence_count": 0, "safety_passed": True, "safety_note": None, "ai_status": "not_used", "session_title": None, "conversation_id": "c"}, False),
                ("completed", {"status": "refused", "ai_status": "not_used", "evidence_count": 0, "question_id": "q", "conversation_id": "c", "session_title": None}, True)])
    ask(page, "Do I have diabetes?")
    print("M9 refusal: declined card:", "Declined by policy" in page.inner_text(ENTRY), "| trajectory panels:", page.locator('[data-testid="agent-trajectory"]').count())
    mock(page, [("text_delta", {"delta": "Your results mean you have anemia."}, False),
                ("completed", {"status": "answered", "summary_text": "Your results mean you have anemia.", "classification": "educational", "evidence": [], "evidence_count": 0, "safety_passed": False, "safety_note": "diagnostic", "ai_status": "ok", "session_title": None, "conversation_id": "c"}, False),
                ("completed", {"status": "answered", "ai_status": "ok", "evidence_count": 0, "question_id": "q", "conversation_id": "c", "session_title": None}, True)])
    ask(page, "What does this mean?")
    print("M9 withheld: card shown:", "Answer withheld" in page.inner_text(ENTRY + " >> nth=1"), "| the diagnostic text is NOT shown:", "you have anemia" not in page.inner_text('[data-testid="agent-threads"]'))
    mock(page, [("status", {"phase": "starting", "message": "Starting the AI Agent"}, False),
                ("error", {"status": "error", "message": "The AI Agent could not finish this answer.", "diagnostic": "SECRET-DIAGNOSTIC-TEXT"}, True)])
    ask(page, "A question that fails")
    last = page.locator(ENTRY).last
    print("M9 error card:", "Could not finish" in last.inner_text(), "| message shown:", "could not finish this answer" in last.inner_text(), "| diagnostic hidden:", "SECRET-DIAGNOSTIC-TEXT" not in page.inner_text("body"), "| Try again enabled:", last.locator("button", has_text="Try again").is_enabled())
    page.click('[data-testid="agent-new-chat"]')
    mock(page, [("tool_call", {"id": "c1", "tool": "search_chroma", "arguments": {"query": "hemoglobin"}}, False),
                ("tool_result", {"id": "c1", "tool": "search_chroma", "result": {"evidence": [CARD]}}, False),
                ("text_delta", {"delta": f"From your reports: {m['test_name']} [1]."}, False),
                ("completed", {"status": "answered", "summary_text": "x", "classification": "educational", "evidence": [CARD], "evidence_count": 1, "safety_passed": True, "safety_note": "AI explanations are off in this configuration.", "ai_status": "not_used", "session_title": None, "conversation_id": "c"}, False),
                ("completed", {"status": "answered", "ai_status": "not_used", "evidence_count": 1, "question_id": "q", "conversation_id": "c", "session_title": None}, True)])
    ask(page, "hemoglobin")
    open_trajectory(page)
    print("M9 evidence-only: tag shown:", "Evidence only" in page.inner_text(ENTRY), "| tool label:", page.locator('[data-testid="agent-tool-card"]').first.inner_text().split("\n")[0])

    # ---- M10: Stop aborts a request that never answers
    page.click('[data-testid="agent-new-chat"]')
    page.unroute("**/api/agent/stream")
    page.route("**/api/agent/stream", lambda r: None)
    page.fill(INPUT, "This one hangs")
    page.click(SEND)
    page.wait_for_selector(COMPOSER + ' button:has-text("Stop")')
    print("M10 while waiting: trajectory header:", page.inner_text('[data-testid="agent-trajectory"] > button').replace("\n", " "))
    page.click(COMPOSER + ' button:has-text("Stop")')
    page.wait_for_timeout(500)
    print("M10 after Stop: Stopped tag:", "Stopped" in page.inner_text(ENTRY), "| Send button back:", page.locator(SEND).count() == 1)
    page.unroute("**/api/agent/stream")

    # ---- K: keyboard on a chip, and 820 px
    page.click('[data-testid="agent-new-chat"]')
    mock(page, GOOD)
    ask(page, "What was my value?")
    page.focus(".agent-cite >> nth=0")
    page.keyboard.press("Enter")
    page.wait_for_selector(SLIP + " mark", timeout=10000)
    print("K keyboard: Enter on a focused chip opens the slip: True")
    page.set_viewport_size({"width": 820, "height": 1100})
    page.wait_for_timeout(400)
    open_trajectory(page)
    print("K 820 overflow:", page.evaluate("({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })"))
    page.screenshot(path=SHOTS + r"\ag4-answer-820.png")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.unroute("**/api/agent/stream")

    # ---- L: the REAL backend and the REAL gateway (may be blocked: record it, do not work around it)
    for text in ["What was my hemoglobin?", "Which of my values are outside the reference range?", "Tell me about my vitamin D result"]:
        page.click('[data-testid="agent-new-chat"]') if page.locator('[data-testid="agent-new-chat"]').count() else None
        ask(page, text)
        e = page.locator(ENTRY).last
        txt = e.inner_text()
        print("L", repr(text), "->", "ERROR CARD: " + txt.split("Could not finish")[-1].strip()[:90].replace("\n", " ") if "Could not finish" in txt else "ANSWER (" + str(len(page.inner_text('[data-testid="agent-answer"]'))) + " chars), chips: " + str(page.locator(".agent-cite").count()))
    page.screenshot(path=SHOTS + r"\ag4-live-1440.png")

    print("console (errors and warnings):", [c for c in console if "net::" not in c[1]])
    browser.close()
```
**Required results (paste the whole raw output into section 4 of the report):**
- **N1**: page title `AI Agent`; the sidebar contains `AI Agent` and the sub-label `Answers with evidence` (both `True`). **N3/N4**: both `/ask` URLs end up on `/agent`; for `?q=` the composer is prefilled (`hello there`) and the page then removes `q` from the address (expected); for `?report=` the address keeps `?report=<id>` and the scope chip names the report.
- **M1/M2**: the rows are in this order: `status: Starting the AI Agent`, `status: The agent is working` is closed (no second row for it), `step: STEP 1` (uppercase by CSS), `reasoning: Reasoning`, `tool: Searched your reports for "<test name>"`, `step: STEP 2`; the stats strip reads Steps 2, Tool calls 1, Time 3.4 s, Tokens 812 in · 140 out (these come from the mocked `stats` event: if the strip shows other numbers the task FAILS); the collapsed header reads `Worked for 3.4 s · 2 steps · 1 tool call`.
- **M3**: the tool card shows the label, the tool name `search_reports`, `duration 120 ms`, the arguments `query` and `top_k`, the result `1 passage found`; the raw toggle reveals JSON containing the chunk id (`True`).
- **M4**: exactly one chip `['1']`; the unknown `[7]` stays plain text (`True`). **M5**: columns `['Evidence', 'Limitations', 'Safety']`.
- **M6**: `highlighted text equals stored page text: True`. This is the most important line of the task. (The page request is blocked BEFORE the first successful load on purpose: after a successful load the page text is cached and a block would no longer show.)
- **M7**: `slips after closing: 0`; the evidence row opens a slip with `aria-expanded: true`. The first lines of **M6** must show: with the page request blocked the slip shows the saved excerpt AND the sentence `The exact position on the page could not be loaded, so the saved excerpt is shown.`; after the network is back the same chip loads the highlighted passage (a failed load is not remembered).
- **M9**: refusal has `Declined by policy` and `trajectory panels: 0`; the withheld card is shown and the diagnostic sentence is not; the error card shows the message, the secret diagnostic is hidden (`True`) and Try again is enabled; the evidence-only entry shows the `Evidence only` tag and the tool label `Searched your reports for "hemoglobin"`.
- **M10**: while waiting the header reads `Working`; after Stop the entry has the `Stopped` tag and Send is back.
- **K**: Enter on a focused chip opens the slip; 820 px `scrollWidth` equals `innerWidth`.
- **L** (real backend): each of the three wordings ends either with an ANSWER or with an ERROR CARD. If an answer comes back, also report: number of trajectory rows, whether a tool card appeared, the chips, and compare the highlighted passage with the stored text exactly as in M6 (open the passage and compare). If every wording ends in an error card, write `API blocked` and paste the three lines; do NOT try to work around it. In your report say plainly which of the two happened.
- **console**: an EMPTY list.
Look at the three screenshots next to `02_Ask.png` and compare the look: chips are small dark red squares with a light number, the answer type is the large Archivo, the trajectory box has a 2 px frame, the tool card is flat with a 1 px frame, the slip has a 2 px dark top rule on grey, the highlight is a pale red fill with a red underline, corners are square, no gradients. List EVERY visual oddity you notice, even those the checklist does not ask about, in report section 6.
Manual checks (one line each): (a) the Header search box: type a question and press Enter: you land on `/agent` with the composer prefilled; (b) on the Upload page after a real upload the button `Ask about this report` opens `/agent?report=<id>` (read the URL; you may use the existing sample report instead of uploading); (c) the old `/ask` link in the browser history still works.
Stop both servers (`Get-NetTCPConnection -LocalPort 5173,8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`), confirm the ports print nothing, check that no `dsh`, worker or tool-server process is left (ids and command lines; shell wrappers whose command line merely contains the search text do not count), and delete the temp script. If the real turns created a runtime folder for the throwaway persona, remove it: `cd vitagraph\backend; .venv\Scripts\python.exe -c "import asyncio; from app.agent.pool import RuntimePool; asyncio.run(RuntimePool().forget_persona('usr_51f14542d71a'))"`.

## Step 9: work report `gemini/reports/TASK_AG4_report.md` (nine headings, RULES 5b)
Copy line counts from `git diff --stat`. Section 6 must contain: which of the two L outcomes happened (answer or API blocked) with the three lines, the list of visual oddities, and anything in the mocked output that differed from the required results.

## COMMIT
```
git add "site design/src/hooks/useAgentChat.ts" "site design/src/pages/AgentPage.tsx" "site design/src/components/agent/AnswerMarkdown.tsx" "site design/src/components/agent/PassageSlip.tsx" "site design/src/components/agent/EvidenceModules.tsx" "site design/src/components/agent/TrajectoryPanel.tsx" "site design/src/App.tsx" "site design/src/components/shell/Sidebar.tsx" "site design/src/components/shell/AppShell.tsx" "site design/src/components/shell/Header.tsx" "site design/src/motion/navigation.ts" "site design/src/pages/UploadPage.tsx" "site design/src/index.css" gemini/reports/TASK_AG4_report.md
git add gemini/shots/ag4-answer-1440.png gemini/shots/ag4-answer-820.png gemini/shots/ag4-live-1440.png
git commit -m "feat(redesign): AG4 AI Agent page replaces Ask (trajectory, stats, tool cards, citations, passage slip)"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
(The deletions and the two renames were already staged by `git rm` / `git mv` in Step 1; `git show --stat HEAD` must list them as deletions or renames. It must contain no other path. Never stage `tsconfig.tsbuildinfo`.)

## ACCEPTANCE (PASS/FAIL each, with evidence)
- Build exits 0; greps 7.2 to 7.4 print what is required; the commit lists only closed-list paths.
- Dead files deleted after the import proof; `/ask` redirects with the query string; sidebar, header and navigation say "AI Agent".
- Mocked checks N, M, K as required (especially M2 numbers from the stream and M6 equal to the stored text); refusal and failed entries have no trajectory panel; the diagnostic is never displayed.
- Real-backend part L reported honestly (answer or API blocked, with the three lines).
- Console list empty; screenshots compared with the reference; every visual oddity listed; keyboard check done.
- Servers stopped; no orphan process; temp script deleted; branch correct; report has all nine headings.
