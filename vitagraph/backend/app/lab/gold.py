"""Loader for the lab's gold set (`gold.json`) and the sample files it refers to."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

GOLD_PATH = Path(__file__).with_name("gold.json")
# app/lab/gold.py -> parents: lab, app, backend, vitagraph
SAMPLE_DIR = Path(__file__).resolve().parents[3] / "sample_data"

EXPECTATIONS = ("answer", "not_found", "refuse")


@lru_cache(maxsize=1)
def load_gold() -> dict:
    data = json.loads(GOLD_PATH.read_text(encoding="utf-8"))
    keys = {f["key"] for f in data["files"]}
    for q in data["questions"]:
        if q["expect"] not in EXPECTATIONS:
            raise ValueError(f"{q['id']}: unknown expectation {q['expect']!r}")
        unknown = set(q.get("files", [])) - keys
        if unknown:
            raise ValueError(f"{q['id']}: unknown file keys {sorted(unknown)}")
    return data


def questions() -> list[dict]:
    """Every question with its expected files as file NAMES and all list fields present."""
    data = load_gold()
    return [
        {
            "id": q["id"],
            "question": q["question"],
            "expect": q["expect"],
            "files": [_name(data, k) for k in q.get("files", [])],
            "must_contain": list(q.get("must_contain", [])),
            "answer_must_contain": list(q.get("answer_must_contain", [])),
            "forbidden": list(q.get("forbidden", [])),
        }
        for q in data["questions"]
    ]


def public_gold() -> dict:
    """The gold set as the API shows it (file names, not paths)."""
    data = load_gold()
    return {
        "version": data["version"],
        "files": [{"key": f["key"], "name": f["name"], "label": f["label"]} for f in data["files"]],
        "identifiers": list(data["identifiers"]),
        "questions": questions(),
    }


def _name(data: dict, key: str) -> str:
    return next(f["name"] for f in data["files"] if f["key"] == key)


def file_names(keys: list[str] | None = None) -> list[str]:
    data = load_gold()
    return [f["name"] for f in data["files"] if keys is None or f["key"] in keys]


def read_sample(name: str) -> bytes:
    return (SAMPLE_DIR / name).read_bytes()
