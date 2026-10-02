import os
import time
from playwright.sync_api import sync_playwright

OUT_DIR = r"C:\Users\Admin\.gemini\antigravity\brain\e985d3af-7e4d-41c0-83ee-af822fc35567"
os.makedirs(OUT_DIR, exist_ok=True)

routes = [
    ("homepage.png", "http://localhost:5174/"),
    ("knowledge_graph.png", "http://localhost:5174/graph"),
    ("ask_interface.png", "http://localhost:5174/ask"),
    ("timeline.png", "http://localhost:5174/timeline"),
]

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="msedge", headless=True)
    except Exception:
        browser = p.chromium.launch(headless=True)
        
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    for filename, url in routes:
        print(f"Capturing {url} -> {filename}...")
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        # Give animated components time to settle
        time.sleep(2.5)
        target_path = os.path.join(OUT_DIR, filename)
        page.screenshot(path=target_path, full_page=False)
        print(f"Saved: {target_path}")

    browser.close()
    print("All captures completed successfully.")
