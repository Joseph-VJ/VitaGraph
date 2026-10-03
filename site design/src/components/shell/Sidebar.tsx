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
      sublabel: "Add a report",
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
      sublabel: "Questions with evidence",
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
      label: "Timeline",
      sublabel: "Changes over time",
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
      id: "compare",
      path: "/compare",
      label: "Compare",
      sublabel: "Two reports side by side",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <path d="M13 6h3a2 2 0 0 1 2 2v7" />
          <path d="M11 18H8a2 2 0 0 1-2-2V9" />
        </svg>
      ),
      live: true,
    },
    {
      id: "insights",
      path: "/insights",
      label: "Insights",
      sublabel: "Graph analytics",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      ),
      live: true,
    },
    {
      id: "library",
      path: "/library",
      label: "Library",
      sublabel: "Your reports",
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
      sublabel: "Ingestion, privacy",
      icon: (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
      live: true,
    },
  ];

  const navGroups: { label: string; ids: string[] }[] = [
    { label: "Workspace", ids: ["upload", "library", "datasets"] },
    { label: "Analyze", ids: ["ask", "graph", "timeline", "compare", "insights"] },
    { label: "Reference", ids: ["ontology", "notebooks"] },
    { label: "System", ids: ["settings"] },
  ];

  return (
    <aside
      aria-label="Primary navigation"
      className={`w-[60px] lg:w-[244px] h-screen bg-[var(--color-bg)] border-r-2 border-[var(--color-divider)] flex flex-col justify-between flex-shrink-0 select-none overflow-y-auto overflow-x-hidden ${className}`}
    >
      <div>
        {/* Brand Block */}
        <div className="h-[76px] px-3 lg:px-5 flex items-center justify-center lg:justify-start border-b-2 border-[var(--color-divider)]">
          <Link
            to="/upload"
            viewTransition={supportsViewTransitions() && governor.getState().tier !== "T0"}
            onClick={() => setNavDirection(getNavDirection(currentPath, "/upload"))}
            className="flex items-center gap-3"
          >
            <span
              data-boot-target="sidebar-leaf"
              aria-hidden="true"
              className="block w-4 h-4 bg-[var(--color-accent)] flex-shrink-0"
              style={{
                viewTransitionName: supportsViewTransitions() && governor.getState().tier !== "T0" ? "sidebar-leaf" : "none",
              }}
            />
            <span className="hidden lg:inline text-[20px] leading-none font-extrabold tracking-[-0.015em] text-[var(--color-text)]">
              VitaGraph
            </span>
          </Link>
        </div>

        {/* Navigation list */}
        <nav ref={navRef} className="relative py-2" aria-label="Main Navigation">
          {/* FLIP animated active-rule indicator (§M6.2) */}
          <div
            ref={indicatorRef}
            data-testid="sidebar-active-indicator"
            className="absolute left-0 w-[5px] bg-[var(--color-accent)] pointer-events-none z-10"
            style={{ top: 0, height: 0, display: "none" }}
          />

          {navGroups.map((group, groupIdx) => {
            const items = group.ids
              .map((id) => navItems.find((n) => n.id === id))
              .filter((n): n is NavItem => n !== undefined);

            return (
              <React.Fragment key={group.label}>
                <div className="hidden lg:block px-5 pt-5 pb-2 text-[11px] leading-none font-extrabold uppercase tracking-[0.08em] text-[var(--faint)]">
                  {group.label}
                </div>
                {groupIdx > 0 && (
                  <div className="lg:hidden mx-3 my-2 border-t border-[var(--line-faint)]" aria-hidden="true" />
                )}
                {items.map((item) => {
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
                      className={`flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-5 py-2.5 relative group transition-colors duration-[120ms] ease-out ${
                        isActive
                          ? "bg-[var(--color-text)] text-[var(--color-bg)]"
                          : "text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]"
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <div className="hidden lg:block min-w-0 flex-1">
                        <div className="text-[15px] leading-tight font-extrabold">{item.label}</div>
                        {item.sublabel && (
                          <div
                            className={`text-[12px] leading-tight mt-0.5 font-normal truncate ${
                              isActive ? "text-[var(--color-neutral-400)]" : "text-[var(--faint)]"
                            }`}
                          >
                            {item.sublabel}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Gallery Link (§7): developer tool, not a product screen, so it is dev-build only. The route stays reachable. */}
        {import.meta.env.DEV && (
          <div className="mt-4 pt-3 border-t-2 border-[var(--color-divider)]">
            <Link
              to="/gallery"
              title="Component gallery"
              viewTransition={supportsViewTransitions() && governor.getState().tier !== "T0"}
              onClick={() => setNavDirection(getNavDirection(currentPath, "/gallery"))}
              className="flex items-center justify-center lg:justify-start gap-2.5 px-2 lg:px-5 py-2 text-[var(--faint)] hover:text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] transition-colors duration-[120ms]"
            >
              <span className="text-[12px] font-semibold text-[var(--faint)]">§7</span>
              <span className="hidden lg:inline text-[13px]">Component gallery</span>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
};
