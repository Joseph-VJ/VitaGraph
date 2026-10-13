"""Privacy Shield routes: summary, live preview, always-hide words, and the tamper-evident ledger."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.privacy import ledger, shield, terms
from app.schemas.privacy import (
    ChainIn,
    LedgerRowFullOut,
    LedgerRowOut,
    PreviewIn,
    PreviewOut,
    Scope,
    SummaryOut,
    TamperOut,
    TermIn,
    TermOut,
    VerifyOut,
)
from app.services import user_service

router = APIRouter(prefix="/api/privacy", tags=["privacy"])

MAX_PREVIEW_CHARS = 20_000


def _chain_owner(user_id: str, scope: Scope) -> str:
    """The ledger user id for a request: the persona, or "" for the shared Tools chain."""
    if scope == "tools":
        return ""
    user_service.user_exists(user_id)
    return user_id


@router.get("/summary", response_model=SummaryOut)
def get_summary(user_id: str) -> dict:
    user_service.user_exists(user_id)
    return {"covered": settings.api_format == "responses", **ledger.summary(user_id)}


@router.post("/preview", response_model=PreviewOut)
def preview(payload: PreviewIn) -> dict:
    user_service.user_exists(payload.user_id)
    if len(payload.text) > MAX_PREVIEW_CHARS:
        raise HTTPException(status_code=413, detail=f"Text is longer than {MAX_PREVIEW_CHARS:,} characters.")
    result = shield.preview(payload.user_id, payload.text)
    return {"masked": result.masked, "spans": result.spans, "counts": result.counts}


@router.get("/terms", response_model=list[TermOut])
def list_terms(user_id: str) -> list[dict]:
    user_service.user_exists(user_id)
    return terms.list_terms(user_id)


@router.post("/terms", response_model=TermOut)
def add_term(payload: TermIn) -> dict:
    user_service.user_exists(payload.user_id)
    return terms.add_term(payload.user_id, payload.term)


@router.delete("/terms/{term_id}")
def delete_term(term_id: str, user_id: str) -> dict:
    user_service.user_exists(user_id)
    return terms.delete_term(user_id, term_id)


@router.get("/ledger", response_model=list[LedgerRowOut])
def list_ledger(user_id: str = "", scope: Scope = "persona", limit: int = Query(50, ge=1, le=200)) -> list[dict]:
    return ledger.list_rows(_chain_owner(user_id, scope), limit)


@router.get("/ledger/{row_id}", response_model=LedgerRowFullOut)
def get_ledger_row(row_id: str, user_id: str = "", scope: Scope = "persona") -> dict:
    return ledger.get_row(_chain_owner(user_id, scope), row_id)


@router.post("/ledger/verify", response_model=VerifyOut)
def verify(payload: ChainIn) -> dict:
    return ledger.verify_chain(_chain_owner(payload.user_id, payload.scope))


@router.post("/ledger/tamper-test", response_model=TamperOut)
def tamper_test(payload: ChainIn) -> dict:
    return ledger.tamper_test(_chain_owner(payload.user_id, payload.scope))
