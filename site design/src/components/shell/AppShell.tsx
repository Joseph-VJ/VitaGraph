import React, { useState, useEffect, useRef } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { StatusStrip } from "./StatusStrip";
import {
  runBoot,
  supportsViewTransitions,
  useMotionGovernor,
  getCurrentNavDirection,
} from "../../motion";
import { BASE_URL } from "../../api/client";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/upload": "Upload and Ingest",
  "/graph": "Knowledge Graph",
  "/ask": "Ask Questions",
  "/timeline": "Patient Timeline",
  "/compare": "Compare Reports",
  "/insights": "Graph Insights",
  "/library": "Document Library",
  "/datasets": "Datasets and Knowledge Sources",
  "/ontology": "Biomedical Ontology",
  "/notebooks": "Research Notebooks",
  "/settings": "Settings and System Configuration",
  "/gallery": "Component Gallery",
};

// routes already converted to the exact reference layout; each page task adds its route here
const OWN_LAYOUT = new Set<string>(["/upload", "/compare", "/insights", "/library", "/settings"]);

interface AppShellProps {
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [backendOnline, setBackendOnline] = useState(true);
  const location = useLocation();
  const motion = useMotionGovernor();

  const grainRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const hasBooted = useRef(false);

  // Boot ignition sequence (§M6.1, WS-3)
  const executeBoot = () => {
    const grain = grainRef.current;
    const statusLed = document.querySelector<HTMLElement>('[data-boot-target="status-led"]');
    const statusSegments = document.querySelectorAll('[data-boot-target="status-segment"]');
    const sidebarLeaf = document.querySelector<HTMLElement>('[data-boot-target="sidebar-leaf"]');
    const navItems = document.querySelectorAll('[data-boot-target="nav-item"]');
    const headerSearch = document.querySelector<HTMLElement>('[data-boot-target="header-search"]');
    const headerUser = document.querySelector<HTMLElement>('[data-boot-target="header-user"]');
    const mainContent = mainRef.current;

    runBoot({
      grain,
      statusLed,
      statusSegments,
      sidebarLeaf,
      navItems,
      headerSearch,
      headerUser,
      mainContent,
    });
  };

  useEffect(() => {
    const isBooted = typeof sessionStorage !== "undefined" && sessionStorage.getItem("vg_booted") === "1";
    if (!isBooted && !hasBooted.current) {
      hasBooted.current = true;
      executeBoot();
    }
  }, []);

  useEffect(() => {
    let replayTimer: ReturnType<typeof setTimeout> | null = null;
    const handleReplay = () => {
      hasBooted.current = true;
      if (replayTimer) clearTimeout(replayTimer);
      replayTimer = setTimeout(() => {
        replayTimer = null;
        executeBoot();
      }, 60);
    };
    window.addEventListener("vitagraph:replay-boot", handleReplay);
    return () => {
      window.removeEventListener("vitagraph:replay-boot", handleReplay);
      if (replayTimer) clearTimeout(replayTimer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const probeBackend = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/health`, {
          signal: AbortSignal.timeout(8000),
        });
        if (isMounted) {
          setBackendOnline(res.ok);
        }
      } catch {
        if (isMounted) {
          setBackendOnline(false);
        }
      }
    };

    probeBackend();
    const timer = setInterval(probeBackend, 8000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Dual-path route transitions (§M6.2, WS-1)
  const ownLayout = OWN_LAYOUT.has(location.pathname);
  const vtActive = supportsViewTransitions() && motion.tier !== "T0";
  const isFallback = !vtActive && motion.tier !== "T0";
  const routeAnimClass = isFallback ? "m-route-enter" : "";
  const navDir = getCurrentNavDirection();
  const routeTitle = ROUTE_TITLES[location.pathname] || "VitaGraph";

  return (
    <div className="flex h-screen w-screen text-[var(--bone)] overflow-hidden relative">
      {/* Route change announcer for assistive technology (WCAG a11y, WS-5) */}
      <div data-testid="route-announcer" aria-live="polite" aria-atomic="true" className="sr-only">
        Navigated to {routeTitle}
      </div>

      {/* 3% opacity grain overlay (§4.7) */}
      <div ref={grainRef} className="absolute inset-0 grain-overlay z-50 pointer-events-none" />

      {/* Sidebar (§5.1, shared chrome) */}
      <Sidebar />

      {/* Main Area: Top Banner + Header + Content + Status Strip */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Failure-injection backend-down banner (§US-12, §M7.10) */}
        {!backendOnline && (
          <div
            data-testid="backend-down-banner"
            className="animate-banner-drop"
            style={{
              flex: "none", display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-6)",
              backgroundColor: "var(--color-accent-100)",
              backgroundImage: "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-accent) 22%, transparent) 0 6px, transparent 6px 16px)",
              borderBottom: "2px solid var(--color-accent)", fontSize: "0.875rem",
            }}
          >
            <span style={{ background: "var(--color-accent-100)", padding: "2px 8px", color: "var(--color-accent-800)" }}>
              <b>Backend offline.</b> Answers, search and uploads are paused. The graph, library and timeline stay readable.
            </span>
          </div>
        )}

        <Header backendOnline={backendOnline} />
        <main
          ref={mainRef}
          id="main-content"
          key={location.pathname}
          data-nav-dir={navDir}
          className={`flex-1 min-h-0 overflow-y-auto relative ${ownLayout ? "" : "p-4 sm:p-8"} ${routeAnimClass}`}
        >
          {ownLayout ? (
            children || <Outlet />
          ) : (
            <div className={`mx-auto flex flex-col ${location.pathname === "/ask" || location.pathname === "/graph" ? "max-w-[1440px]" : "max-w-[1280px]"} ${location.pathname === "/ask" ? "h-full" : "min-h-full"}`}>
              {children || <Outlet />}
            </div>
          )}
        </main>
        <StatusStrip backendOnline={backendOnline} />
      </div>

    </div>
  );
};

