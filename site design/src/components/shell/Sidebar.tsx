import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { flip, supportsViewTransitions, governor, setNavDirection, getNavDirection } from "../../motion";

export interface NavItem {
  id: string;
  path: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  live: boolean;
}

interface SidebarProps {
  activeScreen?: string;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = "" }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const navEl = navRef.current;
    const indicatorEl = indicatorRef.current;
    if (!navEl || !indicatorEl) return;

    const activeLink = navEl.querySelector<HTMLElement>('a[data-active="true"]');
    if (!activeLink) {
      indicatorEl.style.display = "none";
      return;
    }

    const navRect = navEl.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const top = linkRect.top - navRect.top;
    const height = linkRect.height;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      indicatorEl.style.top = `${top}px`;
      indicatorEl.style.height = `${height}px`;
      indicatorEl.style.display = "block";
      return;
    }

    // Subsequent route changes: FLIP animation via weighted spring (§M6.2)
    indicatorEl.style.display = "block";
    flip(
      indicatorEl,
      () => {
        indicatorEl.style.top = `${top}px`;
        indicatorEl.style.height = `${height}px`;
      },
      { spring: "weighted", capMs: 240 }
    );
  }, [currentPath]);

  const navItems: NavItem[] = [
    {
      id: "upload",
      path: "/upload",
      label: "Upload & Ingest",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
      live: true,
    },
    {
      id: "graph",
      path: "/graph",
      label: "Knowledge Graph",
      sublabel: "Explore connections",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
      live: true,
    },
    {
      id: "ask",
      path: "/ask",
      label: "Ask",
      sublabel: "Get evidence-backed answers",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      live: true,
    },
    {
      id: "timeline",
      path: "/timeline",
      label: "Patient Timeline",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      live: true,
    },
    {
      id: "library",
      path: "/library",
      label: "Library",
      sublabel: "Your documents",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      ),
      live: true,
    },
    {
      id: "datasets",
      path: "/datasets",
      label: "Datasets",
      sublabel: "Manage sources",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        </svg>
      ),
      live: true,
    },
    {
      id: "ontology",
      path: "/ontology",
      label: "Ontology",
      sublabel: "Concepts and mappings",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="22" />
        </svg>
      ),
      live: true,
    },
    {
      id: "notebooks",
      path: "/notebooks",
      label: "Notebooks",
      sublabel: "Research notes",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
      live: true,
    },
    {
      id: "settings",
      path: "/settings",
      label: "Settings",
      sublabel: "Preferences",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
      live: true,
    },
  ];

  // Context list according to active screen (§5.1)
  // The per-screen context lists (recent sessions, questions, personas) were hardcoded demo
  // content, not user data, so they are no longer rendered. Persona switching lives in the header menu.
  return (
    <aside
      aria-label="Primary navigation"
      className={`w-[60px] lg:w-[240px] h-screen bg-[var(--chrome)] border-r border-[var(--chrome-line)] shadow-[2px_0_10px_rgba(40,50,58,0.08)] flex flex-col justify-between flex-shrink-0 select-none overflow-y-auto overflow-x-hidden ${className}`}
    >
      <div>
        {/* Brand Block (§5.1) */}
        <div className="p-3 lg:p-5 pb-3 lg:pb-4 border-b border-[var(--chrome-line)]">
          <Link
            to="/upload"
            viewTransition={supportsViewTransitions() && governor.getState().tier !== "T0"}
            onClick={() => setNavDirection(getNavDirection(currentPath, "/upload"))}
            className="flex items-center justify-center lg:justify-start gap-2.5 rounded-[var(--r-6)]"
          >
            {/* Leaf glyph (verdigris hand-drawn SVG) */}
            <svg
              data-boot-target="sidebar-leaf"
              className="w-5 h-5 text-[var(--verdigris)] flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                viewTransitionName: supportsViewTransitions() && governor.getState().tier !== "T0" ? "sidebar-leaf" : "none",
              }}
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="hidden lg:inline font-['Spectral'] text-[20px] leading-tight font-semibold text-[var(--bone)] tracking-tight">
              VitaGraph
            </span>
          </Link>
          <p className="hidden lg:block type-meta text-[var(--dim)] mt-1 pl-7">
            Evidence for a healthier tomorrow
          </p>
        </div>

        {/* Navigation list */}
        <nav ref={navRef} className="p-2 space-y-0.5 relative" aria-label="Main Navigation">
          {/* FLIP animated active-rule indicator (§M6.2) */}
          <div
            ref={indicatorRef}
            data-testid="sidebar-active-indicator"
            className="absolute left-2 w-[3px] bg-[var(--deep-petrol)] rounded-r pointer-events-none z-10"
            style={{ top: 0, height: 0, display: "none" }}
          />

          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            const useVT = supportsViewTransitions() && governor.getState().tier !== "T0";
            return (
              <Link
                key={item.id}
                to={item.path}
                viewTransition={useVT}
                onClick={() => setNavDirection(getNavDirection(currentPath, item.path))}
                data-active={isActive ? "true" : "false"}
                data-boot-target="nav-item"
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2 rounded-[var(--r-6)] transition-colors duration-[120ms] ease-out group relative border-l-2 ${
                  isActive
                    ? "bg-[var(--ink-800)] text-[var(--bone)] border-l-[var(--deep-petrol)] shadow-[var(--shadow-3d)]"
                    : "text-[var(--dim)] hover:text-[var(--bone)] hover:bg-[var(--ink-800)]/60 border-l-transparent"
                }`}
              >
                <span
                  className={`flex-shrink-0 ${
                    isActive ? "text-[var(--bone)]" : "text-[var(--dim)] group-hover:text-[var(--bone)]"
                  }`}
                >
                  {item.icon}
                </span>
                <div className="hidden lg:block min-w-0 flex-1">
                  <div className="type-body text-[14px] leading-tight font-medium text-current">
                    {item.label}
                  </div>
                  {item.sublabel && (
                    <div className="type-label text-[12px] text-[var(--dim)] truncate leading-tight mt-0.5 font-normal">
                      {item.sublabel}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Gallery Link (§7) */}
        <div className="mt-4 pt-3 border-t border-[var(--chrome-line)]">
          <Link
            to="/gallery"
            title="Component gallery"
            viewTransition={supportsViewTransitions() && governor.getState().tier !== "T0"}
            onClick={() => setNavDirection(getNavDirection(currentPath, "/gallery"))}
            className="flex items-center justify-center lg:justify-start gap-2.5 px-2 lg:px-3 py-1.5 mx-2 rounded-[var(--r-6)] text-[var(--dim)] hover:text-[var(--bone)] hover:bg-[var(--ink-800)]/60 transition-colors duration-[120ms]"
          >
            <span className="type-mono-sm text-[11px] text-[var(--verdigris)]">§7</span>
            <span className="hidden lg:inline type-body text-[13px]">Component gallery</span>
          </Link>
        </div>
      </div>

    </aside>
  );
};
