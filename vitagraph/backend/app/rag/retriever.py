"""User-scoped retrieval that produces evidence hits.

Retrieval ALWAYS filters by the active user (plan Sections 5 and 10): the
user_id is mandatory and the request fails closed if it is missing. Hits
below the minimum evidence score are dropped so weak matches never
fabricate support for an answer.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.core.config import settings
from app.rag import embedder, vector_store


def retrieve(user_id: str, question: str, top_k: int | None = None) -> list[dict]:
    """Return evidence hits for a question, restricted to one user.

    Each hit carries chunk text plus the report-level metadata needed to
    build a citation card.
    """
    if not user_id:
        # Fail closed: an answer request must never proceed unfiltered.
        raise HTTPException(status_code=400, detail="User scope is required for retrieval.")

    k = top_k or settings.top_k_results
    query_vector = embedder.embed_query(question)
    hits = vector_store.query_user_chunks(user_id=user_id, query_vector=query_vector, top_k=k)

    kept = [hit for hit in hits if hit["score"] >= settings.min_evidence_score]

    # Enrich with report-level citation info from SQLite.
    from app.core.database import get_db

    report_ids = {hit["metadata"].get("report_id") for hit in kept}
    report_info: dict[str, dict] = {}
    with get_db() as db:
        for report_id in report_ids:
            row = db.execute(
                "SELECT id, original_filename, report_date FROM reports WHERE id = ?",
                (report_id,),
            ).fetchone()
            if row:
                report_info[report_id] = dict(row)

    for hit in kept:
        info = report_info.get(hit["metadata"].get("report_id"), {})
        hit["report_filename"] = info.get("original_filename", "unknown report")
        hit["report_date"] = info.get("report_date")

    return kept
