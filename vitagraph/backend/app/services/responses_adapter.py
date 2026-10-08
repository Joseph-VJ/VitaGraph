"""Adapter between chat-completions callers and a Responses-API endpoint.

The rest of the backend (chat, ask, the agent harness) speaks the chat-completions
contract. When `settings.api_format == "responses"` the model endpoint speaks the
Responses contract instead (`POST <base>/responses`, SSE events such as
`response.output_text.delta`). This module translates in both directions:

  * `build_request`      chat messages/tools  ->  Responses request body
  * `ChunkTranslator`    Responses SSE events ->  chat.completion.chunk dicts
  * `ResponsesClient`    drop-in for AsyncOpenAI (`client.chat.completions.create`)
  * `complete_sync`      one blocking, non-streamed call (ask path, connection test)

No provider or model name is hard-coded; everything comes from `settings`.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
import uuid
from types import SimpleNamespace
from typing import Any, AsyncIterator

import httpx
import openai
from openai.types.chat import ChatCompletion, ChatCompletionChunk

from app.core.config import settings

# Random per-process secret. The agent worker authenticates to the loopback
# translation route with it, so the real model key never leaves this process.
SHIM_TOKEN = secrets.token_urlsafe(32)


def shim_token_for(persona_id: str) -> str:
    """Token the persona's agent worker uses; it proves the call came from our worker and names the persona."""
    signature = hmac.new(SHIM_TOKEN.encode(), persona_id.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{persona_id}.{signature}"


def persona_from_token(token: str) -> tuple[bool, str | None]:
    """(valid, persona). The bare process token is valid too (persona unknown)."""
    if token and hmac.compare_digest(token, SHIM_TOKEN):
        return True, None
    persona, _, _ = token.rpartition(".")
    if persona and hmac.compare_digest(token, shim_token_for(persona)):
        return True, persona
    return False, None


class ResponsesStreamError(RuntimeError):
    """The endpoint reported a failure inside an otherwise successful stream."""


# ---------------------------------------------------------------- request side


def responses_url(base: str | None = None) -> str:
    base = (base if base is not None else settings.effective_base_url).rstrip("/")
    return base if base.endswith("/responses") else f"{base}/responses"


def request_headers(api_key: str, *, stream: bool, request_id: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream" if stream else "application/json",
    }
    if request_id:
        headers["X-Request-Id"] = request_id
    return headers


def _text_of(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for part in content:
        if isinstance(part, dict) and part.get("type") in ("text", "input_text", "output_text"):
            parts.append(str(part.get("text", "")))
    return "\n".join(p for p in parts if p)


def _user_content(content: Any) -> Any:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    parts: list[dict[str, Any]] = []
    for part in content:
        if not isinstance(part, dict):
            continue
        kind = part.get("type")
        if kind in ("text", "input_text"):
            parts.append({"type": "input_text", "text": str(part.get("text", ""))})
        elif kind == "image_url":
            image = part.get("image_url")
            url = image.get("url") if isinstance(image, dict) else image
            if url:
                parts.append({"type": "input_image", "image_url": url})
    return parts


def _tool_choice(choice: Any) -> Any:
    if isinstance(choice, dict):
        name = (choice.get("function") or {}).get("name") or choice.get("name")
        return {"type": "function", "name": name} if name else "auto"
    return choice


def build_request(
    messages: list[dict[str, Any]],
    *,
    model: str,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: Any = None,
    stream: bool = True,
    max_tokens: int | None = None,
    reasoning_effort: str | None = None,
) -> dict[str, Any]:
    """Translate chat-completions messages and tools into a Responses request body.

    `reasoning_effort` overrides the configured level for this one call (and then asks for no summary).
    """
    instructions: list[str] = []
    items: list[dict[str, Any]] = []
    for message in messages:
        role = message.get("role")
        if role in ("system", "developer"):
            text = _text_of(message.get("content"))
            if text:
                instructions.append(text)
        elif role == "user":
            items.append({"role": "user", "content": _user_content(message.get("content"))})
        elif role == "assistant":
            text = _text_of(message.get("content"))
            if text:
                items.append({"role": "assistant", "content": text})
            for call in message.get("tool_calls") or []:
                function = call.get("function") or {}
                items.append(
                    {
                        "type": "function_call",
                        "call_id": call.get("id") or f"call_{uuid.uuid4().hex[:12]}",
                        "name": function.get("name", ""),
                        "arguments": function.get("arguments") or "{}",
                    }
                )
        elif role == "tool":
            items.append(
                {
                    "type": "function_call_output",
                    "call_id": message.get("tool_call_id", ""),
                    "output": _text_of(message.get("content")),
                }
            )

    body: dict[str, Any] = {
        "model": model,
        "input": items,
        "stream": stream,
        "temperature": settings.model_temperature,
        "top_p": settings.model_top_p,
        "max_output_tokens": max_tokens or settings.model_max_output_tokens,
    }
    if instructions:
        body["instructions"] = "\n\n".join(instructions)
    effort = (reasoning_effort or settings.model_reasoning_effort).strip()
    if effort:
        body["reasoning"] = {"effort": effort}
        summary = "" if reasoning_effort else settings.model_reasoning_summary.strip()
        if summary:
            body["reasoning"]["summary"] = summary
    if tools:
        body["tools"] = [
            {
                "type": "function",
                "name": (tool.get("function") or {}).get("name", ""),
                "description": (tool.get("function") or {}).get("description", ""),
                "parameters": (tool.get("function") or {}).get("parameters")
                or {"type": "object", "properties": {}},
            }
            for tool in tools
            if tool.get("type") == "function"
        ]
        if tool_choice is not None:
            body["tool_choice"] = _tool_choice(tool_choice)
    return body


# --------------------------------------------------------------- response side


class ChunkTranslator:
    """Turns Responses SSE events into chat.completion.chunk dicts."""

    def __init__(self, model: str) -> None:
        self.id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
        self.created = int(time.time())
        self.model = model
        self._by_output: dict[int, int] = {}
        self._by_item: dict[str, int] = {}
        self._with_arguments: set[int] = set()
        self._tool_count = 0
        self.finished = False

    def _chunk(self, delta: dict[str, Any], finish: str | None = None, usage: dict | None = None) -> dict:
        chunk: dict[str, Any] = {
            "id": self.id,
            "object": "chat.completion.chunk",
            "created": self.created,
            "model": self.model,
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
        }
        if usage:
            chunk["usage"] = usage
        return chunk

    def _tool_index(self, data: dict[str, Any]) -> int | None:
        item_id = data.get("item_id")
        if item_id in self._by_item:
            return self._by_item[item_id]
        return self._by_output.get(data.get("output_index"))

    def _arguments_chunk(self, index: int, arguments: str) -> dict:
        self._with_arguments.add(index)
        return self._chunk({"tool_calls": [{"index": index, "function": {"arguments": arguments}}]})

    def translate(self, event: str | None, data: dict[str, Any]) -> list[dict]:
        kind = data.get("type") or event or ""
        out: list[dict] = []

        if kind == "response.output_text.delta":
            delta = data.get("delta")
            if delta:
                out.append(self._chunk({"content": delta}))

        elif kind in ("response.reasoning_summary_text.delta", "response.reasoning_text.delta"):
            delta = data.get("delta")
            if delta:
                out.append(self._chunk({"reasoning_content": delta}))

        elif kind == "response.output_item.added":
            item = data.get("item") or {}
            if item.get("type") == "function_call":
                index = self._tool_count
                self._tool_count += 1
                self._by_output[data.get("output_index")] = index
                if item.get("id"):
                    self._by_item[item["id"]] = index
                call_id = item.get("call_id") or item.get("id") or f"call_{index}"
                out.append(
                    self._chunk(
                        {
                            "tool_calls": [
                                {
                                    "index": index,
                                    "id": call_id,
                                    "type": "function",
                                    "function": {"name": item.get("name", ""), "arguments": ""},
                                }
                            ]
                        }
                    )
                )

        elif kind == "response.function_call_arguments.delta":
            index = self._tool_index(data)
            if index is not None and data.get("delta"):
                out.append(self._arguments_chunk(index, data["delta"]))

        elif kind in ("response.function_call_arguments.done", "response.output_item.done"):
            item = data.get("item") or {}
            if kind == "response.output_item.done" and item.get("type") != "function_call":
                return out
            index = self._tool_index({**data, "item_id": data.get("item_id") or item.get("id")})
            arguments = data.get("arguments") or item.get("arguments")
            if index is not None and arguments and index not in self._with_arguments:
                out.append(self._arguments_chunk(index, arguments))

        elif kind in ("response.completed", "response.incomplete"):
            response = data.get("response") or {}
            usage = response.get("usage") or {}
            finish = "tool_calls" if self._tool_count else ("length" if kind.endswith("incomplete") else "stop")
            counted = {
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "total_tokens": usage.get("total_tokens", usage.get("input_tokens", 0) + usage.get("output_tokens", 0)),
            }
            self.finished = True
            out.append(self._chunk({}, finish=finish, usage=counted if usage else None))

        elif kind in ("response.failed", "error"):
            error = data.get("error") or (data.get("response") or {}).get("error") or {}
            message = error.get("message") if isinstance(error, dict) else str(error)
            raise ResponsesStreamError(message or data.get("message") or "The model endpoint reported an error.")

        return out


_STATUS_ERRORS: dict[int, type[openai.APIStatusError]] = {
    400: openai.BadRequestError,
    401: openai.AuthenticationError,
    403: openai.PermissionDeniedError,
    404: openai.NotFoundError,
    429: openai.RateLimitError,
}


def status_error(response: httpx.Response, body: bytes) -> openai.APIStatusError:
    """Build the matching openai exception so existing fallback/retry code keeps working."""
    parsed: Any = None
    message = f"HTTP {response.status_code}"
    try:
        parsed = json.loads(body.decode("utf-8", "replace"))
        error = parsed.get("error") if isinstance(parsed, dict) else None
        if isinstance(error, dict) and error.get("message"):
            message = f"{error['message']} (HTTP {response.status_code})"
        elif isinstance(error, str):
            message = f"{error} (HTTP {response.status_code})"
    except Exception:
        text = body.decode("utf-8", "replace").strip()
        if text:
            message = f"{text[:200]} (HTTP {response.status_code})"
    cls = _STATUS_ERRORS.get(response.status_code)
    if cls is None:
        cls = openai.InternalServerError if response.status_code >= 500 else openai.APIStatusError
    return cls(message, response=response, body=parsed)


def _timeout() -> httpx.Timeout:
    base = float(settings.ai_service_timeout_seconds)
    return httpx.Timeout(connect=base, read=max(base, 180.0), write=base, pool=base)


async def open_stream(
    messages: list[dict[str, Any]],
    *,
    model: str,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: Any = None,
    max_tokens: int | None = None,
    reasoning_effort: str | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[httpx.AsyncClient, httpx.Response]:
    """Send the request and return once the response head is in; raises on an HTTP error status."""
    body = build_request(
        messages, model=model, tools=tools, tool_choice=tool_choice, stream=True, max_tokens=max_tokens,
        reasoning_effort=reasoning_effort,
    )
    client = httpx.AsyncClient(timeout=_timeout(), transport=transport)
    try:
        request = client.build_request(
            "POST",
            responses_url(),
            headers=request_headers(settings.effective_api_key, stream=True),
            json=body,
        )
        response = await client.send(request, stream=True)
        if response.status_code >= 400:
            payload = await response.aread()
            await response.aclose()
            raise status_error(response, payload)
        return client, response
    except BaseException:
        await client.aclose()
        raise


async def iter_chunks(client: httpx.AsyncClient, response: httpx.Response, model: str) -> AsyncIterator[dict]:
    """Yield chat.completion.chunk dicts and always close the connection."""
    translator = ChunkTranslator(model)
    event: str | None = None
    try:
        async for line in response.aiter_lines():
            if not line:
                event = None
                continue
            if line.startswith("event:"):
                event = line[6:].strip()
                continue
            if not line.startswith("data:"):
                continue
            raw = line[5:].strip()
            if raw == "[DONE]":
                break
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(data, dict):
                continue
            for chunk in translator.translate(event, data):
                yield chunk
        if not translator.finished:
            yield translator._chunk({}, finish="stop")
    finally:
        await response.aclose()
        await client.aclose()


async def stream_chunks(
    messages: list[dict[str, Any]],
    *,
    model: str,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: Any = None,
    max_tokens: int | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> AsyncIterator[dict]:
    client, response = await open_stream(
        messages, model=model, tools=tools, tool_choice=tool_choice, max_tokens=max_tokens, transport=transport
    )
    async for chunk in iter_chunks(client, response, model):
        yield chunk


def aggregate_completion(chunks: list[dict], model: str) -> dict:
    """Fold streamed chunks into one chat.completion dict."""
    content: list[str] = []
    reasoning: list[str] = []
    calls: dict[int, dict[str, Any]] = {}
    finish = "stop"
    usage: dict | None = None
    for chunk in chunks:
        usage = chunk.get("usage") or usage
        for choice in chunk.get("choices", []):
            delta = choice.get("delta") or {}
            if delta.get("content"):
                content.append(delta["content"])
            if delta.get("reasoning_content"):
                reasoning.append(delta["reasoning_content"])
            for call in delta.get("tool_calls") or []:
                slot = calls.setdefault(
                    call["index"], {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                )
                slot["id"] = call.get("id") or slot["id"]
                function = call.get("function") or {}
                slot["function"]["name"] += function.get("name") or ""
                slot["function"]["arguments"] += function.get("arguments") or ""
            if choice.get("finish_reason"):
                finish = choice["finish_reason"]
    message: dict[str, Any] = {"role": "assistant", "content": "".join(content) or None}
    if reasoning:
        message["reasoning_content"] = "".join(reasoning)
    if calls:
        message["tool_calls"] = [calls[i] for i in sorted(calls)]
    result: dict[str, Any] = {
        "id": chunks[0]["id"] if chunks else f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": chunks[0]["created"] if chunks else int(time.time()),
        "model": model,
        "choices": [{"index": 0, "message": message, "finish_reason": finish}],
    }
    if usage:
        result["usage"] = usage
    return result


# ------------------------------------------------------ AsyncOpenAI look-alike


class _Completions:
    async def create(self, **kwargs: Any) -> Any:
        model = kwargs["model"]
        client, response = await open_stream(
            kwargs["messages"],
            model=model,
            tools=kwargs.get("tools"),
            tool_choice=kwargs.get("tool_choice"),
            max_tokens=kwargs.get("max_tokens") or kwargs.get("max_completion_tokens"),
            reasoning_effort=kwargs.get("reasoning_effort"),
        )
        chunks = iter_chunks(client, response, model)
        if kwargs.get("stream"):
            return _TypedStream(chunks)
        collected = [chunk async for chunk in chunks]
        return ChatCompletion.model_validate(aggregate_completion(collected, model))


class _TypedStream:
    def __init__(self, chunks: AsyncIterator[dict]) -> None:
        self._chunks = chunks

    def __aiter__(self) -> "_TypedStream":
        return self

    async def __anext__(self) -> ChatCompletionChunk:
        return ChatCompletionChunk.model_validate(await self._chunks.__anext__())


class ResponsesClient:
    """Minimal stand-in for AsyncOpenAI: only `client.chat.completions.create`."""

    def __init__(self) -> None:
        self.base_url = settings.effective_base_url
        self.api_key = settings.effective_api_key
        self.chat = SimpleNamespace(completions=_Completions())


# ----------------------------------------------------------- blocking one-shot


def text_from_response(data: dict[str, Any]) -> str:
    if isinstance(data.get("output_text"), str) and data["output_text"].strip():
        return data["output_text"].strip()
    parts: list[str] = []
    for item in data.get("output") or []:
        if item.get("type") == "message":
            for piece in item.get("content") or []:
                if piece.get("type") in ("output_text", "text"):
                    parts.append(str(piece.get("text", "")))
    return "".join(parts).strip()


def complete_sync(
    messages: list[dict[str, Any]],
    *,
    model: str,
    url: str | None = None,
    api_key: str | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
    request_id: str | None = None,
    transport: httpx.BaseTransport | None = None,
) -> httpx.Response:
    """POST one non-streamed request and return the raw response (caller checks the status)."""
    body = build_request(messages, model=model, stream=False, max_tokens=max_tokens)
    with httpx.Client(timeout=timeout or settings.ai_service_timeout_seconds, transport=transport) as client:
        return client.post(
            responses_url(url),
            headers=request_headers(api_key or settings.effective_api_key, stream=False, request_id=request_id),
            json=body,
        )
