import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useActiveUser } from "../../context/UserContext";
import { supportsViewTransitions, governor } from "../../motion";
import { transitionNavigate } from "../../motion/navigation";
import { BASE_URL } from "../../api/client";

interface HeaderProps {
  onSearch?: (query: string) => void;
  className?: string;
  backendOnline?: boolean;
}

const SEARCH_PLACEHOLDER = "Ask a question about your reports";

export const Header: React.FC<HeaderProps> = ({ onSearch, className = "", backendOnline = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // Ctrl/Cmd+K focuses the search box, as its hint promises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The box asks a question: Enter hands the text to the AI Agent.
  const submitSearch = () => {
    const text = query.trim();
    if (!text) return;
    setQuery("");
    transitionNavigate(navigate, `/agent?q=${encodeURIComponent(text)}`, { direction: "forward" });
  };
  const { user, users, setUser } = useActiveUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [allowApi, setAllowApi] = useState<boolean | null>(() => {
    if (typeof sessionStorage !== "undefined") {
      const cached = sessionStorage.getItem("vg_allow_api");
      if (cached !== null) return cached === "true";
    }
    return null;
  });

  // Check if in replay mode (§US-12: replay badge if replay mode)
  const isReplay =
    location.search.includes("replay=true") ||
    localStorage.getItem("vitagraph_replay") === "true";

  // Check allow_api status from backend (§US-12)
  useEffect(() => {
    let isMounted = true;
    if (!backendOnline) {
      setAllowApi(false);
      return;
    }
    fetch(`${BASE_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && typeof data.allow_api === "boolean") {
          setAllowApi(data.allow_api);
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem("vg_allow_api", String(data.allow_api));
          }
        }
      })
      .catch(() => {
        if (isMounted) setAllowApi(false);
      });
    return () => {
      isMounted = false;
    };
  }, [backendOnline]);

  // Settings announces a privacy change so the "AI explanations" tag updates at once
  useEffect(() => {
    const onConfig = (event: Event) => {
      const detail = (event as CustomEvent<{ allow_api?: boolean }>).detail;
      if (typeof detail?.allow_api === "boolean") setAllowApi(detail.allow_api);
    };
    window.addEventListener("vitagraph:ai-config", onConfig);
    return () => window.removeEventListener("vitagraph:ai-config", onConfig);
  }, []);

  const getHeaderConfig = (): { title: string; sub: string } => {
    switch (path) {
      case "/upload": return { title: "Upload & Ingest", sub: "Add a report and watch it become searchable." };
      case "/library": return { title: "Library", sub: "Your reports and the values extracted from them." };
      case "/agent": return { title: "AI Agent", sub: "Ask in plain words. The agent searches your reports and shows its work." };
      case "/graph": return { title: "Knowledge Graph", sub: "How reports, sections and values connect." };
      case "/timeline": return { title: "Timeline", sub: "Reports and key values over time." };
      case "/compare": return { title: "Compare", sub: "Change between two reports." };
      case "/insights": return { title: "Insights", sub: "Structure and key nodes of the graph." };
      case "/settings": return { title: "Settings", sub: "Ingestion, reading, privacy and display." };
      case "/text-to-graph": return { title: "Text to Graph", sub: "Turn plain text into linked entities." };
      default: return { title: "VitaGraph", sub: "Your reports, evidence and insights in one place." };
    }
  };

  const config = getHeaderConfig();

  return (
    <header
      className={`vg-header flex-shrink-0 select-none ${className}`}
      style={{
        minHeight: 76, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
        gap: "var(--space-3) var(--space-6)",
        borderBottom: "2px solid var(--color-divider)", boxSizing: "border-box", background: "var(--color-bg)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: 0, fontSize: "1.5rem", letterSpacing: "-0.02em", fontWeight: 800, lineHeight: 1.12, color: "var(--color-text)",
            viewTransitionName: supportsViewTransitions() && governor.getState().tier !== "T0" ? "header-title" : "none",
          }}
        >
          {config.title}
        </h1>
        <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>{config.sub}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", minWidth: 0, maxWidth: "100%" }}>
        {isReplay && (
          <span className="tag tag-outline" data-testid="replay-mode-badge">Replay mode</span>
        )}
        <form
          data-boot-target="header-search"
          style={{ margin: 0, flex: "1 1 200px", minWidth: 0, maxWidth: 300 }}
          onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
        >
          <input
            ref={searchRef}
            className="input"
            value={query}
            aria-label="Ask a question about your reports"
            placeholder={SEARCH_PLACEHOLDER}
            onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            style={{ width: "100%" }}
          />
        </form>
        {allowApi === false && (
          <span className="tag tag-outline" data-testid="allow-api-chip" title="Answers quote your reports only; the AI service is not called">
            AI explanations off
          </span>
        )}

        <div data-boot-target="header-user" className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-2)", paddingLeft: "var(--space-3)",
              borderLeft: "2px solid var(--color-divider)", background: "transparent", border: 0, cursor: "pointer",
              color: "var(--color-text)", textAlign: "left",
            }}
          >
            <span
              style={{
                width: 32, height: 32, background: "var(--color-accent)", color: "var(--color-bg)",
                display: "grid", placeItems: "center", fontWeight: 800,
              }}
            >
              {user?.display_label ? user.display_label.charAt(0).toUpperCase() : "V"}
            </span>
            <span style={{ lineHeight: 1.2 }}>
              <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 800 }}>{user?.display_label || "Connecting..."}</span>
              <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--color-neutral-700)" }}>{user ? user.id : "No persona"}</span>
            </span>
          </button>

          {showUserMenu && users.length > 0 && (
            <div
              role="menu"
              className="absolute right-0 z-50"
              style={{ marginTop: "var(--space-2)", width: 224, background: "var(--color-surface)", boxShadow: "var(--shadow-lg)", padding: "var(--space-2) 0" }}
            >
              <div style={{ padding: "var(--space-1) var(--space-3)", fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)", borderBottom: "1px solid var(--color-divider)" }}>
                Switch persona
              </div>
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="menuitem"
                  onClick={() => { setUser(u); setShowUserMenu(false); }}
                  className="w-full hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]"
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", border: 0, background: "transparent",
                    padding: "var(--space-2) var(--space-3)", fontSize: "0.8125rem", cursor: "pointer",
                    fontWeight: u.id === user?.id ? 800 : 400, color: "var(--color-text)",
                  }}
                >
                  <span className="truncate">{u.display_label}</span>
                  {u.id === user?.id && <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: "var(--color-accent-700)" }}>active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
