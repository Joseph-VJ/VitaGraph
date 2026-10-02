"""Question and answer schemas.

The answer contract implements the plan's mandatory four visible parts:
what the reports say, evidence used, what cannot be concluded, and safety
guidance (plan Section 10).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class QuestionCreate(BaseModel):
    user_id: str
    text: str = Field(min_length=3, max_length=500)
    job_id: str | None = None
    background: bool = False
    # Optional: restrict retrieval to a single report ("chat with this PDF").
    report_id: str | None = None
    # "rag_ai" = retrieve evidence then let the AI compose from it (default);
    # "rag_only" = retrieve and show the evidence without calling the AI.
    mode: Literal["rag_ai", "rag_only"] = "rag_ai"


class EvidenceCard(BaseModel):
    chunk_id: str
    report_id: str
    report_filename: str
    report_date: str | None
    page_number: int
    snippet: str
    score: float
    char_start: int | None = None
    char_end: int | None = None


class AnswerOut(BaseModel):
    question_id: str
    job_id: str | None = None
    classification: str = "general"
    status: str = "answered"          # answered|refused|insufficient_evidence|error|processing
    summary_text: str = ""            # part 1: what the reports say
    evidence: list[EvidenceCard] = [] # part 2: evidence used
    limitations_text: str = ""        # part 3: what cannot be concluded
    safety_text: str = ""             # part 4: safety guidance
    ai_service_status: str = "ok"     # ok|disabled|error
    safety_status: str = "passed"     # passed|refused|insufficient_evidence
