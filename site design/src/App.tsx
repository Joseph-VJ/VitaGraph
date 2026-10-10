import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { UploadPage } from "./pages/UploadPage";
import { UserProvider } from "./context/UserContext";
import { ToastProvider } from "./components/gallery/Toast";

// Every page except Upload (the landing page) is split into its own file, so the first screen does not download
// and parse the PDF reader, the Markdown renderer and the graph engine. After the first screen is idle the other
// pages are fetched in the background, so a click on the sidebar never waits for the network.
const pageLoaders = {
  graph: () => import("./pages/KnowledgeGraphPage"),
  agent: () => import("./pages/AgentPage"),
  timeline: () => import("./pages/TimelinePage"),
  library: () => import("./pages/LibraryPage"),
  settings: () => import("./pages/SettingsPage"),
  compare: () => import("./pages/ComparePage"),
  insights: () => import("./pages/InsightsPage"),
  textToGraph: () => import("./pages/TextToGraphPage"),
  imageToText: () => import("./pages/ImageToTextPage"),
  pdfToText: () => import("./pages/PdfToTextPage"),
};
const KnowledgeGraphPage = lazy(() => pageLoaders.graph().then((m) => ({ default: m.KnowledgeGraphPage })));
const AgentPage = lazy(() => pageLoaders.agent().then((m) => ({ default: m.AgentPage })));
const TimelinePage = lazy(() => pageLoaders.timeline().then((m) => ({ default: m.TimelinePage })));
const LibraryPage = lazy(() => pageLoaders.library().then((m) => ({ default: m.LibraryPage })));
const SettingsPage = lazy(() => pageLoaders.settings().then((m) => ({ default: m.SettingsPage })));
const ComparePage = lazy(() => pageLoaders.compare().then((m) => ({ default: m.ComparePage })));
const InsightsPage = lazy(() => pageLoaders.insights().then((m) => ({ default: m.InsightsPage })));
const TextToGraphPage = lazy(() => pageLoaders.textToGraph().then((m) => ({ default: m.TextToGraphPage })));
const ImageToTextPage = lazy(() => pageLoaders.imageToText().then((m) => ({ default: m.ImageToTextPage })));
const PdfToTextPage = lazy(() => pageLoaders.pdfToText().then((m) => ({ default: m.PdfToTextPage })));

function prefetchPages(): void {
  Object.values(pageLoaders).forEach((load) => {
    void load().catch(() => {
      /* a failed prefetch only means the page loads on first click instead */
    });
  });
}

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
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = idle ? idle(prefetchPages, { timeout: 4000 }) : window.setTimeout(prefetchPages, 2000);
    return () => {
      if (idle) (window as unknown as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback?.(id);
      else window.clearTimeout(id);
    };
  }, []);

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
              <Route path="/text-to-graph" element={<TextToGraphPage />} />
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
