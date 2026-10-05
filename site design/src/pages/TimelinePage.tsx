import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportsApi, type MeasurementRow, type TrendData } from "../api/reports";
import { graphApi } from "../api/graph";
import { useActiveUser } from "../context/UserContext";
import { transitionNavigate } from "../motion/navigation";
import { parseReportDate, reportStatus, sortReports } from "../lib/reportLabels";
import { PageFrame, PageState, PersonaState, Tag } from "../components/ui";
import type { Report } from "../types";

const MAX_TESTS = 6;
const MAX_POINTS = 5;

const kickerStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtValue(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

interface IsoBarInput {
  t: number;
  v: number;
  val: string;
  date: string;
  hot: boolean;
}

interface IsoOptions {
  max: number;
  lo: number | null;
  hi: number | null;
  loText: string;
  hiText: string;
}

interface IsoLabel {
  text: string;
  style: React.CSSProperties;
}

interface IsoBarPoly {
  top: string;
  front: string;
  right: string;
  tfFill: string;
  ffFill: string;
  rfFill: string;
}

interface IsoChart {
  floor: string;
  back: string;
  left: string;
  bandBack?: string;
  bandLeft?: string;
  grid: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  bars: IsoBarPoly[];
  labels: IsoLabel[];
}

const lab = (
  x: number,
  y: number,
  text: string,
  size: number,
  color: string,
  tx: string,
  ls?: number
): IsoLabel => ({
  text,
  style: {
    position: "absolute",
    left: `${((x / 400) * 100).toFixed(2)}%`,
    top: `${((y / 320) * 100).toFixed(2)}%`,
    transform: `translate(${tx}, -50%)`,
    fontSize: `${size}px`,
    fontWeight: 800,
    lineHeight: 1,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    color,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: ls ? `${ls}em` : undefined,
  },
});

function iso(bars: IsoBarInput[], o: IsoOptions): IsoChart {
  const c = 0.866,
    LX = 260,
    LY = 70,
    LZ = 120,
    ox = 100,
    oy = 135;
  const P = (x: number, y: number, z: number): [number, number] => [
    ox + (x - y) * c,
    oy + (x + y) * 0.5 - z,
  ];
  const pt = (a: [number, number][]): string =>
    a.map((q) => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ");
  const f = (v: number): number => Math.min(1, v / o.max) * LZ;

  const out: IsoChart = {
    floor: pt([P(0, 0, 0), P(LX, 0, 0), P(LX, LY, 0), P(0, LY, 0)]),
    back: pt([P(0, 0, 0), P(LX, 0, 0), P(LX, 0, LZ), P(0, 0, LZ)]),
    left: pt([P(0, 0, 0), P(0, LY, 0), P(0, LY, LZ), P(0, 0, LZ)]),
    grid: [],
    bars: [],
    labels: [],
  };

  const hasBand = o.lo !== null && o.hi !== null;
  if (hasBand) {
    const zl = f(o.lo!);
    const zh = f(o.hi!);
    out.bandBack = pt([P(0, 0, zl), P(LX, 0, zl), P(LX, 0, zh), P(0, 0, zh)]);
    out.bandLeft = pt([P(0, 0, zl), P(0, LY, zl), P(0, LY, zh), P(0, 0, zh)]);

    const l1 = P(0, LY, zl);
    const l2 = P(0, LY, zh);
    out.labels.push(
      lab(l1[0] - 6, l1[1], o.loText, 11, "var(--color-accent-700)", "-100%"),
      lab(l2[0] - 6, l2[1], o.hiText, 11, "var(--color-accent-700)", "-100%")
    );
  }

  for (let i = 1; i < 8; i++) {
    const x = (LX * i) / 8;
    const a = P(x, 0, 0);
    const b = P(x, LY, 0);
    out.grid.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
  }

  const bw = 34,
    bd = 34,
    y0 = (LY - bd) / 2,
    y1 = y0 + bd;
  out.bars = bars.map((b) => {
    const x0 = 20 + b.t * (LX - 40 - bw);
    const x1 = x0 + bw;
    const hh = Math.max(2, f(b.v));
    const tp = P(x0 + bw / 2, y0 + bd / 2, hh);
    const bp = P(x0 + bw / 2, y1, 0);
    const ft = b.hot ? "var(--color-accent-400)" : "var(--color-neutral-400)";
    const ff = b.hot ? "var(--color-accent)" : "var(--color-neutral-700)";
    const rf = b.hot ? "var(--color-accent-700)" : "var(--color-neutral-900)";
    out.labels.push(
      lab(tp[0], tp[1] - 14, b.val, 17, "var(--color-text)", "-50%"),
      lab(bp[0] - 10, bp[1] + 24, b.date, 11, "var(--color-neutral-800)", "-50%", 0.04)
    );
    return {
      top: pt([P(x0, y0, hh), P(x1, y0, hh), P(x1, y1, hh), P(x0, y1, hh)]),
      front: pt([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, hh), P(x0, y1, hh)]),
      right: pt([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, hh), P(x1, y0, hh)]),
      tfFill: ft,
      ffFill: ff,
      rfFill: rf,
    };
  });

  return out;
}

interface ChartPoint {
  reportId: string;
  date: Date;
  value: number;
}

function datedPoints(
  trend: TrendData,
  reportsById: Map<string, Report>
): { points: ChartPoint[]; undated: number } {
  let pts: ChartPoint[] = [];
  let undated = 0;
  for (const pt of trend.points || []) {
    if (pt.report_id && reportsById.has(pt.report_id)) {
      const rep = reportsById.get(pt.report_id)!;
      const date = parseReportDate(rep);
      if (date) {
        pts.push({ reportId: pt.report_id, date, value: pt.value });
      } else {
        undated++;
      }
    } else {
      undated++;
    }
  }
  pts.sort((a, b) => a.date.getTime() - b.date.getTime());
  if (pts.length > MAX_POINTS) {
    pts = pts.slice(pts.length - MAX_POINTS);
  }
  return { points: pts, undated };
}

function spread(dates: Date[]): number[] {
  const n = dates.length;
  if (n <= 1) return [0];
  const t0 = dates[0].getTime();
  const tEnd = dates[n - 1].getTime();
  const totalSpan = tEnd - t0;

  const p: number[] = [];
  for (let i = 0; i < n; i++) {
    p.push(totalSpan > 0 ? (dates[i].getTime() - t0) / totalSpan : i / (n - 1));
  }

  for (let i = 1; i < n; i++) {
    if (p[i] < p[i - 1] + 0.22) {
      p[i] = p[i - 1] + 0.22;
    }
  }

  const maxP = p[n - 1];
  if (maxP > 1) {
    for (let i = 0; i < n; i++) {
      p[i] = p[i] / maxP;
    }
  }
  return p;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value)) - 1;
  const unit = Math.pow(10, exp);
  const res = Math.ceil(value / unit) * unit;
  return Number(res.toPrecision(4));
}

interface ChartModel {
  name: string;
  delta: string;
  caption: string;
  ariaLabel: string;
  iso: IsoChart;
}

function buildChart(
  test: string,
  unit: string,
  points: ChartPoint[],
  latestRow: MeasurementRow,
  undated: number
): ChartModel {
  const values = points.map((p) => p.value);
  let max = 1.25 * Math.max(...values);
  if (latestRow.range_low !== null && latestRow.range_low !== undefined) {
    if (1.1 * latestRow.range_low > max) {
      max = 1.1 * latestRow.range_low;
    }
  }
  max = niceMax(max);

  const lo = latestRow.range_low ?? null;
  const rawHi = latestRow.range_high ?? null;
  const hi = rawHi !== null ? Math.min(rawHi, max) : null;
  const loText = lo !== null ? fmtValue(lo) : "";
  const hiText = rawHi !== null ? fmtValue(rawHi) : "";

  const tValues = spread(points.map((p) => p.date));
  const bars: IsoBarInput[] = points.map((p, i) => ({
    t: tValues[i],
    v: p.value,
    val: fmtValue(p.value),
    date: shortDate(p.date),
    hot: i === points.length - 1,
  }));

  const isoData = iso(bars, { max, lo, hi, loText, hiText });

  const firstVal = fmtValue(points[0].value);
  const lastVal = fmtValue(points[points.length - 1].value);
  const delta = `${firstVal} → ${lastVal}`;

  const sentences: string[] = [];
  let refStr = latestRow.reference_range?.trim();
  if (!refStr && lo !== null && rawHi !== null) {
    refStr = `${fmtValue(lo)}–${fmtValue(rawHi)}`;
  }
  if (refStr) {
    sentences.push(`Reference ${refStr}, as printed in the latest report.`);
  } else {
    sentences.push("No reference range printed in the latest report.");
  }

  const firstDate = shortDate(points[0].date);
  const lastDate = shortDate(points[points.length - 1].date);
  const numReports = points.length;
  sentences.push(`${numReports} reports, ${firstDate} to ${lastDate}.`);

  if (rawHi !== null && rawHi > max) {
    sentences.push(`Axis cut at ${max}.`);
  }

  if (undated > 0) {
    sentences.push(`${undated} undated value${undated === 1 ? "" : "s"} not shown.`);
  }

  const caption = sentences.join(" ");
  const name = unit ? `${test} · ${unit}` : test;
  const ariaLabel = `${test} over time: ${bars.map((b) => `${b.date}: ${b.val}${unit ? " " + unit : ""}`).join(", ")}`;

  return {
    name,
    delta,
    caption,
    ariaLabel,
    iso: isoData,
  };
}

export const TimelinePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const userId = user?.id ?? null;

  const [reports, setReports] = useState<Report[] | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [charts, setCharts] = useState<ChartModel[]>([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState<string | null>(null);
  const [chartTick, setChartTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setReports(null);
      return;
    }
    let cancelled = false;
    setReports(null);
    setReportsError(null);
    reportsApi
      .list(userId)
      .then((list) => {
        if (cancelled) return;
        setReports(sortReports(list));
      })
      .catch((err) => {
        if (cancelled) return;
        setReportsError(err instanceof Error ? err.message : "Could not load reports.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  useEffect(() => {
    if (!userId || !reports || reports.length === 0) {
      setCharts([]);
      setChartsLoading(false);
      setChartsError(null);
      return;
    }

    let cancelled = false;
    setChartsLoading(true);
    setChartsError(null);

    const loadCharts = async () => {
      try {
        const graph = await graphApi.getGraph(userId);
        if (cancelled) return;

        const testNodes = (graph.nodes || [])
          .filter((n) => n.type === "test")
          .sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0));

        const testNames: string[] = [];
        for (const n of testNodes) {
          const name = n.test_name?.trim() || n.label?.trim();
          if (name && !testNames.some((t) => t.toLowerCase() === name.toLowerCase())) {
            testNames.push(name);
            if (testNames.length >= MAX_TESTS) break;
          }
        }

        const reportsById = new Map(reports.map((r) => [r.id, r]));
        const measurementsCache = new Map<string, MeasurementRow[]>();
        const measurementsOf = async (reportId: string): Promise<MeasurementRow[]> => {
          if (measurementsCache.has(reportId)) return measurementsCache.get(reportId)!;
          try {
            const rows = await reportsApi.measurements(reportId);
            measurementsCache.set(reportId, rows || []);
            return rows || [];
          } catch {
            measurementsCache.set(reportId, []);
            return [];
          }
        };

        const out: ChartModel[] = [];
        for (const testName of testNames) {
          if (cancelled) return;
          try {
            const trend = await reportsApi.trends(userId, testName);
            if (!trend || trend.test_name.toLowerCase() !== testName.toLowerCase()) {
              continue;
            }
            const draft = datedPoints(trend, reportsById);
            const verified: { point: ChartPoint; row: MeasurementRow }[] = [];
            for (const point of draft.points) {
              const rows = await measurementsOf(point.reportId);
              const row = rows.find(
                (r) =>
                  r.test_name.toLowerCase() === trend.test_name.toLowerCase() &&
                  Math.abs(r.value - point.value) < 1e-9
              );
              if (row) verified.push({ point, row });
            }
            const onePerReport = new Set(verified.map((v) => v.point.reportId)).size === verified.length;
            if (verified.length < 2 || !onePerReport) continue;
            out.push(
              buildChart(
                trend.test_name,
                trend.unit,
                verified.map((v) => v.point),
                verified[verified.length - 1].row,
                draft.undated
              )
            );
          } catch {
            continue;
          }
        }

        if (!cancelled) {
          setCharts(out);
        }
      } catch (err) {
        if (!cancelled) {
          setChartsError(err instanceof Error ? err.message : "Could not read values over time.");
        }
      } finally {
        if (!cancelled) {
          setChartsLoading(false);
        }
      }
    };

    loadCharts();

    return () => {
      cancelled = true;
    };
  }, [userId, reports, chartTick]);

  if (!userId) {
    return (
      <PageFrame label="Timeline">
        <PersonaState loading={personaLoading} onRetry={refreshUsers} />
      </PageFrame>
    );
  }

  if (reports === null && !reportsError) {
    return (
      <PageFrame label="Timeline">
        <PageState kind="loading" title="Loading reports" />
      </PageFrame>
    );
  }

  if (reportsError || !reports) {
    return (
      <PageFrame label="Timeline">
        <PageState
          kind="error"
          title="Could not load reports"
          detail={reportsError || undefined}
          action={{ label: "Try again", onClick: () => setTick((t) => t + 1) }}
        />
      </PageFrame>
    );
  }

  if (reports.length === 0) {
    return (
      <PageFrame label="Timeline">
        <PageState
          kind="empty"
          title="No reports yet"
          detail="Upload reports to see their values over time."
          action={{
            label: "Upload a report",
            onClick: () => transitionNavigate(navigate, "/upload", { direction: "back" }),
          }}
        />
      </PageFrame>
    );
  }

  return (
    <div
      data-screen-label="Timeline"
      data-testid="timeline-page"
      style={{
        display: "flex",
        flexWrap: "wrap",
        minHeight: "100%",
      }}
    >
      {/* Left column: 380px list */}
      <div
        className="vg-pad"
        style={{
          flex: "0 1 380px",
          maxWidth: "100%",
          boxSizing: "border-box",
          borderRight: "2px solid var(--color-divider)",
          minWidth: 0,
          padding: "var(--space-8)",
        }}
      >
        <div style={kickerStyle}>Reports</div>
        {reports.map((r) => {
          const d = parseReportDate(r);
          const dateStr = d ? shortDate(d) : "Undated";
          const st = reportStatus(r);
          return (
            <div
              key={r.id}
              data-testid="timeline-report-row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "var(--space-3)",
                alignItems: "center",
                padding: "var(--space-4) 0",
                borderBottom: "1px solid var(--color-divider)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "1.375rem",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {dateStr}
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-neutral-700)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {r.original_filename}
                </div>
              </div>
              <Tag tone="neutral">{st.label}</Tag>
            </div>
          );
        })}
      </div>

      {/* Right column: charts */}
      <div
        style={{
          flex: "1 1 560px",
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
          alignContent: "start",
        }}
      >
        {chartsError ? (
          <div className="vg-pad" style={{ gridColumn: "1 / -1", padding: "var(--space-8)" }}>
            <PageState
              kind="error"
              title="Could not read values over time"
              detail={chartsError}
              action={{ label: "Try again", onClick: () => setChartTick((t) => t + 1) }}
            />
          </div>
        ) : chartsLoading ? (
          <div className="vg-pad" style={{ gridColumn: "1 / -1", padding: "var(--space-8)" }}>
            <PageState kind="loading" title="Reading values across your reports" />
          </div>
        ) : charts.length === 0 ? (
          <div className="vg-pad" style={{ gridColumn: "1 / -1", padding: "var(--space-8)" }}>
            <PageState
              kind="empty"
              title="No test appears in two dated reports yet"
              detail="A chart needs the same test, with a value its report confirms, in at least two reports that print a date."
            />
          </div>
        ) : (
          charts.map((c) => (
            <div
              key={c.name}
              data-testid="timeline-chart"
              style={{
                padding: "calc(var(--space-8) + var(--space-4)) var(--space-6) var(--space-6)",
                borderRight: "2px solid var(--color-divider)",
                borderBottom: "2px solid var(--color-divider)",
                boxSizing: "border-box",
              }}
            >
              <div style={kickerStyle}>{c.name}</div>
              <div
                style={{
                  margin: "var(--space-1) 0 var(--space-1)",
                  fontSize: "2rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.delta}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-neutral-700)" }}>{c.caption}</div>
              <div style={{ position: "relative", marginTop: "var(--space-3)" }}>
                <svg
                  viewBox="0 0 400 320"
                  role="img"
                  aria-label={c.ariaLabel}
                  style={{ width: "100%", height: "auto", display: "block" }}
                >
                  <polygon
                    points={c.iso.floor}
                    style={{
                      fill: "var(--color-neutral-200)",
                      stroke: "var(--color-divider)",
                      strokeWidth: 1.5,
                    }}
                  />
                  <polygon
                    points={c.iso.back}
                    style={{
                      fill: "var(--color-neutral-100)",
                      stroke: "var(--color-divider)",
                      strokeWidth: 1.5,
                    }}
                  />
                  <polygon
                    points={c.iso.left}
                    style={{
                      fill: "var(--color-neutral-200)",
                      stroke: "var(--color-divider)",
                      strokeWidth: 1.5,
                    }}
                  />
                  {c.iso.bandBack && (
                    <polygon points={c.iso.bandBack} style={{ fill: "var(--color-accent-200)" }} />
                  )}
                  {c.iso.bandLeft && (
                    <polygon points={c.iso.bandLeft} style={{ fill: "var(--color-accent-300)" }} />
                  )}
                  {c.iso.grid.map((gl, i) => (
                    <line
                      key={i}
                      x1={gl.x1}
                      y1={gl.y1}
                      x2={gl.x2}
                      y2={gl.y2}
                      style={{ stroke: "var(--color-divider)", strokeWidth: 0.8 }}
                    />
                  ))}
                  {c.iso.bars.map((b, i) => (
                    <g key={i}>
                      <polygon
                        points={b.front}
                        style={{ fill: b.ffFill, stroke: "var(--color-text)", strokeWidth: 1 }}
                      />
                      <polygon
                        points={b.right}
                        style={{ fill: b.rfFill, stroke: "var(--color-text)", strokeWidth: 1 }}
                      />
                      <polygon
                        points={b.top}
                        style={{ fill: b.tfFill, stroke: "var(--color-text)", strokeWidth: 1 }}
                      />
                    </g>
                  ))}
                </svg>
                {c.iso.labels.map((lb, i) => (
                  <span key={i} style={lb.style}>
                    {lb.text}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
