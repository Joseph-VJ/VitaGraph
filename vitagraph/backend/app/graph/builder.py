"""Knowledge graph construction and analytics engine using NetworkX.

Builds typed entity-relationship graphs for persona health records, computes
topological analytics (betweenness centrality, community structure, modularity),
and extracts question-activated subgraphs for retrieved evidence chunks.
"""

from __future__ import annotations

from typing import Any
import networkx as nx

from app.core.database import get_db
from app.graph.extractor import extract_entities_from_chunk


# Color coding for graph visualization per DESIGN.md §4 tokens
NODE_COLORS = {
    "person": "#86A9D9",       # Cornflower
    "report": "#86A9D9",       # Cornflower
    "date": "#79B8A6",         # Verdigris
    "section": "#A992D0",      # Lilac
    "category": "#A992D0",     # Lilac
    "test": "#79B8A6",         # Verdigris
    "measurement": "#D9A441",  # Ochre
    "chunk": "#6B7683",        # Faint
    "uncertainty": "#D9808D",  # Madder
}


def _detect_section(text: str, page_num: int) -> str:
    """Detect logical section name from chunk text or fallback to page heading."""
    t_lower = text.lower()
    if any(k in t_lower for k in ["complete blood count", "hemogram", "cbc", "hematology"]):
        return "Complete Blood Count"
    if any(k in t_lower for k in ["lipid profile", "lipid panel", "cholesterol"]):
        return "Lipid Profile"
    if any(k in t_lower for k in ["metabolic panel", "renal function", "liver function", "glucose", "hba1c"]):
        return "Metabolic Panel"
    if any(k in t_lower for k in ["vitamin", "nutritional", "25-hydroxy"]):
        return "Nutritional Panel"
    if any(k in t_lower for k in ["thyroid", "endocrine", "tsh", "t3", "t4"]):
        return "Endocrine Panel"
    if any(k in t_lower for k in ["urinalysis", "urine routine"]):
        return "Urinalysis"
    for line in text.splitlines():
        clean = line.strip()
        if 4 <= len(clean) <= 45 and any(
            term in clean.lower()
            for term in ["panel", "report", "profile", "investigation", "department", "test"]
        ):
            return clean
    return f"Clinical Findings (Page {page_num})"


def build_user_graph(user_id: str) -> tuple[nx.Graph, list[dict[str, Any]]]:
    """Fetch all reports and chunks for a user and build the NetworkX graph.

    Returns (Graph, all_extracted_entities).
    Always emits report + per-page chunk + section + date nodes plus entities.
    If entities == 0, still yields section, chunk, date, and uncertainty structure.
    Edges use: CONTAINS, MENTIONS, HAS_MEASUREMENT, BELONGS_TO, OBSERVED_ON, IN_SECTION.
    """
    g = nx.Graph()
    all_entities: list[dict[str, Any]] = []

    with get_db() as db:
        reports = db.execute(
            "SELECT id, original_filename, report_date, upload_time FROM reports WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        report_map = {r["id"]: dict(r) for r in reports}

        chunks = db.execute(
            "SELECT id, report_id, page_number, text FROM report_chunks WHERE user_id = ?",
            (user_id,),
        ).fetchall()

    if not reports and not chunks:
        return g, all_entities

    # Add Person node per Plan §11
    user_node_id = f"user_{user_id}"
    g.add_node(
        user_node_id,
        id=user_node_id,
        label=f"Persona {user_id}",
        type="person",
        color=NODE_COLORS["person"],
        r=18,
    )

    # 1. Add Report and Date Nodes
    for r_id, r_info in report_map.items():
        rep_node_id = f"rep_{r_id}"
        date_str = r_info.get("report_date") or "Unknown Date"
        date_slug = date_str.replace(" ", "_").replace(":", "_").replace("-", "_")
        date_node_id = f"date_{date_slug}"

        g.add_node(
            rep_node_id,
            id=rep_node_id,
            label=f"{r_info['original_filename']} ({date_str})",
            type="report",
            report_id=r_id,
            date=date_str,
            color=NODE_COLORS["report"],
            r=15,
        )
        g.add_edge(user_node_id, rep_node_id, relation="CONTAINS")

        if date_node_id not in g:
            g.add_node(
                date_node_id,
                id=date_node_id,
                label=date_str,
                type="date",
                date=date_str,
                color=NODE_COLORS["date"],
                r=12,
            )
        g.add_edge(rep_node_id, date_node_id, relation="OBSERVED_ON")

    # Group chunks by report
    report_chunks_map: dict[str, list[dict]] = {}
    for ch in chunks:
        report_chunks_map.setdefault(ch["report_id"], []).append(dict(ch))

    # 2. Add Chunk, Section, Entity, and Uncertainty Nodes
    for r_id, r_chunks in report_chunks_map.items():
        r_info = report_map.get(r_id, {})
        date_str = r_info.get("report_date") or "Unknown Date"
        date_slug = date_str.replace(" ", "_").replace(":", "_").replace("-", "_")
        date_node_id = f"date_{date_slug}"
        rep_node_id = f"rep_{r_id}"

        for ch in r_chunks:
            ch_id = ch["id"]
            page_num = ch["page_number"]
            chunk_text = ch["text"]

            chunk_node_id = f"chunk_{ch_id}"
            g.add_node(
                chunk_node_id,
                id=chunk_node_id,
                label=f"Page {page_num}",
                type="chunk",
                chunk_id=ch_id,
                report_id=r_id,
                page=page_num,
                color=NODE_COLORS["chunk"],
                r=10,
            )
            g.add_edge(rep_node_id, chunk_node_id, relation="CONTAINS")

            # Section node per Plan §11
            section_title = _detect_section(chunk_text, page_num)
            section_slug = section_title.replace(" ", "_").replace("(", "").replace(")", "").replace("/", "_")
            sec_node_id = f"sec_{r_id}_{section_slug}"
            if sec_node_id not in g:
                g.add_node(
                    sec_node_id,
                    id=sec_node_id,
                    label=section_title,
                    type="section",
                    section=section_title,
                    report_id=r_id,
                    color=NODE_COLORS["section"],
                    r=13,
                )
                g.add_edge(rep_node_id, sec_node_id, relation="CONTAINS")
            g.add_edge(chunk_node_id, sec_node_id, relation="IN_SECTION")

            # Extract entities
            entities = extract_entities_from_chunk(
                chunk_text=chunk_text,
                chunk_id=ch_id,
                report_id=r_id,
                page_number=page_num,
                date=date_str,
            )
            all_entities.extend(entities)

            if entities:
                for ent in entities:
                    test_name = ent["test_name"]
                    category = ent["category"]
                    val = ent["value"]
                    unit = ent["unit"]
                    flag = ent["flag"]

                    test_node_id = f"test_{test_name.replace(' ', '_')}"
                    meas_node_id = f"meas_{test_name.replace(' ', '_')}_{date_slug}_{val}"
                    cat_node_id = f"cat_{category.replace(' ', '_')}"

                    # Category Node
                    if cat_node_id not in g:
                        g.add_node(
                            cat_node_id,
                            id=cat_node_id,
                            label=category,
                            type="category",
                            category=category,
                            color=NODE_COLORS["category"],
                            r=14,
                        )

                    # Test Node
                    if test_node_id not in g:
                        g.add_node(
                            test_node_id,
                            id=test_node_id,
                            label=test_name,
                            type="test",
                            test_name=test_name,
                            category=category,
                            color=NODE_COLORS["test"],
                            r=16,
                        )
                        g.add_edge(test_node_id, cat_node_id, relation="BELONGS_TO")

                    # Measurement Node
                    flag_marker = f" ({flag})" if flag != "NORMAL" else ""
                    if meas_node_id not in g:
                        g.add_node(
                            meas_node_id,
                            id=meas_node_id,
                            label=f"{val} {unit}{flag_marker}",
                            type="measurement",
                            value=val,
                            unit=unit,
                            flag=flag,
                            date=date_str,
                            color=NODE_COLORS["measurement"],
                            r=12,
                        )

                    # Edges
                    g.add_edge(chunk_node_id, test_node_id, relation="MENTIONS")
                    g.add_edge(test_node_id, meas_node_id, relation="HAS_MEASUREMENT")
                    g.add_edge(test_node_id, sec_node_id, relation="IN_SECTION")
                    g.add_edge(meas_node_id, date_node_id, relation="OBSERVED_ON")
            else:
                # entities == 0 guarantee: emit Uncertainty node
                unc_node_id = f"unc_{ch_id}"
                if unc_node_id not in g:
                    g.add_node(
                        unc_node_id,
                        id=unc_node_id,
                        label=f"Marked Uncertain (Page {page_num})",
                        type="uncertainty",
                        chunk_id=ch_id,
                        report_id=r_id,
                        page=page_num,
                        color=NODE_COLORS["uncertainty"],
                        r=12,
                    )
                g.add_edge(chunk_node_id, unc_node_id, relation="MENTIONS")
                g.add_edge(unc_node_id, sec_node_id, relation="IN_SECTION")
                g.add_edge(unc_node_id, date_node_id, relation="OBSERVED_ON")

    return g, all_entities


def serialize_graph(g: nx.Graph) -> dict[str, Any]:
    """Serialize a NetworkX graph to JSON-ready dict with topological analytics."""
    if len(g) == 0:
        return {
            "nodes": [],
            "edges": [],
            "metrics": {
                "total_nodes": 0,
                "total_edges": 0,
                "communities_count": 0,
                "modularity": 0.0,
                "density": 0.0,
            },
        }

    # 1. Betweenness centrality
    try:
        centrality = nx.betweenness_centrality(g)
    except Exception:
        centrality = {n: 0.0 for n in g.nodes()}

    # 2. Community detection (greedy modularity)
    communities_map: dict[str, int] = {}
    modularity_val = 0.0
    try:
        communities = list(nx.community.greedy_modularity_communities(g))
        for c_idx, comm in enumerate(communities):
            for n in comm:
                communities_map[n] = c_idx
        if len(g.edges()) > 0 and communities:
            modularity_val = round(float(nx.community.modularity(g, communities)), 4)
    except Exception:
        communities_map = {n: 0 for n in g.nodes()}

    # 3. Nodes serialization
    nodes_out: list[dict[str, Any]] = []
    for node_id, data in g.nodes(data=True):
        node_dict = dict(data)
        node_dict["id"] = node_id
        node_dict["betweenness"] = round(float(centrality.get(node_id, 0.0)), 4)
        node_dict["community"] = communities_map.get(node_id, 0)
        nodes_out.append(node_dict)

    # 4. Edges serialization
    edges_out: list[dict[str, Any]] = []
    for u, v, data in g.edges(data=True):
        edges_out.append({
            "source": u,
            "target": v,
            "relation": data.get("relation", "CONNECTED_TO"),
        })

    density_val = round(float(nx.density(g)), 4) if len(g) > 1 else 0.0

    return {
        "nodes": nodes_out,
        "edges": edges_out,
        "metrics": {
            "total_nodes": len(nodes_out),
            "total_edges": len(edges_out),
            "communities_count": len(set(communities_map.values())) if communities_map else 0,
            "modularity": modularity_val,
            "density": density_val,
        },
    }


def get_question_subgraph(
    user_id: str,
    retrieved_chunk_ids: list[str],
) -> dict[str, Any]:
    """Extract question-conditioned subnetwork for retrieved evidence chunks.

    Finds the active chunk nodes, connected test concepts, and their measurements.
    Returns the serialized subgraph and active concept names.
    """
    g, _ = build_user_graph(user_id)

    if len(g) == 0 or not retrieved_chunk_ids:
        return {
            "nodes": [],
            "edges": [],
            "active_concepts": [],
            "metrics": {
                "total_nodes": 0,
                "total_edges": 0,
                "communities_count": 0,
                "modularity": 0.0,
                "density": 0.0,
            },
        }

    # Find matching chunk nodes in graph
    target_nodes: set[str] = set()
    active_concepts: set[str] = set()

    for ch_id in retrieved_chunk_ids:
        chunk_node_id = f"chunk_{ch_id}"
        if chunk_node_id in g:
            target_nodes.add(chunk_node_id)
            # 1-hop neighbors (Reports, Tests)
            for neighbor in g.neighbors(chunk_node_id):
                target_nodes.add(neighbor)
                node_type = g.nodes[neighbor].get("type")
                if node_type == "test":
                    test_name = g.nodes[neighbor].get("test_name")
                    if test_name:
                        active_concepts.add(test_name)
                    # 2-hop neighbors of test (Measurements, Category)
                    for test_nbr in g.neighbors(neighbor):
                        target_nodes.add(test_nbr)

    if not target_nodes:
        # Fallback: return full graph if no specific nodes matched
        res = serialize_graph(g)
        res["active_concepts"] = []
        return res

    sub_g = g.subgraph(target_nodes).copy()
    serialized = serialize_graph(sub_g)
    serialized["active_concepts"] = sorted(list(active_concepts))

    return serialized
