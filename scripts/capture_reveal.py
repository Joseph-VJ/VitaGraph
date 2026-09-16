import time
import os
from playwright.sync_api import sync_playwright

out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.goto("http://localhost:5174/graph", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    
    with page.expect_response(lambda r: "/api/graph" in r.url):
        page.reload(wait_until="domcontentloaded")
    
    # 400ms after graph JSON received: right during staggered scale-in & edge draw-in
    time.sleep(0.40)
    out_path = os.path.join(out_dir, "us17_graph_staggered_reveal.png")
    page.screenshot(path=out_path)
    print(f"Captured mid-stagger reveal to {out_path}!")
    browser.close()
