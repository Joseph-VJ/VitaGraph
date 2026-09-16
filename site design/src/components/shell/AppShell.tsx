import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { StatusStrip } from "./StatusStrip";
import { LED } from "../gallery/LED";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [backendOnline, setBackendOnline] = useState(true);
  const location = useLocation();

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

  return (
    <div className="flex h-screen w-screen bg-[var(--ink-900)] text-[var(--bone)] overflow-hidden relative">
      {/* 3% opacity grain overlay (§4.7) */}
      <div className="absolute inset-0 grain-overlay z-50 pointer-events-none" />

      {/* Sidebar (§5.1) */}
      <Sidebar />

      {/* Main Area: Top Banner + Header + Content + Status Strip */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Failure-injection backend-down banner (§US-12) */}
        {!backendOnline && (
          <div
            data-testid="backend-down-banner"
            className="bg-[var(--madder)] text-[var(--bone)] px-4 py-2 type-label text-xs flex items-center justify-between z-40 border-b border-[var(--line-strong)] animate-fade-in flex-shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <LED status="offline" size={8} />
              <span>
                <strong>Backend Offline:</strong> Connection to 127.0.0.1:8000 lost · Live RAG, vector retrieval, and pipeline ingestion are paused · Graph & timeline inspectable
              </span>
            </div>
            <span className="type-mono-sm uppercase text-[11px] opacity-80">Fail-Closed Boundary</span>
          </div>
        )}

        <Header backendOnline={backendOnline} />
        <main
          key={location.pathname}
          className="flex-1 overflow-y-auto p-6 relative animate-route-fade"
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
