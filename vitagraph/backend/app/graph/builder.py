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


# Color coding for graph visualization
NODE_COLORS = {
    "report": "#3B82F6",       # Blue
    "test": "#10B981",         # Emerald
    "measurement": "#F59E0B",  # Amber
    "chunk": "#8B5CF6",        # Violet
    "category": "#06B6D4",     # Cyan
}


def build_user_graph(user_id: str) -> tuple[nx.Graph, list[dict[str, Any]]]:
    """Fetch all reports and chunks for a user and build the NetworkX graph.

    Returns (Graph, all_extracted_entities).
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

    # 1. Add Report Nodes
    for r_id, r_info in report_map.items():
        node_id = f"rep_{r_id}"
        date_str = r_info.get("report_date") or "Unknown Date"
        g.add_node(
            node_id,
            id=node_id,
            label=f"{r_info['original_filename']} ({date_str})",
            type="report",
            report_id=r_id,
            date=date_str,
            color=NODE_COLORS["report"],
            r=15,
        )

    # 2. Extract entities from chunks and build graph structure
    for ch in chunks:
        ch_id = ch["id"]
        rep_id = ch["report_id"]
        page_num = ch["page_number"]
        chunk_text = ch["text"]

        r_info = report_map.get(rep_id, {})
        date_str = r_info.get("report_date") or "Unknown"

        chunk_node_id = f"chunk_{ch_id}"
        g.add_node(
            chunk_node_id,
            id=chunk_node_id,
            label=f"Page {page_num}",
            type="chunk",
            chunk_id=ch_id,
            report_id=rep_id,
            page=page_num,
            color=NODE_COLORS["chunk"],
            r=10,
        )

        # Edge: Report -> Chunk
        if f"rep_{rep_id}" in g:
            g.add_edge(f"rep_{rep_id}", chunk_node_id, relation="CONTAINS")

        # Extract medical observations
        entities = extract_entities_from_chunk(
            chunk_text=chunk_text,
            chunk_id=ch_id,
            report_id=rep_id,
            page_number=page_num,
            date=date_str,
        )
        all_entities.extend(entities)

        for ent in entities:
            test_name = ent["test_name"]
            category = ent["category"]
            val = ent["value"]
            unit = ent["unit"]
            flag = ent["flag"]

            test_node_id = f"test_{test_name.replace(' ', '_')}"
            meas_node_id = f"meas_{test_name.replace(' ', '_')}_{date_str}_{val}"
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
