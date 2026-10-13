// The AI Agent run store. It lives outside React, so an answer keeps arriving while the
// person looks at another page or another chat. The backend owns the run (see
// vitagraph/backend/app/agent/runs.py); this store only FOLLOWS it:
//   - start(): POST /api/agent/stream (the first frame is `run`, then the usual frames),
//   - attach(): GET /api/agent/runs/{id}/events (replay from the start, then live),
//   - a dropped connection re-attaches with after=<last frame index> while the run is alive,
//   - stop(): POST /api/agent/runs/{id}/stop.
// Every frame goes through the same event handling the AI Agent page always had.

import { agentApi, type Conversation, type ConversationMessage } from "../api/agent";
import { agentRunsApi, type ActiveRun, type StreamRequestBody } from "../api/agentRuns";
import type { AgentEntry, AgentEvidence, AgentStats, EntryStatus } from "../hooks/useAgentChat";
import {
  applyFeedEvent,
  asRecord,
  closeRunning,
  evidenceFrom,
  numberOrNull,
  replaySavedFeed,
  settleItems,
} from "./agentFeed";
import { getActivity, setActivity } from "./appActivity";
import { saveLastAnswer } from "./lastAnswer";

type Json = Record<string, unknown>;
type Timer = ReturnType<typeof setTimeout>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RunSummary {
  conversationId: string;
  question: string;
  startedAt: number;
}

export interface ReadySummary {
  conversationId: string;
  question: string;
  /** Epoch ms; a new answer in the same chat is a new item. */
  finishedAt: number;
}

export interface AgentActivitySnapshot {
  running: RunSummary[];
  ready: ReadySummary[];
}

export interface AgentRunsSnapshot {
  userId: string | null;
  /** Entries of every conversation the app has touched. */
  entries: Readonly<Record<string, AgentEntry[]>>;
  runningIds: string[];
  activity: AgentActivitySnapshot;
  viewingId: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY_MESSAGES = 40;
const MAX_TURN_CHARS = 8000;
const RETRY_DELAYS_MS = [800, 1600, 3200, 6400];
const FLUSH_FALLBACK_MS = 100;
const EMPTY_ENTRIES: AgentEntry[] = [];
const EMPTY_IDS: string[] = [];
const DRAFT_KEY = "vitagraph_agent_drafts";

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

export interface Run {
  entryId: string;
  question: string;
  startedAt: number;
  controller: AbortController | null;
  /** Highest frame index applied; -1 before the first frame. */
  lastIndex: number;
  framesSeen: number;
  attempts: number;
  /** The run reached its last frame (or was stopped / failed): nothing more will arrive. */
  terminal: boolean;
  /** The person pressed Stop. */
  stopping: boolean;
  /** The store let go of this run (persona change); the reader must not touch state any more. */
  closed: boolean;
  buffer: string;
  raf: number | null;
  timer: Timer | null;
  stepSeq: number;
}

export interface Rec {
  id: string;
  userId: string;
  entries: AgentEntry[];
  run: Run | null;
}

export type Opener = { kind: "start" | "events"; open: (signal: AbortSignal) => Promise<Response> };

const records = new Map<string, Rec>();
const readyMap = new Map<string, ReadySummary>();
const listeners = new Set<() => void>();

let currentUser: string | null = null;
let viewingId: string | null = null;
let runningIds: string[] = EMPTY_IDS;
let runningList: RunSummary[] = [];
let readyList: ReadySummary[] = [];
let runningSig = "";
let readySig = "";
let activity: AgentActivitySnapshot = { running: runningList, ready: readyList };
let snapshot: AgentRunsSnapshot = buildSnapshot();
let lastBusy = false;

function buildSnapshot(): AgentRunsSnapshot {
  const entries: Record<string, AgentEntry[]> = {};
  records.forEach((rec, id) => {
    entries[id] = rec.entries;
  });
  return { userId: currentUser, entries, runningIds, activity, viewingId };
}

function liveRun(rec: Rec | undefined): Run | null {
  return rec && rec.run && !rec.run.terminal && !rec.run.closed ? rec.run : null;
}

function emit(): void {
  const running: RunSummary[] = [];
  records.forEach((rec) => {
    const run = liveRun(rec);
    if (run && rec.userId === currentUser) {
      running.push({ conversationId: rec.id, question: run.question, startedAt: run.startedAt });
    }
  });
  const nextRunningSig = running.map((r) => `${r.conversationId}|${r.startedAt}|${r.question}`).join("\n");
  let activityChanged = false;
  if (nextRunningSig !== runningSig) {
    runningSig = nextRunningSig;
    runningList = running;
    runningIds = running.length === 0 ? EMPTY_IDS : running.map((r) => r.conversationId);
    activityChanged = true;
  }
  const ready = Array.from(readyMap.values()).sort((a, b) => b.finishedAt - a.finishedAt);
  const nextReadySig = ready.map((r) => `${r.conversationId}|${r.finishedAt}`).join("\n");
  if (nextReadySig !== readySig) {
    readySig = nextReadySig;
    readyList = ready;
    activityChanged = true;
  }
  if (activityChanged) activity = { running: runningList, ready: readyList };
  snapshot = buildSnapshot();

  // The living background watches this flag; it stays true while ANY answer is being written.
  const busy = runningList.length > 0;
  if (busy !== lastBusy || getActivity().agentBusy !== busy) {
    lastBusy = busy;
    setActivity({ agentBusy: busy });
  }
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* a broken listener must not stop the others */
    }
  });
}

// ---------------------------------------------------------------------------
// Store access (used by the hooks)
// ---------------------------------------------------------------------------

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): AgentRunsSnapshot {
  return snapshot;
}

/** Entries of one conversation; the same array until it changes. */
export function getEntries(conversationId: string | null): AgentEntry[] {
  return (conversationId && records.get(conversationId)?.entries) || EMPTY_ENTRIES;
}

export function getRunningIds(): string[] {
  return runningIds;
}

export function getActivitySnapshot(): AgentActivitySnapshot {
  return activity;
}

export function isRunning(conversationId: string | null): boolean {
  return !!conversationId && liveRun(records.get(conversationId)) !== null;
}

/** The chat the person is looking at right now (null: none). A chat that finishes while viewed is not "ready". */
export function setViewing(conversationId: string | null): void {
  if (viewingId === conversationId && !(conversationId && readyMap.has(conversationId))) return;
  viewingId = conversationId;
  if (conversationId) readyMap.delete(conversationId);
  emit();
}

export function markSeen(conversationId: string): void {
  if (readyMap.delete(conversationId)) emit();
}

// ---------------------------------------------------------------------------
// Drafts (what the person typed and did not send), per conversation
// ---------------------------------------------------------------------------

let drafts: Record<string, string> | null = null;

function loadDrafts(): Record<string, string> {
  if (drafts) return drafts;
  drafts = {};
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(DRAFT_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        for (const [key, value] of Object.entries(parsed as Json)) {
          if (typeof value === "string") drafts[key] = value;
        }
      }
    }
  } catch {
    /* a blocked store only means drafts are not remembered across a reload */
  }
  return drafts;
}

/** `key` is a conversation id, or "new" for a chat that has no id yet. */
export function getDraft(key: string): string {
  return loadDrafts()[key] ?? "";
}

export function setDraftFor(key: string, text: string): void {
  const all = loadDrafts();
  if (text) all[key] = text;
  else delete all[key];
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

function newEntry(id: string, question: string, startedAt: number): AgentEntry {
  return {
    id,
    question,
    startedAt,
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
  };
}

function settle(entry: AgentEntry): AgentEntry {
  return { ...entry, trajectory: settleItems(entry.trajectory) };
}

function setEntries(rec: Rec, next: AgentEntry[]): void {
  rec.entries = next;
  emit();
}

function patchEntry(rec: Rec, entryId: string, change: (entry: AgentEntry) => AgentEntry): void {
  let touched = false;
  const next = rec.entries.map((e) => {
    if (e.id !== entryId) return e;
    touched = true;
    return change(e);
  });
  if (touched) setEntries(rec, next);
}

// A saved turn keeps the backend's names (elapsed_ms, tool_calls); the page uses its own.
function savedStats(raw: unknown): AgentStats | null {
  const s = asRecord(raw);
  if (Object.keys(s).length === 0) return null;
  return {
    steps: numberOrNull(s.steps) ?? 0,
    toolCalls: numberOrNull(s.tool_calls ?? s.toolCalls) ?? 0,
    elapsedMs: numberOrNull(s.elapsed_ms ?? s.elapsedMs) ?? 0,
    inputTokens: numberOrNull(s.input_tokens ?? s.inputTokens),
    outputTokens: numberOrNull(s.output_tokens ?? s.outputTokens),
  };
}

type SavedMessage = ConversationMessage & { safety_passed?: boolean | null; safety_note?: string | null };

const SAVED_STATUSES = new Set(["answered", "refused", "insufficient_evidence", "error", "stopped"]);

/**
 * Entries of a saved conversation. With `liveTail` the last question that has no saved answer
 * is the answer being written right now (it becomes the "streaming" entry the run fills).
 */
export function entriesFromConversation(conv: Conversation, liveTail: boolean): AgentEntry[] {
  const out: AgentEntry[] = [];
  const msgs = (conv.messages || []) as SavedMessage[];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== "user") continue;
    const next = msgs[i + 1]?.role === "assistant" ? msgs[i + 1] : null;
    if (next) i++;
    const startedAt = m.created_at ? new Date(m.created_at).getTime() : Date.now();

    if (!next) {
      const isTail = i >= msgs.length - 1;
      if (liveTail && isTail) {
        out.push(newEntry(`live_${conv.id}_${m.seq}`, m.content, startedAt));
      } else {
        out.push({
          ...newEntry(`loaded_${m.seq}`, m.content, startedAt),
          status: "error",
          endedAt: startedAt,
          error: "This answer was not finished.",
          title: conv.title ?? null,
        });
      }
      continue;
    }

    const endedAt = next.created_at ? new Date(next.created_at).getTime() : startedAt;
    const status: EntryStatus = SAVED_STATUSES.has(String(next.status)) ? (next.status as EntryStatus) : "answered";
    out.push({
      id: `loaded_${m.seq}`,
      question: m.content,
      startedAt,
      endedAt,
      status,
      answer: status === "error" ? "" : next.content,
      trajectory: replaySavedFeed(next.trajectory),
      stats: savedStats(next.stats),
      evidence: Array.isArray(next.evidence) ? next.evidence : [],
      withheld: next.safety_passed === false,
      safetyNote: typeof next.safety_note === "string" ? next.safety_note : null,
      aiStatus: next.ai_status ?? null,
      title: conv.title ?? null,
      error: status === "error" ? next.content || "The AI Agent could not finish this answer." : null,
    });
  }
  return out;
}

/** The earlier turns of a chat, sent to the AI Agent as context. */
export function historyMessages(entries: AgentEntry[]): { role: string; content: string }[] {
  return entries
    .filter((e) => e.status === "answered" && !e.withheld && e.answer.trim())
    .flatMap((e) => [
      { role: "user", content: e.question.slice(0, MAX_TURN_CHARS) },
      { role: "assistant", content: e.answer.slice(0, MAX_TURN_CHARS) },
    ])
    .slice(-MAX_HISTORY_MESSAGES);
}

// ---------------------------------------------------------------------------
// Frame handling (the event semantics are the ones the AI Agent page always had)
// ---------------------------------------------------------------------------

function payloadOf(data: unknown): Json {
  const record = asRecord(data);
  const metadata = record.metadata;
  return metadata && typeof metadata === "object" ? (metadata as Json) : record;
}

function isEvidence(value: unknown): value is AgentEvidence {
  const record = asRecord(value);
  return typeof record.ref === "number" && typeof record.chunk_id === "string";
}

function distinctChunkIds(evidence: AgentEvidence[]): string[] {
  const sorted = [...evidence].sort((a, b) => (a.ref ?? 0) - (b.ref ?? 0));
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const card of sorted) {
    if (card.chunk_id && !seen.has(card.chunk_id)) {
      seen.add(card.chunk_id);
      ids.push(card.chunk_id);
    }
  }
  return ids;
}

function newRun(entryId: string, question: string, startedAt: number): Run {
  return {
    entryId,
    question,
    startedAt,
    controller: null,
    lastIndex: -1,
    framesSeen: 0,
    attempts: 0,
    terminal: false,
    stopping: false,
    closed: false,
    buffer: "",
    raf: null,
    timer: null,
    stepSeq: 0,
  };
}

function clearFlushHandles(run: Run): void {
  if (run.raf !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(run.raf);
  if (run.timer !== null) clearTimeout(run.timer);
  run.raf = null;
  run.timer = null;
}

function flushNow(rec: Rec, run: Run): void {
  clearFlushHandles(run);
  if (!run.buffer || run.closed) return;
  const chunk = run.buffer;
  run.buffer = "";
  patchEntry(rec, run.entryId, (e) => ({ ...e, answer: e.answer + chunk }));
}

// text_delta tokens arrive many times per frame; coalesce them into one state write per frame.
// requestAnimationFrame is paused in a hidden tab, so a short timer is the fallback there.
function scheduleFlush(rec: Rec, run: Run): void {
  if (run.raf !== null || run.timer !== null) return;
  const go = () => flushNow(rec, run);
  if (typeof requestAnimationFrame === "function") run.raf = requestAnimationFrame(go);
  run.timer = setTimeout(go, FLUSH_FALLBACK_MS);
}

function finishRun(rec: Rec, run: Run, outcome: "ok" | "error" | "stopped"): void {
  if (run.terminal) return;
  flushNow(rec, run);
  run.terminal = true;
  run.controller = null;
  if (outcome === "ok" && !run.closed && rec.id !== viewingId && rec.userId === currentUser) {
    readyMap.set(rec.id, { conversationId: rec.id, question: run.question, finishedAt: Date.now() });
  }
  emit();
}

function fail(rec: Rec, run: Run, message: string): void {
  if (run.terminal) return;
  flushNow(rec, run);
  patchEntry(rec, run.entryId, (e) =>
    settle({ ...e, status: "error", error: e.error ?? message, endedAt: e.endedAt ?? Date.now() })
  );
  finishRun(rec, run, "error");
}

// Move the words written so far into the feed as a note and clear the answer area.
function narrate(rec: Rec, run: Run, now: number): void {
  flushNow(rec, run);
  patchEntry(rec, run.entryId, (e) => {
    const text = e.answer.trim();
    if (!text) return e;
    return {
      ...e,
      answer: "",
      trajectory: applyFeedEvent(e.trajectory, "note", { text }, { id: () => `feed_${run.stepSeq++}`, now }),
    };
  });
}

function frameTime(record: Json): number {
  const t = numberOrNull(record.timestamp);
  if (t === null) return Date.now();
  const ms = t < 1e11 ? t * 1000 : t;
  return Math.abs(ms - Date.now()) < 86_400_000 ? ms : Date.now();
}

function statusFrom(value: unknown): EntryStatus {
  return value === "refused" ? "refused" : value === "insufficient_evidence" ? "insufficient_evidence" : "answered";
}

/** Apply one SSE frame to a run. Exported for the offline test. */
export function consume(rec: Rec, run: Run, event: string, data: unknown): void {
  if (run.closed) return;
  const record = asRecord(data);
  let ev = event;
  if (ev === "message" && typeof record.event_type === "string") ev = record.event_type;
  // The last frame of a run is a `completed` frame whose stage is "done".
  if (ev === "completed" && record.stage === "done") ev = "done";

  // A replayed frame that was already applied (re-attach overlap) is skipped.
  const idx = Number.parseInt(String(record.index ?? ""), 10);
  if (Number.isFinite(idx)) {
    if (idx <= run.lastIndex) return;
    run.lastIndex = idx;
  }
  run.framesSeen += 1;
  run.attempts = 0;

  const p = payloadOf(data);
  const now = frameTime(record);
  const ctx = () => ({ id: () => `feed_${run.stepSeq++}`, now });
  const id = run.entryId;

  switch (ev) {
    case "run": {
      const startedAt = numberOrNull(p.started_at);
      if (startedAt !== null) {
        run.startedAt = startedAt;
        patchEntry(rec, id, (e) => ({ ...e, startedAt }));
      }
      emit();
      break;
    }
    case "status":
    case "step":
    case "thinking":
    case "privacy":
      patchEntry(rec, id, (e) => ({ ...e, trajectory: applyFeedEvent(e.trajectory, ev, p, ctx()) }));
      break;
    case "model":
      // The model finished a call that asked for tools: the words it wrote were narration, not the answer.
      if (p.phase === "end" && (numberOrNull(p.tool_calls) ?? 0) > 0) narrate(rec, run, now);
      patchEntry(rec, id, (e) => ({ ...e, trajectory: applyFeedEvent(e.trajectory, ev, p, ctx()) }));
      break;
    case "tool_call":
      narrate(rec, run, now); // without model events (chat format) the tool call is what ends the narration
      patchEntry(rec, id, (e) => ({ ...e, trajectory: applyFeedEvent(e.trajectory, ev, p, ctx()) }));
      break;
    case "tool_result": {
      const tool = String(p.tool ?? "");
      const cards = evidenceFrom(tool, asRecord(p.result));
      patchEntry(rec, id, (e) => {
        const byRef = new Map(e.evidence.map((c) => [c.ref, c]));
        cards.forEach((c) => byRef.set(c.ref, c));
        return {
          ...e,
          trajectory: applyFeedEvent(e.trajectory, ev, p, ctx()),
          evidence: Array.from(byRef.values()).sort((a, b) => a.ref - b.ref),
        };
      });
      break;
    }
    case "text_delta": {
      const delta = String(p.delta ?? "");
      if (!delta) break;
      patchEntry(rec, id, (e) => ({ ...e, trajectory: closeRunning(e.trajectory, ["status", "reasoning"]) }));
      run.buffer += delta;
      scheduleFlush(rec, run);
      break;
    }
    case "stats":
      patchEntry(rec, id, (e) => ({
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
    case "error": {
      flushNow(rec, run);
      if (p.status === "stopped") {
        patchEntry(rec, id, (e) => settle({ ...e, status: "stopped", endedAt: e.endedAt ?? Date.now() }));
        finishRun(rec, run, "stopped");
      } else {
        fail(rec, run, String(p.message ?? "The AI Agent could not finish this answer."));
      }
      break;
    }
    case "completed": {
      flushNow(rec, run);
      const status = statusFrom(p.status);
      const incomingEv = Array.isArray(p.evidence) ? p.evidence.filter(isEvidence) : null;
      // Save the last answer once, here, and only for an answer that was not withheld by the safety gate.
      const current = rec.entries.find((x) => x.id === id);
      if (current && status === "answered" && p.safety_passed !== false) {
        const chunkIds = distinctChunkIds(incomingEv ?? current.evidence);
        if (chunkIds.length > 0) saveLastAnswer({ userId: rec.userId, question: current.question, chunkIds });
      }
      patchEntry(rec, id, (e) => ({
        ...e,
        status,
        answer: String(p.summary_text ?? "").trim() ? String(p.summary_text) : e.answer,
        evidence: incomingEv ?? e.evidence,
        withheld: p.safety_passed === false,
        safetyNote: typeof p.safety_note === "string" ? p.safety_note : null,
        aiStatus: typeof p.ai_status === "string" ? p.ai_status : null,
        title: typeof p.session_title === "string" && p.session_title.trim() ? p.session_title.trim() : null,
      }));
      break;
    }
    case "done": {
      flushNow(rec, run);
      patchEntry(rec, id, (e) => {
        const finalStatus: EntryStatus = e.status === "streaming" ? statusFrom(p.status) : e.status;
        return settle({
          ...e,
          status: finalStatus,
          aiStatus: e.aiStatus ?? (typeof p.ai_status === "string" ? p.ai_status : null),
          title: e.title ?? (typeof p.session_title === "string" && p.session_title.trim() ? p.session_title.trim() : null),
          endedAt: e.endedAt ?? Date.now(),
        });
      });
      finishRun(rec, run, "ok");
      break;
    }
    default:
      break;
  }
}

/** Parse a text/event-stream body and hand every frame to `onFrame`. Handler errors are not swallowed. */
export async function pumpSse(res: Response, onFrame: (event: string, data: unknown) => void): Promise<void> {
  if (!res.body) throw new Error("The stream did not open.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
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
      onFrame(event, data);
    }
  }
}

// ---------------------------------------------------------------------------
// Following a run
// ---------------------------------------------------------------------------

class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Replace a chat's entries with what the backend saved (after a lost run, or a Stop that came too late). */
async function syncFromServer(rec: Rec, run: Run | null): Promise<void> {
  try {
    const conv = await agentApi.getConversation(rec.userId, rec.id);
    if (run && (run.closed || rec.run !== run)) return;
    if (liveRun(rec) && liveRun(rec) !== run) return; // a newer run owns the entries now
    if (run) {
      clearFlushHandles(run);
      run.buffer = "";
    }
    setEntries(rec, entriesFromConversation(conv, false));
  } catch {
    if (run) fail(rec, run, "The connection ended before the answer was complete.");
    return;
  }
  if (run) finishRun(rec, run, "ok");
}

async function follow(rec: Rec, run: Run, first: Opener): Promise<void> {
  let opener = first;
  while (!run.terminal && !run.closed) {
    const controller = new AbortController();
    run.controller = controller;
    try {
      const res = await opener.open(controller.signal);
      if (!res.ok || !res.body) throw new HttpError(res.status);
      await pumpSse(res, (event, data) => consume(rec, run, event, data));
      if (run.terminal || run.closed) return;
      throw new Error("dropped"); // the stream ended before the last frame
    } catch (err) {
      if (controller.signal.aborted || run.terminal || run.closed) return;
      if (err instanceof HttpError) {
        if (err.status === 404 && opener.kind === "events") {
          await syncFromServer(rec, run); // no such run any more: show what was saved
          return;
        }
        fail(rec, run, opener.kind === "start" ? `The AI Agent could not start (HTTP ${err.status}).` : `The AI Agent could not be followed (HTTP ${err.status}).`);
        return;
      }
      if (opener.kind === "start" && run.framesSeen === 0) {
        fail(rec, run, err instanceof TypeError ? "Cannot reach the VitaGraph backend. Is it running?" : err instanceof Error ? err.message : "The connection was lost.");
        return;
      }
      // The connection dropped while the answer was being written: the backend keeps going, so join it again.
      run.attempts += 1;
      if (run.attempts > RETRY_DELAYS_MS.length) {
        fail(rec, run, "The connection was lost before the answer was complete.");
        return;
      }
      await sleep(RETRY_DELAYS_MS[run.attempts - 1]);
      if (run.terminal || run.closed) return;
      opener = eventsOpener(rec, () => run.lastIndex);
    }
  }
}

function eventsOpener(rec: Rec, after: () => number): Opener {
  return { kind: "events", open: (signal) => agentRunsApi.openEvents(rec.userId, rec.id, Math.max(0, after()), signal) };
}

function getOrCreate(userId: string, conversationId: string): Rec {
  let rec = records.get(conversationId);
  if (!rec) {
    rec = { id: conversationId, userId, entries: EMPTY_ENTRIES, run: null };
    records.set(conversationId, rec);
  }
  return rec;
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/** A run that is not alive is dropped from the list of "in progress" answers. Persona change drops all of the old persona's. */
export function setUser(userId: string | null): void {
  if (userId === currentUser) return;
  records.forEach((rec, id) => {
    if (rec.userId === userId) return;
    const run = rec.run;
    if (run) {
      run.closed = true;
      clearFlushHandles(run);
      run.controller?.abort();
    }
    records.delete(id);
  });
  readyMap.clear();
  currentUser = userId;
  emit();
  if (userId) void refreshActive();
}

/** Join every answer the backend is still writing for this person (app start, persona change, tab shown again). */
export async function refreshActive(): Promise<void> {
  const userId = currentUser;
  if (!userId) return;
  let active: ActiveRun[];
  try {
    active = await agentRunsApi.active(userId);
  } catch {
    return; // backend offline: nothing to join
  }
  if (userId !== currentUser) return;
  for (const item of active) {
    if (liveRun(records.get(item.conversation_id))) continue;
    void attach(userId, item.conversation_id, 0, item);
  }
}

/**
 * Follow a running answer. Fetches the saved chat first (so the question shows), then replays the
 * run from the beginning and goes on live. If this store already follows the run it only joins again
 * from `afterIndex` (a dropped connection), keeping what it already has.
 */
export async function attach(userId: string, conversationId: string, afterIndex = 0, known?: ActiveRun): Promise<void> {
  setUser(userId);
  const existing = records.get(conversationId);
  const existingRun = liveRun(existing);
  if (existing && existingRun) {
    if (existingRun.controller) return; // already connected
    void follow(existing, existingRun, eventsOpener(existing, () => afterIndex));
    return;
  }

  const rec = getOrCreate(userId, conversationId);
  let entries: AgentEntry[];
  try {
    entries = entriesFromConversation(await agentApi.getConversation(userId, conversationId), true);
  } catch {
    entries = [newEntry(`live_${conversationId}_0`, known?.question ?? "", known?.started_at ?? Date.now())];
  }
  if (currentUser !== userId || liveRun(rec)) return; // persona changed, or a send() got there first
  const tail = entries[entries.length - 1];
  if (!tail || tail.status !== "streaming") {
    setEntries(rec, entries); // it finished while we were asking: the saved answer is complete
    return;
  }
  const run = newRun(tail.id, tail.question, known?.started_at ?? tail.startedAt);
  rec.run = run;
  // Replay from the first frame onto an empty answer, so nothing is written twice.
  setEntries(rec, entries.map((e) => (e.id === tail.id ? { ...newEntry(e.id, e.question, run.startedAt), title: e.title } : e)));
  void follow(rec, run, eventsOpener(rec, () => run.lastIndex));
}

/**
 * Start a new answer. `messages` are the earlier turns plus the new question as the last item.
 * Returns false when nothing was started (empty question, or an answer is already running).
 */
export function start(
  userId: string,
  conversationId: string,
  messages: { role: string; content: string }[],
  reportId?: string | null
): boolean {
  setUser(userId);
  const question = (messages[messages.length - 1]?.content ?? "").trim();
  if (!question || runningIds.length > 0) return false;

  const rec = getOrCreate(userId, conversationId);
  const entryId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const run = newRun(entryId, question, Date.now());
  rec.run = run;
  readyMap.delete(conversationId);
  setEntries(rec, [...rec.entries, newEntry(entryId, question, run.startedAt)]);

  const body: StreamRequestBody = {
    user_id: userId,
    messages,
    conversation_id: conversationId,
    ...(reportId ? { report_id: reportId } : {}),
  };
  void follow(rec, run, { kind: "start", open: (signal) => agentRunsApi.openStream(body, signal) });
  return true;
}

/** Stop the answer of one chat: the backend cancels the run and saves what was written so far. */
export async function stop(userId: string, conversationId: string): Promise<void> {
  const rec = records.get(conversationId);
  const run = liveRun(rec);
  if (!rec || !run) return;
  run.stopping = true;
  flushNow(rec, run);
  run.controller?.abort();
  patchEntry(rec, run.entryId, (e) => (e.status === "streaming" ? settle({ ...e, status: "stopped", endedAt: Date.now() }) : e));
  finishRun(rec, run, "stopped");
  try {
    const result = await agentRunsApi.stop(userId, conversationId);
    // Too late to stop: the answer was finished and saved, so show that instead.
    if (!result.stopped) await syncFromServer(rec, null);
  } catch {
    /* keep the local "stopped" state */
  }
}

/**
 * Show a saved chat. Never touches a run that is still being written: its live entries stay.
 * If the backend still writes this chat's answer, the run is joined.
 */
export async function open(userId: string, conversationId: string): Promise<void> {
  setUser(userId);
  const existing = records.get(conversationId);
  if (liveRun(existing)) return;
  let conv: Conversation;
  let active: ActiveRun[] = [];
  try {
    [conv, active] = await Promise.all([
      agentApi.getConversation(userId, conversationId),
      agentRunsApi.active(userId).catch(() => [] as ActiveRun[]),
    ]);
  } catch {
    return; // keep what is shown
  }
  if (currentUser !== userId) return;
  const rec = getOrCreate(userId, conversationId);
  if (liveRun(rec)) return;
  const running = active.find((a) => a.conversation_id === conversationId);
  if (running) {
    await attach(userId, conversationId, 0, running);
    return;
  }
  setEntries(rec, entriesFromConversation(conv, false));
}

/** Forget a chat the person deleted. */
export function forget(conversationId: string): void {
  const rec = records.get(conversationId);
  if (!rec) return;
  if (rec.run) {
    rec.run.closed = true;
    clearFlushHandles(rec.run);
    rec.run.controller?.abort();
  }
  records.delete(conversationId);
  readyMap.delete(conversationId);
  emit();
}

// Coming back to a hidden tab: join any answer whose connection was lost meanwhile.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentUser) void refreshActive();
  });
}

// Test hooks (the offline test builds a record and a run without the network).
export const __test = {
  makeRec: (id: string, userId: string, entries: AgentEntry[]): Rec => ({ id, userId, entries, run: null }),
  makeRun: newRun,
  newEntry,
  flush: flushNow,
};

export const agentRuns = {
  start,
  attach,
  stop,
  open,
  forget,
  subscribe,
  getSnapshot,
  getEntries,
  getRunningIds,
  getActivitySnapshot,
  isRunning,
  setViewing,
  markSeen,
  setUser,
  refreshActive,
  getDraft,
  setDraftFor,
};
