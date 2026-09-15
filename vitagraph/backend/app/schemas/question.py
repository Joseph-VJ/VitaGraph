"""Question and answer schemas.

The answer contract implements the plan's mandatory four visible parts:
what the reports say, evidence used, what cannot be concluded, and safety
guidance (plan Section 10).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class QuestionCreate(BaseModel):
    user_id: str
    text: str = Field(min_length=3, max_length=500)


class EvidenceCard(BaseModel):
    chunk_id: str
    report_id: str
    report_filename: str
    report_date: str | None
    page_number: int
    snippet: str
    score: float


class AnswerOut(BaseModel):
    question_id: str
    classification: str
    status: str                      # answered|refused|insufficient_evidence|error
    summary_text: str                # part 1: what the reports say
    evidence: list[EvidenceCard]     # part 2: evidence used
    limitations_text: str            # part 3: what cannot be concluded
    safety_text: str                 # part 4: safety guidance
    ai_service_status: str           # ok|disabled|error
    safety_status: str               # passed|refused|insufficient_evidence
