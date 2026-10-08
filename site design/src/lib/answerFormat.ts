// Pure helpers for how an AI answer is read: follow-up chips, streaming without flicker, and highlighting
// only the numbers that a tool really returned.

import type { TrajectoryItem } from "../hooks/useAgentChat";

// ------------------------------------------------------------------ follow-ups

const FOLLOW_UP_LINE = /(?:^|\n)[ \t]*`?FOLLOW-?UPS?:[^\n]*`?[ \t]*$/i;
const MARKER = "FOLLOW-UPS:";

/** Splits the closing "FOLLOW-UPS: a | b" line off an answer; also hides it while it is still being typed. */
export function splitFollowUps(text: string): { body: string; followUps: string[] } {
  const match = FOLLOW_UP_LINE.exec(text);
  if (match) {
    const line = match[0].replace(/`/g, "").replace(/^[\s]*FOLLOW-?UPS?:/i, "").trim();
    const followUps = line
      .split("|")
      .map((q) => q.trim().replace(/^[-*\d.)\s]+/, ""))
      .filter((q) => q.length >= 3 && q.length <= 140)
      .slice(0, 2);
    return { body: text.slice(0, match.index).trimEnd(), followUps };
  }
  // A marker that has only just started ("...\nFOLLOW-U") must not flash on screen.
  const lastLine = text.slice(text.lastIndexOf("\n") + 1).replace(/^[ \t`]+/, "").toUpperCase();
  if (lastLine.length >= 3 && MARKER.startsWith(lastLine.replace("FOLLOWUP", "FOLLOW-UP"))) {
    return { body: text.slice(0, text.lastIndexOf("\n")).trimEnd(), followUps: [] };
  }
  return { body: text, followUps: [] };
}

// --------------------------------------------------------- streaming stability

/** Hides a half-typed `**`, backtick or `[1` so raw marks never flicker while the answer streams. */
export function stabilizeMarkdown(text: string): string {
  let out = text;
  const bold = out.match(/\*\*/g)?.length ?? 0;
  if (bold % 2 === 1) out = out.slice(0, out.lastIndexOf("**"));
  const ticks = out.match(/`/g)?.length ?? 0;
  if (ticks % 2 === 1) out = out.slice(0, out.lastIndexOf("`"));
  out = out.replace(/\[\d{0,2}$/, "");
  return out;
}

// --------------------------------------------------------- verified highlights

export interface Fact {
  value: number;
  unit: string; // lower case, no spaces
}

const UNIT_WORDS = new Set(["mg", "g", "kg", "mmol", "mol", "iu", "fl", "pg", "ng", "bpm", "mmhg", "cm", "kcal", "lb", "lbs"]);
const NUMBER_WITH_UNIT = /(\d+(?:\.\d+)?)[  ]?(%|[A-Za-zµμ][A-Za-zµμ/%.^0-9]*)/g;

function normaliseUnit(unit: string): string {
  return unit.toLowerCase().replace(/\s+/g, "").replace(/[.,;:]+$/, "").replace(/μ/g, "µ");
}

function looksLikeUnit(unit: string): boolean {
  return unit === "%" || unit.includes("/") || UNIT_WORDS.has(unit);
}

/** Numbers with a unit written in a piece of report text. */
function factsInText(text: string): Fact[] {
  const found: Fact[] = [];
  for (const m of text.matchAll(NUMBER_WITH_UNIT)) {
    const unit = normaliseUnit(m[2]);
    if (looksLikeUnit(unit)) found.push({ value: Number(m[1]), unit });
  }
  return found;
}

/** The values a tool really returned in this turn: lab measurements and numbers inside cited passages. */
export function verifiedFacts(trajectory: TrajectoryItem[], snippets: string[] = []): Fact[] {
  const facts: Fact[] = [];
  for (const item of trajectory) {
    const measurements = item.result && Array.isArray((item.result as { measurements?: unknown }).measurements)
      ? ((item.result as { measurements: unknown[] }).measurements)
      : [];
    for (const raw of measurements) {
      const m = raw as { value?: unknown; unit?: unknown };
      if (typeof m.value === "number" && typeof m.unit === "string" && m.unit.trim()) {
        facts.push({ value: m.value, unit: normaliseUnit(m.unit) });
      }
    }
  }
  for (const snippet of snippets) facts.push(...factsInText(snippet));
  return facts;
}

export interface Segment {
  text: string;
  verified: boolean;
}

/** Splits text so that only a number-with-unit that matches a returned fact is marked verified. */
export function markVerified(text: string, facts: readonly Fact[]): Segment[] {
  if (facts.length === 0 || !text) return [{ text, verified: false }];
  const segments: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER_WITH_UNIT)) {
    const unit = normaliseUnit(m[2]);
    const value = Number(m[1]);
    if (!looksLikeUnit(unit)) continue;
    if (!facts.some((f) => f.unit === unit && Math.abs(f.value - value) < 1e-9)) continue;
    const start = m.index ?? 0;
    // Keep a trailing sentence dot out of the highlight ("14.1 g/dL." -> "14.1 g/dL").
    const matched = m[0].replace(/[.,;:]+$/, "");
    if (start > last) segments.push({ text: text.slice(last, start), verified: false });
    segments.push({ text: matched, verified: true });
    last = start + matched.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), verified: false });
  return segments.length > 0 ? segments : [{ text, verified: false }];
}

// --------------------------------------------------------------------- reports

const REPORT_BLOCK = /```report[ \t]*\n([\s\S]*?)\n```/i;

/** The Markdown of a report the agent wrote inside a ```report block (complete blocks only), else null. */
export function extractReport(text: string): string | null {
  const match = REPORT_BLOCK.exec(text);
  return match && match[1].trim().length > 0 ? match[1].trim() : null;
}

/** The report's title: its first heading, or the fallback. */
export function reportTitle(markdown: string, fallback: string): string {
  const heading = /^#{1,2}[ \t]+(.+)$/m.exec(markdown);
  return (heading ? heading[1] : fallback).trim().slice(0, 120) || "Report";
}
