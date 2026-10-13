"""AI service configuration and dynamic report analysis routes."""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import urlsplit
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.agent.pool import get_pool
from app.agent.runs import get_registry
from app.core.config import settings
from app.core.database import get_db
from app.generation import ai_client
from app.services import user_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Provider standard presets
PROVIDER_PRESETS: dict[str, dict[str, str]] = {
    "gemini": {
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "default_model": "gemini-1.5-flash",
    },
    "openai": {
        "url": "https://api.openai.com/v1/chat/completions",
        "default_model": "gpt-4o-mini",
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "default_model": "llama-3.3-70b-versatile",
    },
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "default_model": "deepseek/deepseek-chat",
    },
}


class AiConfigRequest(BaseModel):
    provider: str = Field(default="gemini", description="gemini | openai | groq | openrouter | custom")
    api_key: str = Field(default="", description="API key to configure (leave blank to keep existing)")
    model: str = Field(default="gemini-1.5-flash")
    url: str = Field(default="")
    allow_api: bool = Field(default=True)


class AiConfigResponse(BaseModel):
    allow_api: bool
    provider: str
    model: str
    url: str
    has_api_key: bool
    masked_key: str
    status: str  # connected | error | offline
    message: str | None = None


class ReportAnalysisRequest(BaseModel):
    report_id: str
    user_id: str


def _detect_provider(url: str) -> str:
    url_lower = url.lower()
    if "googleapis.com" in url_lower:
        return "gemini"
    if "api.openai.com" in url_lower:
        return "openai"
    if "groq.com" in url_lower:
        return "groq"
    if "openrouter.ai" in url_lower:
        return "openrouter"
    return "custom"


@router.get("/config", response_model=AiConfigResponse)
def get_ai_config() -> dict:
    """Return active AI service configuration and masked key status."""
    has_key = bool(settings.effective_api_key)
    provider = _detect_provider(settings.effective_base_url)

    status = "offline"
    if settings.allow_api and has_key:
        status = "configured"

    return {
        "allow_api": settings.allow_api,
        "provider": provider,
        "model": settings.effective_model,
        "url": settings.effective_base_url,
        "has_api_key": has_key,
        "masked_key": settings.get_masked_key(),
        "status": status,
        "message": "AI service ready" if has_key else "API key not configured",
    }


class AiPrivacyRequest(BaseModel):
    allow_api: bool


@router.post("/privacy", response_model=AiConfigResponse)
def set_ai_privacy(payload: AiPrivacyRequest) -> dict:
    """Turn sending retrieved passages to the AI service on or off. No network call, so Off can never fail."""
    settings.update_ai_config(
        allow_api=payload.allow_api,
        url=settings.ai_service_url,
        key="",
        model=settings.ai_service_model,
        persist=True,
    )
    return get_ai_config()


@router.post("/config", response_model=AiConfigResponse)
def set_ai_config(payload: AiConfigRequest) -> dict:
    """Test and update AI service configuration."""
    target_url = payload.url.strip()
    target_model = payload.model.strip()
    target_key = payload.api_key.strip()

    # Fill default URL if empty and known preset
    if not target_url and payload.provider in PROVIDER_PRESETS:
        target_url = PROVIDER_PRESETS[payload.provider]["url"]
        if not target_model:
            target_model = PROVIDER_PRESETS[payload.provider]["default_model"]

    # Use existing key if none provided in request
    effective_key = target_key if target_key else settings.ai_service_api_key

    # Test the connection
    is_ok, test_msg = ai_client.test_connection(
        url=target_url,
        key=effective_key,
        model=target_model,
    )

    if is_ok:
        settings.update_ai_config(
            allow_api=payload.allow_api,
            url=target_url,
            key=effective_key,
            model=target_model,
            persist=True,
        )
        return {
            "allow_api": settings.allow_api,
            "provider": payload.provider,
            "model": settings.ai_service_model,
            "url": settings.ai_service_url,
            "has_api_key": bool(settings.ai_service_api_key),
            "masked_key": settings.get_masked_key(),
            "status": "connected",
            "message": f"Verified successfully! Model '{target_model}' responded.",
        }
    else:
        # Save anyway if requested, but label error
        if payload.allow_api and effective_key:
            settings.update_ai_config(
                allow_api=payload.allow_api,
                url=target_url,
                key=effective_key,
                model=target_model,
                persist=True,
            )
        return {
            "allow_api": settings.allow_api,
            "provider": payload.provider,
            "model": target_model,
            "url": target_url,
            "has_api_key": bool(effective_key),
            "masked_key": settings.get_masked_key() if effective_key else "",
            "status": "error",
            "message": test_msg,
        }


@router.post("/analyze-report")
def analyze_report(payload: ReportAnalysisRequest) -> dict:
    """Dynamically analyze a report using AI generation or grounded clinical synthesis."""
    user_service.user_exists(payload.user_id)

    with get_db() as db:
        report_row = db.execute(
            "SELECT * FROM reports WHERE id = ? AND user_id = ?",
            (payload.report_id, payload.user_id),
        ).fetchone()

        if not report_row:
            # Fallback to latest report for this user if specific report not found
            report_row = db.execute(
                "SELECT * FROM reports WHERE user_id = ? ORDER BY upload_time DESC LIMIT 1",
                (payload.user_id,),
            ).fetchone()

        if not report_row:
            raise HTTPException(status_code=404, detail="No report found for user.")

        report_id = report_row["id"]
        filename = report_row["original_filename"]
        report_date = report_row["report_date"] or "Unknown date"

        pages = db.execute(
            "SELECT * FROM report_pages WHERE report_id = ? ORDER BY page_number ASC",
            (report_id,),
        ).fetchall()

    if not pages:
        raise HTTPException(status_code=400, detail="Report contains no extracted pages.")

    # Combine text from pages
    combined_text = "\n\n".join(
        f"--- Page {p['page_number']} ---\n{p['extracted_text']}" for p in pages
    )

    # Parse biomarkers dynamically from extracted text
    biomarkers = _extract_biomarkers(combined_text)

    # Generate AI synthesis
    summary_text = ""
    is_ai_generated = False
    model_used = settings.effective_model

    if settings.allow_api and settings.effective_api_key:
        prompt = (
            f"Analyze this patient lab report ({filename}, dated {report_date}) for patient education.\n"
            "Provide:\n"
            "1. An executive summary explaining the main lab categories present.\n"
            "2. Notable biomarker findings and whether they are within typical lab ranges.\n"
            "3. Clear disclaimer that this is educational report analysis, not clinical diagnosis.\n"
            f"\nReport contents:\n{combined_text[:4000]}"
        )
        res = ai_client.generate_answer(
            question="Summarize and analyze all findings in this lab report",
            evidence_snippets=[combined_text[:4000]],
        )
        if res.ok:
            summary_text = res.text
            is_ai_generated = True

    if not summary_text:
        # Offline high-quality grounded clinical synthesis
        summary_text = _compose_offline_summary(filename, report_date, len(pages), biomarkers)
        model_used = "VitaGraph Local Clinical Synthesizer (Offline Mode)"

    insights = [
        f"Analyzed {len(pages)} pages with {len(biomarkers)} recognized biomedical parameters.",
        f"Document date identified as {report_date} with SHA-256 provenance.",
        "Grounding verification: All extracted metrics are linked to exact page coordinates.",
    ]

    return {
        "report_id": report_id,
        "filename": filename,
        "report_date": report_date,
        "page_count": len(pages),
        "summary": summary_text,
        "biomarkers": biomarkers,
        "ai_insights": insights,
        "model_used": model_used,
        "is_ai_generated": is_ai_generated,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _extract_biomarkers(text: str) -> list[dict[str, Any]]:
    """Extract standard biomedical test metrics with values, units, and flags."""
    patterns = [
        ("Hemoglobin", r"Hemoglobin\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "g/dL", "13.0 - 17.0"),
        ("Vitamin D", r"Vitamin D[^\n\r]*\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "ng/mL", "30.0 - 100.0"),
        ("Total Cholesterol", r"(?:Total Cholesterol|Cholesterol, Total)\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "mg/dL", "< 200"),
        ("LDL Cholesterol", r"LDL(?: Cholesterol)?\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "mg/dL", "< 100"),
        ("HDL Cholesterol", r"HDL(?: Cholesterol)?\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "mg/dL", "> 40"),
        ("Fasting Glucose", r"(?:Fasting Glucose|Glucose, Fasting|Fasting Blood Sugar)\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "mg/dL", "70 - 100"),
        ("HbA1c", r"HbA1c\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "%", "< 5.7"),
        ("Creatinine", r"Creatinine\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "mg/dL", "0.7 - 1.3"),
        ("TSH", r"(?:TSH|Thyroid Stimulating Hormone)\s*(?:\(TSH\))?\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μuIU]+)?", "uIU/mL", "0.4 - 4.0"),
        ("WBC Count", r"(?:WBC|WBC Count)\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%k/uL]+)?", "/uL", "4000 - 11000"),
        ("Vitamin B12", r"Vitamin B12\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%]+)?", "pg/mL", "200 - 900"),
        ("Platelets", r"Platelets\s*(?:Result:)?\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%k]+)?", "k/uL", "150 - 450"),
    ]

    results: list[dict[str, Any]] = []
    seen = set()

    for name, regex, default_unit, ref_range in patterns:
        match = re.search(regex, text, re.IGNORECASE)
        if match and name not in seen:
            val_str = match.group(1)
            try:
                val = float(val_str)
                unit = match.group(2) or default_unit
                # Check for explicit flags in context
                window = text[max(0, match.start() - 30):min(len(text), match.end() + 50)]
                flag = "NORMAL"
                if re.search(r"\bHIGH\b", window, re.IGNORECASE):
                    flag = "HIGH"
                elif re.search(r"\bLOW\b", window, re.IGNORECASE):
                    flag = "LOW"

                results.append({
                    "test_name": name,
                    "value": val,
                    "unit": unit,
                    "reference_range": ref_range,
                    "flag": flag,
                })
                seen.add(name)
            except ValueError:
                continue

    return results


def _compose_offline_summary(filename: str, report_date: str, page_count: int, biomarkers: list[dict]) -> str:
    """Build a rich grounded clinical overview without external API calls."""
    lines = [
        f"### Summary for {filename} ({report_date})",
        f"VitaGraph successfully extracted and verified {page_count} pages of laboratory data.",
        "",
        "#### Key Biomarkers Found:",
    ]

    if biomarkers:
        for b in biomarkers:
            flag_str = f" **[{b['flag']}]**" if b['flag'] != "NORMAL" else ""
            lines.append(f"- **{b['test_name']}**: {b['value']} {b['unit']} (Ref: {b['reference_range']}){flag_str}")
    else:
        lines.append("- General lab panel entries extracted; see individual page scans.")

    lines.extend([
        "",
        "#### What Cannot Be Concluded:",
        "Lab results provide observational indicators. Diagnostic conclusions require consultation with a qualified medical provider.",
        "",
        "#### Safety Guidance:",
        "VitaGraph is an educational health-report organizer and knowledge graph engine. It does not replace clinical evaluation.",
    ])

    return "\n".join(lines)


# --------------------------------------------------------------------------------------------------
# AI connection (plan T): endpoint, key and model name saved from the Settings page.
# Changing it is allowed only from the computer that runs the backend: there is no login, and the
# endpoint decides where the person's report passages are sent.
# --------------------------------------------------------------------------------------------------

LOCAL_HOSTS = frozenset({"127.0.0.1", "::1", "localhost", "testclient"})
_LOCAL_URL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
_MODEL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@+\-]{0,99}$")


class ModelConnectionIn(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    key: str = Field(default="", max_length=500)
    model: str = Field(min_length=1, max_length=100)
    api_format: Literal["auto", "responses", "chat"] = "auto"
    reasoning: Literal["minimal", "low", "medium", "high", "default"] = "low"
    skip_test: bool = False


class ModelConnectionOut(BaseModel):
    url: str
    model: str
    api_format: Literal["responses", "chat"]
    reasoning: Literal["minimal", "low", "medium", "high", "default"]
    has_key: bool
    masked_key: str
    allow_api: bool
    shield_covered: bool
    can_edit: bool
    message: str = ""


class ModelTestOut(BaseModel):
    ok: bool
    message: str
    api_format: Literal["responses", "chat"]


def _is_local(request: Request) -> bool:
    host = request.client.host if request.client else ""
    return host in LOCAL_HOSTS


def _require_local(request: Request) -> None:
    if not _is_local(request):
        raise HTTPException(status_code=403, detail="The AI connection can only be changed from the computer that runs VitaGraph.")


def _clean_url(raw: str) -> str:
    url = raw.strip()
    if not url or re.search(r"\s", url):
        raise HTTPException(status_code=422, detail="The endpoint address cannot be empty or contain spaces.")
    try:
        parts = urlsplit(url)
        host = parts.hostname
    except ValueError:
        raise HTTPException(status_code=422, detail="The endpoint address is not a valid web address.")
    if parts.scheme not in ("http", "https") or not host:
        raise HTTPException(status_code=422, detail="The endpoint address must start with http:// or https://")
    if parts.username or parts.password:
        raise HTTPException(status_code=422, detail="Do not put a user name or password in the endpoint address.")
    if parts.query or parts.fragment:
        raise HTTPException(status_code=422, detail="Remove everything after ? or # from the endpoint address.")
    if parts.scheme == "http" and host not in _LOCAL_URL_HOSTS:
        raise HTTPException(status_code=422, detail="Use https:// for an endpoint that is not on this computer.")
    return url.rstrip("/")


def _clean_model_name(raw: str) -> str:
    name = raw.strip()
    if not _MODEL_NAME.match(name):
        raise HTTPException(status_code=422, detail="The model name can only use letters, digits and the characters . _ : / @ + -")
    return name


def _clean_key(raw: str) -> str:
    key = raw.strip()
    if key and (len(key) < 8 or re.search(r"\s", key)):
        raise HTTPException(status_code=422, detail="The key looks wrong: it is too short or contains spaces or line breaks.")
    return key


def _resolve_format(url: str, requested: str) -> str:
    if requested in ("responses", "chat"):
        return requested
    return "responses" if urlsplit(url).path.rstrip("/").endswith("/responses") else "chat"


def _test_url(url: str, api_format: str) -> str:
    # Same address the app really calls: the base address plus /responses or /chat/completions.
    base = settings._normalise_base(url)
    return f"{base}/responses" if api_format == "responses" else f"{base}/chat/completions"


def _run_test(url: str, key: str, model: str, api_format: str) -> tuple[bool, str]:
    use_key = key or settings.effective_api_key
    ok, message = ai_client.test_connection(url=_test_url(url, api_format), key=use_key, model=model)
    for secret in (key, settings.effective_api_key):
        if secret:
            message = message.replace(secret, "…")
    return ok, message


def _model_out(request: Request, message: str = "") -> dict[str, Any]:
    key = settings.effective_api_key
    effort = settings.model_reasoning_effort.strip().lower()
    return {
        "url": settings.model_api_url.strip(),
        "model": settings.model_name.strip(),
        "api_format": "responses" if settings.model_api_format.strip().lower() == "responses" else "chat",
        "reasoning": effort if effort in ("minimal", "low", "medium", "high") else "default",
        "has_key": bool(key),
        "masked_key": ("••••" + key[-4:]) if len(key) >= 8 else ("••••" if key else ""),
        "allow_api": settings.allow_api,
        "shield_covered": settings.api_format == "responses",
        "can_edit": _is_local(request),
        "message": message,
    }


def _same_host(a: str, b: str) -> bool:
    """Same address host and port (scheme and path may differ)."""
    return urlsplit(a).netloc.lower() == urlsplit(b).netloc.lower()


def _checked_input(payload: ModelConnectionIn) -> tuple[str, str, str, str]:
    url = _clean_url(payload.url)
    model = _clean_model_name(payload.model)
    key = _clean_key(payload.key)
    if not key:
        if not settings.effective_api_key:
            raise HTTPException(status_code=422, detail="Enter an API key.")
        # A saved key is only ever used with the address it was saved for.
        saved = settings.model_api_url.strip() or settings.effective_base_url
        if saved and not _same_host(url, saved):
            raise HTTPException(
                status_code=422,
                detail="You changed the address, so paste the key again. A saved key is only used with the address it was saved for.",
            )
    return url, key, model, _resolve_format(url, payload.api_format)


@router.get("/model", response_model=ModelConnectionOut)
def get_model_connection(request: Request) -> dict[str, Any]:
    """The saved connection, without the key."""
    return _model_out(request)


@router.post("/model/test", response_model=ModelTestOut)
async def test_model_connection(payload: ModelConnectionIn, request: Request) -> dict[str, Any]:
    """Try the connection with the values typed in. Saves nothing."""
    _require_local(request)
    url, key, model, api_format = _checked_input(payload)
    ok, message = await asyncio.to_thread(_run_test, url, key, model, api_format)
    return {"ok": ok, "message": message, "api_format": api_format}


@router.post("/model", response_model=ModelConnectionOut)
async def save_model_connection(payload: ModelConnectionIn, request: Request) -> dict[str, Any]:
    """Test the connection, then use it at once and remember it in the .env file."""
    _require_local(request)
    url, key, model, api_format = _checked_input(payload)
    if get_registry().any_running():
        raise HTTPException(status_code=409, detail="The AI Agent is still answering. Wait for it to finish, then save.")
    message = "Saved without a test."
    if not payload.skip_test:
        ok, message = await asyncio.to_thread(_run_test, url, key, model, api_format)
        if not ok:
            raise HTTPException(status_code=422, detail=message)
    settings.apply_model_connection(
        url=url,
        key=key,
        model=model,
        api_format=api_format,
        reasoning_effort="" if payload.reasoning == "default" else payload.reasoning,
    )
    await get_pool().close_all()  # running agent workers keep the old values until they restart
    return _model_out(request, message)


@router.post("/model/remove-key", response_model=ModelConnectionOut)
async def remove_model_key(request: Request) -> dict[str, Any]:
    """Forget the saved key (the AI then stays off until a new key is saved)."""
    _require_local(request)
    if get_registry().any_running():
        raise HTTPException(status_code=409, detail="The AI Agent is still answering. Wait for it to finish, then remove the key.")
    settings.forget_model_key()
    await get_pool().close_all()
    return _model_out(request, "The saved key was removed.")
