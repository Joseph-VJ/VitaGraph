import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { StatusStrip } from "./StatusStrip";
import { LED } from "../gallery/LED";
import { runBoot, supportsViewTransitions, useMotionGovernor } from "../../motion";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [backendOnline, setBackendOnline] = useState(true);
  const location = useLocation();
  const motion = useMotionGovernor();

  const grainRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const hasBooted = useRef(false);

  // Boot ignition sequence (§M6.1)
  useEffect(() => {
    if (hasBooted.current) return;
    hasBooted.current = true;

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
  }, []);

  useEffect(() => {
    let isMounted = true;
    const probeBackend = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/health", {
          signal: AbortSignal.timeout(2000),
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

  // Dual-path route transitions (§M6.2)
  const vtActive = supportsViewTransitions() && motion.tier !== "T0";
  const isFallback = !vtActive && motion.tier !== "T0";
  const routeAnimClass = isFallback ? "m-route-enter" : "";

  return (
    <div className="flex h-screen w-screen bg-[var(--ink-900)] text-[var(--bone)] overflow-hidden relative">
      {/* 3% opacity grain overlay (§4.7) */}
      <div ref={grainRef} className="absolute inset-0 grain-overlay z-50 pointer-events-none" />

      {/* Sidebar (§5.1) */}
      <Sidebar />

      {/* Main Area: Top Banner + Header + Content + Status Strip */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Failure-injection backend-down banner (§US-12, §M7.10) */}
        {!backendOnline && (
          <div
            data-testid="backend-down-banner"
            className="bg-madder-hatch text-[var(--bone)] px-4 py-2 type-label text-xs flex items-center justify-between z-40 border-b border-[var(--line-strong)] animate-banner-drop flex-shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <LED status="offline" size={8} />
              <span>
                <strong>Backend Offline:</strong> Connection to 127.0.0.1:8000 lost · Live RAG, vector retrieval, and pipeline ingestion are paused · Graph & timeline inspectable
              </span>
            </div>
            <span className="type-mono-sm uppercase text-[11px] opacity-90 font-medium tracking-wide">Fail-Closed Boundary</span>
          </div>
        )}

        <Header backendOnline={backendOnline} />
        <main
          ref={mainRef}
          key={location.pathname}
          className={`flex-1 overflow-y-auto p-6 relative ${routeAnimClass}`}
        >
          <div className="max-w-[1440px] mx-auto min-h-full flex flex-col">
            {children}
          </div>
        </main>
        <StatusStrip backendOnline={backendOnline} />
      </div>
    </div>
  );
};
