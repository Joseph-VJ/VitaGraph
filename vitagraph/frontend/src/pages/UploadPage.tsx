// Report upload + timeline of the persona's reports (plan Workflows B and E).
// Shows the real processing outcome of every upload: pages, chunks, status.

import { useCallback, useEffect, useState } from "react";
import { reportsApi, type ReportStatus } from "../api/reports";
import { usersApi } from "../api/users";
import { ReportStatusBadge } from "../components/ReportStatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useActiveUser } from "../context/UserContext";
import type { Report, ReportPage } from "../types";

export function UploadPage() {
  const { user, setUser } = useActiveUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReportStatus | null>(null);
  const [pages, setPages] = useState<Record<string, ReportPage[]>>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!user) return;
    reportsApi
      .list(user.id)
      .then(setReports)
      .catch((e) => setError((e as Error).message));
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = async (file: File) => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const status = await reportsApi.upload(user.id, file);
      setResult(status);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const acceptConsent = async () => {
    if (!user || !consentChecked) return;
    setConsentBusy(true);
    setError(null);
    try {
      const updated = await usersApi.consent(user.id);
      setUser(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConsentBusy(false);
    }
  };

  const togglePages = async (report: Report) => {
    if (pages[report.id]) {
      setPages((prev) => {
        const next = { ...prev };
        delete next[report.id];
        return next;
      });
      return;
    }
    try {
      const reportPages = await reportsApi.pages(report.id);
      setPages((prev) => ({ ...prev, [report.id]: reportPages }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!user) {
    return <EmptyState title="No persona selected" hint="Pick or create a persona first." />;
  }

  // Consent gate (plan Section 15.2): uploads stay locked until the persona
  // accepts the data-use statement.
  if (!user.consent_accepted) {
    return (
      <div className="space-y-6">
        <section className="max-w-xl space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-5">
          <h2 className="text-lg font-semibold text-amber-200">Data-use consent required</h2>
          <p className="text-sm leading-relaxed text-amber-100/90">
            Before uploading reports, this persona must accept the data-use
            statement: VitaGraph is an educational tool; uploads are stored
            locally and processed only for this persona; only synthetic or
            properly de-identified reports may be uploaded; everything can be
            deleted at any time; no data is used for diagnosis.
          </p>
          <label className="flex items-start gap-2 text-sm text-amber-100">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className="mt-1"
            />
            <span>
              I understand and accept the data-use statement for this demo
              persona.
            </span>
          </label>
          <button
            onClick={acceptConsent}
            disabled={!consentChecked || consentBusy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {consentBusy ? "Recording…" : "Accept and continue"}
          </button>
        </section>
        {error && <ErrorState message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="max-w-xl space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Upload a health report</h2>
        <p className="text-sm text-slate-400">
          PDF, up to 25 MB. The original file is preserved unchanged; the text is extracted,
          chunked, and indexed for retrieval within this persona only.
        </p>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 bg-slate-900/50 px-6 py-10 text-center hover:border-indigo-500">
          <span className="text-sm font-medium text-slate-300">
            {busy ? "Processing…" : "Choose a PDF report or drop it here"}
          </span>
          <span className="mt-1 text-xs text-slate-500">
            Synthetic or de-identified reports only
          </span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />
        </label>
      </section>

      {error && <ErrorState message={error} />}

      {result && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.status === "ready"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {result.status === "ready" ? (
            <p>
              Indexed successfully: {result.page_count} page(s), {result.chunk_count} evidence
              chunk(s).
            </p>
          ) : (
            <p>Processing failed: {result.error_message}</p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Report history</h2>
        {reports.length === 0 ? (
          <EmptyState
            title="No reports uploaded yet"
            hint="Upload the two synthetic sample PDFs from sample_data/ to try the system."
          />
        ) : (
          <ul className="grid gap-2">
            {reports.map((report) => (
              <li key={report.id} className="rounded-lg border border-slate-700 bg-slate-900">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {report.original_filename}
                      {report.version > 1 && (
                        <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                          v{report.version} (duplicate upload)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      uploaded {report.upload_time}
                      {report.page_count !== null && ` · ${report.page_count} page(s)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ReportStatusBadge status={report.status} />
                    <button
                      onClick={() => togglePages(report)}
                      className="text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                    >
                      {pages[report.id] ? "hide pages" : "view pages"}
                    </button>
                  </div>
                </div>
                {report.error_message && (
                  <p className="border-t border-slate-800 px-4 py-2 text-xs text-rose-300">
                    {report.error_message}
                  </p>
                )}
                {pages[report.id] && (
                  <div className="space-y-3 border-t border-slate-800 px-4 py-3">
                    {pages[report.id].map((page) => (
                      <div key={page.page_number}>
                        <p className="mb-1 text-xs text-slate-500">
                          Page {page.page_number} · {page.extraction_method} ·{" "}
                          {page.text_length} chars · {page.quality}
                        </p>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-400">
                          {page.extracted_text}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
