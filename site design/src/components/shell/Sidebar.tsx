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

  const Icon = ({ d }: { d: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
      style={{ strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", flex: "none" }}>
      <path d={d} />
    </svg>
  );

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: "Workspace",
      items: [
        { id: "upload", path: "/upload", label: "Upload & Ingest", sublabel: "Add a report", live: true,
          icon: <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /> },
        { id: "library", path: "/library", label: "Library", sublabel: "Your reports", live: true,
          icon: <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /> },
      ],
    },
    {
      label: "Analyze",
      items: [
        { id: "agent", path: "/agent", label: "AI Agent", sublabel: "Answers with evidence", live: true,
          icon: <Icon d="M4 17l6-6-6-6M12 19h8" /> },
        { id: "graph", path: "/graph", label: "Knowledge Graph", sublabel: "Explore connections", live: true,
          icon: <Icon d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /> },
        { id: "timeline", path: "/timeline", label: "Timeline", sublabel: "Changes over time", live: true,
          icon: <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /> },
        { id: "compare", path: "/compare", label: "Compare", sublabel: "Two reports side by side", live: true,
          icon: <Icon d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 3v18" /> },
        { id: "insights", path: "/insights", label: "Insights", sublabel: "Graph analytics", live: true,
          icon: <Icon d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" /> },
      ],
    },
    {
      label: "System",
      items: [
        { id: "settings", path: "/settings", label: "Settings", sublabel: "Ingestion, privacy", live: true,
          icon: <Icon d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /> },
      ],
    },
  ];

  const vtOn = supportsViewTransitions() && governor.getState().tier !== "T0";

  return (
    <aside
      aria-label="Primary navigation"
      className={`w-[60px] lg:w-[244px] h-screen flex-shrink-0 flex flex-col select-none overflow-hidden ${className}`}
      style={{ borderRight: "2px solid var(--color-divider)", background: "var(--color-bg)", boxSizing: "border-box" }}
    >
      {/* Brand row: 76px high, red 16px square + name */}
      <div
        className="h-[76px] flex-shrink-0 flex items-center justify-center lg:justify-start lg:px-6"
        style={{ borderBottom: "2px solid var(--color-divider)" }}
      >
        <Link
          to="/upload"
          viewTransition={vtOn}
          onClick={() => setNavDirection(getNavDirection(currentPath, "/upload"))}
          className="flex items-center gap-2"
          style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.02em", color: "var(--color-text)", textDecoration: "none" }}
        >
          <span
            data-boot-target="sidebar-leaf"
            aria-hidden="true"
            style={{
              width: 16, height: 16, background: "var(--color-accent)", display: "inline-block", flex: "none",
              viewTransitionName: vtOn ? "sidebar-leaf" : "none",
            }}
          />
          <span className="hidden lg:inline">VitaGraph</span>
        </Link>
      </div>

      <nav ref={navRef} className="relative flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: "var(--space-3) 0" }} aria-label="Main Navigation">
        {/* FLIP active bar (5px, brand red) */}
        <div
          ref={indicatorRef}
          data-testid="sidebar-active-indicator"
          className="absolute left-0 pointer-events-none z-10"
          style={{ top: 0, height: 0, display: "none", width: 5, background: "var(--color-accent)" }}
        />

        {navGroups.map((group, groupIdx) => (
          <React.Fragment key={group.label}>
            <div
              className="hidden lg:block"
              style={{
                padding: "var(--space-4) var(--space-6) var(--space-2)", fontSize: "0.6875rem", fontWeight: 800,
                letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-neutral-700)",
              }}
            >
              {group.label}
            </div>
            {groupIdx > 0 && <div className="lg:hidden mx-3 my-2" style={{ borderTop: "1px solid var(--color-divider)" }} aria-hidden="true" />}
            {group.items.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  viewTransition={vtOn}
                  onClick={() => setNavDirection(getNavDirection(currentPath, item.path))}
                  data-active={isActive ? "true" : "false"}
                  data-boot-target="nav-item"
                  title={item.label}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center justify-center lg:justify-start gap-3 w-full px-2 lg:px-6 py-2 text-left ${isActive ? "" : "hover:bg-[var(--color-surface)]"}`}
                  style={{
                    lineHeight: "normal",
                    textDecoration: "none",
                    background: isActive ? "var(--color-text)" : "transparent",
                    color: isActive ? "var(--color-bg)" : "var(--color-text)",
                  }}
                >
                  <span style={{ color: isActive ? "var(--color-bg)" : "var(--color-neutral-700)", display: "flex" }}>{item.icon}</span>
                  <span className="hidden lg:block min-w-0">
                    <span style={{ display: "block", fontSize: "0.9375rem", fontWeight: 800, lineHeight: 1.2 }}>{item.label}</span>
                    {item.sublabel && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: isActive ? "var(--color-neutral-400)" : "var(--color-neutral-700)" }}>
                        {item.sublabel}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </React.Fragment>
        ))}

        {import.meta.env.DEV && (
          <Link
            to="/gallery"
            title="Component gallery"
            viewTransition={vtOn}
            onClick={() => setNavDirection(getNavDirection(currentPath, "/gallery"))}
            className="hidden lg:block hover:bg-[var(--color-surface)]"
            style={{ padding: "var(--space-2) var(--space-6)", fontSize: "0.75rem", color: "var(--color-neutral-700)", textDecoration: "none", marginTop: "var(--space-4)" }}
          >
            Component gallery (dev)
          </Link>
        )}
      </nav>

      <div
        className="hidden lg:block flex-shrink-0"
        style={{ padding: "var(--space-4) var(--space-6)", borderTop: "2px solid var(--color-divider)", fontSize: "0.6875rem", lineHeight: 1.4, color: "var(--color-neutral-700)" }}
      >
        Educational tool. Not a diagnostic service.
      </div>
    </aside>
  );
};
