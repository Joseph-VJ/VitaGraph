import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { UploadPage } from "./pages/UploadPage";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage";
import { AgentPage } from "./pages/AgentPage";
import { TimelinePage } from "./pages/TimelinePage";
import { LibraryPage } from "./pages/LibraryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ComparePage } from "./pages/ComparePage";
import { InsightsPage } from "./pages/InsightsPage";
import { ImageToTextPage } from "./pages/ImageToTextPage";
import { PdfToTextPage } from "./pages/PdfToTextPage";
import { UserProvider } from "./context/UserContext";
import { ToastProvider } from "./components/gallery/Toast";

// The component gallery is a development tool. Production builds never load it.
const GalleryPage = import.meta.env.DEV
  ? lazy(() => import("./pages/GalleryPage").then((m) => ({ default: m.GalleryPage })))
  : null;

// The old /ask address keeps working: same query string, new route.
const AskRedirect: React.FC = () => {
  const { search } = useLocation();
  return <Navigate to={`/agent${search}`} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <UserProvider>
          <Routes>
            {/* Full Gallery route (§7 Items 1–26) */}
            {GalleryPage !== null && (
              <Route
                path="/gallery"
                element={
                  <Suspense fallback={null}>
                    <GalleryPage />
                  </Suspense>
                }
              />
            )}

            {/* Persistent AppShell with Shared Chrome (§WS-1) */}
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/upload" replace />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/graph" element={<KnowledgeGraphPage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/ask" element={<AskRedirect />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/image-to-text" element={<ImageToTextPage />} />
              <Route path="/pdf-to-text" element={<PdfToTextPage />} />
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
