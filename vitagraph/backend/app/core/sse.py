"""SSE framing and keep-alive streaming utilities."""

from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncIterator

KEEPALIVE_SECONDS = 15.0


def frame(index: int, event_type: str, payload: dict, *, last: bool) -> str:
    event = {
        "index": f"{index:02d}",
        "stage": "done" if last else "generation",
        "description": payload.get("delta") or payload.get("thinking") or payload.get("message") or event_type,
        "subDescription": "",
        "latency": "",
        "timestamp": time.time(),
        "metadata": payload,
        "event_type": event_type,
        "event": event_type,
    }
    return f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


async def sse_stream(
    events: AsyncIterator[tuple[str, dict]],
    keepalive_seconds: float = KEEPALIVE_SECONDS,
) -> AsyncIterator[str]:
    """Turn (event_type, payload) tuples into SSE frames; keep the connection alive while the agent is silent."""
    index = 0
    pending: asyncio.Future | None = None
    try:
        yield ": connected to agent stream\n\n"
        pending = asyncio.ensure_future(events.__anext__())
        while True:
            done, _ = await asyncio.wait({pending}, timeout=keepalive_seconds)
            if not done:
                yield ": keep-alive\n\n"
                continue
            try:
                event_type, payload = pending.result()
            except StopAsyncIteration:
                pending = None
                return
            index += 1
            last = event_type in ("done", "error")
            yield frame(index, "completed" if event_type == "done" else event_type, payload, last=last)
            if last:
                pending = None
                return
            pending = asyncio.ensure_future(events.__anext__())
    finally:
        if pending is not None:
            if not pending.done():
                pending.cancel()
            await asyncio.wait({pending})
        await events.aclose()
