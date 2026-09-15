import React, { useState } from "react";
import {
  Dropzone,
  PipelineStepper,
  QualityBar,
  ManifestRow,
  QuarantineRow,
  Badge,
  Marginalia,
  Button,
} from "../components/gallery";
import { reportsApi, type ReportStatus } from "../api/reports";

interface QualityRowData {
  page: number;
  characters: string;
  method: "native" | "ocr";
  quality: number;
  notes: string;
}

const defaultQualityRows: QualityRowData[] = [
  { page: 1, characters: "2,418", method: "native", quality: 96, notes: "Good structure" },
  { page: 2, characters: "1,983", method: "native", quality: 91, notes: "Tables detected" },
  { page: 3, characters: "2,105", method: "ocr", quality: 74, notes: "Scanned page (OCR)" },
  { page: 4, characters: "1,764", method: "native", quality: 88, notes: "Good structure" },
];

export const UploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, setUploadStatus] = useState<ReportStatus | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsUploading(true);

    try {
      // Try live backend or fallback gracefully
      const res = await reportsApi.upload("VG-2026-001", selectedFile);
      setUploadStatus(res);
    } catch (err: any) {
      console.warn("Upload API unavailable, using offline preview state:", err);
      setUploadStatus({
        id: "rep_" + Math.random().toString(36).substring(2, 9),
        status: "completed",
        page_count: 4,
        chunk_count: 24,
        error_message: null,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Screen-level Marginalia top-right (§9.2: "Same documents. Deeper insights.") */}
      <div className="flex justify-end -mt-2 -mb-2">
        <Marginalia
          text="Same documents. Deeper insights."
          sketch="compass"
        />
      </div>

      {/* Main Grid: Left Stage (flex-1) + Right Rail (360px) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Main Column */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          {/* Dropzone (§7.11) */}
          <Dropzone onFileSelect={handleFileSelect} />

          {/* Ingestion Pipeline Stepper Card (§7.12, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--line-faint)]">
              <div>
                <h3 className="type-title text-[var(--bone)]">
                  Processing your document step by step
                </h3>
                <p className="type-meta text-[var(--dim)] mt-0.5">
                  Full text extraction, vector embedding, and entity linking
                </p>
              </div>
              <Badge variant={isUploading ? "ochre" : "verdigris"}>
                {isUploading ? "Ingesting…" : "Completed"}
              </Badge>
            </div>

            {/* Stepper (§7.12) */}
            <PipelineStepper />
          </div>

          {/* Page Quality Assessment Table (§9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="type-title text-[var(--bone)]">
                  Page quality assessment
                </h3>
                <p className="type-meta text-[var(--dim)] mt-0.5">
                  Resolution and OCR confidence per ingested sheet
                </p>
              </div>
              <Badge variant="dim">4 pages analyzed</Badge>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--line-faint)]">
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Page</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Characters</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Method</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Quality</th>
                    <th className="type-label text-[var(--dim)] py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-faint)]">
                  {defaultQualityRows.map((row) => (
                    <tr
                      key={row.page}
                      className="hover:bg-[var(--ink-700)]/40 transition-colors duration-[120ms] ease-out"
                    >
                      <td className="type-mono-sm text-[var(--bone)] py-3 px-3">
                        Page {row.page}
                      </td>
                      <td className="type-mono-sm text-[var(--dim)] py-3 px-3">
                        {row.characters}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={row.method === "native" ? "verdigris" : "ochre"}>
                          {row.method}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <QualityBar percentage={row.quality} method={row.method} />
                          <span className="type-mono-sm text-[var(--bone)]">
                            {row.quality}%
                          </span>
                        </div>
                      </td>
                      <td className="type-meta text-[var(--dim)] py-3 px-3">
                        {row.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footnote */}
            <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex items-center justify-between">
              <span className="type-quote-sm text-[var(--dim)] italic">
                3 native pages (average 92% confidence) · 1 OCR scanned page (74% confidence)
              </span>
              <span className="type-mono-sm text-[var(--faint)]">
                Engine: Surya-OCR v0.4
              </span>
            </div>
          </div>
        </div>

        {/* Right Rail (360px) */}
        <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-6">
          {/* File Manifest Card (§7.14, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--line-faint)]">
              <h3 className="type-title text-[var(--bone)]">File manifest</h3>
              <Badge variant="verdigris">Verified</Badge>
            </div>

            <div className="flex flex-col">
              <ManifestRow
                label="File name"
                value={file?.name || "synthetic_panel_2025-06-20.pdf"}
              />
              <ManifestRow
                label="SHA-256"
                value="8f4a9c0d2b7e6f1c9d4a1e0b6c21"
                copyable
              />
              <ManifestRow
                label="File size"
                value={file ? `${(file.size / 1024).toFixed(0)} KB` : "214 KB"}
              />
              <ManifestRow label="Page count" value="4 pages" />
              <ManifestRow label="Date parsed" value="2025-06-20 (parsed)" />
              <ManifestRow label="Document type" value="Lab report (panel)" />
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--line-faint)] flex justify-end">
              <Button variant="ghost" className="text-xs h-8">
                Download JSON metadata
              </Button>
            </div>
          </div>

          {/* Quarantine Card (§7.15, §9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--line-faint)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--madder)]" />
                <h3 className="type-title text-[var(--bone)]">Quarantined files (1)</h3>
              </div>
              <Badge variant="madder">Action required</Badge>
            </div>

            <QuarantineRow
              filename="corrupted_report_2025-06-18.pdf"
              reason="Corrupted PDF stream at xref table · 0 text streams found"
              onRetry={() => console.log("Retrying corrupted file")}
            />
          </div>

          {/* Need help? card (§9.2) */}
          <div className="bg-[var(--ink-800)] border border-[var(--line-strong)] rounded-[var(--r-14)] p-5">
            <h3 className="type-title text-[var(--bone)] mb-3 pb-2 border-b border-[var(--line-faint)]">
              Need help?
            </h3>
            <ul className="space-y-2">
              {[
                { title: "Supported document formats", desc: "PDF 1.4+, scanned images, FHIR bundles" },
                { title: "OCR accuracy and language models", desc: "Dual engine with layout detection" },
                { title: "Knowledge graph extraction pipeline", desc: "Entity resolution and ontology linking" },
                { title: "Data privacy & local storage", desc: "Zero telemetry leaves local workstation" },
              ].map((item, idx) => (
                <li
                  key={idx}
                  className="p-2.5 rounded-[var(--r-6)] border border-transparent hover:border-[var(--line-strong)] hover:bg-[var(--ink-700)]/30 transition-all duration-[120ms] ease-out cursor-pointer"
                >
                  <div className="type-body font-medium text-[var(--bone)] text-xs flex items-center justify-between">
                    <span>{item.title}</span>
                    <span className="text-[var(--dim)]">›</span>
                  </div>
                  <div className="type-meta text-[var(--dim)] text-[11px] mt-0.5">
                    {item.desc}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
