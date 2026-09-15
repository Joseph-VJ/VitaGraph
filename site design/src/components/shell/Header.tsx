import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Breadcrumb } from "../gallery/Breadcrumb";
import { useActiveUser } from "../../context/UserContext";

interface HeaderProps {
  onSearch?: (query: string) => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ onSearch, className = "" }) => {
  const location = useLocation();
  const path = location.pathname;
  const { user, users, setUser } = useActiveUser();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Title, subline, search placeholder per screen (§5.2, §9)
  const getHeaderConfig = () => {
    switch (path) {
      case "/upload":
        return {
          title: "Upload & Ingest",
          sub: "Turn your health reports into a structured knowledge graph.",
          placeholder: "Search reports, concepts, or ask a question…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
      case "/graph":
        return {
          title: "Knowledge Graph",
          sub: "Discover how medical concepts, evidence, and outcomes are connected in your documents.",
          placeholder: "Search documents, concepts, or ask a question…",
          shortcut: "/",
          breadcrumb: null,
        };
      case "/ask":
        return {
          title: "RAG Assistant",
          sub: "Ask questions. Get evidence-backed answers from your health reports.",
          placeholder: "Search your reports, concepts, or ask a question…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
      case "/timeline":
        return {
          title: "Patient Timeline",
          sub: "A longitudinal view of reports, key changes, and research activity.",
          placeholder: "Search reports, concepts, or ask a question…",
          shortcut: "Ctrl K",
          breadcrumb: [
            { label: "Patients", href: "#" },
            { label: "Arjun R", href: "#" },
            { label: "Timeline", current: true },
          ],
        };
      case "/compare":
        return {
          title: "Compare Reports",
          sub: "See how key measurements and findings change across time.",
          placeholder: "Search reports, concepts, or ask a question…",
          shortcut: "Ctrl K",
          breadcrumb: [
            { label: "Patients", href: "#" },
            { label: "Arjun R", href: "#" },
            { label: "Compare Reports", current: true },
          ],
        };
      case "/insights":
        return {
          title: "Insights",
          sub: "Discover patterns, key concepts, and trends across your health reports.",
          placeholder: "Search reports, concepts, or ask a question…",
          shortcut: "Ctrl K",
          breadcrumb: [
            { label: "VitaGraph", href: "#" },
            { label: "Insights", current: true },
          ],
        };
      case "/library":
        return {
          title: "Library",
          sub: "Your health documents and indexed research papers.",
          placeholder: "Search library documents…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
      case "/datasets":
        return {
          title: "Datasets",
          sub: "Manage health sources, FHIR bundles, and clinical guidelines.",
          placeholder: "Search datasets…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
      case "/ontology":
        return {
          title: "Ontology",
          sub: "Medical concepts, hierarchical mappings, and relationship rules.",
          placeholder: "Search ontology concepts…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
      case "/notebooks":
        return {
          title: "Notebooks",
          sub: "Computational research scratchpads and analytic protocols.",
          placeholder: "Search research notes…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
      case "/settings":
        return {
          title: "Settings",
          sub: "System parameters, model configuration, and local privacy controls.",
          placeholder: "Search preferences…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
      default: // Home
        return {
          title: "Workspace overview",
          sub: "Your health reports, evidence, and insights — all in one place.",
          placeholder: "Search reports, concepts, or ask a question…",
          shortcut: "Ctrl K",
          breadcrumb: null,
        };
    }
  };

  const config = getHeaderConfig();

  return (
    <header
      className={`h-[72px] px-8 bg-[var(--ink-900)] border-b border-[var(--line-faint)] flex items-center justify-between flex-shrink-0 select-none ${className}`}
    >
      {/* Left: Title block or Breadcrumb */}
      <div className="flex flex-col justify-center min-w-0 pr-4">
        {config.breadcrumb ? (
          <div>
            <Breadcrumb items={config.breadcrumb} className="mb-0.5" />
            <h1 className="type-display text-[22px] leading-tight text-[var(--bone)]">
              {config.title}
            </h1>
            <p className="type-screen-sub text-[13px] leading-tight text-[var(--dim)] mt-0.5">
              {config.sub}
            </p>
          </div>
        ) : (
          <div>
            <h1 className="type-display text-[24px] leading-tight text-[var(--bone)]">
              {config.title}
            </h1>
            <p className="type-screen-sub text-[13px] leading-tight text-[var(--dim)] mt-0.5">
              {config.sub}
            </p>
          </div>
        )}
      </div>

      {/* Right: Search Input + User Chip (§5.2) */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Search input (320px) */}
        <div className="relative w-[320px] flex items-center">
          <span className="absolute left-3 text-[var(--dim)] pointer-events-none">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder={config.placeholder}
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full h-9 pl-9 pr-14 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] text-[var(--bone)] placeholder-[var(--faint)] text-[12.5px] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--verdigris)] hover:border-[var(--dim)]"
          />
          <span className="absolute right-2.5 px-1.5 py-0.5 rounded-[var(--r-4)] bg-[var(--ink-700)] border border-[var(--line-strong)] text-[var(--dim)] type-mono-sm pointer-events-none">
            {config.shortcut}
          </span>
        </div>

        {/* User Chip (§5.2) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 pl-3 border-l border-[var(--line-faint)] hover:opacity-90 transition-opacity text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--verdigris)] text-[var(--ink-900)] flex items-center justify-center font-semibold text-[13px] shadow-sm">
              {user?.display_label ? user.display_label.charAt(0).toUpperCase() : "V"}
            </div>
            <div className="flex flex-col">
              <span className="type-body text-[12.5px] font-medium leading-none text-[var(--bone)]">
                {user?.display_label || "Connecting..."}
              </span>
              <span className="type-meta text-[11px] text-[var(--dim)] leading-none mt-1">
                {user ? `Persona ${user.id.slice(0, 6)}` : "No persona"}
              </span>
            </div>
            <svg className="w-3.5 h-3.5 text-[var(--dim)] ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {showUserMenu && users.length > 0 && (
            <div className="absolute right-0 mt-2 w-56 rounded-[var(--r-6)] bg-[var(--ink-800)] border border-[var(--line-strong)] shadow-lg py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-medium text-[var(--dim)] border-b border-[var(--line-faint)]">
                Switch Persona
              </div>
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setUser(u);
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between hover:bg-[var(--ink-700)] ${
                    u.id === user?.id ? "text-[var(--verdigris)] font-medium" : "text-[var(--bone)]"
                  }`}
                >
                  <span className="truncate">{u.display_label}</span>
                  {u.id === user?.id && <span className="text-[10px] type-mono-sm">active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
