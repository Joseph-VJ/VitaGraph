"""VitaGraph backend application entry point.

This file only creates the app, initializes the schema, and mounts routers.
All behavior lives in the service modules.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.routes import ai, graph, questions, reports, timeline, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_dirs()
    init_db()
    yield


app = FastAPI(
    title="VitaGraph API",
    description=(
        "Educational health-report organization and evidence-retrieval system. "
        "Not a diagnostic, treatment, or emergency service."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Local development origin only; tighten before any shared deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(reports.router)
app.include_router(questions.router)
app.include_router(timeline.router)
app.include_router(graph.router)
app.include_router(ai.router)


@app.get("/api/health")
def health() -> dict:
    """Local-core health: retrieval store reachable and service mode label."""
    from app.rag import vector_store

    return {
        "status": "ok",
        "retrieval_store": vector_store.store_health(),
        "ai_service": "enabled" if settings.allow_api else "disabled (offline mode)",
        "ai_service_model": settings.ai_service_model if settings.allow_api else "offline-fallback-composer",
        "embedding_model": settings.embedding_model_name,
    }
