"""Neutral AI generation service client (plan Sections 2.3 and 3.3).

The backend is the ONLY component allowed to contact the generation
service. The client is provider-neutral: it speaks the common
chat-completions contract and takes its endpoint, key, and model label
from configuration. No provider or model name is hard-coded here.

Controls required by the plan:
  - allow_api must be enabled before any request is sent
  - timeouts and safe error handling (never raises to the caller)
  - request identifiers for the audit trail
  - disabled-service mode that leaves all local features working
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import httpx

from app.core.config import settings

CONFIG_VERSION = "neutral-openai-compatible-v2-med-edu"


@dataclass
class GenerationResult:
    ok: bool
    text: str = ""
    request_id: str = ""
    status: str = "ok"          # ok | error | disabled
    error: str | None = None


def _instruction_prompt(question: str, evidence_snippets: list[str]) -> list[dict]:
    """Build the request payload. Only selected evidence crosses the boundary."""
    evidence_block = "\n\n".join(
        f"[{i}] {snippet.strip()}" for i, snippet in enumerate(evidence_snippets, start=1)
    )
    system = (
        "You are VitaGraph's medical-information assistant: an AI that "
        "explains laboratory health reports in plain, friendly language for "
        "education. You receive ONLY snippets retrieved from the user's own "
        "uploaded reports.\n"
        "HOW TO ANSWER:\n"
        "- Explain what each relevant test generally measures (educational "
        "background, useful for a student user).\n"
        "- Restate the user's values, units, reference ranges, dates, and any "
        "lab flags EXACTLY as they appear in the evidence — never invent or "
        "alter a number, unit, or date.\n"
        "- You may note when a value sits above or below the reference range "
        "shown in the report itself, and restate flags like LOW/HIGH as the "
        "report's own statements.\n"
        "- If evidence spans multiple report dates, compare values across "
        "dates factually (e.g. from X in January to Y in June) and note which "
        "tests appear only in some reports.\n"
        "- Keep general educational context clearly separate from the user's "
        "own data.\n"
        "BOUNDARIES (mandatory, no exceptions):\n"
        "- NEVER diagnose, never state the user has or lacks a condition, "
        "never recommend, change, or stop medication, never suggest "
        "treatments, never triage emergencies — direct all of these to a "
        "qualified healthcare professional.\n"
        "- Never state or imply that one observation caused another.\n"
        "- If the evidence does not answer the question, say so plainly "
        "instead of using general medical knowledge to fill the gap.\n"
        "STRUCTURE the reply in three sections with these headings: "
        "WHAT YOUR REPORTS SAY (with page references like p. 1), "
        "WHAT CANNOT BE CONCLUDED, and SAFETY GUIDANCE."
    )
    user = f"Question: {question}\n\nEvidence snippets from the user's reports:\n{evidence_block}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _build_headers_and_url(url: str, key: str, request_id: str) -> tuple[str, dict]:
    """Prepare request headers and URL, handling provider quirks."""
    target_url = url.strip()
    headers = {
        "Authorization": f"Bearer {key.strip()}",
        "Content-Type": "application/json",
        "X-Request-Id": request_id,
    }
    # Google Gemini OpenAI-compatible endpoint accepts key parameter or Bearer token
    if "generativelanguage.googleapis.com" in target_url and "key=" not in target_url:
        separator = "&" if "?" in target_url else "?"
        target_url = f"{target_url}{separator}key={key.strip()}"
    return target_url, headers


def test_connection(url: str, key: str, model: str, timeout: int = 12) -> tuple[bool, str]:
    """Test AI API connectivity with a lightweight ping prompt. Never raises."""
    if not key.strip():
        return False, "API key is required."
    if not url.strip():
        return False, "AI Service URL is required."

    request_id = f"test_{uuid.uuid4().hex[:8]}"
    target_url, headers = _build_headers_and_url(url, key, request_id)
    payload = {
        "model": model.strip(),
        "messages": [
            {"role": "system", "content": "You are an AI assistant. Ping test."},
            {"role": "user", "content": "Hello. Please reply with the single word 'OK'."},
        ],
        "max_tokens": 10,
        "temperature": 0.0,
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(target_url, json=payload, headers=headers)
            if resp.status_code == 401:
                return False, "Authentication failed (HTTP 401): Invalid API key or unauthorized client."
            if resp.status_code == 403:
                return False, "Access forbidden (HTTP 403): Check model permissions or regional availability."
            if resp.status_code == 404:
                return False, f"Not found (HTTP 404): Check endpoint URL and model name '{model}'."
            if resp.status_code == 429:
                return False, "Rate limit exceeded or API quota exhausted (HTTP 429)."
            resp.raise_for_status()
            data = resp.json()
            if "choices" in data and len(data["choices"]) > 0:
                reply = data["choices"][0].get("message", {}).get("content", "").strip()
                return True, f"Connection verified. Model responded: '{reply or 'OK'}'"
            return True, "Connection verified successfully."
    except httpx.TimeoutException:
        return False, f"Connection timed out after {timeout}s. Check URL reachability or network connection."
    except Exception as exc:
        return False, f"Connection failed: {str(exc)}"


def generate_answer(question: str, evidence_snippets: list[str]) -> GenerationResult:
    """Call the configured generation service. Never raises."""
    if not settings.allow_api:
        return GenerationResult(
            ok=False,
            status="disabled",
            request_id="",
            error="AI generation service is disabled (allow_api=false); using local composer.",
        )

    if not (settings.ai_service_api_key or "").strip():
        return GenerationResult(
            ok=False,
            status="disabled",
            request_id="",
            error="AI API key is not configured; using local composer.",
        )

    request_id = f"gen_{uuid.uuid4().hex[:12]}"
    target_url, headers = _build_headers_and_url(
        settings.ai_service_url, settings.ai_service_api_key, request_id
    )
    payload = {
        "model": settings.ai_service_model,
        "messages": _instruction_prompt(question, evidence_snippets),
        "temperature": 0.1,
    }

    try:
        with httpx.Client(timeout=settings.ai_service_timeout_seconds) as client:
            response = client.post(target_url, json=payload, headers=headers)
            status_code = getattr(response, "status_code", 200)
            if status_code == 401:
                return GenerationResult(
                    ok=False,
                    status="error",
                    request_id=request_id,
                    error="AI service authentication failed (HTTP 401): Check your API key.",
                )
            if status_code == 429:
                return GenerationResult(
                    ok=False,
                    status="error",
                    request_id=request_id,
                    error="AI service quota exceeded (HTTP 429): Check your usage limits.",
                )
            response.raise_for_status()
            data = response.json()
        text = data["choices"][0]["message"]["content"].strip()
        return GenerationResult(ok=True, text=text, request_id=request_id, status="ok")
    except Exception as exc:
        return GenerationResult(
            ok=False,
            status="error",
            request_id=request_id,
            error=f"Generation service request failed: {exc}",
        )

