# TASK 09a: the Ask page as a real streaming chat (conversation core)

Read `gemini/RULES.md` first (branch guard 3b, report format 5, **work report file 5b**, **quality bar 5c**). Read `gemini/reviews/TASK_08c_review.md` and obey it. Then LOOK at `design/reference/screens/02_Ask.png` and read `design/reference/app-v3-source.html` lines 499-590 (the markup).

The chat backend (`POST /api/chat/stream`) was finished and proven against the real AI gateway in Task 08c. This task is frontend only. Do not touch `vitagraph/backend/`.

## What this task delivers (and what comes in Task 09b)
The Ask page becomes a real multi-turn chat that looks like the reference: a centered 960px column, the heading "What would you like to know?" with suggested questions, a question bubble with its "Q1" label, a collapsible "Thought for N s · M steps" panel built from the REAL tool events, the answer streamed as Markdown (tables included), and a sticky composer with Send and Stop. Earlier answered turns are sent back to the backend, so follow-ups like "and what is its normal range?" work.

| Part | Status in this task |
|---|---|
| Streaming Markdown answer, tables, memory of earlier turns, Stop, New chat | **Done here** |
| Steps panel from real events (reasoning, report searches with passage counts, graph lookups) | **Done here** |
| Refusal card, "No supporting passage" card, "Answer withheld" card, error card with Try again | **Done here** |
| `?q=` prefill from the header search, `?report=` scope chip ("Chatting with this report") | **Done here** |
| Empty states: no reports, backend unreachable | **Done here** |
| Citation numbers `[1]` turned into clickable chips, the passage slip with the exact characters highlighted, the Evidence / Limitations / Safety columns | **Task 09b** (the hook already collects the evidence cards for it). Until then `[1]` simply stays visible as text in the answer. |

Differences from the reference that are INTENDED (list them in your report): no model button in the header, no "Gemini"/provider name anywhere; the suggested questions come from the persona's real graph instead of demo questions; the steps are the real steps of the assistant instead of the demo "Retrieve / Rank / Compose"; a "New chat" button and a "Stop" button exist (the reference has neither, the real chat needs both); the old side panel (Document / Activity tabs) is gone.

## Files you may change (closed list)
1. NEW `site design/src/hooks/useChatStream.ts`
2. NEW `site design/src/components/ask/AnswerMarkdown.tsx`
3. NEW `site design/src/components/ask/StepsPanel.tsx`
4. `site design/src/pages/AskPage.tsx` : REPLACE the whole file
5. `site design/src/components/shell/AppShell.tsx` : add `"/ask"` to `OWN_LAYOUT`
6. `site design/src/index.css` : one block appended at the end
7. NEW `gemini/reports/TASK_09a_report.md`
8. screenshots in `gemini/shots/` named `task09a-*.png`

Everything else is forbidden. In particular do NOT delete or edit the old files in `src/components/agent/`, `src/hooks/useAgentStream.ts`, `src/hooks/useJobStream.ts` (a later cleanup task removes the unused ones), and do not touch `vitagraph/backend/`, `design/`, `docs/`, `modernist.css`, `tokens.css`.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
Branch must be `redesign/modernist-app`; the build must exit 0. (`site design/tsconfig.tsbuildinfo` changes after every build; never stage it.)

## Step 1: create `site design/src/hooks/useChatStream.ts`
Copy exactly:
```ts
import { useCallback, useEffect, useRef, useState } from "react";

// Consumes POST /api/chat/stream. EventSource is GET-only, so the stream is read through fetch + ReadableStream
// and torn down with an AbortController (same cleanup discipline as useAgentStream / useJobStream).
// The hook owns the whole conversation: every call to send() appends one entry and streams into it, and the
// earlier answered entries are sent back to the backend as the conversation memory.

import { BASE_URL } from "../api/client";

export interface ChatEvidence {
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

export type StepKind = "thinking" | "search" | "graph" | "tool";
export type StepStatus = "running" | "done" | "failed";

export interface ChatStep {
  id: string;
  kind: StepKind;
  label: string;
  detail: string;
  status: StepStatus;
}

export type EntryStatus = "streaming" | "answered" | "refused" | "insufficient_evidence" | "error" | "stopped";

export interface ChatEntry {
  id: string;
  question: string;
  startedAt: number;
  endedAt: number | null;
  status: EntryStatus;
  answer: string;
  steps: ChatStep[];
  evidence: ChatEvidence[];
  fallbackNotice: boolean;
  withheld: boolean;
  safetyNote: string | null;
  error: string | null;
}

export interface UseChatStreamReturn {
  entries: ChatEntry[];
  isStreaming: boolean;
  send: (userId: string, text: string, reportId?: string | null) => void;
  stop: () => void;
  reset: () => void;
}

type Json = Record<string, unknown>;

const MAX_HISTORY_MESSAGES = 40;
const MAX_TURN_CHARS = 8000;

function asRecord(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

// The typed payload lives in `metadata` on broker events.
function payloadOf(data: unknown): Json {
  const record = asRecord(data);
  const metadata = record.metadata;
  return metadata && typeof metadata === "object" ? (metadata as Json) : record;
}

function isEvidence(value: unknown): value is ChatEvidence {
  const record = asRecord(value);
  return typeof record.ref === "number" && typeof record.chunk_id === "string";
}

function toolLabel(tool: string, args: Json): { kind: StepKind; label: string } {
  if (tool === "search_chroma") {
    return { kind: "search", label: `Searched your reports for "${String(args.query ?? "").slice(0, 80)}"` };
  }
  if (tool === "query_networkx_graph") {
    return { kind: "graph", label: `Looked up "${String(args.concept ?? "").slice(0, 80)}" in the knowledge graph` };
  }
  return { kind: "tool", label: "Used a tool" };
}

function toolDetail(tool: string, result: Json): { detail: string; failed: boolean } {
  if (typeof result.error === "string") return { detail: result.error, failed: true };
  if (tool === "search_chroma") {
    const count = Array.isArray(result.evidence) ? result.evidence.length : 0;
    return { detail: count === 1 ? "1 passage found" : `${count} passages found`, failed: false };
  }
  return { detail: "Done", failed: false };
}

function closeThinking(entry: ChatEntry): ChatEntry {
  if (!entry.steps.some((s) => s.kind === "thinking" && s.status === "running")) return entry;
  return {
    ...entry,
    steps: entry.steps.map((s) => (s.kind === "thinking" && s.status === "running" ? { ...s, status: "done" as const } : s)),
  };
}

function settleSteps(entry: ChatEntry): ChatEntry {
  return { ...entry, steps: entry.steps.map((s) => (s.status === "running" ? { ...s, status: "done" as const } : s)) };
}

export function useChatStream(): UseChatStreamReturn {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const entriesRef = useRef<ChatEntry[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const thinkingOpenRef = useRef(false);
  const stepSeqRef = useRef(0);
  // text_delta tokens arrive many times per frame; coalesce them into one state write per frame.
  const bufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const commit = useCallback((next: ChatEntry[]) => {
    entriesRef.current = next;
    if (mountedRef.current) setEntries(next);
  }, []);

  const patch = useCallback(
    (id: string, change: (entry: ChatEntry) => ChatEntry) => {
      commit(entriesRef.current.map((e) => (e.id === id ? change(e) : e)));
    },
    [commit]
  );

  const flushNow = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const id = activeIdRef.current;
    if (!id || !bufferRef.current) return;
    const chunk = bufferRef.current;
    bufferRef.current = "";
    patch(id, (e) => ({ ...e, answer: e.answer + chunk }));
  }, [patch]);

  const teardown = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    bufferRef.current = "";
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const fail = useCallback(
    (id: string, message: string) => {
      patch(id, (e) => settleSteps({ ...e, status: "error", error: e.error ?? message, endedAt: e.endedAt ?? Date.now() }));
    },
    [patch]
  );

  const handleEvent = useCallback(
    (id: string, event: string, data: unknown) => {
      const p = payloadOf(data);
      switch (event) {
        case "thinking": {
          const text = String(p.thinking ?? "");
          if (!text) break;
          patch(id, (e) => {
            const steps = e.steps.slice();
            const last = steps[steps.length - 1];
            if (thinkingOpenRef.current && last && last.kind === "thinking") {
              steps[steps.length - 1] = { ...last, detail: last.detail + text };
            } else {
              thinkingOpenRef.current = true;
              steps.push({ id: `think_${stepSeqRef.current++}`, kind: "thinking", label: "Reasoning", detail: text, status: "running" });
            }
            return { ...e, steps };
          });
          break;
        }
        case "tool_call": {
          thinkingOpenRef.current = false;
          const callId = String(p.id ?? `call_${stepSeqRef.current++}`);
          const { kind, label } = toolLabel(String(p.tool ?? ""), asRecord(p.arguments));
          patch(id, (e) => {
            const closed = closeThinking(e);
            if (closed.steps.some((s) => s.id === callId)) return closed;
            return { ...closed, steps: [...closed.steps, { id: callId, kind, label, detail: "", status: "running" }] };
          });
          break;
        }
        case "tool_result": {
          const callId = String(p.id ?? "");
          const tool = String(p.tool ?? "");
          const result = asRecord(p.result);
          const { detail, failed } = toolDetail(tool, result);
          const cards = tool === "search_chroma" && Array.isArray(result.evidence) ? result.evidence.filter(isEvidence) : [];
          patch(id, (e) => {
            const byRef = new Map(e.evidence.map((c) => [c.ref, c]));
            cards.forEach((c) => byRef.set(c.ref, c));
            return {
              ...e,
              steps: e.steps.map((s) => (s.id === callId ? { ...s, detail, status: failed ? ("failed" as const) : ("done" as const) } : s)),
              evidence: Array.from(byRef.values()).sort((a, b) => a.ref - b.ref),
            };
          });
          break;
        }
        case "text_delta": {
          const delta = String(p.delta ?? "");
          if (!delta) break;
          if (thinkingOpenRef.current) {
            thinkingOpenRef.current = false;
            patch(id, closeThinking);
          }
          bufferRef.current += delta;
          if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushNow);
          break;
        }
        case "model_fallback": {
          // Provider and model names are never shown; the UI only says that a backup engine took over.
          patch(id, (e) => ({ ...e, fallbackNotice: true }));
          break;
        }
        case "error": {
          flushNow();
          fail(id, String(p.message ?? p.error ?? "The assistant could not finish this answer."));
          break;
        }
        case "completed": {
          flushNow();
          if (asRecord(data).stage === "done") {
            patch(id, (e) =>
              settleSteps({ ...e, status: e.status === "streaming" ? "answered" : e.status, endedAt: e.endedAt ?? Date.now() })
            );
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

  const send = useCallback(
    (userId: string, text: string, reportId?: string | null) => {
      const question = text.trim();
      if (!question || controllerRef.current) return;

      const prior = entriesRef.current
        .filter((e) => e.status === "answered" && !e.withheld && e.answer.trim())
        .flatMap((e) => [
          { role: "user", content: e.question.slice(0, MAX_TURN_CHARS) },
          { role: "assistant", content: e.answer.slice(0, MAX_TURN_CHARS) },
        ])
        .slice(-MAX_HISTORY_MESSAGES);
      const messages = [...prior, { role: "user", content: question.slice(0, MAX_TURN_CHARS) }];

      const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const controller = new AbortController();
      controllerRef.current = controller;
      activeIdRef.current = id;
      bufferRef.current = "";
      thinkingOpenRef.current = false;
      commit([
        ...entriesRef.current,
        {
          id,
          question,
          startedAt: Date.now(),
          endedAt: null,
          status: "streaming",
          answer: "",
          steps: [],
          evidence: [],
          fallbackNotice: false,
          withheld: false,
          safetyNote: null,
          error: null,
        },
      ]);

      (async () => {
        try {
          const res = await fetch(`${BASE_URL}/api/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
            body: JSON.stringify({ user_id: userId, messages, job_id: id, ...(reportId ? { report_id: reportId } : {}) }),
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`The assistant could not start (HTTP ${res.status}).`);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let sawTerminal = false;

          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            let sep: number;
            while ((sep = buf.search(/\r?\n\r?\n/)) >= 0) {
              const block = buf.slice(0, sep);
              buf = buf.slice(sep).replace(/^\r?\n\r?\n/, "");
              let event = "message";
              const dataLines: string[] = [];
              for (const line of block.split(/\r?\n/)) {
                if (line.startsWith(":")) continue; // comment / keep-alive
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
              }
              if (dataLines.length === 0) continue;
              let data: unknown;
              try {
                data = JSON.parse(dataLines.join("\n"));
              } catch {
                continue;
              }
              const record = asRecord(data);
              if (event === "message" && typeof record.event_type === "string") event = record.event_type;
              if (event === "error" || (event === "completed" && record.stage === "done")) sawTerminal = true;
              handleEvent(id, event, data);
            }
          }

          if (!sawTerminal && !controller.signal.aborted) {
            flushNow();
            fail(id, "The connection ended before the answer was complete.");
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          flushNow();
          fail(id, err instanceof TypeError ? "Cannot reach the VitaGraph backend. Is it running?" : err instanceof Error ? err.message : "The connection was lost.");
        } finally {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
            activeIdRef.current = null;
          }
        }
      })();
    },
    [commit, handleEvent, flushNow, fail]
  );

  const stop = useCallback(() => {
    const id = activeIdRef.current;
    flushNow();
    teardown();
    activeIdRef.current = null;
    if (id) {
      patch(id, (e) => (e.status === "streaming" ? settleSteps({ ...e, status: "stopped", endedAt: Date.now() }) : e));
    }
  }, [flushNow, teardown, patch]);

  const reset = useCallback(() => {
    teardown();
    activeIdRef.current = null;
    thinkingOpenRef.current = false;
    commit([]);
  }, [teardown, commit]);

  return { entries, isStreaming: entries.some((e) => e.status === "streaming"), send, stop, reset };
}
```

## Step 2: create `site design/src/components/ask/AnswerMarkdown.tsx`
(create the folder `site design/src/components/ask/` first) Copy exactly:
```tsx
import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const bodyText: React.CSSProperties = {
  maxWidth: "62ch",
  fontSize: "1.3125rem",
  lineHeight: 1.5,
  fontWeight: 400,
};

const components: Components = {
  p: ({ children }) => <p style={{ ...bodyText, margin: "0 0 var(--space-3)" }}>{children}</p>,
  ul: ({ children }) => <ul style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.4em" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ ...bodyText, margin: "0 0 var(--space-3)", paddingLeft: "1.4em" }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: "var(--space-1)" }}>{children}</li>,
  h1: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
  h2: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
  h3: ({ children }) => <h3 style={{ margin: "var(--space-4) 0 var(--space-2)", fontSize: "1.125rem", fontWeight: 800 }}>{children}</h3>,
  strong: ({ children }) => <strong style={{ fontWeight: 800 }}>{children}</strong>,
  code: ({ children }) => (
    <code style={{ fontFamily: "inherit", fontWeight: 600, background: "var(--color-surface)", padding: "0 var(--space-1)" }}>{children}</code>
  ),
  // The model's text is data, never navigation: links are shown as plain text.
  a: ({ children }) => <span>{children}</span>,
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "0 0 var(--space-3)" }}>
      <table className="table">{children}</table>
    </div>
  ),
};

export const AnswerMarkdown: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {text}
  </ReactMarkdown>
);
```

## Step 3: create `site design/src/components/ask/StepsPanel.tsx`
Copy exactly:
```tsx
import React, { useState } from "react";
import type { ChatEntry, ChatStep } from "../../hooks/useChatStream";

const dotColor = (status: ChatStep["status"]): string => {
  if (status === "running") return "var(--color-accent)";
  if (status === "failed") return "var(--color-accent-700)";
  return "var(--color-text)";
};

const Dot: React.FC<{ status: ChatStep["status"] }> = ({ status }) => (
  <span
    aria-hidden="true"
    style={{
      display: "block",
      width: 12,
      height: 12,
      flex: "none",
      boxSizing: "border-box",
      border: `2px solid ${dotColor(status)}`,
      background: status === "failed" ? "transparent" : dotColor(status),
    }}
  />
);

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  padding: "var(--space-1) 0",
  fontSize: "0.875rem",
};

export const StepsPanel: React.FC<{ entry: ChatEntry }> = ({ entry }) => {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const streaming = entry.status === "streaming";
  const open = toggled ?? streaming;
  const seconds = ((entry.endedAt ?? Date.now()) - entry.startedAt) / 1000;
  const count = entry.steps.length;
  const label = streaming
    ? "Thinking"
    : `Thought for ${seconds.toFixed(1)} s · ${count === 1 ? "1 step" : `${count} steps`}`;

  return (
    <div style={{ border: "2px solid var(--color-divider)", marginBottom: "var(--space-4)" }} data-testid="ask-steps">
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
        <div style={{ borderTop: "2px solid var(--color-divider)", padding: "var(--space-2) var(--space-4)" }}>
          {entry.steps.length === 0 && streaming ? (
            <div style={rowStyle}>
              <Dot status="running" />
              <span style={{ color: "var(--color-neutral-700)" }}>Waiting for the first step</span>
            </div>
          ) : null}
          {entry.steps.map((step) => (
            <div key={step.id} style={rowStyle}>
              <span style={{ display: "flex", paddingTop: 3 }}>
                <Dot status={step.status} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 800 }}>{step.label}</span>
                {step.detail.trim() ? (
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
                    {step.detail.trim()}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
          {entry.fallbackNotice ? (
            <div style={rowStyle}>
              <span style={{ display: "flex", paddingTop: 3 }}>
                <Dot status="done" />
              </span>
              <span style={{ fontWeight: 800 }}>Switched to a backup engine</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
```

## Step 4: replace `site design/src/pages/AskPage.tsx`
Replace the ENTIRE file with exactly:
```tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActiveUser } from "../context/UserContext";
import { reportsApi } from "../api/reports";
import { graphApi } from "../api/graph";
import type { Report } from "../types";
import { useChatStream, type ChatEntry } from "../hooks/useChatStream";
import { AnswerMarkdown } from "../components/ask/AnswerMarkdown";
import { StepsPanel } from "../components/ask/StepsPanel";

const MIN_QUESTION_CHARS = 2;
const MAX_QUESTION_CHARS = 2000;
const STICK_THRESHOLD_PX = 80;

const GENERIC_SUGGESTIONS = [
  "Are any of my values outside their printed reference range?",
  "Summarize my latest report",
];
const SCOPED_SUGGESTIONS = ["Summarize this report", "Are any values in this report outside their printed reference range?"];

type ReportsState = "loading" | "ready" | "failed";

const Arrow: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    style={{ strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const cardBase: React.CSSProperties = { padding: "var(--space-4)", marginBottom: "var(--space-4)" };

const NoteCard: React.FC<{ tone: "accent" | "neutral"; tag: string; children: React.ReactNode }> = ({ tone, tag, children }) => (
  <div
    style={
      tone === "accent"
        ? { ...cardBase, background: "var(--color-accent-100)", borderTop: "2px solid var(--color-accent)" }
        : { ...cardBase, background: "var(--color-surface)", borderTop: "2px solid var(--color-text)" }
    }
  >
    <span
      className={tone === "accent" ? "tag tag-accent" : "tag tag-neutral"}
      style={{ fontWeight: 800, ...(tone === "accent" ? { background: "var(--color-accent-200)" } : {}) }}
    >
      {tag}
    </span>
    <div
      style={{
        margin: "var(--space-3) 0 0",
        fontSize: "1.0625rem",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        color: tone === "accent" ? "var(--color-accent-800)" : "var(--color-text)",
      }}
    >
      {children}
    </div>
  </div>
);

const EntryView: React.FC<{ n: number; entry: ChatEntry; onRetry: (question: string) => void; canRetry: boolean }> = ({
  n,
  entry,
  onRetry,
  canRetry,
}) => {
  let body: React.ReactNode = null;
  if (entry.status === "refused") {
    body = (
      <NoteCard tone="accent" tag="Declined by policy">
        {entry.answer}
      </NoteCard>
    );
  } else if (entry.status === "insufficient_evidence") {
    body = (
      <NoteCard tone="neutral" tag="No supporting passage">
        {entry.answer}
      </NoteCard>
    );
  } else if (entry.withheld) {
    body = (
      <NoteCard tone="neutral" tag="Answer withheld">
        The safety check held this answer back because it read like a diagnosis. Please rephrase the question, or take it to a clinician.
      </NoteCard>
    );
  } else if (entry.answer.trim()) {
    body = (
      <div style={{ paddingBottom: "var(--space-4)" }} data-testid="ask-answer">
        <AnswerMarkdown text={entry.answer} />
      </div>
    );
  }

  return (
    <article style={{ paddingBottom: "var(--space-6)" }} data-testid="ask-entry">
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: "var(--space-3)" }}>
        <div
          style={{
            maxWidth: "72%",
            background: "var(--color-surface)",
            borderTop: "2px solid var(--color-text)",
            padding: "var(--space-3) var(--space-4)",
          }}
        >
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "var(--color-accent-700)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Q{n}
          </div>
          <div style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {entry.question}
          </div>
        </div>
      </div>
      <StepsPanel entry={entry} />
      {body}
      {entry.status === "stopped" ? (
        <div style={{ paddingBottom: "var(--space-4)" }}>
          <span className="tag tag-neutral" style={{ fontWeight: 800 }}>
            Stopped
          </span>
        </div>
      ) : null}
      {entry.status === "error" ? (
        <div role="alert" style={{ ...cardBase, background: "var(--color-accent-100)", borderTop: "2px solid var(--color-accent)" }}>
          <span className="tag tag-accent" style={{ fontWeight: 800, background: "var(--color-accent-200)" }}>
            Could not finish
          </span>
          <p style={{ margin: "var(--space-3) 0", fontSize: "1.0625rem", lineHeight: 1.5, color: "var(--color-accent-800)" }}>
            {entry.error}
          </p>
          <button type="button" className="btn btn-secondary" disabled={!canRetry} onClick={() => onRetry(entry.question)}>
            Try again
          </button>
        </div>
      ) : null}
    </article>
  );
};

export const AskPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useActiveUser();
  const effectiveUserId = user?.id || localStorage.getItem("vitagraph_user_id") || "VG-2026-001";
  const chat = useChatStream();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportParam = searchParams.get("report");
  const qParam = searchParams.get("q");

  const [input, setInput] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsState, setReportsState] = useState<ReportsState>("loading");
  const [topTests, setTopTests] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Header search hands a question over as ?q=: prefill the composer, then drop q (keep report).
  useEffect(() => {
    if (!qParam) return;
    setInput(qParam);
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  // A different persona starts a fresh conversation.
  useEffect(() => {
    chat.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // The persona's reports: they decide the empty state and the "chat with this report" scope.
  useEffect(() => {
    let cancelled = false;
    setReportsState("loading");
    reportsApi
      .list(effectiveUserId)
      .then((list) => {
        if (cancelled) return;
        setReports(list);
        setReportsState("ready");
      })
      .catch(() => {
        if (!cancelled) setReportsState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId]);

  // Suggested questions name the most central tests of the persona's real graph.
  useEffect(() => {
    if (reportsState !== "ready" || reports.length === 0) {
      setTopTests([]);
      return;
    }
    let cancelled = false;
    graphApi
      .getGraph(effectiveUserId)
      .then((graph) => {
        if (cancelled) return;
        const labels = graph.nodes
          .filter((n) => n.type === "test")
          .sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0))
          .map((n) => String(n.label));
        setTopTests(Array.from(new Set(labels)).slice(0, 2));
      })
      .catch(() => {
        if (!cancelled) setTopTests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, reportsState, reports.length]);

  const scope = reportParam ? reports.find((r) => r.id === reportParam) ?? null : null;
  const hasReports = reportsState === "ready" && reports.length > 0;
  const composerReady = hasReports;

  const suggestions = scope
    ? SCOPED_SUGGESTIONS
    : [
        ...(topTests[0] ? [`What does my ${topTests[0]} trend show over time?`] : []),
        ...GENERIC_SUGGESTIONS,
        ...(topTests[1] ? [`What was my ${topTests[1]} value in each report?`] : []),
      ];

  const submit = (text: string) => {
    const question = text.trim();
    if (question.length < MIN_QUESTION_CHARS || chat.isStreaming || !composerReady) return;
    stickRef.current = true;
    chat.send(effectiveUserId, question, scope?.id ?? null);
    setInput("");
  };

  // Follow the answer while the reader is at the bottom; leave them alone once they scroll up.
  useEffect(() => {
    const scroller = bottomRef.current?.closest("main");
    if (!scroller) return;
    const onScroll = () => {
      stickRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_THRESHOLD_PX;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const scroller = bottomRef.current?.closest("main");
    if (scroller && stickRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [chat.entries]);

  const placeholder = composerReady ? "Ask about a value, a trend or a report" : "Upload a report to start asking";

  return (
    <div data-screen-label="Ask" data-testid="ask-page" style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          maxWidth: "960px",
          width: "100%",
          boxSizing: "border-box",
          margin: "0 auto",
          padding: "var(--space-8) var(--space-8) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        {reportParam ? (
          <div
            data-testid="scope-chip"
            style={{
              background: "var(--color-surface)",
              borderTop: "2px solid var(--color-text)",
              padding: "var(--space-3) var(--space-4)",
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "0.9375rem" }}>
              {scope ? (
                <>
                  <span style={{ fontWeight: 800 }}>Chatting with {scope.original_filename}.</span>{" "}
                  <span style={{ color: "var(--color-neutral-700)" }}>Answers use only this report.</span>
                </>
              ) : reportsState === "ready" ? (
                <span style={{ fontWeight: 800 }}>That report was not found. Answers use all your reports.</span>
              ) : (
                <span style={{ fontWeight: 800 }}>Loading the report</span>
              )}
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setSearchParams({})}>
              Use all my reports
            </button>
          </div>
        ) : null}

        {chat.entries.length === 0 ? (
          <div data-testid="ask-empty" style={{ padding: "var(--space-8) 0", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {reportsState === "failed" ? (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Cannot reach the backend</h2>
                <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>Your reports could not be loaded. Check that the backend is running, then reload this page.</p>
              </>
            ) : reportsState === "ready" && reports.length === 0 ? (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>No reports yet</h2>
                <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>Upload a report first, then ask about it here.</p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => navigate("/upload")}>
                    Upload a report
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>What would you like to know?</h2>
                <div>
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => submit(q)}
                      disabled={!composerReady}
                      className="ask-suggestion"
                      style={{
                        appearance: "none",
                        width: "100%",
                        cursor: composerReady ? "pointer" : "not-allowed",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-2)",
                        border: 0,
                        borderTop: "1px solid var(--color-divider)",
                        background: "transparent",
                        color: "var(--color-text)",
                        fontSize: "1rem",
                        fontWeight: 600,
                        opacity: composerReady ? 1 : 0.45,
                      }}
                    >
                      <span>{q}</span>
                      <Arrow size={16} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div data-testid="conversation-threads">
            {chat.entries.map((entry, index) => (
              <EntryView key={entry.id} n={index + 1} entry={entry} onRetry={submit} canRetry={composerReady && !chat.isStreaming} />
            ))}
            {!chat.isStreaming ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={chat.reset} data-testid="ask-new-chat">
                  New chat
                </button>
              </div>
            ) : null}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        data-testid="ask-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--color-bg)",
          borderTop: "2px solid var(--color-divider)",
          padding: "var(--space-4) var(--space-8)",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <input
            data-testid="ask-input"
            className="input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            disabled={!composerReady}
            aria-label="Your question"
            placeholder={placeholder}
            style={{ flex: "1 1 320px", minHeight: 52, fontSize: "1.0625rem", fontWeight: 600, padding: "var(--space-3) var(--space-4)" }}
          />
          {chat.isStreaming ? (
            <button type="button" className="btn btn-secondary" onClick={chat.stop} style={{ minWidth: 140, justifyContent: "space-between" }}>
              Stop
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!composerReady || input.trim().length < MIN_QUESTION_CHARS}
              style={{ minWidth: 140, justifyContent: "space-between" }}
            >
              Send
              <Arrow size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
```

## Step 5: the two small edits
5a. `site design/src/components/shell/AppShell.tsx`: find `new Set<string>(["/upload", "/compare", "/insights", "/library", "/settings"]);` (exists once) and change it to `new Set<string>(["/upload", "/compare", "/insights", "/library", "/settings", "/ask"]);`

5b. `site design/src/index.css`: append this block at the very end (after one blank line):
```css
/* Ask page: hover tint on the suggested-question rows. */
.ask-suggestion:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-text) 5%, transparent);
}
```

## Step 6: static checks (paste the output)
1. `npm run build` exits 0 (paste the last 3 lines).
2. `grep -n "rounded\|Spectral\|backdrop\|#[0-9a-fA-F]\{3,6\}" src/pages/AskPage.tsx src/hooks/useChatStream.ts src/components/ask/AnswerMarkdown.tsx src/components/ask/StepsPanel.tsx` prints nothing.
3. `grep -n -i "gemini\|agentrouter\|deepseek\|claude\|gpt\|openai" src/pages/AskPage.tsx src/hooks/useChatStream.ts src/components/ask/*.tsx` prints nothing.
4. `git diff --stat` lists only the files in the closed list (plus `tsconfig.tsbuildinfo`, which you never stage).

## Step 7: live check in the browser (REAL backend, REAL AI gateway)
This test asks real questions, so it costs a few AI calls and writes question events to the persona's history. Use ONLY the throwaway persona **"Empty Test Persona"** (id `usr_51f14542d71a`, check with `Invoke-RestMethod http://127.0.0.1:8000/api/users`). Never use any other persona for this test.

1. Start the backend (`cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, background) and the frontend (`cd "site design"; npm run dev -- --port 5173`, background). Wait 12 s.
2. Save the script below as `$env:TEMP\ask_live_check_t09a.py` (NOT in the repo). It needs Playwright for Python (it is installed on this machine) and Chrome.
```python
import json, sys, time
from playwright.sync_api import sync_playwright

SHOTS = sys.argv[1]
USER_ID = sys.argv[2]
BASE = "http://localhost:5173"
API = "http://127.0.0.1:8000"
COMPOSER = '[data-testid="ask-composer"]'
INPUT = '[data-testid="ask-input"]'
SEND = COMPOSER + ' button[type="submit"]'
LAST_DONE = """(() => { const e = document.querySelectorAll('[data-testid="ask-entry"]'); const l = e[e.length - 1];
  return !!l && /Thought for/.test(l.querySelector('[data-testid="ask-steps"] button').innerText); })()"""


def ask(page, text, expect_entries):
    page.fill(INPUT, text)
    page.click(SEND)
    page.wait_for_function(f"document.querySelectorAll('[data-testid=\"ask-entry\"]').length === {expect_entries}")
    page.wait_for_function(LAST_DONE, timeout=150000)


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script(f"localStorage.setItem('vitagraph_user_id','{USER_ID}')")
    page = ctx.new_page()
    console, requests = [], []
    page.on("console", lambda m: console.append((m.type, m.text[:160])) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: console.append(("pageerror", str(e)[:160])))
    page.on("request", lambda r: requests.append(json.loads(r.post_data)) if r.url.endswith("/api/chat/stream") and r.post_data else None)

    # A. empty state, suggestions, geometry
    page.goto(BASE + "/ask")
    page.wait_for_selector('[data-testid="ask-empty"]')
    page.wait_for_timeout(2500)
    print("A suggestions:", page.eval_on_selector_all(".ask-suggestion", "els => els.map(e => e.innerText)"))
    print("A geometry:", page.evaluate("""() => { const c = document.querySelector('[data-testid="ask-composer"]').getBoundingClientRect(); const h = document.querySelector('[data-testid="ask-empty"] h2'); const s = getComputedStyle(h);
      return { composerBottom: Math.round(c.bottom), mainBottom: Math.round(document.querySelector('main').getBoundingClientRect().bottom), h2: h.innerText, h2Size: s.fontSize, h2Weight: s.fontWeight, rowHeight: Math.round(document.querySelector('.ask-suggestion').getBoundingClientRect().height), inputHeight: Math.round(document.querySelector('[data-testid="ask-input"]').getBoundingClientRect().height), sendWidth: Math.round(document.querySelector('[data-testid="ask-composer"] button').getBoundingClientRect().width), font: getComputedStyle(document.body).fontFamily.slice(0, 20) }; }"""))
    page.screenshot(path=SHOTS + r"\task09a-ask-empty.png")

    # B. first question through a suggestion: streaming, table, steps header, scroll-follow
    t0 = time.time()
    page.click(".ask-suggestion >> nth=0")
    page.wait_for_selector('[data-testid="ask-entry"]')
    page.wait_for_function(LAST_DONE, timeout=150000)
    page.wait_for_timeout(500)
    print("B seconds:", round(time.time() - t0, 1))
    print("B entry:", page.evaluate("""() => ({ label: document.querySelector('[data-testid="ask-entry"]').innerText.split('\\n')[0],
      steps: document.querySelector('[data-testid="ask-steps"] button').innerText.replace(/\\n/g, ' '),
      answerStart: document.querySelector('[data-testid="ask-answer"]').innerText.slice(0, 140).replace(/\\n/g, ' '),
      tables: document.querySelectorAll('[data-testid="ask-answer"] table.table').length,
      newChat: !!document.querySelector('[data-testid="ask-new-chat"]'),
      send: document.querySelector('[data-testid="ask-composer"] button').innerText,
      fromBottom: Math.round(document.querySelector('main').scrollHeight - document.querySelector('main').scrollTop - document.querySelector('main').clientHeight) })"""))
    page.click('[data-testid="ask-steps"] button')
    page.wait_for_timeout(300)
    print("B step dot:", page.evaluate("""() => { const b = document.querySelector('[data-testid="ask-steps"] span[aria-hidden]').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }"""))
    print("B steps text:", page.eval_on_selector('[data-testid="ask-steps"]', "e => e.innerText.replace(/\\n+/g, ' | ').slice(0, 380)"))
    page.screenshot(path=SHOTS + r"\task09a-ask-answer.png")

    # C. follow-up: the request must carry the earlier turns
    ask(page, "And what is its normal range?", 2)
    last = requests[-1]
    print("C request messages:", [(m["role"], m["content"][:36]) for m in last["messages"]], "| report_id:", last.get("report_id"))
    print("C answer:", page.eval_on_selector_all('[data-testid="ask-answer"]', "els => els[els.length - 1].innerText.slice(0, 200).replace(/\\n/g, ' ')"))

    # D. refusal
    page.fill(INPUT, "Do I have diabetes?")
    page.click(SEND)
    page.wait_for_selector("text=Declined by policy", timeout=60000)
    print("D refusal:", page.eval_on_selector("text=Declined by policy", "e => e.parentElement.innerText.slice(0, 150).replace(/\\n/g, ' ')"))
    page.screenshot(path=SHOTS + r"\task09a-ask-refusal.png")

    # E. new chat
    page.wait_for_selector('[data-testid="ask-new-chat"]')
    page.click('[data-testid="ask-new-chat"]')
    page.wait_for_selector('[data-testid="ask-empty"]')
    print("E entries after new chat:", page.locator('[data-testid="ask-entry"]').count())

    # F. stop while streaming
    page.fill(INPUT, "Explain every value in all of my reports in detail")
    page.click(SEND)
    page.wait_for_selector(COMPOSER + ' button:has-text("Stop")', timeout=20000)
    page.wait_for_timeout(2500)
    page.click(COMPOSER + ' button:has-text("Stop")')
    page.wait_for_selector(COMPOSER + ' button:has-text("Send")', timeout=10000)
    print("F stopped tags:", page.locator("text=Stopped").count(), "| header:", page.eval_on_selector('[data-testid="ask-steps"] button', "e => e.innerText.replace(/\\n/g, ' ')"))

    # G. network failure: error card, then Try again after the network is back
    page.click('[data-testid="ask-new-chat"]')
    page.route("**/api/chat/stream", lambda r: r.abort())
    page.fill(INPUT, "What was my vitamin D?")
    page.click(SEND)
    page.wait_for_selector('[role="alert"]', timeout=10000)
    print("G error card:", page.eval_on_selector('[role="alert"]', "e => e.innerText.replace(/\\n/g, ' | ')"))
    page.screenshot(path=SHOTS + r"\task09a-ask-error.png")
    page.unroute("**/api/chat/stream")
    page.click('[role="alert"] button')
    page.wait_for_function("document.querySelectorAll('[data-testid=\"ask-entry\"]').length === 2")
    page.wait_for_function(LAST_DONE, timeout=150000)
    print("G retry answered:", page.eval_on_selector_all('[data-testid="ask-answer"]', "els => els.length"))

    # H. persona without reports
    page.route("**/api/reports?user_id=*", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
    page.goto(BASE + "/ask")
    page.wait_for_selector('[data-testid="ask-empty"] h2')
    print("H no reports:", page.inner_text('[data-testid="ask-empty"]').replace("\n", " | "), "| input disabled:", page.is_disabled(INPUT))
    page.unroute("**/api/reports?user_id=*")

    # I. report scope chip and ?q= prefill
    reports = json.loads(page.evaluate(f"fetch('{API}/api/reports?user_id={USER_ID}').then(r => r.text())"))
    rid = reports[0]["id"]
    page.goto(BASE + f"/ask?report={rid}&q=Summarize%20this")
    page.wait_for_selector('[data-testid="scope-chip"]')
    page.wait_for_timeout(800)
    print("I scope chip:", page.inner_text('[data-testid="scope-chip"]').replace("\n", " | "), "| input:", page.input_value(INPUT), "| url:", page.url)
    page.click(SEND)
    page.wait_for_function(LAST_DONE, timeout=150000)
    print("I scoped request carried report_id:", requests[-1].get("report_id") == rid)

    # J. narrow screen
    page.set_viewport_size({"width": 820, "height": 1100})
    page.goto(BASE + "/ask")
    page.wait_for_selector('[data-testid="ask-empty"]')
    page.wait_for_timeout(1500)
    print("J overflow:", page.evaluate("({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })"))
    page.screenshot(path=SHOTS + r"\task09a-ask-820.png")

    print("console (errors and warnings):", [m for m in console if "net::" not in m[1]])
    browser.close()
```
3. Run it, with Python UTF-8 output, from any folder:
`$env:PYTHONIOENCODING="utf-8"; python $env:TEMP\ask_live_check_t09a.py "F:\kiruthika\kiruthika final project\gemini\shots" usr_51f14542d71a`
It saves `task09a-ask-empty.png`, `task09a-ask-answer.png`, `task09a-ask-refusal.png`, `task09a-ask-error.png`, `task09a-ask-820.png` in `gemini/shots/`. It takes 1 to 4 minutes (the AI answers take 5 to 40 seconds each).
4. **Paste the whole raw output** in section 4 of your report. Required results (the wording of AI answers varies from run to run; the statuses and numbers must not):
   - **A**: four suggestions (the first names the persona's most central test, for example `What does my Hemoglobin trend show over time?`); `h2Size 32px`, `h2Weight 800`; `rowHeight` about 50; `inputHeight 52`; `sendWidth 140`; `composerBottom` equal to `mainBottom` (the composer is pinned to the bottom); font starts with `Archivo`.
   - **B**: label `Q1`; steps header `Thought for X s · N steps`; `tables 1` or more is fine, `0` is also acceptable if the answer simply has no table, but then say so; `send` is `Send` again; `fromBottom` 0 (the page followed the answer to the bottom); step dot `w 12, h 12` (square, not a bar); the steps text lists `Searched your reports for ...` with `N passages found`.
   - **C**: the request messages list contains exactly THREE items in this order: `user` (the first question), `assistant` (the first answer), `user` (`And what is its normal range?`). The answer mentions the reference range printed in the report (12.0 - 15.5 g/dL for hemoglobin) or says honestly that it is not printed.
   - **D**: `Declined by policy` card with the boundary text.
   - **E**: `entries after new chat: 0`.
   - **F**: `stopped tags: 1`, header `Thought for X s · N steps`, and the Send button is back.
   - **G**: the error card says `Cannot reach the VitaGraph backend. Is it running?`; after the network is back, Try again produces an answer.
   - **H**: `No reports yet` and `input disabled: True`.
   - **I**: the scope chip says `Chatting with <file>. Answers use only this report.`, the input is prefilled with `Summarize this`, the URL no longer contains `q=`, and `scoped request carried report_id: True`.
   - **J**: `scrollWidth` equals `innerWidth` (820).
   - **console**: an EMPTY list. (Do not accept font warnings: if you see any, say so; they are not expected.)
5. Look at the five screenshots and compare with `design/reference/screens/02_Ask.png`. Required: same heading, same suggestion rows with arrows, composer pinned at the bottom with a red Send button, Q bubble with "Q1" in red, bordered steps panel. Then compare what each screenshot SAYS with the footer, the header and the API (review rule of Task 08) and write any contradiction in section 6.
6. Two extra manual checks, each with a one-line result in the report:
   - With the backend STOPPED (`Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`) reload `/ask`: the page says `Cannot reach the backend` (heading) and the composer is disabled. Start the backend again.
   - Press Enter inside the input: it sends the question exactly like the Send button.
7. Stop both servers and confirm `Get-NetTCPConnection -LocalPort 5173,8000 -State Listen` prints nothing. Delete `$env:TEMP\ask_live_check_t09a.py`.

## Step 8: work report
Write `gemini/reports/TASK_09a_report.md` (nine headings, RULES 5b). Section 3 line counts must be copied from `git diff --stat`. Section 6 lists every difference from the reference and every contradiction you noticed.

## COMMIT
Stage ONLY these paths by explicit path (screenshots by explicit file name):
```
git add "site design/src/hooks/useChatStream.ts" "site design/src/components/ask/AnswerMarkdown.tsx" "site design/src/components/ask/StepsPanel.tsx" "site design/src/pages/AskPage.tsx" "site design/src/components/shell/AppShell.tsx" "site design/src/index.css" gemini/reports/TASK_09a_report.md
git add gemini/shots/task09a-ask-empty.png gemini/shots/task09a-ask-answer.png gemini/shots/task09a-ask-refusal.png gemini/shots/task09a-ask-error.png gemini/shots/task09a-ask-820.png
git commit -m "feat(redesign): T09a Ask as a real streaming chat (steps, markdown, memory, stop)"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```

## ACCEPTANCE (PASS/FAIL each with evidence)
- Build exits 0; greps 6.2 and 6.3 print nothing; only closed-list files in the commit.
- Live check A to J all as required above; console list empty.
- Screenshots match the reference layout (compared); no contradiction between what a screenshot says and the footer, header or API.
- Backend-down state and Enter-to-send verified.
- Servers stopped; temp script deleted; branch correct; report file has all nine headings.
