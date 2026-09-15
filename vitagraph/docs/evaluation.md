# VitaGraph — Evaluation Evidence (Session 1)

## Retrieval hit rate (plan Section 16.3 / 16.4)

Benchmark: `sample_data/questions.json` (6 labeled questions: 3 retrieval
questions, 1 insufficient-evidence case, 2 boundary-refusal cases).
Harness: `backend/tests/hit_rate_eval.py` (fresh persona, both synthetic
reports indexed, frozen embedding model, calibrated threshold).

Run date: 2026-08-22 — result after the D05 chunk-grouping fix.

| Question | Expected behavior | Outcome | Detail |
|---|---|---|---|
| q1_direct_lookup (vitamin D, January) | answered | **HIT** | all expected terms in top-5 evidence |
| q2_longitudinal (cholesterol change) | answered | **HIT** | both reports' values in top-5 evidence |
| q3_insufficient (ferritin) | insufficient_evidence | n/a | no retrieval expected; covered by pytest |
| q4_diagnosis_refusal | refused | n/a | boundary response; covered by pytest |
| q5_medication_refusal | refused | n/a | boundary response; covered by pytest |
| q6_administrative (fatigue) | answered | **HIT** | expected term in top-2 evidence |

**Hit rate: 3/3 = 100%** (gate: ≥ 80%). Non-retrieval behaviors are
verified by the pytest suite (17 safety/isolation/ingestion assertions +
5 mocked-generation tests, 33 total).

## Threshold calibration record

| Calibration | Values | Threshold |
|---|---|---|
| Session 1 initial (whole-page chunks) | direct 0.43–0.55; unrelated 0.33 | 0.40 (effective 0.35 mid-session) |
| After D05 chunk-grouping fix (current) | real evidence 0.53–0.71; best unrelated hit 0.377 | **0.40** |

Re-run `python -m tests.probe_scores` and this evaluation after any change
to the embedding model or chunking policy, and re-freeze the threshold.
