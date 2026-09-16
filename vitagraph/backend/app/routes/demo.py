"""Demo routes — one-click cohort initialization for viva demonstrations."""

from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.graph.builder import build_user_graph, serialize_graph
from app.services import report_service, user_service

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/cohort", status_code=201)
def load_demo_cohort() -> dict:
    """Create a fresh demo persona labeled 'demo data', ingest both synthetic panels, and return graph metrics."""
    # 1. Create fresh demo persona with label containing 'demo data'
    user = user_service.create_user("Demo Cohort (demo data)")
    user_id = user["id"]

    # 2. Accept privacy consent for the persona
    user_service.accept_consent(user_id)

    # 3. Locate both synthetic panels across candidate sample data paths
    candidates = [
        Path(__file__).resolve().parents[3] / "sample_data",
        Path(__file__).resolve().parents[2] / "sample_data",
        Path.cwd() / "sample_data",
        Path.cwd().parent / "sample_data",
        Path.cwd() / "vitagraph" / "sample_data",
    ]
    p1 = None
    p2 = None
    for cand in candidates:
        cand_p1 = cand / "synthetic_panel_2025-01-15.pdf"
        cand_p2 = cand / "synthetic_panel_2025-06-20.pdf"
        if cand_p1.exists() and cand_p2.exists():
            p1 = cand_p1
            p2 = cand_p2
            break

    if not p1 or not p2:
        raise HTTPException(
            status_code=500,
            detail="Synthetic panel demo files not found on backend filesystem.",
        )

    # 4. Ingest both panels
    data1 = p1.read_bytes()
    data2 = p2.read_bytes()

    rep1 = report_service.process_upload(user_id, "synthetic_panel_2025-01-15.pdf", data1)
    rep2 = report_service.process_upload(user_id, "synthetic_panel_2025-06-20.pdf", data2)

    # 5. Extract knowledge graph metrics
    g, _ = build_user_graph(user_id)
    graph_data = serialize_graph(g)

    return {
        "user_id": user_id,
        "display_label": user["display_label"],
        "reports_ingested": 2,
        "report_ids": [rep1.get("id"), rep2.get("id")],
        "nodes": len(graph_data.get("nodes", [])),
        "edges": len(graph_data.get("edges", [])),
        "communities": graph_data.get("communities", 0),
        "modularity": graph_data.get("modularity", 0.0),
    }
