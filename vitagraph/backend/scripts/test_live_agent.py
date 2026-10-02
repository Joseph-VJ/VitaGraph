"""Live Terminal Trace Script for AgentRouter LLM Service.

Executes stream_agent_rag using deepseek-v4-flash, prints colorized
events (thinking, tool_call, tool_result, text_delta, completed, error)
in real-time to the terminal using rich, and outputs a transcript to AGENT_PROOF.md.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any
from unittest.mock import patch

# Ensure vitagraph/backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.text import Text

from app.core.config import settings
from app.core.database import get_db
from app.services import llm_service
from app.services.llm_service import stream_agent_rag

console = Console(highlight=False, legacy_windows=False)
ROOT_DIR = backend_dir.parent.parent
PROOF_FILE = ROOT_DIR / "AGENT_PROOF.md"


def get_active_user_id() -> str:
    """Fetch an existing active patient user ID, or fallback to default."""
    try:
        with get_db() as db:
            row = db.execute("SELECT id FROM users WHERE status = 'active' LIMIT 1").fetchone()
            if row:
                return row["id"] if isinstance(row, dict) else row[0]
    except Exception:
        pass
    return "usr_demo_patient"


class ProofLogger:
    """Logs SSE events to both console and AGENT_PROOF.md."""

    def __init__(self, output_path: Path):
        self.output_path = output_path
        self.events: list[dict[str, Any]] = []
        self.thinking_accumulator: list[str] = []
        self.text_accumulator: list[str] = []
        self.start_time = time.time()

    def record_event(self, event_type: str, payload: dict[str, Any]):
        timestamp = time.strftime("%H:%M:%S", time.localtime())
        self.events.append({
            "timestamp": timestamp,
            "type": event_type,
            "payload": payload,
        })

    def render_console(self, event_type: str, payload: dict[str, Any]):
        if event_type == "thinking":
            token = payload.get("thinking", "")
            self.thinking_accumulator.append(token)
            console.print(f"[dim blue]{token}[/dim blue]", end="", highlight=False)

        elif event_type == "tool_call":
            console.print()
            tool_name = payload.get("tool", "")
            args = payload.get("arguments", {})
            call_id = payload.get("id", "")
            console.print(
                f"[bold yellow][TOOL CALL][/bold yellow] [bold]{tool_name}[/bold] "
                f"[dim](id: {call_id})[/dim] -> [yellow]{json.dumps(args)}[/yellow]"
            )

        elif event_type == "tool_result":
            tool_name = payload.get("tool", "")
            result = payload.get("result", {})
            result_preview = json.dumps(result, indent=2)
            if len(result_preview) > 300:
                result_preview = result_preview[:300] + "... (truncated)"
            console.print(
                f"[bold green][TOOL RESULT][/bold green] [green]{tool_name} returned:[/green]\n"
                f"[dim green]{result_preview}[/dim green]"
            )

        elif event_type == "text_delta":
            delta = payload.get("delta", "")
            self.text_accumulator.append(delta)
            console.print(f"[white]{delta}[/white]", end="", highlight=False)

        elif event_type == "model_fallback":
            console.print()
            old_m = payload.get("from", "")
            new_m = payload.get("to", "")
            reason = payload.get("reason", "")
            console.print(
                f"[bold magenta][MODEL FALLBACK][/bold magenta] "
                f"[yellow]{old_m}[/yellow] -> [bold cyan]{new_m}[/bold cyan] "
                f"[dim]({reason[:120]})[/dim]"
            )

        elif event_type == "completed":
            console.print()
            console.print(Rule(style="green"))
            model_used = payload.get("model", "unknown")
            console.print(
                f"[bold green][COMPLETED][/bold green] "
                f"Status: [cyan]{payload.get('status')}[/cyan] | "
                f"Model Responded: [bold yellow]{model_used}[/bold yellow] | "
                f"Safety Verified: [{'green' if payload.get('safety_passed') else 'red'}]{payload.get('safety_passed')}[/] | "
                f"Evidence Count: [cyan]{payload.get('evidence_count')}[/cyan]"
            )
            if payload.get("safety_note"):
                console.print(f"[dim italic]Safety note: {payload.get('safety_note')}[/dim italic]")

        elif event_type == "error":
            console.print()
            console.print(
                f"[bold red][ERROR][/bold red] [red]{payload.get('message')}[/red]\n"
                f"[dim red]Diagnostic: {payload.get('diagnostic')}[/dim red]"
            )

    def write_proof_markdown(self, question: str, target_model: str, live_status: str, actual_model: str = ""):
        elapsed = time.time() - self.start_time
        lines = [
            "# VitaGraph AgentRouter Live Terminal Trace Proof",
            "",
            f"**Execution Timestamp:** `{time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}`  ",
            f"**Target Model:** `{target_model}`  ",
            f"**Responding Model:** `{actual_model or target_model}`  ",
            f"**Gateway URL:** `{settings.effective_base_url}`  ",
            f"**Status / Outcome:** `{live_status}`  ",
            f"**Total Trace Duration:** `{elapsed:.2f}s`  ",
            "",
            "## 1. Test Medical Query",
            f"> **Question:** \"{question}\"",
            "",
            "---",
            "",
            "## 2. Real-Time Event Sequence Log",
            "",
            "| Step | Event Type | Description / Content |",
            "|---|---|---|",
        ]

        for i, ev in enumerate(self.events, start=1):
            etype = ev["type"]
            pl = ev["payload"]
            if etype == "thinking":
                desc = f"Thinking token: `{pl.get('thinking', '')[:80]}`"
            elif etype == "tool_call":
                desc = f"Invoke tool `{pl.get('tool')}` with `{json.dumps(pl.get('arguments'))}`"
            elif etype == "tool_result":
                res_str = json.dumps(pl.get('result', {}))
                desc = f"Tool result for `{pl.get('tool')}`: `{res_str[:90]}...`"
            elif etype == "text_delta":
                desc = f"Delta chunk: `{pl.get('delta', '')[:60]}`"
            elif etype == "model_fallback":
                desc = f"Model fallback: `{pl.get('from')}` -> `{pl.get('to')}`: `{pl.get('reason')}`"
            elif etype == "completed":
                desc = f"Completed (model={pl.get('model')}, safety_passed={pl.get('safety_passed')}, evidence={pl.get('evidence_count')})"
            elif etype == "error":
                desc = f"Error: `{pl.get('message')}`"
            else:
                desc = str(pl)[:80]
            lines.append(f"| {i} | `{etype}` | {desc} |")

        lines.extend([
            "",
            "---",
            "",
            "## 3. Synthesized 4-Part Clinical Answer",
            "",
        ])

        full_text = "".join(self.text_accumulator).strip()
        if full_text:
            lines.append("```text")
            lines.append(full_text)
            lines.append("```")
        else:
            lines.append("*No text generated due to upstream error state.*")

        lines.extend([
            "",
            "---",
            "",
            "## 4. Raw Event Payloads Dump",
            "```json",
            json.dumps(self.events, indent=2),
            "```",
        ])

        self.output_path.write_text("\n".join(lines), encoding="utf-8")
        console.print(f"\n[bold green]Proof successfully written to:[/bold green] {self.output_path}")


async def create_mock_stream_generator(messages: list[dict], user_id: str):
    """
    Simulates high-fidelity DeepSeek V4 Flash streaming tokens
    executing real tool calls and synthesizing a 4-part grounded clinical answer.
    """
    class MockDelta:
        def __init__(self, content=None, reasoning_content=None, tool_calls=None):
            self.content = content
            self.reasoning_content = reasoning_content
            self.tool_calls = tool_calls

    class MockChoice:
        def __init__(self, delta):
            self.delta = delta

    class MockChunk:
        def __init__(self, choices):
            self.choices = choices

    class MockToolCall:
        def __init__(self, index, call_id, name, args):
            self.index = index
            self.id = call_id
            self.function = type("Fn", (), {"name": name, "arguments": args})()

    has_tool_results = any(m.get("role") == "tool" for m in messages)

    if not has_tool_results:
        # Step 1: Thinking and tool calling phase
        yield MockChunk([MockChoice(MockDelta(reasoning_content="[Analyzing query] Patient inquiry regards HbA1c trajectory and clinical safety warnings.\n"))])
        await asyncio.sleep(0.03)
        yield MockChunk([MockChoice(MockDelta(reasoning_content="[Reasoning] Need to query ChromaDB for laboratory report text chunks discussing HbA1c and glycation.\n"))])
        await asyncio.sleep(0.03)
        yield MockChunk([MockChoice(MockDelta(reasoning_content="[Reasoning] Need to query NetworkX graph to trace Fasting Glucose and HbA1c relationships across reports.\n"))])
        await asyncio.sleep(0.04)

        # Emit tool calls
        tc1 = MockToolCall(0, "call_chroma_01", "search_chroma", json.dumps({"query": "HbA1c glycated hemoglobin diabetes", "top_k": 3}))
        tc2 = MockToolCall(1, "call_graph_02", "query_networkx_graph", json.dumps({"concept": "Glucose"}))
        yield MockChunk([MockChoice(MockDelta(tool_calls=[tc1, tc2]))])
    else:
        # Step 2: Final 4-part clinical synthesis phase
        yield MockChunk([MockChoice(MockDelta(reasoning_content="[Synthesis] Synthesizing longitudinal measurements from ChromaDB and NetworkX graph.\n"))])
        yield MockChunk([MockChoice(MockDelta(reasoning_content="[Structure] Structuring into strict 4-part format: 1. Summary, 2. Evidence, 3. Limitations, 4. Safety.\n"))])
        await asyncio.sleep(0.04)

        answer_text = (
            "1. Summary:\n"
            "Review of the patient's retrieved laboratory documents confirms Hemoglobin is measured at "
            "14.1 g/dL in the June 2025 panel. Fasting Glucose was previously recorded at 96.0 mg/dL in January 2025. "
            "A specific glycated hemoglobin (HbA1c %) assay was not detected in the current panel.\n\n"
            "2. Evidence:\n"
            "- Report 'synthetic_panel_2025-06-20.pdf' (20 June 2025): Hemoglobin Result = 14.1 g/dL.\n"
            "- NetworkX Graph Node: 'meas_Fasting_Glucose_20_June_2025_92.0' connected to 'sec_Metabolic_Panel'.\n\n"
            "3. Limitations:\n"
            "- Standard HbA1c testing is absent from the uploaded metabolic panels.\n"
            "- Findings reflect only the two available documentation dates.\n\n"
            "4. Safety:\n"
            "- Hemoglobin concentration remains at 14.1 g/dL.\n"
            "- For diabetes screening, prediabetes evaluation, or comprehensive glycemic control assessment, "
            "please consult a licensed healthcare professional for dedicated HbA1c testing."
        )

        for word in answer_text.split(" "):
            yield MockChunk([MockChoice(MockDelta(content=word + " "))])
            await asyncio.sleep(0.02)


async def main():
    use_mock = "--mock" in sys.argv

    console.print()
    console.print(Panel.fit(
        f"[bold cyan]VitaGraph AgentRouter Live Terminal Trace[/bold cyan]\n"
        f"[dim]Model: deepseek-v4-flash | Mode: {'Offline Mock (--mock)' if use_mock else 'Live Gateway Stream'} | Engine: app.services.llm_service[/dim]",
        border_style="cyan"
    ))

    # 1. Override the model strictly for this execution
    target_model = "deepseek-v4-flash"
    settings.agentrouter_model = target_model
    settings.ai_service_model = target_model

    console.print(f"[bold]Active Primary Model:[/bold] [yellow]{settings.effective_model}[/yellow]")
    console.print(f"[bold]Fallback Model Chain:[/bold] [yellow]{settings.model_chain}[/yellow]")
    console.print(f"[bold]Gateway Base URL:[/bold] [cyan]{settings.effective_base_url}[/cyan]")
    console.print(f"[bold]API Key:[/bold] [dim]{settings.effective_api_key[:10]}...{settings.effective_api_key[-4:]}[/dim]")

    user_id = get_active_user_id()
    console.print(f"[bold]Patient Context ID:[/bold] [cyan]{user_id}[/cyan]\n")

    test_question = "Analyze the HbA1c trends and check for any safety warnings in the uploaded documents."
    console.print(f"[bold magenta]Query:[/bold magenta] \"{test_question}\"\n")

    logger = ProofLogger(PROOF_FILE)

    if use_mock:
        console.print(Rule("OFFLINE MOCK STREAM EXECUTION (--mock)", style="magenta"))
        async def mock_call(client, messages, model, tools=None):
            return create_mock_stream_generator(messages, user_id)

        with patch("app.services.llm_service.create_chat_completion_stream", side_effect=mock_call):
            async for event_type, payload in stream_agent_rag(
                user_id=user_id,
                question=test_question,
            ):
                logger.record_event(event_type, payload)
                logger.render_console(event_type, payload)

        logger.write_proof_markdown(test_question, target_model, "Offline Mock Simulation (--mock)", actual_model="deepseek-v4-flash-simulated")
        return

    console.print(Rule("LIVE STREAM EXECUTION", style="cyan"))
    console.print("[dim]Connecting to AgentRouter gateway...[/dim]\n")
    live_failed = False
    error_payload = None
    actual_model_used = None

    try:
        async for event_type, payload in stream_agent_rag(
            user_id=user_id,
            question=test_question,
        ):
            logger.record_event(event_type, payload)
            logger.render_console(event_type, payload)
            if event_type == "completed":
                actual_model_used = payload.get("model")
            elif event_type == "error":
                live_failed = True
                error_payload = payload
    except Exception as exc:
        live_failed = True
        err_dict = {"status": "error", "message": str(exc), "diagnostic": "Exception during stream"}
        logger.record_event("error", err_dict)
        logger.render_console("error", err_dict)
        error_payload = err_dict

    if live_failed:
        console.print()
        console.print(Rule("LIVE STREAM FAILED", style="red"))
        err_msg = str(error_payload.get("message") if isinstance(error_payload, dict) else error_payload)
        if "403" in err_msg or "无权访问" in err_msg:
            console.print(
                "[bold red]Live AgentRouter call failed: Token model scope is restricted - fix in console.[/bold red]\n"
                "[yellow]Action Required: Enable deepseek-v4-flash at https://agentrouter.org/console/token.[/yellow]\n"
                "[dim]For an offline architectural demo, run: python scripts/test_live_agent.py --mock[/dim]"
            )
        else:
            console.print(f"[bold red]Live AgentRouter call failed:[/bold red] {err_msg}")
        logger.write_proof_markdown(test_question, target_model, f"Live Gateway Failed: {err_msg[:100]}")
    else:
        console.print()
        console.print(Rule("LIVE STREAM SUCCESS (200 OK)", style="green"))
        console.print(f"[bold green]Live stream completed successfully (200 OK) via model:[/bold green] [bold cyan]{actual_model_used or target_model}[/bold cyan]")
        logger.write_proof_markdown(test_question, target_model, "Live Gateway 200 OK", actual_model=actual_model_used or target_model)


if __name__ == "__main__":
    asyncio.run(main())

