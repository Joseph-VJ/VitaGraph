import React, { useEffect, useRef, useState } from "react";
import { privacyApi, type LedgerRowFull, type LedgerScope } from "../../api/privacy";
import { countParts, formatNumber, formatWhen, hiddenLine, purposeLabel, shortHash, toCounts } from "../../lib/privacyFormat";
import { MaskedText } from "./MaskedText";

export interface LedgerDrawerProps {
  userId: string;
  scope: LedgerScope;
  /** One ledger id per message sent to the AI; several ids show as "Message 1", "Message 2" tabs. */
  rowIds: string[];
  onClose: () => void;
}

const kickerStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

const hashRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  fontSize: "0.9375rem",
  fontVariantNumeric: "tabular-nums",
  padding: "var(--space-1) 0",
  borderBottom: "1px solid var(--color-divider)",
};

export const LedgerDrawer: React.FC<LedgerDrawerProps> = ({ userId, scope, rowIds, onClose }) => {
  const [rows, setRows] = useState<(LedgerRowFull | null)[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const idsKey = rowIds.join("|");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(null);
    setTab(0);
    Promise.all(rowIds.map((id) => privacyApi.ledgerRow(userId, id, scope).catch(() => null)))
      .then((loaded) => {
        if (!alive) return;
        setRows(loaded);
        // Open on the message that hid the most, so the first thing shown is the shield at work.
        let best = 0;
        loaded.forEach((row, index) => {
          if ((row?.removed_total ?? 0) > (loaded[best]?.removed_total ?? 0)) best = index;
        });
        setTab(best);
        if (loaded.every((row) => row === null)) setFailed("What was sent could not be loaded.");
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setFailed("What was sent could not be loaded.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, scope, idsKey]);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const row = rows[tab] ?? null;
  const counts = row ? toCounts(row.removed_by_type) : {};
  const parts = countParts(counts);

  return (
    <>
      <div
        data-testid="ledger-backdrop"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 80, background: "color-mix(in srgb, var(--color-text) 30%, transparent)" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="What the AI service received"
        tabIndex={-1}
        data-testid="ledger-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 81,
          width: "min(560px, 100vw)",
          background: "var(--color-bg)",
          borderLeft: "2px solid var(--color-divider)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "var(--space-4) var(--space-4) var(--space-3)", display: "flex", justifyContent: "space-between", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={kickerStyle}>What the AI service received</div>
            <h2 style={{ margin: "var(--space-1) 0 0", fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.01em" }}>
              {row ? purposeLabel(row.purpose) : "Record"}
            </h2>
            {row ? (
              <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                {formatWhen(row.created_at)} · {formatNumber(row.chars_sent)} characters · {hiddenLine(row.removed_total)}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Close"
            data-testid="ledger-close"
            style={{ minHeight: 40, fontSize: "0.9375rem" }}
          >
            Close
          </button>
        </div>

        {rowIds.length > 1 ? (
          <div style={{ padding: "0 var(--space-4) var(--space-3)" }}>
            <div className="seg" role="group" aria-label="Message sent to the AI">
              {rowIds.map((id, index) => (
                <label key={id} className="seg-opt" style={{ position: "relative", minHeight: 40, fontSize: "0.9375rem" }}>
                  <input type="radio" name="ledger-call" checked={tab === index} onChange={() => setTab(index)} />
                  Message {index + 1}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ padding: "0 var(--space-4) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {loading ? (
            <div role="status" style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)" }}>
              Loading what was sent
            </div>
          ) : failed || !row ? (
            <div role="alert" style={{ fontSize: "0.9375rem", color: "var(--color-accent-800)", background: "var(--color-accent-100)", padding: "var(--space-3)" }}>
              {failed ?? "That message has no record."}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {parts.length > 0 ? (
                  parts.map((part) => (
                    <span key={part} className="tag tag-neutral">
                      {part}
                    </span>
                  ))
                ) : (
                  <span className="tag tag-neutral">Nothing personal found</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--color-neutral-700)" }}>
                This is exactly what the AI service received. A tag like [PERSON_1] stands for a detail that was hidden.
              </p>
              <div
                data-testid="ledger-transcript"
                style={{
                  border: "1px solid var(--color-divider)",
                  padding: "var(--space-4)",
                  maxHeight: "calc(100vh - 260px)",
                  overflow: "auto",
                  background: "var(--color-bg)",
                }}
              >
                <MaskedText mode="masked" text={row.sent_text} />
              </div>
              <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)" }}>
                This record keeps only the hidden version. Your real names, IDs and phone numbers are not saved in it.
              </div>
              <details className="vg-fold" data-testid="ledger-technical">
                <summary style={{ padding: "var(--space-2) 0", fontSize: "0.9375rem", fontWeight: 800 }}>
                  Technical details
                </summary>
                <div style={{ paddingTop: "var(--space-2)" }}>
                  <div style={hashRow}>
                    <span style={{ fontWeight: 800 }}>Record fingerprint</span>
                    <span title={row.row_hash} data-testid="ledger-hash">{shortHash(row.row_hash, 16)}</span>
                  </div>
                  <div style={hashRow}>
                    <span style={{ fontWeight: 800 }}>Fingerprint of the record before it</span>
                    <span title={row.prev_hash}>{shortHash(row.prev_hash, 16)}</span>
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </>
  );
};
