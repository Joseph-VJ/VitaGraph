// Plain words for the Accuracy Test (the RAG Lab). Only wording lives here: no score is computed or changed.

import type { LabGoldQuestion, LabMode, LabRunSummary } from "../api/lab";
import type { RowState } from "../hooks/useLabRun";

export function pct(v: number | null | undefined): string {
  return typeof v === "number" ? `${Math.round(v * 100)}%` : "–";
}

/** "7 of 8", or a dash when either number is missing. */
export function frac(a: number | null | undefined, b: number | null | undefined): string {
  return typeof a === "number" && typeof b === "number" ? `${a} of ${b}` : "–";
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function modeLabel(mode: LabMode | null): string {
  return mode === "full" ? "With the AI's answers" : "Quick test";
}

const ORDINAL_WORDS = ["first", "second", "third"];

export function ordinalWord(rank: number): string {
  return ORDINAL_WORDS[rank - 1] ?? `number ${rank}`;
}

/** The backend's check names, in words a person knows. */
export function plainCheckName(name: string): string {
  const key = name.toLowerCase();
  if (key === "gate") return "Safety check";
  if (key.startsWith("retriev")) return "Search";
  if (key === "answer") return "Written answer";
  if (key.startsWith("citation")) return "Pointed to the right report";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function expectWords(expect: LabGoldQuestion["expect"]): string {
  if (expect === "refuse") return "This one must be refused.";
  if (expect === "not_found") return "The reports do not contain this.";
  return "The reports contain the answer.";
}

export type ResultWord = "Waiting" | "Checking" | "Passed" | "Failed" | "No result";

export function resultWord(row: RowState): ResultWord {
  if (row.status === "waiting") return "Waiting";
  if (row.status === "running") return "Checking";
  if (row.pass === null) return "No result";
  return row.pass ? "Passed" : "Failed";
}

function checkOf(row: RowState, name: string) {
  return row.checks.find((c) => c.name.toLowerCase().startsWith(name));
}

/** One plain sentence about what happened to a question. */
export function howSentence(q: LabGoldQuestion, row: RowState): string {
  if (row.status === "waiting") return "Waiting to be checked.";
  if (row.status === "running") return "Checking now.";
  if (row.pass === null) return "There is no result for this question.";

  const gate = checkOf(row, "gate");
  const search = checkOf(row, "retriev");
  const answer = checkOf(row, "answer");
  const cites = checkOf(row, "citation");
  const parts: string[] = [];

  if (q.expect === "refuse") {
    if (gate && !gate.pass) parts.push("It was answered, but it should have been refused.");
    else if (answer && !answer.pass) parts.push("The safety rules refused it, but the AI still answered.");
    else parts.push("Correctly refused.");
    return parts.join(" ");
  }

  if (gate && !gate.pass) {
    parts.push("A good question was refused by mistake.");
    return parts.join(" ");
  }

  if (q.expect === "not_found") {
    if (search && !search.pass) parts.push("The search found something about it, but the reports do not mention it.");
    else parts.push("Correctly found nothing about it.");
    if (answer) parts.push(answer.pass ? "The AI said it is not in the reports." : "The AI did not clearly say it is not in the reports.");
    return parts.join(" ");
  }

  if (search && !search.pass) {
    parts.push("Did not find the right passage.");
    if (row.missingTerms.length) parts.push(`Not found: ${row.missingTerms.join(", ")}.`);
  } else if (row.firstRelevantRank) {
    parts.push(`Found the right passage (${ordinalWord(row.firstRelevantRank)} result).`);
  } else {
    parts.push("Found the right passage.");
  }
  if (answer) parts.push(answer.pass ? "The written answer was correct." : "The written answer was wrong or incomplete.");
  if (cites && !cites.pass) parts.push("It did not point to the right report.");
  return parts.join(" ");
}

/** "Quick test · piece size 200 · 9 of 11 passed" for the list of past results. */
export function historyLine(run: LabRunSummary): string {
  const sc = run.scorecard;
  const parts = [modeLabel(run.mode), `piece size ${run.chunk_size}`];
  if (sc && typeof sc.passed === "number" && typeof sc.questions_total === "number") {
    parts.push(`${sc.passed} of ${sc.questions_total} passed`);
  } else {
    parts.push("no result");
  }
  if (run.status !== "finished" && run.status !== "completed") {
    parts.push(run.status === "stopped" ? "stopped" : run.status === "failed" ? "did not finish" : run.status);
  }
  return parts.join(" · ");
}
