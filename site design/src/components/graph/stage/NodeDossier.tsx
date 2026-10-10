import React from "react";
import { NodeSummary } from "../NodeSummary";
import type { StageNode, StageReportInfo } from "./GraphStageEngine";
import type { SeriesTest } from "../../../api/graph";
import { parseReportDate } from "../../../lib/reportLabels";

interface NodeDossierProps {
  userId: string;
  node: StageNode;
  neighbors: Array<{ id: string; label: string }>;
  totalNeighborCount: number;
  onSelectNode: (id: string) => void;
  onClose: () => void;
  seriesTest?: SeriesTest | null;
  reports: StageReportInfo[];
  siblingBios?: StageNode[];
  summaryCounts?: {
    reports: number;
    bios: number;
    meas: number;
  };
}

const KINDS_LABELS: Record<string, string> = {
  person: "SUBJECT",
  report: "REPORT",
  section: "SECTION",
  bio: "BIOMARKER",
  meas: "MEASUREMENT",
  unc: "UNCERTAINTY",
};

function fmt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–";
  return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function flagWords(f: string): string {
  const uf = f.toUpperCase();
  if (uf === "HIGH") return "▲ Above the printed range";
  if (uf === "LOW") return "▼ Below the printed range";
  if (uf === "CRITICAL") return "▲ Critical value";
  if (uf === "ABNORMAL") return "● Marked abnormal";
  return "● Inside the printed range";
}

export const NodeDossier: React.FC<NodeDossierProps> = ({
  userId,
  node,
  neighbors,
  totalNeighborCount,
  onSelectNode,
  onClose,
  seriesTest,
  reports,
  siblingBios = [],
  summaryCounts,
}) => {
  const kindWord = KINDS_LABELS[node.k] || node.k.toUpperCase();

  // Biomarker sparkline math
  // Analyze dated vs undated readings for biomarker (A4)
  const biomarkerData = React.useMemo(() => {
    if (node.k !== "bio") return null;

    const points = seriesTest?.points || [];
    const datedPoints = points.filter((p) => p.date !== null && p.date.trim() !== "");
    const undatedPoints = points.filter((p) => p.date === null || p.date.trim() === "");

    if (datedPoints.length > 0) {
      const newestDated = datedPoints[datedPoints.length - 1];
      const oldestDated = datedPoints[0];
      const hasDelta = datedPoints.length > 1;
      const deltaVal = hasDelta ? newestDated.value - oldestDated.value : null;

      const newestRep = reports.find((r) => r.id === newestDated.report_id || r.order === newestDated.order);
      const oldestRep = reports.find((r) => r.id === oldestDated.report_id || r.order === oldestDated.order);

      const newestDateStr = newestRep?.date || newestRep?.label || newestDated.date || "";
      const oldestDateStr = oldestRep?.date || oldestRep?.label || oldestDated.date || "first report";

      return {
        hasDated: true,
        headlineValue: newestDated.value,
        headlineUnit: node.unit,
        headlineDateStr: newestDateStr,
        flag: newestDated.flag,
        deltaVal,
        changeText: hasDelta
          ? `${deltaVal! >= 0 ? "+" : ""}${fmt(deltaVal)} ${node.unit} since ${oldestDateStr}`
          : "Only one dated measurement so far.",
        undatedList: undatedPoints.map((u) => {
          const uRep = reports.find((r) => r.id === u.report_id || r.order === u.order);
          return {
            value: u.value,
            unit: node.unit,
            filename: uRep?.filename || "undated report",
          };
        }),
      };
    } else if (undatedPoints.length > 0) {
      const firstUndated = undatedPoints[0];
      return {
        hasDated: false,
        headlineValue: firstUndated.value,
        headlineUnit: `${node.unit} · Undated`,
        headlineDateStr: "",
        flag: firstUndated.flag,
        deltaVal: null,
        changeText: "Undated reading; no baseline to compare.",
        undatedList: [],
      };
    } else {
      return {
        hasDated: false,
        headlineValue: node.latest ?? node.val,
        headlineUnit: node.unit,
        headlineDateStr: "",
        flag: node.flag,
        deltaVal: node.delta,
        changeText:
          node.delta !== null
            ? `${node.delta >= 0 ? "+" : ""}${fmt(node.delta)} ${node.unit}`
            : "No baseline to compare.",
        undatedList: [],
      };
    }
  }, [node, seriesTest, reports]);

  // Biomarker sparkline math (A2)
  const renderSparkline = () => {
    const points = seriesTest?.points || [];
    if (points.length === 0 && (!node.vals || node.vals.length === 0)) {
      return (
        <p className="muted" style={{ fontSize: "0.8125rem", margin: "8px 0" }}>
          Trend not available.
        </p>
      );
    }

    const validPoints = points.length > 0 ? points : [];
    const vals: (number | null)[] =
      validPoints.length > 0
        ? validPoints.map((p) => p.value)
        : node.vals && node.vals.length > 0
        ? node.vals
        : [node.latest ?? 0];

    const nums = vals.filter((v): v is number => v !== null && !Number.isNaN(v));
    if (nums.length === 0) {
      return (
        <p className="muted" style={{ fontSize: "0.8125rem", margin: "8px 0" }}>
          Trend not available.
        </p>
      );
    }

    const dLo = Math.min(...nums);
    const dHi = Math.max(...nums);
    const span = Math.max(dHi - dLo, Math.abs(dHi) * 0.08, 1e-6);

    const r = node.range || [null, null];
    let lo = dLo;
    let hi = dHi;

    if (r[0] !== null) lo = Math.min(lo, Math.max(r[0], dLo - span * 1.5));
    if (r[1] !== null) hi = Math.max(hi, Math.min(r[1], dHi + span * 1.5));

    if (r[0] !== null && r[0] >= lo && r[0] <= hi) {
      hi = Math.max(hi, Math.min(r[1] !== null ? r[1] : Infinity, r[0] + span * 0.5));
    }
    if (r[1] !== null && r[1] >= lo && r[1] <= hi) {
      lo = Math.min(lo, Math.max(r[0] !== null ? r[0] : -Infinity, r[1] - span * 0.5));
    }

    const pad = (hi - lo) * 0.14 || 1;
    lo -= pad;
    hi += pad;

    const W = 268;
    const H = 112;
    const padL = 20;
    const padR = 20;
    const top = 22;
    const bot = 24;

    const count = Math.max(1, vals.length);
    const X = (i: number) => padL + (count === 1 ? 0.5 : i / (count - 1)) * (W - padL - padR);
    const Y = (v: number) => top + (1 - (clamp(v, lo, hi) - lo) / (hi - lo)) * (H - top - bot);

    const yTop = Y(r[1] !== null ? r[1] : hi);
    const yBot = Y(r[0] !== null ? r[0] : lo);
    const pts = vals
      .map((v, i) => (v === null ? null : ([X(i), Y(v)] as [number, number])))
      .filter((p): p is [number, number] => p !== null);

    const hasRange = r[0] !== null || r[1] !== null;

    // Marker size shrinks with count (A2)
    const markerSize = count > 25 ? 3 : count > 14 ? 4.5 : count > 6 ? 6 : 8;
    const halfM = markerSize / 2;
    const strokeW = count > 25 ? 1 : count > 14 ? 1.5 : 2;

    // Determine value labels (A2: with > 6 points, only first, last, min, max)
    const valueLabelIndices = new Set<number>();
    if (count <= 6) {
      for (let i = 0; i < count; i++) {
        if (vals[i] !== null) valueLabelIndices.add(i);
      }
    } else {
      valueLabelIndices.add(0);
      valueLabelIndices.add(count - 1);
      let minIdx = -1;
      let maxIdx = -1;
      let minV = Infinity;
      let maxV = -Infinity;
      vals.forEach((v, idx) => {
        if (v !== null && !Number.isNaN(v)) {
          if (v < minV) {
            minV = v;
            minIdx = idx;
          }
          if (v > maxV) {
            maxV = v;
            maxIdx = idx;
          }
        }
      });
      if (minIdx >= 0) valueLabelIndices.add(minIdx);
      if (maxIdx >= 0) valueLabelIndices.add(maxIdx);
    }

    // For value labels: keep first, last, min, max (A2)
    // Only prune if both X and Y are colliding (within 22px horizontally AND 14px vertically)
    const sortedValueIndices = Array.from(valueLabelIndices).sort((a, b) => a - b);
    const keptValueIndices: number[] = [];
    sortedValueIndices.forEach((idx) => {
      const v = vals[idx];
      if (v === null) return;
      const px = X(idx);
      const py = Y(v);
      const collides = keptValueIndices.some((kIdx) => {
        const kv = vals[kIdx]!;
        const kx = X(kIdx);
        const ky = Y(kv);
        return Math.abs(px - kx) < 22 && Math.abs(py - ky) < 14;
      });
      if (!collides || idx === count - 1) {
        keptValueIndices.push(idx);
      }
    });

    // Date labels: at most 4 shown, always first and last, thinned by width (A2)
    const dateIndices: number[] = [];
    if (count <= 4) {
      for (let i = 0; i < count; i++) dateIndices.push(i);
    } else {
      dateIndices.push(0);
      if (count >= 7) {
        const m1 = Math.round((count - 1) * 0.33);
        const m2 = Math.round((count - 1) * 0.67);
        if (X(m1) - X(0) >= 44 && X(m2) - X(m1) >= 44 && X(count - 1) - X(m2) >= 44) {
          dateIndices.push(m1, m2);
        } else {
          const mid = Math.round((count - 1) * 0.5);
          if (X(mid) - X(0) >= 44 && X(count - 1) - X(mid) >= 44) {
            dateIndices.push(mid);
          }
        }
      } else {
        const mid = Math.round((count - 1) * 0.5);
        if (X(mid) - X(0) >= 44 && X(count - 1) - X(mid) >= 44) {
          dateIndices.push(mid);
        }
      }
      dateIndices.push(count - 1);
    }

    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${node.name || node.label} over time, with the printed range shaded`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {hasRange && yBot - yTop > 0.5 && (
          <rect
            x={padL}
            y={yTop}
            width={W - padL - padR}
            height={yBot - yTop}
            fill="var(--color-surface)"
          />
        )}
        {[r[0], r[1]].map((b, idx) => {
          if (b === null || b < lo || b > hi) return null;
          return (
            <line
              key={idx}
              x1={padL}
              x2={W - padR}
              y1={Y(b)}
              y2={Y(b)}
              stroke="var(--color-neutral-500)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}
        {pts.length > 1 && (
          <polyline
            points={pts.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="var(--color-text)"
            strokeWidth="2"
          />
        )}
        {vals.map((v, i) => {
          if (v === null) return null;
          const pt = validPoints[i];
          const isHot = pt
            ? pt.flag && pt.flag !== "NORMAL" && pt.flag !== "in"
            : (node.flag && node.flag !== "in" && node.flag !== "NORMAL") || false;
          const isLast = i === vals.length - 1;
          const px = X(i);
          const py = Y(v);

          const showValueLabel = keptValueIndices.includes(i);
          const labelAnchor = i === 0 ? "start" : i === count - 1 ? "end" : "middle";
          const labelY = py - halfM - 4 < top ? py + halfM + 11 : py - halfM - 4;

          return (
            <g key={i}>
              <rect
                x={px - halfM}
                y={py - halfM}
                width={markerSize}
                height={markerSize}
                fill={isHot ? "var(--color-accent)" : isLast ? "var(--color-text)" : "var(--color-bg)"}
                stroke={isHot ? "var(--color-accent)" : "var(--color-text)"}
                strokeWidth={strokeW}
              />
              {showValueLabel && (
                <text
                  x={px}
                  y={labelY}
                  textAnchor={labelAnchor}
                  fontSize="10"
                  fontWeight="800"
                  fill="var(--color-text)"
                >
                  {fmt(v)}
                </text>
              )}
            </g>
          );
        })}
        {(() => {
          let lastDrawnLabel = "";
          return dateIndices.map((i) => {
            const pt = validPoints[i];
            const rawDate = pt?.date || reports[i]?.date || reports[i]?.label;
            let lbl = `R${i + 1}`;
            if (rawDate) {
              if (rawDate.toLowerCase().includes("undated")) {
                lbl = "UNDATED";
              } else {
                const d = parseReportDate({ report_date: rawDate });
                if (d) {
                  lbl = d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
                } else {
                  lbl = rawDate.slice(0, 7);
                }
              }
            }
            lbl = lbl.toUpperCase();
            if (lbl === lastDrawnLabel) {
              return null;
            }
            lastDrawnLabel = lbl;
            const anchor = i === 0 ? "start" : i === count - 1 ? "end" : "middle";
            const posX = i === 0 ? padL : i === count - 1 ? W - padR : X(i);

            return (
              <text
                key={i}
                x={posX}
                y={H - 5}
                textAnchor={anchor}
                fontSize="9"
                fontWeight="800"
                fill="var(--color-neutral-700)"
                letterSpacing="0.6"
              >
                {lbl}
              </text>
            );
          });
        })()}
      </svg>
    );
  };

  const isHotFlag =
    node.flag &&
    node.flag !== "in" &&
    node.flag !== "NORMAL" &&
    node.flag !== "normal";

  const renderUndatedSummary = () => {
    if (!biomarkerData || biomarkerData.undatedList.length === 0) return null;
    const list = biomarkerData.undatedList;
    if (list.length === 1) {
      const u = list[0];
      return (
        <p className="muted" style={{ fontSize: "0.8125rem", margin: "2px 0 6px" }}>
          Undated reading: {fmt(u.value)} {u.unit} ({u.filename})
        </p>
      );
    }

    const total = list.length;
    const valMap = new Map<string, { value: number; unit: string; count: number }>();
    list.forEach((u) => {
      const key = `${fmt(u.value)} ${u.unit}`;
      const curr = valMap.get(key) || { value: u.value, unit: u.unit, count: 0 };
      curr.count += 1;
      valMap.set(key, curr);
    });

    if (valMap.size === 1) {
      const single = valMap.values().next().value!;
      return (
        <p className="muted" style={{ fontSize: "0.8125rem", margin: "2px 0 6px" }}>
          {total} undated readings, all {fmt(single.value)} {single.unit}
        </p>
      );
    }

    const sorted = Array.from(valMap.entries()).sort((a, b) => b[1].count - a[1].count);
    const top3 = sorted.slice(0, 3);
    const parts = top3.map(([key, item]) => `${key} (x${item.count})`);
    const hasMore = sorted.length > 3;
    return (
      <p className="muted" style={{ fontSize: "0.8125rem", margin: "2px 0 6px" }}>
        {total} undated readings: {parts.join(", ")}{hasMore ? ", and more" : ""}
      </p>
    );
  };

  return (
    <aside className="dossier" role="dialog" aria-label="Details of the selected node" data-testid="graph-dossier">
      <div className="dk">
        <span className="label">{kindWord}</span>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <h3>
        {node.k === "report"
          ? node.name || node.label
          : node.k === "meas"
          ? node.name || node.label
          : node.label}
      </h3>

      {/* AI Summary Box: NodeSummary with autoScroll={false} */}
      <NodeSummary userId={userId} nodeId={node.id} autoScroll={false} />

      {/* Node specific content */}
      {node.k === "bio" && biomarkerData && (
        <>
          <div className="big">
            <span className="num">{fmt(biomarkerData.headlineValue)}</span>
            <span className="unit">
              {biomarkerData.headlineUnit}
              {biomarkerData.headlineDateStr ? ` · ${biomarkerData.headlineDateStr}` : ""}
            </span>
          </div>

          <p>{biomarkerData.changeText}</p>

          {renderUndatedSummary()}

          <span className={`flag${isHotFlag ? " hot" : ""}`}>
            {flagWords(biomarkerData.flag || node.flag)}
          </span>

          <div>{renderSparkline()}</div>

          {(node.range[0] !== null || node.range[1] !== null) && (
            <p className="muted">
              Shaded band: the printed range,{" "}
              {node.range[0] !== null && node.range[1] !== null
                ? `${node.range[0]}–${node.range[1]} ${node.unit}`
                : `${node.range[0] ?? node.range[1]} ${node.unit}`}
              .
            </p>
          )}
        </>
      )}

      {node.k === "meas" && (
        <>
          <div className="big">
            <span className="num">{fmt(node.val)}</span>
            <span className="unit">{node.unit}</span>
          </div>
          <span className={`flag${isHotFlag ? " hot" : ""}`}>
            {flagWords(node.flag)}
          </span>
          {reports[node.ri] && (
            <p className="muted">
              From the report of {reports[node.ri].date || reports[node.ri].label}.
            </p>
          )}
        </>
      )}

      {node.k === "section" && siblingBios.length > 0 && (
        <div className="rows">
          {siblingBios.map((b) => (
            <button key={b.id} type="button" onClick={() => onSelectNode(b.id)}>
              <span>{b.name || b.label}</span>
              <b>
                {fmt(b.latest)} {b.unit}
              </b>
              <span>
                {b.flag === "high" || b.flag === "HIGH"
                  ? "▲"
                  : b.flag === "low" || b.flag === "LOW"
                  ? "▼"
                  : "●"}
              </span>
            </button>
          ))}
        </div>
      )}

      {node.k === "report" && (
        <div className="big">
          <span className="num">{totalNeighborCount}</span>
          <span className="unit">connected nodes in this report</span>
        </div>
      )}

      {node.k === "person" && summaryCounts && (
        <div className="big">
          <span className="unit">
            {summaryCounts.reports} reports · {summaryCounts.bios} biomarkers · {summaryCounts.meas} values
          </span>
        </div>
      )}

      {/* Neighbor chips: at most 8 */}
      {neighbors.length > 0 && (
        <div className="chips">
          {neighbors.slice(0, 8).map((nb) => (
            <button
              key={nb.id}
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => onSelectNode(nb.id)}
            >
              {nb.label}
            </button>
          ))}
        </div>
      )}

      {/* Connection count line: keeps data-testid="graph-connections" */}
      <p className="muted" data-testid="graph-connections">
        Connected to {totalNeighborCount} node{totalNeighborCount === 1 ? "" : "s"}. Its lines are red; the fainter ones go one step further.
      </p>
    </aside>
  );
};
