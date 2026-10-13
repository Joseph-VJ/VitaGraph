"""Put masked details back, locally, before text reaches the screen or a tool.

Only placeholders that exist in this persona's vault are swapped; a made-up ``[PERSON_9]`` stays as typed.
``StreamRestorer`` handles a placeholder that arrives split across streamed chunks.
"""

from __future__ import annotations

import json
import re

from app.privacy.redactor import PLACEHOLDER_RE, Vault

# How many characters a trailing, unfinished "[PERSON_1" may be held back while waiting for its "]".
HOLD_BACK_MAX = 24
_PARTIAL_TAIL = re.compile(r"\[[A-Z_]*\d*\Z")


def _escaped(original: str) -> str:
    return json.dumps(original, ensure_ascii=False)[1:-1]


def restore_text(text: str, vault: Vault | None, json_escape: bool = False) -> str:
    if not text or vault is None or len(vault) == 0 or "[" not in text:
        return text

    def swap(match: re.Match[str]) -> str:
        original = vault.original_of(match.group(0))
        if original is None:
            return match.group(0)
        return _escaped(original) if json_escape else original

    return PLACEHOLDER_RE.sub(swap, text)


class StreamRestorer:
    """Feed streamed deltas in; get restored text out. Call ``flush()`` once at the end."""

    def __init__(self, vault: Vault | None, json_escape: bool = False) -> None:
        self._vault = vault
        self._json_escape = json_escape
        self._held = ""

    @property
    def active(self) -> bool:
        return self._vault is not None and len(self._vault) > 0

    def feed(self, delta: str) -> str:
        if not delta or not self.active:
            return delta
        text = self._held + delta
        self._held = ""
        tail = _PARTIAL_TAIL.search(text)
        if tail and len(text) - tail.start() <= HOLD_BACK_MAX:
            self._held = text[tail.start():]
            text = text[: tail.start()]
        return restore_text(text, self._vault, self._json_escape)

    def flush(self) -> str:
        held, self._held = self._held, ""
        return restore_text(held, self._vault, self._json_escape) if held else ""
