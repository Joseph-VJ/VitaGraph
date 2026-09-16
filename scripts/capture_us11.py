import time
import os
import json
import urllib.request
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)

# 1. Fetch live graph metrics directly from backend to verify truth
res = urllib.request.urlopen("http://127.0.0.1:8000/api/graph/VG-2026-001")
graph_json = json.loads(res.read())
metrics = graph_json["metrics"]
print(f"Backend Graph Metrics: total_nodes={metrics['total_nodes']}, total_edges={metrics['total_edges']}, Q={metrics['modularity']:.2f}")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1100})
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    print("=== US-11: InsightsPage Live Analytics Verification ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.goto(f"http://localhost:{PORT}/insights", wait_until="domcontentloaded")
    time.sleep(3)
    print("InsightsPage loaded for Arjun R", flush=True)

    # 1. Verify Louvain Community Card & Modularity
    page.wait_for_selector('text=Community Modularity (Louvain)', timeout=10000)
    q_str = f"Q = {metrics['modularity']:.2f}"
    page.wait_for_selector(f'text={q_str}', timeout=5000)
    print(f"Verified live Modularity badge ({q_str}) matches backend!", flush=True)

    # 2. Verify Centrality Hub Ranking with Betweenness badge
    page.wait_for_selector('text=Centrality Hub Ranking', timeout=5000)
    page.wait_for_selector('text=Betweenness', timeout=5000)
    page.wait_for_selector('text=Biomarker Hub', timeout=5000)
    print("Verified Betweenness Centrality Hubs rendered!", flush=True)

    # 3. Verify Predicate Distribution with real edge count
    edge_badge_str = f"{metrics['total_edges']} edges"
    page.wait_for_selector(f'text={edge_badge_str}', timeout=5000)
    print(f"Verified Predicate Distribution badge ({edge_badge_str}) matches backend!", flush=True)

    # 4. Verify Causality Footnote (§9.7)
    footnote = page.locator('text=Graph associations indicate statistical and literature co-occurrence; they do not establish unmeasured biological causality.')
    assert footnote.count() > 0, "Causality footnote must be present"
    print("Verified Causality Footnote is present verbatim!", flush=True)

    time.sleep(1)
    p1 = os.path.join(out_dir, "us11_insights_live_analytics.png")
    page.screenshot(path=p1)
    print(f"Captured insights analytics screenshot to {p1}", flush=True)

    browser.close()
    print("US-11 browser verification completed successfully.", flush=True)
