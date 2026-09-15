"""Sentence-transformers embedding (frozen model version).

The model is loaded lazily on first use so that simply importing the app
does not download weights. The model name is part of the frozen evaluation
setup and is stored with every chunk's reproducibility metadata.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings


@lru_cache(maxsize=1)
def _model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.embedding_model_name)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    return _model().encode(texts, batch_size=32, show_progress_bar=False).tolist()


def embed_query(text: str) -> list[float]:
    return _model().encode(text, show_progress_bar=False).tolist()


def model_version() -> str:
    return settings.embedding_model_name
