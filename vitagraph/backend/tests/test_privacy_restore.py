"""Masked details come back locally, even when a placeholder is split across streamed chunks."""

from __future__ import annotations

import json

from app.privacy.redactor import Vault
from app.privacy.restore import StreamRestorer, restore_text


def vault_with_name() -> Vault:
    vault = Vault()
    vault.placeholder_for("PERSON", "Asha K")
    vault.placeholder_for("ID", 'SYN-"7"')
    return vault


def stream(vault: Vault, parts: list[str], json_escape: bool = False) -> str:
    restorer = StreamRestorer(vault, json_escape=json_escape)
    return "".join(restorer.feed(p) for p in parts) + restorer.flush()


def test_restore_text_swaps_known_placeholders_only():
    vault = vault_with_name()
    assert restore_text("Hello [PERSON_1]!", vault) == "Hello Asha K!"
    assert restore_text("Hello [PERSON_9]!", vault) == "Hello [PERSON_9]!"  # made up by the model: left as typed
    assert restore_text("[PERSON_1] and [PERSON_1]", vault) == "Asha K and Asha K"


def test_an_empty_vault_is_a_no_op():
    assert restore_text("Hello [PERSON_1]", Vault()) == "Hello [PERSON_1]"
    assert restore_text("Hello [PERSON_1]", None) == "Hello [PERSON_1]"
    restorer = StreamRestorer(Vault())
    assert restorer.feed("[PERSON") == "[PERSON"
    assert restorer.flush() == ""


def test_a_placeholder_split_across_two_deltas():
    assert stream(vault_with_name(), ["Hello [PERS", "ON_1], bye"]) == "Hello Asha K, bye"


def test_a_placeholder_split_across_three_deltas():
    assert stream(vault_with_name(), ["Hi [", "PERSON", "_1] there"]) == "Hi Asha K there"
    assert stream(vault_with_name(), ["Hi [PERSON_", "1", "] there"]) == "Hi Asha K there"


def test_text_is_released_while_waiting_for_the_rest_of_a_placeholder():
    restorer = StreamRestorer(vault_with_name())
    assert restorer.feed("Hello [PERS") == "Hello "
    assert restorer.feed("ON_1]") == "Asha K"


def test_a_lone_bracket_is_released_at_flush():
    vault = vault_with_name()
    assert stream(vault, ["Result [", "x"]) == "Result [x"
    assert stream(vault, ["end ["]) == "end ["
    restorer = StreamRestorer(vault)
    assert restorer.feed("end [PERSON") == "end "
    assert restorer.flush() == "[PERSON"


def test_a_bracket_that_cannot_be_a_placeholder_is_not_held_back():
    restorer = StreamRestorer(vault_with_name())
    assert restorer.feed("see [1] and [note") == "see [1] and [note"


def test_a_very_long_unfinished_bracket_is_released():
    restorer = StreamRestorer(vault_with_name())
    out = restorer.feed("[PERSON_" + "1" * 30)
    assert out.startswith("[PERSON_") or out == ""  # never held forever
    assert out + restorer.flush() == "[PERSON_" + "1" * 30


def test_json_escaping_inside_tool_arguments():
    vault = vault_with_name()
    out = stream(vault, ['{"query": "[ID', '_1]"}'], json_escape=True)
    assert json.loads(out) == {"query": 'SYN-"7"'}  # the quote inside the original is escaped
    plain = stream(vault, ['{"query": "[PERSON_1]"}'], json_escape=True)
    assert json.loads(plain) == {"query": "Asha K"}


def test_text_without_brackets_passes_straight_through():
    restorer = StreamRestorer(vault_with_name())
    assert restorer.feed("plain text") == "plain text"
    assert restorer.flush() == ""
