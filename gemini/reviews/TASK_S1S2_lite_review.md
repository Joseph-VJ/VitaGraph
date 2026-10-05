# Review: S1 lite + S2 lite round (merged at 1750c30)

**Result: accepted and merged.** Build passes, backend suite 213 passed (worktree needs `AI_SERVICE_API_KEY=test-placeholder-key`, no `.env` there), console clean, header 76 px on all 12 pages, ingestion show about 5 s per stage, PDF to Text and Image to Text work, three.js removed.

## Follow-ups handed to the next round (S3 / S4)
| # | Finding | Owner |
|---|---------|-------|
| 1 | Primary buttons with arrow icon are darker red than the reference | S3 part 1 |
| 2 | "Load demo cohort" wraps under "Choose file" | S3 part 1 |
| 3 | Image to Text idle status says "Ready" | S3 part 1 |
| 4 | OCR counter counts up for native-text PDFs; `"VG-2026-001"` fallback in `CinematicIngestionShow.tsx`; hex fallbacks; design audit not at 0 | S3 part 1 |
| 5 | Graph labels long and overlapping with real data | S4 part 1 |
| 6 | Subgraph rows wrap, show file names | S4 part 1 |
| 7 | Timeline "Indexed" tags black-filled (reference: light grey); Library SHA column wraps | S4 part 2 |
| 8 | README / CLAUDE.md / AGENTS.md / GEMINI.md / ui notes still describe the old design and 60 tests | S4 part 3 |
| 9 | Conversations (D1, D2, D6, D9, D11) not built yet | S3 parts 2 and 3 |

## Still open (not in this round)
Privacy fix F1 (persona check on report routes), frame images (owner, last), paid API key, key rotation (owner), push to GitHub (only when asked).
