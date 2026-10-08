# Session N6 Summary: AI Node Summary Frontend Writing State

**Task**: Session N6 (Frontend, small): Show that the AI is writing (Item F1 from N3/N4 review)  
**Branch**: `feature/ai-node-summary`  
**Date**: 2026-10-08  

---

## 1. Work Performed

### Fix for Dead Gap While AI Writes (Item F1)
- In `site design/src/components/graph/NodeSummary.tsx`, replaced the single `s.phase === "reading" && !s.text` condition with a multi-phase `waitMessage` handler rendering `<p className="vg-ai-wait" data-testid="node-summary-wait">` whenever `!s.text && (s.phase === "reading" || s.phase === "writing" || s.phase === "checking")`.
- Exact wording based on real server phase:
  - `reading`, no sources yet: `Finding the passages behind this dot…`
  - `reading`, sources known: `Reading N passages from M files…`
  - `writing`, no text yet: `Writing the summary from N passages…`
  - `checking`, no text yet: `Checking it against your files…`
- As soon as the first `text_delta` arrives, `s.text` becomes non-empty and the wait line seamlessly disappears, replaced by the streaming text and blinking red caret.
- Sources list remains continuously visible beneath the wait line.
- Red label indicator pulses via `.vg-ai-label.is-busy i` while busy, and does not pulse when reduced motion is preferred.

---

## 2. Command Output Verbatim

### `npm run build`
```text
> vitagraph-site-design@0.0.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 356 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                          0.71 kB │ gzip:   0.44 kB
dist/assets/archivo-latin-600-normal-3BBy0ZsW.woff2     13.82 kB
dist/assets/archivo-latin-800-normal-cB6v3kRN.woff2     14.41 kB
dist/assets/archivo-latin-400-normal-C81ewxNO.woff2     14.70 kB
dist/assets/archivo-latin-600-normal-DwYieO8P.woff      18.20 kB
dist/assets/archivo-latin-800-normal-DZa_k145.woff      18.90 kB
dist/assets/archivo-latin-400-normal-Bl602Mgc.woff      18.97 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs              1,264.34 kB
dist/assets/index-B7ka3RjR.css                          93.80 kB │ gzip:  17.32 kB
dist/assets/index-DV7cD2NL.js                        1,114.46 kB │ gzip: 334.54 kB

✓ built in 671ms
```

### `npm run audit:design`
```text
> vitagraph-site-design@0.0.0 audit:design
> node scripts/audit-design.mjs

Checked 61 files: 0 error(s), 0 pending.
```

### `python scripts/plan/secret_scan.py`
```text
RESULT: PASS
```

### Real Backend 10-Second Sampling on `usr_7c9aaa7159d6` (Hemoglobin, "Write again")
| Time (s) | Wait Line Text | Source Rows | Text Length | Phase Done |
|---|---|---|---|---|
| 0.0 s | `Finding the passages behind this dot…` | 2 | 0 chars | False |
| 0.5 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 1.1 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 1.6 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 2.1 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 2.6 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 3.2 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 3.7 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 4.2 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 4.7 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 5.2 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 5.8 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 6.3 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 6.8 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 7.4 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 7.9 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 8.4 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 8.9 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 9.4 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |
| 10.0 s | `Writing the summary from 2 passages…` | 2 | 0 chars | False |

- Total samples: 20
- Dead gaps detected (no text, no wait line, not done): **0**

### Mocked Route Verification (Verification Item 3)
- `status writing` + `sources` (2 sources, no text): shows `Writing the summary from 2 passages…` (PASS).
- `status checking` (no text): shows `Checking it against your files…` (PASS).

### Regression Verification Suite (Cases 1–15)
- All 15 earlier test cases pass cleanly (console 0 errors/warnings).

### Screenshot Evidence
- Screenshot with the writing line visible: `gemini/shots/N6-writing-1440.png` showing `Writing the summary from 2 passages…` under the AI SUMMARY header alongside 2 source rows.
