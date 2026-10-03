import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Breadcrumb } from "../gallery/Breadcrumb";
import { Badge } from "../gallery/Badge";
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
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

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

  // The box asks a question: Enter hands the text to the Ask workspace.
  const submitSearch = () => {
    const text = query.trim();
    if (!text) return;
    setQuery("");
    transitionNavigate(navigate, `/ask?q=${encodeURIComponent(text)}`, { direction: "forward" });
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

  // Title and subline (§5.2, §9)
  const getHeaderConfig = () => {
    switch (path) {
      case "/upload":
        return {
          title: "Upload & Ingest",
          sub: "Add a report and watch it become a knowledge graph.",
          breadcrumb: null,
        };
      case "/graph":
        return {
          title: "Knowledge Graph",
          sub: "Discover how medical concepts, evidence, and outcomes are connected in your documents.",
          breadcrumb: null,
        };
      case "/ask":
        return {
          title: "Ask your reports",
          sub: "Every answer cites the report page it came from.",
          breadcrumb: null,
        };
      case "/timeline":
        return {
          title: "Patient Timeline",
          sub: "A longitudinal view of reports, key changes, and research activity.",
          breadcrumb: [
            { label: "Patients", href: "#" },
            { label: user?.display_label ?? "Patient", href: "#" },
            { label: "Timeline", current: true },
          ],
        };
      case "/compare":
        return {
          title: "Compare Reports",
          sub: "See how key measurements and findings change across time.",
          breadcrumb: [
            { label: "Patients", href: "#" },
            { label: user?.display_label ?? "Patient", href: "#" },
            { label: "Compare Reports", current: true },
          ],
        };
      case "/insights":
        return {
          title: "Insights",
          sub: "Discover patterns, key concepts, and trends across your health reports.",
          breadcrumb: [
            { label: "VitaGraph", href: "#" },
            { label: "Insights", current: true },
          ],
        };
      case "/library":
        return {
          title: "Library",
          sub: "Your health documents and indexed research papers.",
          breadcrumb: null,
        };
      case "/datasets":
        return {
          title: "Datasets",
          sub: "Manage health sources, FHIR bundles, and clinical guidelines.",
          breadcrumb: null,
        };
      case "/ontology":
        return {
          title: "Ontology",
          sub: "Medical concepts, hierarchical mappings, and relationship rules.",
          breadcrumb: null,
        };
      case "/notebooks":
        return {
          title: "Notebooks",
          sub: "Computational research scratchpads and analytic protocols.",
          breadcrumb: null,
        };
      case "/settings":
        return {
          title: "Settings",
          sub: "System parameters, model configuration, and local privacy controls.",
          breadcrumb: null,
        };
      default: // Home
        return {
          title: "Workspace overview",
          sub: "Your reports, evidence and insights in one place.",
          breadcrumb: null,
        };
    }
  };

  const config = getHeaderConfig();

  return (
    <header
      className={`min-h-[76px] px-4 sm:px-8 py-3 bg-[var(--color-bg)] border-b-2 border-[var(--color-divider)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 flex-shrink-0 select-none ${className}`}
    >
      {/* Left: Title block or Breadcrumb */}
      <div className="flex flex-col justify-center min-w-0 flex-1 basis-[260px]">
        {config.breadcrumb ? (
          <div>
            <Breadcrumb items={config.breadcrumb} className="mb-0.5" />
            <h1
              className="text-[22px] leading-[28px] sm:text-[24px] sm:leading-[30px] font-extrabold tracking-[-0.015em] text-[var(--color-text)]"
              style={{
                viewTransitionName:
                  supportsViewTransitions() && governor.getState().tier !== "T0"
                    ? "header-title"
                    : "none",
              }}
            >
              {config.title}
            </h1>
            <p className="mt-1 max-w-[62ch] text-[14px] leading-[20px] text-[var(--faint)]">
              {config.sub}
            </p>
          </div>
        ) : (
          <div>
            <h1
              className="text-[22px] leading-[28px] sm:text-[24px] sm:leading-[30px] font-extrabold tracking-[-0.015em] text-[var(--color-text)]"
              style={{
                viewTransitionName:
                  supportsViewTransitions() && governor.getState().tier !== "T0"
                    ? "header-title"
                    : "none",
              }}
            >
              {config.title}
            </h1>
            <p className="mt-1 max-w-[62ch] text-[14px] leading-[20px] text-[var(--faint)]">
              {config.sub}
            </p>
          </div>
        )}
      </div>

      {/* Right: Mode badges + Search Input + User Chip (§5.2, §US-12) */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full sm:w-auto sm:flex-nowrap sm:flex-shrink-0">
        {/* Replay mode badge (§US-12, §M7.10: pops on enter, static while on, never disguised as live) */}
        {isReplay && (
          <Badge variant="ochre" className="animate-chip-pop" testId="replay-mode-badge">
            Replay mode
          </Badge>
        )}

        {/* allow_api=false label (§US-12, §M7.10: static ochre, never pulses) */}
        {allowApi === false && (
          <Badge variant="ochre" className="animate-none" testId="allow-api-chip" title="Answers quote your reports only; the AI service is not called">
            AI explanations off
          </Badge>
        )}

        {/* Search input (300px). Hidden on /ask, where the composer is the input. */}
        {path !== "/ask" && (
          <div data-boot-target="header-search" className="relative w-full sm:w-[300px] flex items-center order-last sm:order-none">
            <span className="absolute left-3 text-[var(--faint)] pointer-events-none">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={searchRef}
              type="text"
              value={query}
              aria-label="Ask a question about your reports"
              placeholder={SEARCH_PLACEHOLDER}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitSearch();
                }
              }}
              className="w-full h-9 pl-9 pr-14 bg-[var(--color-surface)] border border-[var(--color-divider)] text-[var(--color-text)] placeholder:text-[var(--faint)] text-[14px] transition-colors duration-[120ms] hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus-visible:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-0"
            />
            <span className="absolute right-2.5 px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-divider)] text-[var(--faint)] text-[11px] font-semibold pointer-events-none hidden sm:inline">
              {isMac ? "⌘K" : "Ctrl K"}
            </span>
          </div>
        )}

        {/* User Chip (§5.2) */}
        <div data-boot-target="header-user" className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center text-left gap-2.5 sm:pl-3 sm:border-l-2 sm:border-[var(--color-divider)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center font-extrabold text-[14px]">
              {user?.display_label ? user.display_label.charAt(0).toUpperCase() : "V"}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[14px] font-extrabold leading-none text-[var(--color-text)]">
                {user?.display_label || "Connecting..."}
              </span>
              <span className="mt-1.5 text-[12px] leading-none text-[var(--faint)]">
                {user ? `Persona ${user.id.slice(0, 6)}` : "No persona"}
              </span>
            </div>
            <svg className="w-3.5 h-3.5 text-[var(--faint)] ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {showUserMenu && users.length > 0 && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--color-neutral-100)] border-2 border-[var(--color-divider)] shadow-[var(--shadow-md)] py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--faint)] border-b border-[var(--line-faint)]">
                Switch persona
              </div>
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setUser(u);
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] ${
                    u.id === user?.id ? "text-[var(--verdigris)] font-semibold" : "text-[var(--color-text)]"
                  }`}
                >
                  <span className="truncate">{u.display_label}</span>
                  {u.id === user?.id && <span className="text-[11px] font-semibold">active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
