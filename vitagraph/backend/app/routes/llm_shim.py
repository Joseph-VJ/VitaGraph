"""Loopback chat-completions endpoint for the agent harness.

The harness only speaks chat-completions. When the model endpoint speaks the
Responses contract, the agent worker is pointed at this route instead. It is
reachable only from this machine and only with the per-process token, and it
holds the real key, so the worker process never sees it.
"""

from __future__ import annotations

import hmac
import json
import logging
import time
from typing import Any, AsyncIterator

import openai
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.config import settings
from app.services import live_bus, responses_adapter as adapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/llm/v1", tags=["internal"], include_in_schema=False)

_LOOPBACK = {"127.0.0.1", "::1", "localhost", "testclient"}


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": {"message": message, "type": "vitagraph_shim_error"}}, status_code=status)


def _authorise(request: Request) -> tuple[bool, str | None]:
    """(allowed, persona). Loopback callers only, and only with a token minted by this process."""
    host = request.client.host if request.client else ""
    if host not in _LOOPBACK:
        return False, None
    header = request.headers.get("authorization", "")
    token = header[7:] if header.lower().startswith("bearer ") else ""
    return adapter.persona_from_token(token)


async def _observed(chunks: AsyncIterator[dict], persona: str | None) -> AsyncIterator[dict]:
    """Pass chunks through while telling the live channel what the model is doing, as it happens."""
    started = time.monotonic()
    first_ms: int | None = None
    tool_indexes: set[int] = set()
    usage: dict | None = None
    finish: str | None = None
    try:
        async for chunk in chunks:
            for choice in chunk.get("choices", []):
                delta = choice.get("delta") or {}
                active = False
                if delta.get("reasoning_content"):
                    live_bus.publish(persona, {"kind": "reasoning", "delta": delta["reasoning_content"]})
                    active = True
                if delta.get("content"):
                    live_bus.publish(persona, {"kind": "text", "delta": delta["content"]})
                    active = True
                for call in delta.get("tool_calls") or []:
                    tool_indexes.add(call.get("index", 0))
                    active = True
                if active and first_ms is None:
                    first_ms = int((time.monotonic() - started) * 1000)
                finish = choice.get("finish_reason") or finish
            usage = chunk.get("usage") or usage
            yield chunk
    except Exception as exc:
        live_bus.publish(persona, {"kind": "model_error", "message": str(exc)[:300]})
        raise
    live_bus.publish(
        persona,
        {
            "kind": "model_end",
            "ms": int((time.monotonic() - started) * 1000),
            "first_ms": first_ms,
            "input_tokens": (usage or {}).get("prompt_tokens"),
            "output_tokens": (usage or {}).get("completion_tokens"),
            "tool_calls": len(tool_indexes),
            "finish": finish,
        },
    )


async def _sse(chunks: AsyncIterator[dict]) -> AsyncIterator[str]:
    try:
        async for chunk in chunks:
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
    except Exception as exc:  # the head was already sent, so report inside the stream
        logger.warning("Model stream failed: %s", exc)
        yield f"data: {json.dumps({'error': {'message': str(exc)[:300]}})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat/completions")
async def chat_completions(request: Request) -> Any:
    allowed, persona = _authorise(request)
    if not allowed:
        return _error(401, "Not allowed.")
    if settings.api_format != "responses":
        return _error(404, "The model endpoint does not need translation.")
    try:
        body = await request.json()
        messages = body["messages"]
    except Exception:
        return _error(400, "Malformed request.")

    model = body.get("model") or settings.effective_model
    live_bus.publish(persona, {"kind": "model_start"})
    try:
        client, response = await adapter.open_stream(
            messages,
            model=model,
            tools=body.get("tools"),
            tool_choice=body.get("tool_choice"),
            max_tokens=body.get("max_tokens") or body.get("max_completion_tokens"),
        )
    except openai.APIStatusError as exc:
        live_bus.publish(persona, {"kind": "model_error", "message": str(exc)[:300]})
        return _error(exc.status_code, str(exc))
    except Exception as exc:
        logger.warning("Model endpoint unreachable: %s", exc)
        live_bus.publish(persona, {"kind": "model_error", "message": "The model endpoint is unreachable."})
        return _error(502, f"Model endpoint unreachable: {exc}")

    chunks = _observed(adapter.iter_chunks(client, response, model), persona)
    if body.get("stream"):
        return StreamingResponse(_sse(chunks), media_type="text/event-stream")
    try:
        collected = [chunk async for chunk in chunks]
    except Exception as exc:
        return _error(502, str(exc)[:300])
    result = adapter.aggregate_completion(collected, model)
    result["created"] = result.get("created") or int(time.time())
    return JSONResponse(result)
