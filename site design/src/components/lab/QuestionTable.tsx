import React from "react";
import type { LabGoldQuestion } from "../../api/lab";
import { emptyRow, type RowState } from "../../hooks/useLabRun";
import { expectWords, howSentence, plainCheckName, plural, resultWord } from "../../lib/labWords";
import { Tag } from "../ui";

export interface QuestionTableProps {
  questions: LabGoldQuestion[];
  rows: Record<string, RowState>;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

function formatMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "–";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// Three columns on a wide screen (Question | Result | How); on a phone the sentence drops under the question.
const css = `
.lab-q-head { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lab-q-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--space-4); row-gap: var(--space-1); align-items: start; }
.lab-q-how { grid-column: 1 / -1; }
.lab-q-btn { background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; display: block; width: 100%; line-height: 1.4; }
.lab-q-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
@media (min-width: 820px) {
  .lab-q-head { position: static; width: auto; height: auto; margin: 0; overflow: visible; clip: auto; white-space: normal; }
  .lab-q-grid { grid-template-columns: minmax(0, 5fr) 6.5rem minmax(0, 5fr); }
  .lab-q-how { grid-column: auto; }
}
`;

const headCell: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

function ResultCell({ row }: { row: RowState }) {
  const word = resultWord(row);
  if (word === "Checking") return <span style={{ fontWeight: 800, color: "var(--color-accent-700)" }}>Checking</span>;
  if (word === "Passed") return <Tag tone="done">Passed</Tag>;
  if (word === "Failed") return <Tag tone="accent">Failed</Tag>;
  return <span style={{ color: "var(--color-neutral-700)" }}>{word === "Waiting" ? "Waiting" : "–"}</span>;
}

export const QuestionTable: React.FC<QuestionTableProps> = ({ questions, rows, expandedId, onToggle }) => {
  return (
    <div data-testid="lab-question-table" role="table" aria-label="Test questions and results">
      <style>{css}</style>
      <div role="row" className="lab-q-head lab-q-grid" style={{ borderBottom: "2px solid var(--color-divider)", padding: "0 var(--space-2) var(--space-2)" }}>
        <div role="columnheader" style={headCell}>Question</div>
        <div role="columnheader" style={headCell}>Result</div>
        <div role="columnheader" style={headCell}>How</div>
      </div>
      {questions.map((q, index) => {
        const row = rows[q.id] ?? emptyRow(q.id);
        const waiting = row.status === "waiting";
        const running = row.status === "running";
        const open = expandedId === q.id;
        return (
          <React.Fragment key={q.id}>
            <div
              role="row"
              className="lab-q-grid"
              data-testid={`lab-row-${q.id}`}
              data-status={row.status}
              onClick={() => onToggle(q.id)}
              style={{
                cursor: "pointer",
                padding: "var(--space-3) var(--space-2)",
                borderBottom: "1px solid var(--color-divider)",
                boxShadow: running ? "inset 5px 0 0 var(--color-accent)" : undefined,
                color: waiting ? "var(--color-neutral-700)" : undefined,
                minHeight: 44,
              }}
            >
              <div role="cell" style={{ minWidth: 0 }}>
                <button
                  type="button"
                  className="lab-q-btn"
                  aria-expanded={open}
                  aria-controls={`lab-detail-${q.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(q.id);
                  }}
                  style={{ fontWeight: running ? 800 : 600, fontSize: "1rem", overflowWrap: "anywhere" }}
                >
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-700)", fontWeight: 600 }}>
                    {index + 1}.{" "}
                  </span>
                  {q.question}
                </button>
              </div>
              <div role="cell">
                <ResultCell row={row} />
              </div>
              <div role="cell" className="lab-q-how" style={{ fontSize: "0.9375rem", lineHeight: 1.4, color: "var(--color-neutral-700)", overflowWrap: "anywhere" }}>
                {howSentence(q, row)}
              </div>
            </div>
            {open && (
              <div
                id={`lab-detail-${q.id}`}
                data-testid={`lab-detail-${q.id}`}
                style={{ background: "var(--color-surface)", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-divider)" }}
              >
                <RowDetail q={q} row={row} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** The questions that did not pass, each with its plain reason. Renders nothing when everything passed so far. */
export const WhatWentWrong: React.FC<{
  questions: LabGoldQuestion[];
  rows: Record<string, RowState>;
  leaks: number | null;
}> = ({ questions, rows, leaks }) => {
  const failed = questions.filter((q) => rows[q.id]?.status === "done" && rows[q.id]?.pass === false);
  const leakCount = typeof leaks === "number" && leaks > 0 ? leaks : 0;
  if (failed.length === 0 && leakCount === 0) return null;
  return (
    <section
      aria-label="What went wrong"
      data-testid="lab-went-wrong"
      style={{ borderLeft: "5px solid var(--color-accent)", background: "var(--color-surface)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>What went wrong</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {failed.map((q) => (
          <li key={q.id} style={{ fontSize: "0.9375rem", lineHeight: 1.45 }}>
            <strong style={{ fontWeight: 800 }}>{q.question}</strong>
            <br />
            {howSentence(q, rows[q.id])}
          </li>
        ))}
        {leakCount > 0 && (
          <li style={{ fontSize: "0.9375rem", lineHeight: 1.45 }}>
            <strong style={{ fontWeight: 800 }}>Personal details got through</strong>
            <br />
            {leakCount} {plural(leakCount, "name or ID was", "names or IDs were")} still visible after the Privacy Shield hid the text.
          </li>
        )}
      </ul>
    </section>
  );
};

const kicker: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
  margin: 0,
};

const body: React.CSSProperties = { margin: 0, fontSize: "0.9375rem", lineHeight: 1.45 };
const muted: React.CSSProperties = { margin: 0, fontSize: "0.9375rem", color: "var(--color-neutral-700)", lineHeight: 1.45 };

const RowDetail: React.FC<{ q: LabGoldQuestion; row: RowState }> = ({ q, row }) => {
  if (row.status === "waiting") {
    return (
      <p style={muted}>
        {expectWords(q.expect)}{" "}
        {q.expect === "answer" && q.must_contain.length > 0 ? `The right passage must contain: ${q.must_contain.join(", ")}. ` : ""}
        It has not been checked yet.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <p style={muted}>{expectWords(q.expect)}</p>
      {row.hasRetrieval && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <h3 style={kicker}>Passages the search found</h3>
          {row.hits.length === 0 ? (
            <p style={body}>No passage was close enough to the question.</p>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {row.hits.map((hit) => (
                <li key={hit.rank} style={{ display: "flex", gap: "var(--space-2)", alignItems: "baseline" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      flex: "none",
                      width: 8,
                      height: 8,
                      background: hit.relevant ? "var(--color-accent)" : "transparent",
                      border: hit.relevant ? "none" : "1px solid var(--color-neutral-400)",
                    }}
                  />
                  <span style={{ ...body, minWidth: 0, overflowWrap: "anywhere" }}>
                    <strong style={{ fontWeight: 800 }}>
                      #{hit.rank} {hit.file}
                      {hit.page !== null && hit.page !== undefined ? `, page ${hit.page}` : ""}
                      {typeof hit.score === "number" ? ` · match ${hit.score.toFixed(2)}` : ""}
                      {hit.relevant ? " · the right passage" : ""}
                    </strong>
                    <br />
                    {hit.snippet}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {q.expect !== "refuse" && (
            <p style={muted}>
              Looked for: found {row.foundTerms.length ? row.foundTerms.join(", ") : "nothing"} · not found{" "}
              {row.missingTerms.length ? row.missingTerms.join(", ") : "nothing"}
            </p>
          )}
        </div>
      )}
      {row.answer && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <h3 style={kicker}>The AI's written answer</h3>
          {row.answer.text ? (
            <p style={{ ...body, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{row.answer.text}</p>
          ) : (
            <p style={body}>No answer was written. The question was refused before the AI was asked.</p>
          )}
          <p style={muted}>
            Reports it pointed to: {row.answer.citedFiles.length ? row.answer.citedFiles.join(", ") : "none"}
            {typeof row.answer.seconds === "number" ? ` · ${row.answer.seconds.toFixed(1)} s` : ""}
          </p>
        </div>
      )}
      {row.checks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <h3 style={kicker}>What was checked</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.9375rem", lineHeight: 1.5 }}>
            {row.checks.map((check) => (
              <li key={check.name}>
                <strong style={{ fontWeight: 800, color: check.pass ? undefined : "var(--color-accent-700)" }}>
                  {check.pass ? "Passed" : "Failed"}
                </strong>{" "}
                {plainCheckName(check.name)}
                {check.detail ? `: ${check.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p style={muted}>Time taken: {formatMs(row.ms)}</p>
    </div>
  );
};
