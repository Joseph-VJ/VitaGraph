"""Event mapper translating AI Agent harness notifications into VitaGraph SSE frames."""

from __future__ import annotations

import json
import time
from typing import Any, Callable


def _dict(x: Any) -> dict:
    return x if isinstance(x, dict) else {}


_TOOL_PREFIXES = ("mcp__vitagraph__", "mcp__vgartifacts__")


def _short_tool_name(name: str) -> str:
    for prefix in _TOOL_PREFIXES:
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


class EventMapper:
    """Pure, non-async event mapper translating harness session messages into client events."""

    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.monotonic,
        redact: Callable[[str], str] = lambda s: s,
    ) -> None:
        self._clock = clock
        self._redact = redact
        self._t0 = clock()

        self.answer_text: str = ""
        self.evidence: list[dict] = []
        self.title: str | None = None
        self.outcome: str | None = None  # None while running; "result" or "error" once terminal

        self._turns: int = 0
        self._steps: int = 0
        self._tool_calls_count: int = 0
        self._retries: int = 0
        self._pending_calls: dict[str, tuple[str, float]] = {}  # callId -> (short_name, start_time)
        self._turn_error: str = ""
        self._seen_chunk_ids: set[str] = set()

        self._has_usage: bool = False
        self._input_tokens: int = 0
        self._output_tokens: int = 0
        self._reasoning_tokens: int = 0

        self._current_step_for_text: int | None = None

        # Model calls in order. A call that asked for tools wrote narration; the last call without tools wrote the answer.
        self._calls: list[dict[str, Any]] = []
        self._live = False  # True once the loopback route has reported the model's own stream
        self._live_calls = 0
        self._live_text_seen = False
        self._live_reasoning_seen = False

    @property
    def final_text(self) -> str:
        """The answer: the text of the last model call that did not ask for tools (else everything written)."""
        for call in reversed(self._calls):
            if not call["tools"]:
                return call["text"].strip()
        return self.answer_text.strip()

    def feed_live(self, ev: dict) -> list[tuple[str, dict]]:
        """Map one live event from the model stream (see app.services.live_bus) to client events."""
        kind = ev.get("kind")
        if kind == "model_start":
            self._live = True
            self._live_calls += 1
            self._live_text_seen = False
            self._live_reasoning_seen = False
            self._calls.append({"text": "", "tools": False})
            return [("model", {"phase": "start", "call": self._live_calls})]
        if kind == "reasoning":
            delta = ev.get("delta")
            if not delta:
                return []
            self._live_reasoning_seen = True
            return [("thinking", {"thinking": delta})]
        if kind == "text":
            delta = ev.get("delta")
            if not delta:
                return []
            if not self._calls:
                self._calls.append({"text": "", "tools": False})
            out = ""
            if self.answer_text and not self._live_text_seen:
                out = "\n\n"  # a new model call starts a new paragraph
            self._live_text_seen = True
            out += delta
            self.answer_text += out
            self._calls[-1]["text"] += delta
            return [("text_delta", {"delta": out})]
        if kind == "model_end":
            tools = int(ev.get("tool_calls") or 0)
            if tools and self._calls:
                self._calls[-1]["tools"] = True
            return [
                (
                    "model",
                    {
                        "phase": "end",
                        "call": self._live_calls,
                        "ms": ev.get("ms"),
                        "first_ms": ev.get("first_ms"),
                        "input_tokens": ev.get("input_tokens"),
                        "output_tokens": ev.get("output_tokens"),
                        "tool_calls": tools,
                    },
                )
            ]
        if kind == "model_error":
            return [("model", {"phase": "error", "call": self._live_calls, "message": self._redact(str(ev.get("message", "")))[:300]})]
        return []

    def _failure_message(self, detail: str) -> tuple[str, str]:
        lowered = (detail or "").lower()
        if any(w in lowered for w in ("401", "403", "unauthorized", "forbidden")):
            msg = "The AI service refused the request. Please try again later."
        elif "too long to answer" in lowered:
            msg = "The AI Agent took too long to answer. Please try again."
        elif "cancel" in lowered:
            msg = "The turn was cancelled."
        else:
            msg = "The AI Agent could not finish this answer."

        full_diag = detail or self._turn_error or ""
        return msg, self._redact(full_diag)[:300]

    def stats(self) -> dict:
        st: dict[str, Any] = {
            "turns": self._turns,
            "steps": self._steps,
            "tool_calls": self._tool_calls_count,
            "elapsed_ms": int((self._clock() - self._t0) * 1000),
        }
        if self._has_usage:
            st["input_tokens"] = self._input_tokens
            st["output_tokens"] = self._output_tokens
            st["reasoning_tokens"] = self._reasoning_tokens
        return st

    def feed(self, msg: Any) -> list[tuple[str, dict]]:
        if not isinstance(msg, dict):
            return []

        mtype = msg.get("type")

        # 10. Terminal: result
        if mtype == "result":
            finish_reason = msg.get("finish_reason", "stop")
            if finish_reason in ("error", "aborted", "interrupted"):
                self.outcome = "error"
                final_resp = str(msg.get("final_response") or "")
                detail = self._turn_error or final_resp or finish_reason or "error"
                msg_text, diag = self._failure_message(detail)
                return [("error", {"status": "error", "message": msg_text, "diagnostic": diag})]

            self.outcome = "result"
            final_resp = msg.get("final_response")
            if not self.answer_text and isinstance(final_resp, str) and final_resp:
                self.answer_text = final_resp
                return [("text_delta", {"delta": final_resp})]
            return []

        # 11. Terminal: run_error
        if mtype == "run_error":
            self.outcome = "error"
            msg_text, diag = self._failure_message(str(msg.get("message", "")))
            return [("error", {"status": "error", "message": msg_text, "diagnostic": diag})]

        # 12. Terminal: lockdown_violation
        if mtype == "lockdown_violation":
            self.outcome = "error"
            tools = msg.get("tools", [])
            tools_str = ", ".join(tools) if isinstance(tools, list) else str(tools)
            msg_text = "The AI Agent was stopped by a safety check."
            diag = f"Unexpected tools were offered: {tools_str}"[:300]
            return [("error", {"status": "error", "message": msg_text, "diagnostic": diag})]

        # Notifications
        if mtype != "notification" or msg.get("method") != "session.event":
            return []

        payload = _dict(msg.get("payload"))
        event = _dict(payload.get("event"))
        etype = event.get("type")
        d = _dict(event.get("data"))

        # 2. turn/start
        if etype == "turn/start":
            self._turns += 1
            return [("status", {"phase": "working", "message": "The agent is working"})]

        # 9. turn/end
        if etype == "turn/end":
            reason = _dict(d.get("reason"))
            if reason.get("kind") == "error":
                err = reason.get("error")
                if isinstance(err, (dict, list)):
                    self._turn_error = json.dumps(err, ensure_ascii=False, default=str)
                elif err is not None:
                    self._turn_error = str(err)
                else:
                    self._turn_error = ""
            return []

        # 3. step/start
        if etype == "step/start":
            step_num = d.get("step") if isinstance(d.get("step"), int) else (self._steps + 1)
            self._steps = max(self._steps + 1, step_num)
            return [("step", {"phase": "start", "step": step_num})]

        # 3. step/end
        if etype == "step/end":
            step_num = d.get("step") if isinstance(d.get("step"), int) else self._steps
            self._steps = max(self._steps, step_num)
            return [
                ("step", {"phase": "end", "step": step_num}),
                ("stats", self.stats()),
            ]

        # 4. assistant/message
        if etype == "assistant/message":
            events: list[tuple[str, dict]] = []
            step_num = d.get("step") if isinstance(d.get("step"), int) else self._steps
            message = _dict(d.get("message"))
            content_list = message.get("content")
            if not isinstance(content_list, list):
                content_list = []

            usage = _dict(d.get("usage"))
            if usage:
                in_tok = usage.get("inputTokens")
                out_tok = usage.get("outputTokens")
                rsn_tok = usage.get("reasoningTokens")
                if any(isinstance(v, int) for v in (in_tok, out_tok, rsn_tok)):
                    self._has_usage = True
                    if isinstance(in_tok, int):
                        self._input_tokens += in_tok
                    if isinstance(out_tok, int):
                        self._output_tokens += out_tok
                    if isinstance(rsn_tok, int):
                        self._reasoning_tokens += rsn_tok

            for block in content_list:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type")
                text = block.get("text")
                if not isinstance(text, str) or not text:
                    continue

                if btype == "reasoning":
                    if not self._live_reasoning_seen:
                        events.append(("thinking", {"thinking": text}))
                elif btype == "text":
                    if self._live_text_seen:
                        continue  # already streamed word by word from the model stream
                    if not self._live:
                        self._calls.append({"text": text, "tools": False})
                    elif self._calls:
                        self._calls[-1]["text"] += text
                    if self.answer_text and self._current_step_for_text is not None and self._current_step_for_text != step_num:
                        events.append(("text_delta", {"delta": "\n\n"}))
                        self.answer_text += "\n\n"
                    self._current_step_for_text = step_num
                    events.append(("text_delta", {"delta": text}))
                    self.answer_text += text

            self._live_text_seen = False
            self._live_reasoning_seen = False
            return events

        # 5. tool/call
        if etype == "tool/call":
            name = d.get("name")
            if not isinstance(name, str) or not name:
                return []
            short = _short_tool_name(name)

            raw_args = d.get("arguments")
            args = {}
            if isinstance(raw_args, str):
                try:
                    parsed = json.loads(raw_args)
                    if isinstance(parsed, dict):
                        args = parsed
                except Exception:
                    args = {}
            elif isinstance(raw_args, dict):
                args = raw_args

            call_id = d.get("callId")
            if not isinstance(call_id, str) or not call_id:
                call_id = f"call_{self._tool_calls_count + 1}"

            self._pending_calls[call_id] = (short, self._clock())
            self._tool_calls_count += 1
            if self._calls:
                self._calls[-1]["tools"] = True
            step_num = d.get("step") if isinstance(d.get("step"), int) else self._steps
            return [("tool_call", {"id": call_id, "tool": short, "arguments": args, "step": step_num})]

        # 6. tool/result
        if etype == "tool/result":
            message = _dict(d.get("message"))
            content_list = message.get("content")
            if not isinstance(content_list, list):
                content_list = []

            # Real shape: content = [{"type": "tool-result", "toolCallId", "content": [{"type": "text", "text"}], "isError"}]
            block = next(
                (b for b in content_list if isinstance(b, dict) and b.get("type") == "tool-result"), {}
            )
            call_id = (
                block.get("toolCallId")
                or _dict(message.get("source")).get("callId")
                or message.get("toolCallId")
                or d.get("toolCallId")
                or ""
            )
            short, started = self._pending_calls.get(call_id, ("unknown", self._clock()))
            duration_ms = max(0, int((self._clock() - started) * 1000))

            inner = block.get("content") if block else content_list
            if isinstance(inner, str):
                raw_text = inner
            else:
                raw_text = "".join(
                    b.get("text", "") for b in (inner or []) if isinstance(b, dict) and b.get("type") == "text"
                )

            is_error = bool(block.get("isError") or message.get("isError") or isinstance(d.get("error"), dict))
            if is_error:
                err_dict = _dict(d.get("error"))
                err_text = raw_text or err_dict.get("reason") or "The tool failed."
                result = {"error": err_text}
            else:
                try:
                    parsed = json.loads(raw_text)
                    if isinstance(parsed, dict):
                        result = parsed
                    else:
                        result = {"text": raw_text}
                except Exception:
                    result = {"text": raw_text}

            if not is_error and short == "search_reports" and isinstance(result.get("evidence"), list):
                for card in result["evidence"]:
                    if isinstance(card, dict) and isinstance(card.get("chunk_id"), str):
                        cid = card["chunk_id"]
                        if cid not in self._seen_chunk_ids:
                            self._seen_chunk_ids.add(cid)
                            self.evidence.append(card)

            return [("tool_result", {
                "id": call_id,
                "tool": short,
                "result": result,
                "is_error": is_error,
                "duration_ms": duration_ms,
            })]

        # 7. llm/retry
        if etype == "llm/retry":
            self._retries += 1
            if isinstance(d.get("retry"), int):
                attempt = d["retry"]
            elif isinstance(d.get("attempt"), int):
                attempt = d["attempt"]
            else:
                attempt = self._retries
            return [("status", {
                "phase": "retrying",
                "attempt": attempt,
                "message": "The AI service is slow to answer; trying again",
            })]

        # 8. session/title
        if etype == "session/title":
            title = d.get("title")
            if isinstance(title, str) and title.strip():
                self.title = title.strip()
            return []

        return []
