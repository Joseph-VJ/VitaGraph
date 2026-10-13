import React from "react";
import type { LabMode, Scorecard as ScorecardData } from "../../api/lab";
import { frac, pct, plural } from "../../lib/labWords";

export interface ScorecardProps {
  card: ScorecardData | null;
  mode: LabMode | null;
}

interface Tile {
  key: string;
  label: string;
  value: string;
  note: string;
  wide?: boolean;
  alert?: boolean;
}

const EMPTY = "–";
const WAITING = "Scored when the test ends.";

/** The four scores a person needs first, plus the headline. Every number comes from the run's scorecard. */
function mainTiles(c: ScorecardData | null): Tile[] {
  const has = c !== null;
  return [
    {
      key: "hit",
      label: "Found the right passage",
      value: has ? `${frac(c.retrieval_hits, c.answerable)} · ${pct(c.retrieval_hit_rate)}` : EMPTY,
      note:
        has && c.answerable !== null
          ? `The right part of a report was found for ${c.retrieval_hits ?? 0} of ${c.answerable} questions.`
          : WAITING,
    },
    {
      key: "refusals",
      label: "Correctly refused unsafe questions",
      value: has ? frac(c.refusal_correct, c.refusal_total) : EMPTY,
      note: has ? "Questions asking for a diagnosis or advice that were refused, as they should be." : WAITING,
    },
    {
      key: "false",
      label: "Wrongly refused good questions",
      value: has && typeof c.false_refusals === "number" ? String(c.false_refusals) : EMPTY,
      note: has ? "Good questions that were refused by mistake. Zero is best." : WAITING,
      alert: has && (c.false_refusals ?? 0) > 0,
    },
    {
      key: "leaks",
      label: "Personal details that got through",
      value: has && typeof c.identifier_leaks === "number" ? String(c.identifier_leaks) : EMPTY,
      note: has ? "The sample reports' known names and IDs that were still visible after the Privacy Shield hid them. Zero is best." : WAITING,
      alert: has && (c.identifier_leaks ?? 0) > 0,
    },
  ];
}

/** Everything else the test measures. Still shown, just not first. */
function moreTiles(c: ScorecardData | null, mode: LabMode | null): Tile[] {
  const has = c !== null;
  const tiles: Tile[] = [
    {
      key: "mrr",
      label: "How near the top the right passage came",
      value: has && typeof c.mrr === "number" ? c.mrr.toFixed(2) : EMPTY,
      note: has ? "1.00 means the right passage was always the first result." : WAITING,
    },
    {
      key: "precision",
      label: "How many shown passages were the right ones",
      value: has ? pct(c.context_precision) : EMPTY,
      note: has ? "Of all the passages the search showed, the share that were the right ones." : WAITING,
    },
    {
      key: "gaps",
      label: "Correctly said “not in your reports”",
      value: has ? frac(c.not_found_ok, c.not_found_total) : EMPTY,
      note: has ? "Questions about things that are not in the reports, where nothing was made up." : WAITING,
    },
  ];
  const full = mode === "full" || (has && typeof c.answer_accuracy === "number");
  if (full) {
    tiles.push(
      {
        key: "accuracy",
        label: "Written answers that were correct",
        value: has ? pct(c.answer_accuracy) : EMPTY,
        note: has ? "Answers that contain the expected facts." : WAITING,
      },
      {
        key: "citations",
        label: "Answers that pointed to the right report",
        value: has ? pct(c.citation_correctness) : EMPTY,
        note: has ? "Passages the AI pointed to that came from the right report." : WAITING,
      },
      {
        key: "time",
        label: "Average time for an answer",
        value: has && typeof c.avg_answer_s === "number" ? `${c.avg_answer_s.toFixed(1)} s` : EMPTY,
        note: has
          ? typeof c.max_answer_s === "number"
            ? `The slowest answer took ${c.max_answer_s.toFixed(1)} s.`
            : "Time from question to finished answer."
          : WAITING,
      },
    );
  }
  return tiles;
}

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

const TileView: React.FC<{ tile: Tile }> = ({ tile }) => (
  <div
    data-testid={`lab-score-${tile.key}`}
    style={{
      gridColumn: tile.wide ? "1 / -1" : undefined,
      borderTop: "2px solid var(--color-text)",
      paddingTop: "var(--space-2)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
      minWidth: 0,
    }}
  >
    <div style={labelStyle}>{tile.label}</div>
    <div
      style={{
        fontSize: tile.wide ? "2.25rem" : "1.75rem",
        fontWeight: 800,
        lineHeight: 1.1,
        fontVariantNumeric: "tabular-nums",
        overflowWrap: "anywhere",
        color: tile.alert ? "var(--color-accent)" : "var(--color-text)",
      }}
    >
      {tile.value}
    </div>
    <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", lineHeight: 1.4 }}>{tile.note}</div>
  </div>
);

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: "var(--space-4)",
};

export const Scorecard: React.FC<ScorecardProps> = ({ card, mode }) => {
  const has = card !== null;
  const total = card?.questions_total ?? null;
  const passed = card?.passed ?? null;
  const allPassed = has && typeof passed === "number" && typeof total === "number" && passed === total;
  const headline: Tile = {
    key: "passed",
    label: "Result",
    value:
      has && typeof passed === "number" && typeof total === "number"
        ? `${passed} of ${total} ${plural(total, "question", "questions")} passed`
        : EMPTY,
    note:
      has && typeof passed === "number" && typeof total === "number"
        ? "A question passes when every check that applies to it passes."
        : WAITING,
    wide: true,
  };

  return (
    <div data-testid="lab-scorecard" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <span
          aria-hidden="true"
          style={{
            flex: "none",
            width: 14,
            height: 14,
            marginTop: 10,
            background: has && !allPassed ? "var(--color-accent)" : "var(--color-text)",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <TileView tile={headline} />
        </div>
      </div>
      <div style={grid}>
        {mainTiles(card).map((tile) => (
          <TileView key={tile.key} tile={tile} />
        ))}
      </div>
      <details className="vg-fold" data-testid="lab-more-scores" style={{ borderTop: "2px solid var(--color-divider)" }}>
        <summary
          style={{
            fontWeight: 800,
            fontSize: "1.0625rem",
          }}
        >
          More scores
        </summary>
        <div style={{ ...grid, paddingTop: "var(--space-3)" }}>
          {moreTiles(card, mode).map((tile) => (
            <TileView key={tile.key} tile={tile} />
          ))}
        </div>
      </details>
    </div>
  );
};
