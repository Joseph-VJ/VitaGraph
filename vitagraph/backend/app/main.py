"""VitaGraph backend application entry point.

This file only creates the app, initializes the schema, and mounts routers.
All behavior lives in the service modules.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.pool import RuntimePool, get_pool
from app.core.config import settings
from app.core.database import init_db
from app.routes import agent, ai, chat, demo, graph, jobs, llm_shim, questions, reports, timeline, tools, users

logger = logging.getLogger(__name__)


async def _reap_loop(pool: RuntimePool, interval: float) -> None:
    """Close idle agent runtimes every `interval` seconds until cancelled."""
    while True:
        await asyncio.sleep(interval)
        try:
            await pool.reap_idle()
        except Exception:
            logger.exception("Reaping idle agent runtimes failed")


def _warm_graphs() -> None:
    try:
        from app.graph import builder

        count = builder.warm_all_graphs()
        logger.info("Warmed %d persona graphs", count)
    except Exception:
        logger.exception("Warming persona graphs failed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_dirs()
    init_db()
    pool = get_pool()
    reaper = asyncio.create_task(_reap_loop(pool, 60.0))
    # Betweenness centrality takes seconds for a persona with many reports; do it once in the background
    # so the first visit to the Knowledge Graph or Insights page is as fast as every later one.
    threading.Thread(target=_warm_graphs, name="warm-graphs", daemon=True).start()
    try:
        yield
    finally:
        reaper.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await reaper
        await pool.close_all()


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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(reports.router)
app.include_router(questions.router)
app.include_router(chat.router)
app.include_router(agent.router)
app.include_router(llm_shim.router)
app.include_router(timeline.router)
app.include_router(graph.router)
app.include_router(ai.router)
app.include_router(jobs.router)
app.include_router(demo.router)
app.include_router(tools.router)


@app.get("/api/health")
def health() -> dict:
    """Local-core health: retrieval store reachable and service mode label."""
    from app.ingestion import chunker
    from app.rag import vector_store

    store_status = vector_store.store_health()
    is_ok = store_status.get("status") == "ok"

    return {
        "status": "ok" if is_ok else "degraded",
        "retrieval_store": store_status,
        "allow_api": settings.allow_api,
        "ai_service": "enabled" if settings.allow_api else "disabled (offline mode)",
        "ai_service_model": settings.effective_model if settings.allow_api else "offline-fallback-composer",
        "embedding_model": settings.embedding_model_name,
        "chunk_target_chars": chunker.CHUNK_TARGET_CHARS,
        "chunk_max_chars": chunker.CHUNK_MAX_CHARS,
    }
