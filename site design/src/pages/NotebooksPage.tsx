import React, { useState } from "react";
import { Badge, Button, Marginalia, ErrorState } from "../components/gallery";
import { Sequence, governor, isReducedMotion } from "../motion";
import { DetentPress } from "../motion/fx/DetentPress";
import { WashSweep } from "../motion/fx/WashSweep";
import { playDetent, playChime, playThud } from "../motion/audio";

interface NotebookItem {
  id: string;
  title: string;
  filename: string;
  author: string;
  kernel: string;
  lastRun: string;
  cells: number;
  summary: string;
  codeSnippet: string;
}

const notebooksList: NotebookItem[] = [
  {
    id: "nb-1",
    title: "Longitudinal Biomarker Shift Estimation (Arjun R)",
    filename: "01_patient_delta_analysis.ipynb",
    author: "Vijay Joseph",
    kernel: "Python 3.11 (VitaGraph env)",
    lastRun: "2026-09-09 14:15",
    cells: 14,
    summary: "Evaluates percentage changes in Hemoglobin, eGFR, and HbA1c between January and June panels.",
    codeSnippet: `# Compute longitudinal percentage change between lab visits
import pandas as pd

deltas = {
    "test": ["Hemoglobin", "eGFR", "HbA1c"],
    "baseline": [13.1, 78.0, 6.8],
    "followup": [13.2, 72.0, 7.1]
}
df = pd.DataFrame(deltas)
df["delta"] = df["followup"] - df["baseline"]
df["pct_change"] = (df["delta"] / df["baseline"]) * 100
print(df[["test", "baseline", "followup", "delta", "pct_change"]])`,
  },
  {
    id: "nb-2",
    title: "Louvain Subgraph Community Partitioning",
    filename: "02_graph_modularity.ipynb",
    author: "Vijay Joseph",
    kernel: "Python 3.11 (NetworkX)",
    lastRun: "2026-09-09 11:20",
    cells: 22,
    summary: "Applies Louvain community detection to 214 nodes, identifying Cardiac, Renal, and Treatment clusters.",
    codeSnippet: `import networkx as nx
from community import community_louvain

G = load_vitagraph_subgraph(user_id="VG-2026-001")
partition = community_louvain.best_partition(G, weight='weight')
modularity = community_louvain.modularity(partition, G)
print(f"Communities detected: {len(set(partition.values()))}, Modularity: {modularity:.2f}")`,
  },
  {
    id: "nb-3",
    title: "Citation Grounding & Evidence Span Validation",
    filename: "03_citation_verifier.ipynb",
    author: "Vijay Joseph",
    kernel: "Python 3.11 (Chroma + PyPDF)",
    lastRun: "2026-09-08 17:40",
    cells: 18,
    summary: "Verifies every retrieved citation chunk maps to an exact character start/end span in source PDFs.",
    codeSnippet: `def verify_citation_span(chunk_id, doc_path, span_start, span_end):
    raw_text = extract_page_slice(doc_path, span_start, span_end)
    similarity = cosine_similarity(chunk_embedding, model.encode(raw_text))
    assert similarity >= 0.85, f"Span alignment failure on {chunk_id}"
    return {"status": "verified", "similarity": round(float(similarity), 3)}`,
  },
];

export const NotebooksPage: React.FC = () => {
  const [selectedNb, setSelectedNb] = useState<NotebookItem>(notebooksList[0]);
  const [maskKey, setMaskKey] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);
  const [wash, setWash] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);

  const isT0 = governor.getState().tier === "T0" || isReducedMotion();

  const handleSelectNotebook = (nb: NotebookItem) => {
    playDetent();
    setError(null);
    setFailedStep(null);
    if (!isT0 && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setSelectedNb(nb);
        setMaskKey((k) => k + 1);
        setStep(0);
      });
    } else {
      setSelectedNb(nb);
      setMaskKey((k) => k + 1);
      setStep(0);
    }
  };

  const handleRunNotebook = () => {
    playDetent();
    setError(null);
    setFailedStep(null);

    if (isT0) {
      if ((window as any).__VG_STUB_NOTEBOOK_FAIL__) {
        setStep(2);
        setFailedStep(2);
        setError("Kernel execution failed at step 2/3: ZeroDivisionError in cell 14: community modularity matrix singular");
        return;
      }
      setStep(3);
      return;
    }

    setRunning(true);
    setStep(0);
    setWash(true);

    new Sequence()
      .wait(80)
      .addAction(() => {
        setStep(1);
        playDetent();
      })
      .wait(80)
      .addAction(() => {
        if ((window as any).__VG_STUB_NOTEBOOK_FAIL__) {
          setStep(2);
          setFailedStep(2);
          setRunning(false);
          setWash(false);
          setError("Kernel execution failed at step 2/3: ZeroDivisionError in cell 14: community modularity matrix singular");
          playThud();
          return;
        }
        setStep(2);
        playDetent();
      })
      .wait(80)
      .addAction(() => {
        if ((window as any).__VG_STUB_NOTEBOOK_FAIL__) return;
        setStep(3);
        setRunning(false);
        setWash(false);
        playChime();
      })
      .play();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-title text-[var(--bone)]">Research Notebooks</h2>
          <p className="type-meta text-[var(--dim)] mt-0.5">
            Interactive Jupyter research workflows, statistical models, and validation routines.
          </p>
        </div>
        <Marginalia
          text="Better questions Healthier People"
          sketch="quill"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Notebooks List (1 column) */}
        <div className="space-y-3">
          <span className="type-label text-[var(--dim)] block mb-1">
            Available notebooks ({notebooksList.length})
          </span>
          {notebooksList.map((nb, idx) => {
            const isSelected = selectedNb.id === nb.id;
            return (
              <DetentPress key={nb.id} className="block w-full">
                <div
                  onClick={() => handleSelectNotebook(nb)}
                  data-testid={`notebook-card-${nb.id}`}
                  className={`p-4 rounded-[var(--r-10)] border cursor-pointer transition-all duration-[120ms] ease-out ${!isT0 ? "m-enter" : ""} ${
                    isSelected
                      ? "bg-[var(--ink-800)] border-[var(--verdigris)] shadow-sm"
                      : "bg-[var(--ink-800)]/60 border-[var(--line-strong)] hover:border-[var(--dim)]"
                  }`}
                  style={!isT0 ? { animationDelay: `${Math.min(idx * 60, 240)}ms` } : undefined}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="type-mono-sm text-[var(--dim)] text-xs">
                      {nb.filename}
                    </span>
                    <Badge variant="verdigris">{nb.cells} cells</Badge>
                  </div>
                  <h3 className="type-title text-[var(--bone)] text-sm font-medium mb-1">
                    {nb.title}
                  </h3>
                  <p className="type-meta text-[var(--dim)] text-xs line-clamp-2">
                    {nb.summary}
                  </p>
                  <div className="mt-3 pt-2 border-t border-[var(--line-faint)] flex items-center justify-between text-[11px] text-[var(--faint)]">
                    <span>{nb.kernel}</span>
                    <span className="font-mono">{nb.lastRun}</span>
                  </div>
                </div>
              </DetentPress>
            );
          })}
        </div>

        {/* Notebook Preview (2 columns) */}
        <div className="lg:col-span-2 rounded-[var(--r-14)] bg-[var(--ink-800)] border border-[var(--line-strong)] p-6 relative overflow-hidden">
          {wash && (
            <WashSweep
              active={wash}
              color="var(--verdigris)"
              testId="notebook-wash"
            />
          )}

          <div
            data-testid="notebook-preview-header"
            className={`flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[var(--line-faint)] ${!isT0 ? "m-enter" : ""}`}
            style={!isT0 ? { animationDelay: `${Math.min(notebooksList.length * 60, 240)}ms` } : undefined}
          >
            <div>
              <span className="type-mono-sm text-[var(--verdigris)] text-xs block mb-1">
                {selectedNb.filename}
              </span>
              <h3
                className="type-title text-[var(--bone)] text-lg"
                style={{
                  viewTransitionName: !isT0 ? "notebook-title" : "none",
                }}
              >
                {selectedNb.title}
              </h3>
              <p className="type-meta text-[var(--dim)] text-xs mt-1">
                Author: {selectedNb.author} · Kernel: {selectedNb.kernel} · Last executed: {selectedNb.lastRun}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && !error && (
                <span className="type-mono text-[11px] text-[var(--verdigris)]">
                  {step === 3 ? "Execution complete (0.24s)" : `Executing step ${step}/3...`}
                </span>
              )}
              {error && (
                <span
                  data-testid="notebook-step-failed"
                  className={`type-mono text-[11px] text-[var(--madder)] flex items-center gap-1.5 ${
                    !isT0 ? "animate-led-fail" : ""
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-[var(--madder)] ${!isT0 ? "animate-led-fail" : ""}`} />
                  <span>Step {failedStep}/3 failed</span>
                </span>
              )}
              <DetentPress>
                <Button
                  variant="primary"
                  className="h-8 px-3 text-xs"
                  onClick={handleRunNotebook}
                  disabled={running}
                  data-testid="run-notebook-btn"
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>{running ? "Running…" : error ? "Retry notebook" : "Run notebook"}</span>
                </Button>
              </DetentPress>
            </div>
          </div>

          {error && (
            <ErrorState
              message={error}
              onRetry={handleRunNotebook}
              className="mb-4"
            />
          )}

          <div className="mb-4">
            <span className="type-label text-[var(--dim)] text-xs block mb-1">
              Methodological summary
            </span>
            <p className="type-reading text-[var(--bone)] text-sm">
              {selectedNb.summary}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="type-label text-[var(--dim)] text-xs">
                Executable Cell [1]
              </span>
              <span className="type-mono-sm text-[var(--faint)] text-[11px]">
                Python 3.11
              </span>
            </div>
            <pre
              key={maskKey}
              className={`p-4 rounded-[var(--r-6)] bg-[var(--ink-900)] border border-[var(--line-strong)] overflow-x-auto type-mono text-xs text-[var(--bone)] leading-relaxed font-mono ${
                !isT0 ? "m-mask-reveal" : ""
              }`}
            >
              <code>{selectedNb.codeSnippet}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
