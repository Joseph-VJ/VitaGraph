# VitaGraph API Reference

Base URL: `http://localhost:8000`  ·  Interactive docs: `http://localhost:8000/docs` (Swagger UI)

VitaGraph is an educational health-report RAG system. All data is synthetic.
Every query is fail-closed user-isolated. Answers are evidence-grounded and cite
the exact report page and chunk that supports them.

## Error model (consistent across the API)

| Status | Meaning |
|---|---|
| 200/201 | Success |
| 404 | Target not found (unknown user / report / route) — `{"detail": "User not found."}` |
| 422 | Request validation failed (missing/too-short field) — `{"detail": [ {loc, msg, type} ]}` |
| 403 | Consent not accepted before storage |

---

## Health

`GET /api/health`

Response:
```json
{
  "status": "ok",
  "retrieval_store": { "status": "ok", "chunks": 104 },
  "ai_service": "enabled",
  "ai_service_model": "deepseek-v4-flash",
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2"
}
```

## Users

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/users` | - | list of users |
| `POST /api/users` | `{"display_label":"..."}` | 201 created user |
| `POST /api/users/{id}/consent` | - (no body) | user with `consent_accepted: true` |
| `DELETE /api/users/{id}` | - | `{"deleted":"...","records":"reports, pages, chunks, ..."}` (cascade) |

Errors: missing `display_label` → 422; unknown id → 404.

## Reports

| Method & path | Params | Returns |
|---|---|---|
| `POST /api/reports/upload` | multipart: `file` (PDF) + `user_id` | 201 `{id, status, page_count, chunk_count, version}` |
| `GET /api/reports?user_id={id}` | query `user_id` | list of reports |
| `GET /api/reports/{report_id}/status` | - | `{id, status, page_count, chunk_count, error_message}` |
| `GET /api/reports/{report_id}/pages` | - | list of `{page_number, extraction_method, text_length, quality, extracted_text}` |
| `GET /api/reports/{user_id}/trends?test=hemoglobin` | query `test` (case-insensitive) | `{test_name, unit, points[], trend_direction, start_value, latest_value}` |

Errors: missing `file`/`user_id` → 422; unknown user/report → 404.

## Questions (the working RAG model)

`POST /api/questions`  body `{"user_id":"...", "text":"..."}` (text ≥ 3 chars)

Response shape:
```json
{
  "question_id": "qst_...",
  "classification": "educational | out_of_bounds",
  "status": "answered | insufficient_evidence | refused",
  "summary_text": "...",
  "evidence": [ { "chunk_id": "...", "report_filename": "...", "page_number": 1, "score": 0.654, "snippet": "...", "report_date": "..." } ],
  "limitations_text": "...",
  "safety_text": "...",
  "ai_service_status": "offline-fallback-composer | ...",
  "safety_status": "ok"
}
```

Observed behaviors (verified):
- Direct fact question → `status: answered`, evidence with `score ≈ 0.65`.
- Question not present in reports → `status: insufficient_evidence`, `evidence: []`.
- Diagnosis/medication request → `status: refused` before retrieval (safety boundary).

Errors: empty text → 422 (`String should have at least 3 characters`); unknown user → 404.

## Knowledge Graph

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/graph/{user_id}` | - | `{nodes[], edges[], metrics{total_nodes,total_edges,communities_count,modularity,density}, active_concepts[]}` |
| `POST /api/graph/subgraph` | `{"user_id":"...","chunk_ids":[...]}` | same shape, question-conditioned + `active_concepts` |

Node types: `report`, `chunk`, `test`, `measurement`, `category`.
Each node has `betweenness` and `community` for the analytics panel.

## Timeline (traceable activity record)

`GET /api/timeline/{user_id}` → list of events:
`{id, user_id, event_type, timestamp, payload}` where `event_type` ∈
`persona_created`, `consent_accepted`, `report_uploaded`, `report_indexed`,
`question_asked`, `answer_generated`, `report_deleted`.

---

## Verified run evidence (2026-09-09)

- 38/38 backend tests pass (`pytest tests`).
- Full loop (fresh user → upload `synthetic_panel_2025-06-20.pdf` → ask question →
  `answered` with 5 cited evidence chunks, top score 0.654 → graph 34 nodes / 36 edges,
  modularity 0.584 → subgraph activation [HDL Cholesterol, Hemoglobin, LDL Cholesterol,
  Vitamin B12, Vitamin D] → timeline 6 events → cascade delete).
- Probe report: `backend/verification/api_probe_report.txt`
- E2E loop report: `backend/verification/e2e_loop_report.txt`
