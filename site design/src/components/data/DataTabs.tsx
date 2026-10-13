import React, { useRef } from "react";
import { kickerStyle, mutedStyle } from "./helpers";

export type DataTabId = "reports" | "chats" | "ai-reports" | "activity";

export interface DataTab {
  id: DataTabId;
  label: string;
  count: number;
  note: string;
}

export interface DataTabsProps {
  tabs: DataTab[];
  active: DataTabId;
  onChange: (id: DataTabId) => void;
  /** Extra tile after the tabs (a link, not a tab). */
  extra?: React.ReactNode;
}

export const tabButtonId = (id: DataTabId) => `data-tab-${id}`;
export const tabPanelId = (id: DataTabId) => `data-panel-${id}`;

/** Big number tiles that work as tabs: arrow keys, Home and End move between them. */
export const DataTabs: React.FC<DataTabsProps> = ({ tabs, active, onChange, extra }) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--space-4)" }}>
      <div role="tablist" aria-label="What to look at" style={{ display: "contents" }}>
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={tabButtonId(tab.id)}
              data-testid={`data-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={tabPanelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              style={{
                appearance: "none",
                font: "inherit",
                color: "var(--color-text)",
                textAlign: "left",
                cursor: "pointer",
                minHeight: 96,
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
                padding: "var(--space-3) var(--space-4)",
                border: 0,
                borderTop: "2px solid var(--color-text)",
                background: selected ? "var(--color-surface)" : "transparent",
                boxShadow: selected ? "inset 0 -4px 0 var(--color-accent)" : "none",
              }}
            >
              <span style={kickerStyle}>{tab.label}</span>
              <span style={{ fontSize: "1.75rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {tab.count.toLocaleString("en-US")}
              </span>
              <span style={{ ...mutedStyle, fontSize: "0.8125rem" }}>{tab.note}</span>
            </button>
          );
        })}
      </div>
      {extra}
    </div>
  );
};
