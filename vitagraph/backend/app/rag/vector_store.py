"""Chroma vector-store operations (first-milestone store per the plan).

This module is the ONLY file that touches the vector store, so the planned
Haystack/Qdrant upgrade path is a contained change. Every stored vector
carries the chunk's metadata, and every read path MUST receive a user_id
filter — a query without one is a bug (fail closed, plan Section 5).
"""

from __future__ import annotations

import json
from typing import Callable

from app.core.config import settings
from app.rag import embedder

COLLECTION_NAME = "evidence"


def _collection():
    import chromadb

    client = chromadb.PersistentClient(path=str(settings.chroma_dir))
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def index_chunks(
    rows: list[dict], *, on_embedded: Callable[[], None] | None = None
) -> int:
    """Embed and index chunk rows from SQLite. Returns count indexed.

    Indexing is all-or-nothing per report: on failure the caller marks the
    report 'not indexed' instead of claiming readiness.
    """
    if not rows:
        return 0
    texts = [row["text"] for row in rows]
    vectors = embedder.embed_texts(texts)
    if on_embedded is not None:
        on_embedded()

    documents, metadatas, ids = [], [], []
    for row, vector in zip(rows, vectors):
        meta = json.loads(row["metadata"])
        meta["embedding_model"] = embedder.model_version()
        # Chroma metadata values must be scalars; NULLs become empty strings.
        meta = {k: ("" if v is None else v) for k, v in meta.items()}
        documents.append(row["text"])
        metadatas.append(meta)
        ids.append(row["id"])

    _collection().add(ids=ids, embeddings=vectors,
                      documents=documents, metadatas=metadatas)
    return len(rows)


def query_user_chunks(
    user_id: str, query_vector: list[float], top_k: int, report_id: str | None = None
) -> list[dict]:
    """Similarity search strictly within one user's evidence.

    Raises if user_id is missing — the retrieval filter is never optional.
    """
    if not user_id:
        raise ValueError("Retrieval without a user filter is forbidden (fail closed).")
    # The user filter is mandatory; a report filter only narrows it further.
    where: dict = {"user_id": {"$eq": user_id}}
    if report_id:
        where = {"$and": [where, {"report_id": {"$eq": report_id}}]}
    result = _collection().query(
        query_embeddings=[query_vector],
        n_results=top_k,
        where=where,
        include=["documents", "metadatas", "distances"],
    )
    hits = []
    for i, chunk_id in enumerate(result["ids"][0]):
        distance = result["distances"][0][i]
        hits.append({
            "chunk_id": chunk_id,
            "document": result["documents"][0][i],
            "metadata": result["metadatas"][0][i],
            # Cosine distance -> similarity in [0, 1] for display.
            "score": round(1.0 - float(distance), 4),
        })
    return hits


def delete_user_chunks(user_id: str) -> None:
    """Remove all vector entries belonging to a persona (deletion policy)."""
    if not user_id:
        raise ValueError("Deletion without a user filter is forbidden.")
    _collection().delete(where={"user_id": {"$eq": user_id}})


def delete_report_chunks(report_id: str) -> None:
    """Remove vector entries of one report (failed-ingestion cleanup)."""
    if not report_id:
        raise ValueError("Deletion without a report filter is forbidden.")
    _collection().delete(where={"report_id": {"$eq": report_id}})


def store_health() -> dict:
    """Public health probe for diagnostics endpoints (never exposes data)."""
    try:
        return {"status": "ok", "chunks": _collection().count()}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


def sample_embeddings(ids: list[str], n_values: int = 8) -> list[dict]:
    """Return the first n_values of the stored vector for each id (real values, for display)."""
    if not ids:
        return []
    got = _collection().get(ids=ids, include=["embeddings"])
    out = []
    for cid, vec in zip(got["ids"], got["embeddings"]):
        out.append({"chunk_id": cid, "dim": len(vec), "values": [round(float(v), 4) for v in vec[:n_values]]})
    return out


def collection_count() -> int:
    return _collection().count()
