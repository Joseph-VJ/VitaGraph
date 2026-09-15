"""Retrieval hit-rate evaluation (plan Sections 16.2-16.4).

Runs the labeled question set (sample_data/questions.json) against a fresh,
consented persona with both synthetic reports indexed, and prints a
hit-rate table. A question 'hits' when the expected evidence term appears
in at least one retrieved chunk above the calibrated threshold.

Usage:  cd backend && .venv/Scripts/python.exe -m tests.hit_rate_eval
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="vitagraph_eval_"))
os.environ["DATA_DIR"] = str(_TMP)
os.environ["UPLOADS_DIR"] = str(_TMP / "uploads")
os.environ["DB_PATH"] = str(_TMP / "eval.db")
os.environ["CHROMA_DIR"] = str(_TMP / "chroma")
os.environ["ALLOW_API"] = "false"

from app.core.database import init_db  # noqa: E402
from app.rag import retriever  # noqa: E402
from app.services import report_service, user_service  # noqa: E402

init_db()

SAMPLE = Path(__file__).resolve().parent.parent.parent / "sample_data"

# Substrings that must appear in retrieved evidence for a question to count
# as a hit, derived from the manually recorded expectations in questions.json.
HIT_TERMS = {
    "q1_direct_lookup": ["18 ng/mL"],
    "q2_longitudinal": ["224 mg/dL", "198 mg/dL"],
    "q6_administrative": ["fatigue"],
}
# Questions whose correct behavior is NOT retrieval (refusals, honest gaps)
# are excluded from the hit-rate denominator and reported separately.
NON_RETRIEVAL = {"q3_insufficient", "q4_diagnosis_refusal", "q5_medication_refusal"}


def main() -> None:
    user = user_service.create_user("Evaluation persona")
    user_service.accept_consent(user["id"])
    report_service.process_upload(
        user["id"], "jan.pdf", (SAMPLE / "synthetic_panel_2025-01-15.pdf").read_bytes())
    report_service.process_upload(
        user["id"], "jun.pdf", (SAMPLE / "synthetic_panel_2025-06-20.pdf").read_bytes())

    questions = json.loads((SAMPLE / "questions.json").read_text(encoding="utf-8"))
    rows = []
    hits = 0
    retrieval_questions = 0

    for entry in questions["evaluation_set"]:
        qid = entry["id"]
        if qid in NON_RETRIEVAL:
            rows.append((qid, entry["expected_behavior"], "-", "n/a (no retrieval expected)"))
            continue

        retrieval_questions += 1
        evidence = retriever.retrieve(user_id=user["id"], question=entry["question"])
        evidence_text = " ".join(hit["document"] for hit in evidence)

        missing = [term for term in HIT_TERMS[qid]
                   if term.lower() not in evidence_text.lower()]
        if not missing:
            hits += 1
            rows.append((qid, entry["expected_behavior"], "HIT",
                         f"all expected terms found in {len(evidence)} evidence chunk(s)"))
        else:
            rows.append((qid, entry["expected_behavior"], "MISS",
                         f"missing from retrieval: {', '.join(missing)}"))

    print("=" * 88)
    print("VitaGraph retrieval hit-rate evaluation (synthetic benchmark)")
    print("=" * 88)
    for qid, behavior, outcome, detail in rows:
        print(f"{qid:<26} {behavior:<24} {outcome:<5} {detail}")
    rate = hits / retrieval_questions if retrieval_questions else 0.0
    print("-" * 88)
    print(f"Hit rate: {hits}/{retrieval_questions} = {rate:.0%}  "
          f"(plan Section 16.4 gate: >= 80% on the synthetic benchmark)")


if __name__ == "__main__":
    main()
