"""The Privacy Shield: masks every outgoing model request, restores the answer locally, records what was sent.

Callers wrap a model call in ``scope(persona, purpose)``. The Responses adapter (the single exit door for model
traffic) calls ``protect_messages`` before it builds the request and ``after_send`` right before it sends it.
"""

from __future__ import annotations

import copy
import logging
import threading
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator

from app.core.database import get_db
from app.privacy import ledger, terms
from app.privacy.redactor import RedactResult, Vault, learn_labelled, redact_text
from app.privacy.restore import restore_text
from app.services import live_bus

logger = logging.getLogger(__name__)

PURPOSES = ("agent", "node_summary", "text_to_graph", "chat", "ask", "connection_test", "other")
TRANSCRIPT_MAX_CHARS = 60_000
PRELEARN_MAX_PAGES = 200

SHIELD_NOTE = (
    "Text in square brackets such as [PERSON_1] or [ID_2] is a private detail that was masked on the person's "
    "computer before it reached you. Keep such tags exactly as written and never guess what they stand for."
)


@dataclass(frozen=True)
class Scope:
    vault_key: str
    purpose: str


_DEFAULT_SCOPE = Scope("", "other")
_current: ContextVar[Scope] = ContextVar("privacy_scope", default=_DEFAULT_SCOPE)

_lock = threading.RLock()
_vaults: dict[str, Vault] = {}
_prelearned: set[str] = set()


@contextmanager
def scope(user_id: str | None, purpose: str) -> Iterator[Scope]:
    """Say which persona and which feature the model calls inside the block belong to."""
    new = Scope(user_id or "", purpose if purpose in PURPOSES else "other")
    token = _current.set(new)
    try:
        yield new
    finally:
        try:
            _current.reset(token)
        except ValueError:  # an async generator resumed in another context
            _current.set(_DEFAULT_SCOPE)


def current() -> Scope:
    return _current.get()


def vault_for(key: str | None) -> Vault:
    key = key or ""
    with _lock:
        vault = _vaults.get(key)
        if vault is None:
            vault = _vaults[key] = Vault()
        return vault


def forget(user_id: str) -> None:
    """Drop what is remembered in memory for a persona (called when the persona is deleted)."""
    with _lock:
        _vaults.pop(user_id, None)
        _prelearned.discard(user_id)


def _prelearn(key: str, vault: Vault) -> None:
    """Once per persona per process: learn the labelled identifiers in the stored report text."""
    if not key or key in _prelearned:
        return
    _prelearned.add(key)
    try:
        with get_db() as db:
            rows = db.execute(
                "SELECT p.extracted_text AS t FROM report_pages p JOIN reports r ON r.id = p.report_id "
                "WHERE r.user_id = ? ORDER BY r.upload_time, p.page_number LIMIT ?",
                (key, PRELEARN_MAX_PAGES),
            ).fetchall()
        for row in rows:
            learn_labelled(row["t"] or "", vault)
    except Exception:
        logger.exception("Privacy Shield: could not read stored report text for pre-learning")


def restore(text: str, key: str | None) -> str:
    """Put masked details back into text that came from the model."""
    if not text:
        return text
    return restore_text(text, vault_for(key))


@dataclass
class Protected:
    messages: list[dict[str, Any]]
    vault_key: str
    purpose: str
    removed_total: int = 0
    by_type: dict[str, int] = field(default_factory=dict)
    chars_original: int = 0
    chars_sent: int = 0
    transcript: str = ""
    ledger_id: str | None = None


def _walk(messages: list[dict[str, Any]], fn: Callable[[str], str]) -> None:
    """Apply ``fn`` to every text field of the (already copied) messages, in place."""
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            message["content"] = fn(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    part["text"] = fn(part["text"])
        for call in message.get("tool_calls") or []:
            function = call.get("function") if isinstance(call, dict) else None
            if isinstance(function, dict) and isinstance(function.get("arguments"), str):
                function["arguments"] = fn(function["arguments"])


def _text_of(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(str(p.get("text", "")) for p in content if isinstance(p, dict) and p.get("text"))
    return ""


def _transcript(messages: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for message in messages:
        role = message.get("role")
        text = _text_of(message.get("content")).strip()
        if role in ("system", "developer"):
            blocks.append("## Instructions\n" + text)
        elif role == "user":
            blocks.append("## Person\n" + text)
        elif role == "assistant":
            if text:
                blocks.append("## AI\n" + text)
            for call in message.get("tool_calls") or []:
                function = (call.get("function") or {}) if isinstance(call, dict) else {}
                blocks.append(f"## Tool call {function.get('name', '')}\n" + str(function.get("arguments") or ""))
        elif role == "tool":
            blocks.append("## Tool result\n" + text)
    out = "\n\n".join(blocks)
    if len(out) > TRANSCRIPT_MAX_CHARS:
        out = out[:TRANSCRIPT_MAX_CHARS] + "\n\n(The rest of this request is not shown.)"
    return out


def protect_messages(messages: list[dict[str, Any]]) -> Protected:
    """Return a masked deep copy of ``messages`` plus what was removed. The caller's messages are never changed."""
    sc = current()
    key = sc.vault_key
    copied = copy.deepcopy(messages)
    with _lock:
        vault = vault_for(key)
        _prelearn(key, vault)
        custom = terms.terms_for(key)

        originals: list[int] = []

        def learn(text: str) -> str:
            originals.append(len(text))
            learn_labelled(text, vault)
            return text

        _walk(copied, learn)  # pass 1: learn labelled values from every message

        removed = 0
        by_type: dict[str, int] = {}
        sent_chars: list[int] = []

        def mask(text: str) -> str:
            nonlocal removed
            result = redact_text(text, vault, custom)
            for kind, count in result.counts.items():
                by_type[kind] = by_type.get(kind, 0) + count
                removed += count
            sent_chars.append(len(result.masked))
            return result.masked

        _walk(copied, mask)  # pass 2: mask

    chars_original = sum(originals)
    chars_sent = sum(sent_chars)
    if removed:
        index = 0
        while index < len(copied) and copied[index].get("role") in ("system", "developer"):
            index += 1
        copied.insert(index, {"role": "system", "content": SHIELD_NOTE})
        chars_sent += len(SHIELD_NOTE)
    return Protected(
        messages=copied,
        vault_key=key,
        purpose=sc.purpose,
        removed_total=removed,
        by_type=by_type,
        chars_original=chars_original,
        chars_sent=chars_sent,
        transcript=_transcript(copied),
    )


def after_send(protected: Protected) -> str | None:
    """Write the ledger row (just before the request leaves). Never raises into the model call."""
    try:
        protected.ledger_id = ledger.record(
            protected.vault_key,
            protected.purpose,
            protected.chars_original,
            protected.chars_sent,
            protected.removed_total,
            protected.by_type,
            protected.transcript,
        )
    except Exception:
        logger.exception("Privacy Shield: could not record the request")
    return protected.ledger_id


def announce(protected: Protected) -> None:
    """Tell the live channel what the shield did for this request (published once the model endpoint has answered)."""
    try:
        live_bus.publish(
            protected.vault_key,
            {
                "kind": "privacy",
                "ledger_id": protected.ledger_id,
                "purpose": protected.purpose,
                "chars_original": protected.chars_original,
                "chars_sent": protected.chars_sent,
                "removed_total": protected.removed_total,
                "by_type": dict(protected.by_type),
            },
        )
    except Exception:
        logger.exception("Privacy Shield: could not announce the request")


def preview(user_id: str, text: str) -> RedactResult:
    """What would be masked in ``text``. Uses a copy of the persona's vault: nothing is remembered or saved."""
    with _lock:
        vault = vault_for(user_id)
        _prelearn(user_id, vault)
        scratch = vault.copy()
    return redact_text(text, scratch, terms.terms_for(user_id))
