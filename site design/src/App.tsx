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

            {/* Persistent AppShell with Shared Chrome (§WS-1) */}
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/graph" element={<KnowledgeGraphPage />} />
              <Route path="/ask" element={<AskPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/datasets" element={<DatasetsPage />} />
              <Route path="/ontology" element={<OntologyPage />} />
              <Route path="/notebooks" element={<NotebooksPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/insights" element={<InsightsPage />} />
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
    </UserProvider>
    </ToastProvider>
  </BrowserRouter>
  );
};

export default App;
