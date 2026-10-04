"""Echo MCP server fixture for testing harness tool discovery and environment isolation."""

from __future__ import annotations

import json
import os
import sys

from mcp.server.mcpserver import MCPServer

server = MCPServer("vitagraph")


@server.tool(name="list_reports", description="List available reports for the persona.")
def list_reports() -> str:
    return "{}"


@server.tool(name="search_reports", description="Search reports for relevant snippets.")
def search_reports(query: str, top_k: int = 5, report_id: str = "") -> str:
    return "{}"


@server.tool(name="get_measurements", description="Get clinical measurements for a report.")
def get_measurements(report_id: str) -> str:
    return "{}"


@server.tool(name="graph_lookup", description="Look up biomedical entities in knowledge graph.")
def graph_lookup(concept: str) -> str:
    return "{}"


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1]:
        out_path = sys.argv[1]
        env_snapshot = {
            "pid": os.getpid(),
            "persona": os.environ.get("VITAGRAPH_USER_ID"),
            "canary": os.environ.get("AG2_CANARY"),
            "deepseek_key": os.environ.get("DEEPSEEK_API_KEY"),
            "agentrouter_key": os.environ.get("AGENTROUTER_API_KEY"),
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(env_snapshot, f)

    server.run("stdio")
