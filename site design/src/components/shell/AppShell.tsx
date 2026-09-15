import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { StatusStrip } from "./StatusStrip";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen bg-[var(--ink-900)] text-[var(--bone)] overflow-hidden relative">
      {/* 3% opacity grain overlay (§4.7) */}
      <div className="absolute inset-0 grain-overlay z-50 pointer-events-none" />

      {/* Sidebar (§5.1) */}
      <Sidebar />

      {/* Main Area: Header + Content + Status Strip */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 relative">
          <div className="max-w-[1440px] mx-auto min-h-full flex flex-col">
            {children}
          </div>
        </main>
        <StatusStrip />
      </div>
    </div>
  );
};
