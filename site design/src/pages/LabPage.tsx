import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { aiApi } from "../api/ai";
import { labApi, type LabGold, type LabMode, type LabRunSummary, type LabSavedRun } from "../api/lab";
import { QuestionTable, WhatWentWrong } from "../components/lab/QuestionTable";
import { Scorecard } from "../components/lab/Scorecard";
import { SweepChart, sweepPoints } from "../components/lab/SweepChart";
import { PageFrame, PageState, SectionHead } from "../components/ui";
import { progressOf, rowsFromSaved, SWEEP_SIZES, useLabRun, type LabState } from "../hooks/useLabRun";
import { historyLine, modeLabel, pct } from "../lib/labWords";
import { usePreferences } from "../lib/preferences";

const TOP_K_OPTIONS = [3, 5, 8];
const DEFAULT_CHUNK = 200;

const card: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  borderTop: "2px solid var(--color-text)",
  padding: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "0.9375rem",
  fontWeight: 800,
};

const helpText: React.CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  lineHeight: 1.45,
  color: "var(--color-neutral-700)",
  maxWidth: "70ch",
};

const summaryStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "1.0625rem",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "–";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function statusLine(state: LabState, filesTotal: number, questionsTotal: number): string {
  if (state.status === "idle") return "Ready. Press Start the test.";
  if (state.status === "failed") return state.error ?? "The test failed.";
  if (state.status === "stopped") return "Stopped. The temporary test data was removed.";
  if (state.status === "finished") return "Finished.";
  const files = Object.keys(state.files);
  const total = Math.max(filesTotal, state.filesTotal ?? 0);
  if (files.length < total) {
    if (files.length === 0) return "Getting the sample reports ready";
    const last = files[files.length - 1];
    return `Read ${last} (${files.length} of ${total}): ${state.files[last]} pieces`;
  }
  const rows = Object.values(state.rows);
  const finished = rows.filter((r) => r.status === "done").length;
  if (finished >= questionsTotal && questionsTotal > 0) return "Checking that no personal details got through";
  return `Checking question ${Math.min(finished + 1, questionsTotal)} of ${questionsTotal}`;
}

export const LabPage: React.FC = () => {
  const prefs = usePreferences();
  const lab = useLabRun();
  const { state } = lab;

  const [gold, setGold] = useState<LabGold | null>(null);
  const [goldError, setGoldError] = useState<string | null>(null);
  const [goldTick, setGoldTick] = useState(0);
  const [allowApi, setAllowApi] = useState<boolean | null>(null);

  const [mode, setMode] = useState<LabMode>("quick");
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK);
  const [topK, setTopK] = useState(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [experimentOpen, setExperimentOpen] = useState(false);

  const [viewing, setViewing] = useState<LabSavedRun | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setGoldError(null);
    labApi
      .gold()
      .then((g) => alive && setGold(g))
      .catch((e) => alive && setGoldError(e instanceof Error ? e.message : "The test questions could not be loaded."));
    aiApi
      .getConfig()
      .then((c) => alive && setAllowApi(c.allow_api))
      .catch(() => alive && setAllowApi(null));
    return () => {
      alive = false;
    };
  }, [goldTick]);

  const running = state.status === "running";

  // The elapsed clock only re-renders the page; it never drives the progress bar.
  useEffect(() => {
    if (!running) {
      if (state.status !== "idle") setEndedAt((prev) => prev ?? Date.now());
      return;
    }
    setEndedAt(null);
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running, state.status, state.runId]);

  const questions = gold?.questions ?? [];
  const questionsTotal = questions.length;
  const filesTotal = gold?.files.length ?? 0;
  const progress = progressOf(state, filesTotal, questionsTotal);
  const elapsedMs =
    state.startedAt === null
      ? null
      : state.status === "finished" && state.durationMs !== null
        ? state.durationMs
        : (running ? now : (endedAt ?? now)) - state.startedAt;

  const fullBlocked = mode === "full" && allowApi === false;
  const sweepRunning = lab.sweep.active;

  const rows = viewing ? rowsFromSaved(viewing.results) : state.rows;
  const score = viewing ? viewing.scorecard : state.scorecard;
  const scoreMode: LabMode | null = viewing ? viewing.mode : state.mode;

  const onRun = useCallback(() => {
    setViewing(null);
    setExpandedId(null);
    void lab.start(mode, chunkSize, topK);
  }, [lab, mode, chunkSize, topK]);

  const onSweep = useCallback(() => {
    setViewing(null);
    setExpandedId(null);
    setExperimentOpen(true);
    void lab.runSweep(topK);
  }, [lab, topK]);

  const openSaved = useCallback((run: LabRunSummary) => {
    setViewError(null);
    labApi
      .run(run.id)
      .then((saved) => {
        setViewing(saved);
        setExpandedId(null);
      })
      .catch((e) => setViewError(e instanceof Error ? e.message : "That result could not be loaded."));
  }, []);

  const points = useMemo(() => sweepPoints(lab.history, topK), [lab.history, topK]);

  if (goldError && !gold) {
    return (
      <PageFrame label="Accuracy Test" testId="lab-page">
        <PageState
          kind="error"
          title="The Accuracy Test could not load"
          detail={goldError}
          action={{ label: "Try again", onClick: () => setGoldTick((n) => n + 1) }}
        />
      </PageFrame>
    );
  }

  const barTransition = prefs.reduceMotion ? "none" : "width 200ms linear";
  const showResults = score !== null || (questions.length > 0 && Object.keys(rows).length > 0);

  return (
    <PageFrame label="Accuracy Test" testId="lab-page">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <p style={{ margin: 0, maxWidth: "70ch", fontSize: "1.125rem", lineHeight: 1.5 }}>
          VitaGraph asks itself {questionsTotal > 0 ? questionsTotal : "a set of"} questions it already knows the answers
          to, then shows how many it got right. It uses sample reports, never yours.
        </p>
        <p style={helpText}>Each test makes a temporary copy of the sample reports and deletes it at the end.</p>
      </div>

      {/* Start */}
      <section aria-label="Start the test" style={card} data-testid="lab-controls">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRun}
            disabled={running || fullBlocked || !gold}
            data-testid="lab-run"
            style={{ minHeight: 48, fontSize: "1.0625rem", paddingLeft: "var(--space-6)", paddingRight: "var(--space-6)" }}
          >
            Start the test
          </button>
          {running && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={lab.stop}
              data-testid="lab-stop"
              style={{ minHeight: 44 }}
            >
              Stop
            </button>
          )}
          <span style={helpText}>
            {mode === "full"
              ? "Takes about 3 minutes and uses the AI service. It also checks the written answers."
              : "Takes about 30 seconds. No AI is used. It checks that the search finds the right passages and that unsafe questions are refused."}
          </span>
        </div>

        <label
          style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", cursor: allowApi === false ? "not-allowed" : "pointer", minHeight: 40 }}
        >
          <input
            type="checkbox"
            role="switch"
            checked={mode === "full"}
            disabled={running || allowApi === false}
            onChange={(e) => setMode(e.target.checked ? "full" : "quick")}
            data-testid="lab-mode-full"
            style={{ width: 20, height: 20, marginTop: 2, flex: "none", accentColor: "var(--color-accent)" }}
          />
          <span style={{ fontSize: "0.9375rem", lineHeight: 1.45 }}>
            <strong style={{ fontWeight: 800 }}>Also test the AI's written answers (slower, about 3 minutes)</strong>
            {allowApi === false && (
              <>
                <br />
                <span style={{ color: "var(--color-neutral-700)" }}>
                  This needs the AI switched on in{" "}
                  <Link to="/settings" style={{ color: "var(--color-accent-700)", fontWeight: 800 }}>
                    Settings
                  </Link>
                  .
                </span>
              </>
            )}
          </span>
        </label>

        <details className="vg-fold" data-testid="lab-settings" style={{ borderTop: "1px solid var(--color-divider)" }}>
          <summary style={summaryStyle}>Change test settings (optional)</summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", paddingTop: "var(--space-3)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxWidth: 360 }}>
              <label htmlFor="lab-chunk" style={fieldLabel}>
                Piece size
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <input
                  id="lab-chunk"
                  type="range"
                  min={120}
                  max={600}
                  step={10}
                  value={chunkSize}
                  disabled={running}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  style={{ width: 220, maxWidth: "100%", accentColor: "var(--color-accent)" }}
                  data-testid="lab-chunk"
                />
                <span style={{ minWidth: "8rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {chunkSize} characters
                </span>
              </div>
              <p style={helpText}>How long each piece of a report is when it is cut up for searching.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxWidth: 360 }}>
              <label htmlFor="lab-topk" style={fieldLabel}>
                Passages looked at per question
              </label>
              <select
                id="lab-topk"
                className="input"
                value={topK}
                disabled={running}
                onChange={(e) => setTopK(Number(e.target.value))}
                data-testid="lab-topk"
                style={{ minHeight: 40, width: "6rem" }}
              >
                {TOP_K_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <p style={helpText}>How many pieces of reports the search brings back for each question.</p>
            </div>
          </div>
        </details>
      </section>

      {/* Live strip */}
      <section
        aria-label="Test progress"
        aria-live="polite"
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
        data-testid="lab-live"
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap", fontSize: "1rem" }}>
          <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }} data-testid="lab-status">
            {statusLine(state, filesTotal, questionsTotal)}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-700)" }} data-testid="lab-elapsed">
            {elapsedMs === null ? "" : `${(elapsedMs / 1000).toFixed(1)} s`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Test progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          style={{ height: 6, background: "var(--color-neutral-200)" }}
          data-testid="lab-progress"
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round(progress * 1000) / 10}%`,
              background: "var(--color-accent)",
              transition: barTransition,
            }}
          />
        </div>
        {state.status === "failed" && state.error && (
          <p role="alert" style={{ margin: 0, color: "var(--color-accent-800)", fontWeight: 600 }}>
            {state.error}
          </p>
        )}
      </section>

      {viewing && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface)",
            borderLeft: "5px solid var(--color-accent)",
          }}
          data-testid="lab-viewing"
        >
          <span style={{ fontSize: "0.9375rem" }}>
            You are looking at a saved result from {formatWhen(viewing.created_at)} · {modeLabel(viewing.mode)} · piece
            size {viewing.chunk_size} · {viewing.top_k} passages per question. Read only.
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setViewing(null)}
            data-testid="lab-back-live"
            style={{ minHeight: 40 }}
          >
            Back to live
          </button>
        </div>
      )}
      {viewError && (
        <p role="alert" style={{ margin: 0, color: "var(--color-accent-800)", fontWeight: 600 }}>
          {viewError}
        </p>
      )}

      {/* Result */}
      {showResults && (
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }} aria-label="Result">
          <SectionHead title="Result" accent />
          <Scorecard card={score} mode={scoreMode} />
          <WhatWentWrong questions={questions} rows={rows} leaks={score?.identifier_leaks ?? null} />
        </section>
      )}

      {/* Questions */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minWidth: 0 }}>
        <SectionHead
          title="Test questions"
          aside={gold ? `${questionsTotal} questions · ${gold.files.length} sample ${gold.files.length === 1 ? "report" : "reports"}` : undefined}
        />
        {gold ? (
          <QuestionTable
            questions={questions}
            rows={rows}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          />
        ) : (
          <PageState kind="loading" title="Loading the test questions" />
        )}
      </section>

      {/* Piece-size experiment */}
      <details
        className="vg-fold"
        data-testid="lab-experiment"
        open={experimentOpen}
        onToggle={(e) => setExperimentOpen((e.currentTarget as HTMLDetailsElement).open)}
        style={{ borderTop: "2px solid var(--color-text)" }}
      >
        <summary style={summaryStyle}>Which piece size works best?</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-3)" }}>
          <p style={helpText}>
            Before searching, every report is cut into small pieces. This runs the same questions again for 5 different
            piece sizes. The black bars show how often the right passage was found. The red line shows how near the top
            it came.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSweep}
              disabled={running || mode !== "quick" || !gold}
              title={mode !== "quick" ? "Switch off the AI option above to compare piece sizes." : undefined}
              data-testid="lab-sweep"
              style={{ minHeight: 44 }}
            >
              Compare {SWEEP_SIZES.length} piece sizes (about 3 minutes)
            </button>
            {mode !== "quick" && <span style={helpText}>Switch off the AI option above to compare piece sizes.</span>}
            {sweepRunning && (
              <span style={helpText} data-testid="lab-sweep-status">
                Comparing piece sizes: test {lab.sweep.index + 1} of {lab.sweep.total || SWEEP_SIZES.length}, piece size{" "}
                {lab.sweep.size}
              </span>
            )}
          </div>
          <SweepChart points={points} />

          <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Past results</h3>
          {lab.historyError ? (
            <p role="alert" style={{ margin: 0, color: "var(--color-accent-800)" }}>
              {lab.historyError}
            </p>
          ) : lab.history.length === 0 ? (
            <p style={helpText}>No saved results yet. Press Start the test.</p>
          ) : (
            <ul
              data-testid="lab-history"
              style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--color-divider)" }}
            >
              {lab.history.map((run) => {
                const sc = run.scorecard;
                const selected = viewing?.id === run.id;
                return (
                  <li
                    key={run.id}
                    data-testid="lab-history-row"
                    style={{
                      borderBottom: "1px solid var(--color-divider)",
                      boxShadow: selected ? "inset 5px 0 0 var(--color-accent)" : undefined,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openSaved(run)}
                      aria-label={`Open the result from ${formatWhen(run.created_at)}`}
                      style={{
                        background: "none",
                        border: 0,
                        font: "inherit",
                        color: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%",
                        minHeight: 48,
                        padding: "var(--space-2) var(--space-3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {formatWhen(run.created_at)} · {historyLine(run)}
                      </span>
                      <span style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", fontVariantNumeric: "tabular-nums" }}>
                        {typeof sc?.retrieval_hit_rate === "number"
                          ? `Found the right passage for ${pct(sc.retrieval_hit_rate)} of questions · `
                          : ""}
                        took {formatDuration(run.duration_ms)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </PageFrame>
  );
};
