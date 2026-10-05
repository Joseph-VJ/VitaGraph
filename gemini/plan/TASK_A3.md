<!-- Copied from VitaGraph-plan.md. Read gemini/plan/COMMON.md first. -->

### Task A3 — Remove pages made of invented data; make the gallery development-only

- **Goal:** Remove the Datasets, Ontology and Notebooks pages, which show only invented content (see the findings above), and load the component gallery only in development builds.
- **Tier:** Must
- **Size:** S
- **Review:** light
- **Depends on:** none
- **Files to read first:**
  - `site design/src/App.tsx`
  - `site design/src/pages/DatasetsPage.tsx`
  - `site design/src/pages/OntologyPage.tsx`
  - `site design/src/pages/NotebooksPage.tsx`
  - `site design/src/pages/NotReleasedPage.tsx`
  - `site design/src/components/shell/AppShell.tsx`
  - `site design/src/components/shell/Header.tsx`
- **Files to create or modify:**
  - modify `site design/src/App.tsx`
  - delete `site design/src/pages/DatasetsPage.tsx`
  - delete `site design/src/pages/OntologyPage.tsx`
  - delete `site design/src/pages/NotebooksPage.tsx`
  - delete `site design/src/pages/NotReleasedPage.tsx`
  - modify `site design/src/components/shell/AppShell.tsx`
  - modify `site design/src/components/shell/Header.tsx`
- **Why delete instead of keep:**
  - `docs/SESSION_CONTEXT.md` section 16.8 lists "Datasets / Ontology / Notebooks: bring back or delete" as an open decision. Rule 3 (no invented data anywhere) rules out bringing them back as they are.
  - `NotReleasedPage.tsx` is imported nowhere.
  - Old addresses keep working, because the catch-all route sends them to `/upload`.

**What to change**
1. `site design/src/App.tsx` line 1 (anchor `import React from "react";`): also import `Suspense` and `lazy` from React.
2. `site design/src/App.tsx` lines 9–11 (anchor `import { DatasetsPage }`): delete the three page imports (Datasets, Ontology, Notebooks).
3. `site design/src/App.tsx` line 15 (anchor `import { GalleryPage } from "./pages/GalleryPage";`): delete this static import.
   - After the last import, add a module-level constant `GalleryPage` with a one-line comment: "The component gallery is a development tool. Production builds never load it."
   - When `import.meta.env.DEV` is true, the constant is a `lazy()` component. Its loader dynamically imports `./pages/GalleryPage` and maps the named export `GalleryPage` to `default`.
   - Otherwise the constant is `null`. Vite then drops the gallery from the production bundle.
4. `site design/src/App.tsx` lines 31–32 (anchor `<Route path="/gallery" element={<GalleryPage />} />`): render the `/gallery` route only when the constant is not null, and wrap the element in `Suspense` with a `null` fallback.
5. `site design/src/App.tsx` lines 43–45 (anchor `<Route path="/datasets"`): delete the three routes `/datasets`, `/ontology` and `/notebooks`.
6. Delete the four page files with `git rm`.
7. `site design/src/components/shell/AppShell.tsx` lines 23–25 (anchor `"/datasets": "Datasets and Knowledge Sources",`): delete the three `ROUTE_TITLES` entries for `/datasets`, `/ontology` and `/notebooks`.
8. `site design/src/components/shell/Header.tsx` lines 103–105 (anchor `case "/datasets":`): delete the three `case` lines for `/datasets`, `/ontology` and `/notebooks` in `getHeaderConfig`.

**How to verify**
1. `Get-ChildItem "site design\src" -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'DatasetsPage|OntologyPage|NotebooksPage|NotReleasedPage'` prints nothing.
2. `cd "site design"; npm run build`. It must exit 0.
3. Production check: `Select-String -Path "site design\dist\assets\*.js" -Pattern 'Component gallery|MotionSpecimens'` prints nothing, because the gallery is not in the production bundle.
4. Browser check, with the dev server running: `http://localhost:5173/datasets` ends on `/upload`, and `http://localhost:5173/gallery` still opens the gallery.

**Acceptance criteria**
- [ ] The four page files are deleted with `git rm`.
- [ ] No route for `/datasets`, `/ontology` or `/notebooks` remains, and no title or header case for them.
- [ ] The production bundle contains no gallery code (check 3 prints nothing).
- [ ] The build exits 0.
