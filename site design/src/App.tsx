import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { HomePage } from "./pages/HomePage";
import { UploadPage } from "./pages/UploadPage";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage";
import { AskPage } from "./pages/AskPage";
import { TimelinePage } from "./pages/TimelinePage";
import { LibraryPage } from "./pages/LibraryPage";
import { DatasetsPage } from "./pages/DatasetsPage";
import { OntologyPage } from "./pages/OntologyPage";
import { NotebooksPage } from "./pages/NotebooksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ComparePage } from "./pages/ComparePage";
import { InsightsPage } from "./pages/InsightsPage";
import { GalleryPage } from "./pages/GalleryPage";
import { UserProvider } from "./context/UserContext";
import { ToastProvider } from "./components/gallery/Toast";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <UserProvider>
          <Routes>
        {/* Full Gallery route (§7 Items 1–26) */}
        <Route path="/gallery" element={<GalleryPage />} />

        {/* Live Core Screens wrapped in AppShell */}
        <Route
          path="/"
          element={
            <AppShell>
              <HomePage />
            </AppShell>
          }
        />
        <Route
          path="/upload"
          element={
            <AppShell>
              <UploadPage />
            </AppShell>
          }
        />
        <Route
          path="/graph"
          element={
            <AppShell>
              <KnowledgeGraphPage />
            </AppShell>
          }
        />
        <Route
          path="/ask"
          element={
            <AppShell>
              <AskPage />
            </AppShell>
          }
        />
        <Route
          path="/timeline"
          element={
            <AppShell>
              <TimelinePage />
            </AppShell>
          }
        />

        {/* Fully Implemented Analytic & Research Screens */}
        <Route
          path="/library"
          element={
            <AppShell>
              <LibraryPage />
            </AppShell>
          }
        />
        <Route
          path="/datasets"
          element={
            <AppShell>
              <DatasetsPage />
            </AppShell>
          }
        />
        <Route
          path="/ontology"
          element={
            <AppShell>
              <OntologyPage />
            </AppShell>
          }
        />
        <Route
          path="/notebooks"
          element={
            <AppShell>
              <NotebooksPage />
            </AppShell>
          }
        />
        <Route
          path="/settings"
          element={
            <AppShell>
              <SettingsPage />
            </AppShell>
          }
        />
        <Route
          path="/compare"
          element={
            <AppShell>
              <ComparePage />
            </AppShell>
          }
        />
        <Route
          path="/insights"
          element={
            <AppShell>
              <InsightsPage />
            </AppShell>
          }
        />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </UserProvider>
    </ToastProvider>
  </BrowserRouter>
  );
};

export default App;
