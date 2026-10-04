"""VitaGraph MCP tool server for the AI Agent.

Security design:
1. Persona is bound strictly by the process environment variable VITAGRAPH_USER_ID.
2. No tool parameter allows the model to specify a persona, user, or owner.
3. Server aborts on startup if VITAGRAPH_USER_ID is missing, empty, or invalid.
4. Report ownership is verified on all report_id lookups to prevent probing.
5. Standard output is reserved strictly for MCP JSON-RPC protocol frames.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

from mcp.server.mcpserver import MCPServer


def _persona() -> str:
    """Read and validate the persona ID from the environment.

    Exits immediately with a non-zero code and a message to stderr if
    VITAGRAPH_USER_ID is missing, empty, or not found in the database.
    """
    pid = os.environ.get("VITAGRAPH_USER_ID", "").strip()
    if not pid:
        sys.stderr.write("VITAGRAPH_USER_ID is missing or empty.\n")
        sys.exit(2)
    try:
        from app.services import user_service

        user_service.user_exists(pid)
    except Exception as exc:
        sys.stderr.write(f"Invalid VITAGRAPH_USER_ID '{pid}': {exc}\n")
        sys.exit(2)
    return pid


def _check_report_owner(report_id: str, persona: str) -> bool:
    """Verify that the specified report exists and belongs to the active persona."""
    from app.core.database import get_db

    with get_db() as db:
        row = db.execute(
            "SELECT user_id FROM reports WHERE id = ?", (report_id,)
        ).fetchone()
        if not row or str(row["user_id"]) != str(persona):
            return False
        return True


def _format_json(payload: dict[str, Any]) -> str:
    """Format payload as JSON with maximum length bound of 12,000 characters."""
    text = json.dumps(payload, ensure_ascii=False)
    if len(text) <= 12000:
        return text

    data = dict(payload)
    for key, val in list(data.items()):
        if isinstance(val, list) and val:
            items = list(val)
            while items and len(json.dumps(data, ensure_ascii=False)) > 11950:
                items.pop()
                data[key] = items
                data["truncated"] = True
            if data.get("truncated"):
                break

    text = json.dumps(data, ensure_ascii=False)
    if len(text) > 12000:
        text = text[:11950] + '..."truncated": true}'
    return text


class _EvidenceRefs:
    """Assigns stable citation references [1], [2], ... for chunks across calls."""

    def __init__(self) -> None:
        self.cards: list[dict[str, Any]] = []
        self._by_chunk: dict[str, dict[str, Any]] = {}

    def add(self, hit: dict[str, Any]) -> dict[str, Any]:
        cid = str(hit.get("chunk_id", ""))
        if cid and cid in self._by_chunk:
            return self._by_chunk[cid]

        meta = hit.get("metadata") or {}
        start = meta.get("char_start")
        end = meta.get("char_end")
        page = meta.get("page_number")

        if start in (None, "") or end in (None, ""):
            from app.core.database import get_db

            with get_db() as db:
                row = db.execute(
                    "SELECT char_start, char_end, page_number FROM report_chunks WHERE id = ?",
                    (cid,),
                ).fetchone()
                if row:
                    start = row["char_start"]
                    end = row["char_end"]
                    page = page or row["page_number"]

        int_start = int(start) if start not in (None, "") else None
        int_end = int(end) if end not in (None, "") else None

        card = {
            "ref": len(self.cards) + 1,
            "chunk_id": cid,
            "report_id": meta.get("report_id") or hit.get("report_id", ""),
            "report_filename": hit.get("report_filename") or meta.get("report_filename", ""),
            "report_date": hit.get("report_date") or meta.get("report_date"),
            "page_number": int(page) if page not in (None, "") else 1,
            "snippet": (hit.get("document") or "")[:600],
            "score": round(float(hit.get("score", 0.0)), 3),
            "char_start": int_start,
            "char_end": int_end,
        }
        self.cards.append(card)
        if cid:
            self._by_chunk[cid] = card
        return card


def create_server(persona: str) -> MCPServer:
    """Build and configure the VitaGraph MCP tool server for the given persona."""
    server = MCPServer("vitagraph")
    evidence_refs = _EvidenceRefs()

    @server.tool(
        name="list_reports",
        description=(
            "List all health reports available for the current patient persona. "
            "Returns a JSON array of reports with their report_id, original filename, "
            "report date, and page count. Use this first to discover available reports and "
            "their IDs before requesting measurements or performing filtered searches."
        ),
    )
    def list_reports() -> str:
        """List all health reports available for the current patient persona.

        Returns a JSON array of reports with their report_id, original filename,
        report date, and page count. Use this first to discover available reports and
        their IDs before requesting measurements or performing filtered searches.
        """
        from app.services import report_service

        raw_reports = report_service.list_reports(persona)
        reports = [
            {
                "report_id": r["id"],
                "filename": r.get("original_filename") or r.get("filename") or "",
                "report_date": r.get("report_date"),
                "page_count": r.get("page_count"),
            }
            for r in raw_reports
        ]
        return _format_json({"reports": reports})

    @server.tool(
        name="search_reports",
        description=(
            "Search clinical reports for keywords, laboratory tests, or medical findings. "
            "Returns numbered evidence cards containing relevant report excerpts with exact "
            "character spans and citation reference numbers. Quote values only from the "
            "evidence returned and cite the reference number in square brackets (e.g. [1])."
        ),
    )
    def search_reports(query: str, top_k: int = 5, report_id: str = "") -> str:
        """Search clinical reports for keywords, laboratory tests, or medical findings.

        Returns numbered evidence cards containing relevant report excerpts with exact
        character spans and citation reference numbers. Quote values only from the
        evidence returned and cite the reference number in square brackets (e.g. [1]).
        """
        if not query or not query.strip():
            return _format_json({"error": "query is required"})

        effective_top_k = max(1, min(int(top_k), 8))
        filter_report_id = report_id.strip() if report_id else ""

        if filter_report_id:
            if not _check_report_owner(filter_report_id, persona):
                return _format_json({"error": "Report not found for this persona."})

        try:
            from app.rag import retriever

            hits = retriever.retrieve(
                user_id=persona,
                question=query.strip(),
                top_k=effective_top_k,
                report_id=filter_report_id or None,
            )
            cards = [evidence_refs.add(hit) for hit in hits]
            return _format_json({"evidence": cards})
        except Exception as exc:
            return _format_json({"error": f"Report search failed: {exc}"})

    @server.tool(
        name="get_measurements",
        description=(
            "Retrieve extracted clinical measurements and laboratory values for a specific report. "
            "Returns structured test names, numeric values, units, reference ranges, and flags "
            "found in the specified report. Use this to inspect comprehensive laboratory panels "
            "after identifying a report ID with list_reports."
        ),
    )
    def get_measurements(report_id: str) -> str:
        """Retrieve extracted clinical measurements and laboratory values for a specific report.

        Returns structured test names, numeric values, units, reference ranges, and flags
        found in the specified report. Use this to inspect comprehensive laboratory panels
        after identifying a report ID with list_reports."
        """
        clean_id = report_id.strip() if report_id else ""
        if not clean_id:
            return _format_json({"error": "report_id is required"})

        if not _check_report_owner(clean_id, persona):
            return _format_json({"error": "Report not found for this persona."})

        from app.services import measurement_service

        measurements = measurement_service.list_report_measurements(clean_id)
        return _format_json({"report_id": clean_id, "measurements": measurements})

    @server.tool(
        name="graph_lookup",
        description=(
            "Look up biomedical concepts and their relational connections in the patient's knowledge graph. "
            "Returns matched graph entities and neighboring nodes representing clinical relationships "
            "such as test biomarkers, conditions, and organ systems. Use this to explore longitudinal "
            "associations and multi-report health connections."
        ),
    )
    def graph_lookup(concept: str) -> str:
        """Look up biomedical concepts and their relational connections in the patient's knowledge graph.

        Returns matched graph entities and neighboring nodes representing clinical relationships
        such as test biomarkers, conditions, and organ systems. Use this to explore longitudinal
        associations and multi-report health connections.
        """
        from app.services import llm_service

        result = llm_service.execute_tool(
            "query_networkx_graph",
            {"concept": concept.strip() if concept else ""},
            user_id=persona,
        )
        return _format_json(result)

    return server


def main() -> None:
    """Entry point for running the VitaGraph MCP tool server over stdio."""
    persona = _persona()
    server = create_server(persona)
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
