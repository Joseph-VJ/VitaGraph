"""AgentRouter LLM service integration.

Provides OpenAI/Anthropic-compatible frontier model access via AgentRouter AI Gateway
(https://agentrouter.org/v1). Supports:
- Streaming reasoning / thinking tokens
- Tool calling (search_chroma, query_networkx_graph)
- 4-part grounded RAG answers (Summary, Evidence, Limitations, Safety)
- Transient error resilience and retries via tenacity
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, AsyncGenerator

import httpx
from openai import (
    AsyncOpenAI,
    RateLimitError,
    APIConnectionError,
    InternalServerError,
    APITimeoutError,
    PermissionDeniedError,
    NotFoundError,
    APIStatusError,
)
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.generation.safety import check_answer_safety, SAFETY_TEXT
from app.graph import builder as graph_builder
from app.rag import retriever

logger = logging.getLogger(__name__)

# System prompt enforcing strict 4-part grounded health explanation
RAG_SYSTEM_PROMPT = (
    "You are VitaGraph's medical-information assistant: an AI that explains "
    "laboratory health reports in plain, structured, educational language.\n"
    "You have access to tools to search the patient's report chunks (search_chroma) "
    "and query the patient's knowledge graph (query_networkx_graph).\n\n"
    "BOUNDARIES (mandatory, no exceptions):\n"
    "- NEVER diagnose any condition or suggest the user has or lacks a disease.\n"
    "- NEVER recommend, change, or stop medication, and never suggest treatments.\n"
    "- NEVER triage emergencies; direct urgent concerns to a healthcare professional immediately.\n"
    "- Only state facts and measurements that appear in retrieved evidence or graph relationships.\n"
    "- NEVER invent or alter numbers, units, reference ranges, or dates.\n\n"
    "RESPONSE STRUCTURE:\n"
    "Format the response into exactly 4 sections with these headings:\n"
    "1. SUMMARY: Plain educational background on what the tests measure, followed by "
    "exact restatement of patient's observed values, units, reference ranges, and flags.\n"
    "2. EVIDENCE: Specific citations noting report filenames, dates, and page numbers.\n"
    "3. LIMITATIONS: What cannot be concluded clinically; gaps in report data; non-causal nature of observations.\n"
    "4. SAFETY: Reiterate that VitaGraph is educational and advise consultation with a qualified clinician."
)

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_chroma",
            "description": (
                "Search the patient's uploaded health reports in ChromaDB vector store "
                "for relevant clinical text, lab observations, values, units, reference ranges, and dates."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Clinical search query or test name (e.g., 'Hemoglobin', 'Vitamin D', 'Lipid Panel').",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Maximum number of evidence chunks to retrieve (default: 5).",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_networkx_graph",
            "description": (
                "Query the patient's clinical knowledge graph in NetworkX to discover "
                "connected entities, biomarkers, relationships across reports, categories, and test panels."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "concept": {
                        "type": "string",
                        "description": (
                            "Entity or biomarker concept name to inspect in the graph "
                            "(e.g., 'Hemoglobin', 'Vitamin D', 'Cholesterol'). If omitted, returns active key entities."
                        ),
                    },
                },
            },
        },
    },
]


def get_client() -> AsyncOpenAI:
    """Create configured AsyncOpenAI client targeting AgentRouter."""
    base_url = settings.effective_base_url
    api_key = settings.effective_api_key or "sk-agentrouter-placeholder"
    timeout = settings.ai_service_timeout_seconds

    return AsyncOpenAI(
        base_url=base_url,
        api_key=api_key,
        timeout=timeout,
        default_headers={"User-Agent": "RooCode/0.15.0"},
    )


def execute_tool(name: str, arguments: dict[str, Any], user_id: str) -> dict[str, Any]:
    """Execute a RAG tool and return structured payload."""
    if name == "search_chroma":
        query = arguments.get("query", "")
        top_k = arguments.get("top_k", 5)
        try:
            hits = retriever.retrieve(user_id=user_id, question=query, top_k=top_k)
            return {
                "evidence": [
                    {
                        "chunk_id": h.get("chunk_id"),
                        "snippet": h.get("document", "")[:400],
                        "report_filename": h.get("report_filename"),
                        "report_date": h.get("report_date"),
                        "page_number": h.get("metadata", {}).get("page_number", 1),
                        "score": round(float(h.get("score", 0.0)), 3),
                    }
                    for h in hits
                ]
            }
        except Exception as exc:
            return {"error": f"ChromaDB retrieval error: {str(exc)}"}

    elif name == "query_networkx_graph":
        concept = arguments.get("concept")
        try:
            graph, entities = graph_builder.build_user_graph(user_id)
            if concept:
                c_lower = concept.lower()
                matches = [n for n in graph.nodes if c_lower in str(n).lower()]
                sub_nodes = set(matches)
                for m in matches:
                    sub_nodes.update(graph.neighbors(m))
                sub = graph.subgraph(sub_nodes)
                return {
                    "matched_nodes": len(matches),
                    "nodes": [{"id": str(n), "type": graph.nodes[n].get("type", "entity")} for n in sub.nodes],
                    "edges": [{"source": str(u), "target": str(v)} for u, v in sub.edges],
                }
            else:
                return {
                    "total_nodes": graph.number_of_nodes(),
                    "total_edges": graph.number_of_edges(),
                    "active_tests": list(set(e.get("name") for e in entities if e.get("name")))[:10],
                }
        except Exception as exc:
            return {"error": f"NetworkX query error: {str(exc)}"}

    return {"error": f"Unknown tool '{name}'"}


# Retry policy on transient gateway/API errors (5xx, timeouts, connection drops)
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=6),
    retry=retry_if_exception_type((APIConnectionError, InternalServerError, APITimeoutError, httpx.RequestError)),
    reraise=True,
)
async def create_chat_completion_stream(
    client: AsyncOpenAI,
    messages: list[dict[str, Any]],
    model: str,
    tools: list[dict[str, Any]] | None = None,
):
    """Wrapped API call with automatic retry on transient gateway faults."""
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": 0.1,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    return await client.chat.completions.create(**kwargs)


# Alias for backward compatibility
_call_agentrouter_stream = create_chat_completion_stream


async def stream_agent_rag(
    user_id: str,
    question: str,
    initial_evidence: list[dict[str, Any]] | None = None,
) -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
    """Execute streaming RAG agent pipeline over AgentRouter with model fallback.

    Yields (event_type, payload) tuples for:
      - thinking: model reasoning tokens
      - tool_call: tool invocation intent
      - tool_result: tool execution outcome
      - text_delta: synthesized 4-part answer text
      - model_fallback: notification when switching to a fallback model
      - completed: terminal answer payload
      - error: structured failure reason
    """
    if not settings.allow_api:
        yield (
            "error",
            {
                "status": "disabled",
                "message": "AI API is disabled in configuration (ALLOW_API=false).",
                "diagnostic": "Local fallback mode active.",
            },
        )
        return

    api_key = settings.effective_api_key
    if not api_key:
        yield (
            "error",
            {
                "status": "unconfigured",
                "message": "AgentRouter API key is not configured.",
                "diagnostic": "Set AGENTROUTER_API_KEY in backend/.env.",
            },
        )
        return

    client = get_client()
    active_model = settings.effective_model

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": RAG_SYSTEM_PROMPT},
    ]

    # Include initial evidence if provided
    if initial_evidence:
        evidence_text = "\n\n".join(
            f"[{i+1}] ({hit.get('report_filename', 'Report')}, p. {hit.get('metadata', {}).get('page_number', 1)}): {hit.get('document', '').strip()}"
            for i, hit in enumerate(initial_evidence)
        )
        messages.append(
            {
                "role": "user",
                "content": f"Question: {question}\n\nRetrieved Report Evidence:\n{evidence_text}",
            }
        )
    else:
        messages.append({"role": "user", "content": f"Question: {question}"})

    collected_evidence = list(initial_evidence or [])

    async def stream_with_model_fallback(
        msgs: list[dict[str, Any]],
        tools_list: list[dict[str, Any]] | None,
        starting_model: str,
    ) -> AsyncGenerator[tuple[str, Any], None]:
        """Stream chunks from starting_model; on 402/403/404/429 fallback to next model in chain."""
        nonlocal active_model
        chain = settings.model_chain
        candidates = [starting_model] + [m for m in chain if m != starting_model]

        for idx, model_cand in enumerate(candidates):
            try:
                active_model = model_cand
                stream = await _call_agentrouter_stream(
                    client, msgs, model=model_cand, tools=tools_list
                )
                async for chunk in stream:
                    yield ("chunk", chunk)
                return  # Stream completed cleanly
            except (PermissionDeniedError, NotFoundError, RateLimitError, APIStatusError) as exc:
                status_code = getattr(exc, "status_code", None)
                is_fallback_candidate = (
                    isinstance(exc, (PermissionDeniedError, NotFoundError, RateLimitError))
                    or status_code in (402, 403, 404, 429)
                )
                if is_fallback_candidate and (idx + 1 < len(candidates)):
                    next_model = candidates[idx + 1]
                    logger.warning(
                        "Model '%s' failed (%s). Triggering fallback to '%s'.",
                        model_cand,
                        str(exc),
                        next_model,
                    )
                    yield (
                        "model_fallback",
                        {
                            "from": model_cand,
                            "to": next_model,
                            "reason": str(exc),
                        },
                    )
                    continue
                raise

    try:
        # Phase 1: Request with tools enabled
        current_tool_calls: dict[int, dict[str, Any]] = {}
        content_accumulator = []

        async for item_type, data in stream_with_model_fallback(messages, TOOL_DEFINITIONS, active_model):
            if item_type == "model_fallback":
                yield ("model_fallback", data)
                continue

            chunk = data
            if not chunk or not getattr(chunk, "choices", None):
                continue

            delta = chunk.choices[0].delta

            # 1. Capture thinking / reasoning if emitted
            reasoning = getattr(delta, "reasoning_content", None) or getattr(delta, "reasoning", None)
            if reasoning:
                yield ("thinking", {"thinking": reasoning})

            # 2. Accumulate tool calls
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in current_tool_calls:
                        current_tool_calls[idx] = {
                            "id": tc.id or "",
                            "name": tc.function.name if tc.function and tc.function.name else "",
                            "arguments": "",
                        }
                    else:
                        if tc.id:
                            current_tool_calls[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            current_tool_calls[idx]["name"] += tc.function.name
                    if tc.function and tc.function.arguments:
                        current_tool_calls[idx]["arguments"] += tc.function.arguments

            # 3. Capture text delta
            if delta.content:
                content_accumulator.append(delta.content)
                yield ("text_delta", {"delta": delta.content})

        # Check if tools were invoked
        if current_tool_calls:
            assistant_tool_calls = []
            for idx in sorted(current_tool_calls.keys()):
                tc = current_tool_calls[idx]
                assistant_tool_calls.append(
                    {
                        "id": tc["id"] or f"call_{idx}",
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": tc["arguments"],
                        },
                    }
                )

            messages.append(
                {
                    "role": "assistant",
                    "content": "".join(content_accumulator) or None,
                    "tool_calls": assistant_tool_calls,
                }
            )

            # Execute tools and feed results back
            for tc in assistant_tool_calls:
                name = tc["function"]["name"]
                args_str = tc["function"]["arguments"]
                try:
                    args = json.loads(args_str) if args_str else {}
                except json.JSONDecodeError:
                    args = {}

                # Emit tool_call event
                yield (
                    "tool_call",
                    {
                        "id": tc["id"],
                        "tool": name,
                        "arguments": args,
                    },
                )

                tool_res = execute_tool(name, args, user_id=user_id)

                # Collect new evidence from tool if ChromaDB search
                if name == "search_chroma" and "evidence" in tool_res:
                    for ev in tool_res["evidence"]:
                        collected_evidence.append({
                            "chunk_id": ev.get("chunk_id", ""),
                            "document": ev.get("snippet", ""),
                            "report_filename": ev.get("report_filename", ""),
                            "report_date": ev.get("report_date"),
                            "score": ev.get("score", 0.0),
                            "metadata": {"page_number": ev.get("page_number", 1)},
                        })

                # Emit tool_result event
                yield (
                    "tool_result",
                    {
                        "id": tc["id"],
                        "tool": name,
                        "result": tool_res,
                    },
                )

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(tool_res),
                    }
                )

            # Anchor instruction for Phase 2 synthesis: enforce 4-part structure and suppress further tool attempts
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "All requested tools have finished executing. Now synthesize your final grounded answer "
                        "using the retrieved tool results above. You MUST strictly use the mandatory 4-part structure:\n"
                        "1. Summary: Direct clinical/educational takeaway.\n"
                        "2. Evidence: Exact values, units, reference ranges, and report dates from the tool results.\n"
                        "3. Limitations: Any missing tests, omitted panels, or boundary caveats.\n"
                        "4. Safety: Practical follow-up advisories and physician consultation recommendations.\n"
                        "Do not output any further tool calls, XML, or DSML tags."
                    ),
                }
            )

            # Phase 2: Final synthesis stream following tool execution
            final_content = []

            async for item_type, data in stream_with_model_fallback(messages, None, active_model):
                if item_type == "model_fallback":
                    yield ("model_fallback", data)
                    continue

                chunk = data
                if not chunk or not getattr(chunk, "choices", None):
                    continue
                delta = chunk.choices[0].delta
                reasoning = getattr(delta, "reasoning_content", None) or getattr(delta, "reasoning", None)
                if reasoning:
                    yield ("thinking", {"thinking": reasoning})
                if delta.content:
                    final_content.append(delta.content)
                    yield ("text_delta", {"delta": delta.content})

            full_text = "".join(final_content).strip()
        else:
            full_text = "".join(content_accumulator).strip()

        # Perform safety check on final text
        evidence_snippets = [hit.get("document", "") for hit in collected_evidence]
        passed, safety_reason = check_answer_safety(full_text, evidence_snippets)

        yield (
            "completed",
            {
                "status": "answered",
                "summary_text": full_text,
                "safety_passed": passed,
                "safety_note": safety_reason,
                "evidence_count": len(collected_evidence),
                "model": active_model,
            },
        )

    except Exception as exc:
        logger.exception("AgentRouter RAG stream encountered failure")
        yield (
            "error",
            {
                "status": "error",
                "message": f"AgentRouter generation failed: {str(exc)}",
                "diagnostic": "Gateway communication or model inference error.",
            },
        )

    except Exception as exc:
        logger.exception("AgentRouter RAG stream encountered failure")
        yield (
            "error",
            {
                "status": "error",
                "message": f"AgentRouter generation failed: {str(exc)}",
                "diagnostic": "Gateway communication or model inference error.",
            },
        )
