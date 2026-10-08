"""In-process live channel from the model stream to the agent stream.

The harness reports a model step only when it ends. The loopback route sees the model's stream while it
is happening, so it publishes what it sees here, keyed by persona, and `agent_service` merges it into the
event stream the browser receives. One answering turn per persona at a time (the pool enforces that), so one
subscriber per persona is enough.

Events (dicts): {"kind": "model_start"} | {"kind": "reasoning", "delta"} | {"kind": "text", "delta"}
| {"kind": "model_end", "ms", "first_ms", "input_tokens", "output_tokens", "tool_calls", "finish"}
| {"kind": "model_error", "message"}
"""

from __future__ import annotations

import asyncio
from typing import Any

_subscribers: dict[str, asyncio.Queue] = {}


def subscribe(persona_id: str) -> asyncio.Queue:
    """Start receiving this persona's live events. Replaces any earlier subscriber."""
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers[persona_id] = queue
    return queue


def unsubscribe(persona_id: str, queue: asyncio.Queue) -> None:
    if _subscribers.get(persona_id) is queue:
        del _subscribers[persona_id]


def publish(persona_id: str | None, event: dict[str, Any]) -> None:
    """Hand an event to the persona's subscriber; silently dropped when nobody is listening."""
    queue = _subscribers.get(persona_id or "")
    if queue is not None:
        queue.put_nowait(event)
