import http.server
import socketserver
import threading
import time
import os
import sys
from playwright.sync_api import sync_playwright

PORT = 5174
BASE_DIR = r"F:\kiruthika\kiruthika final project"
DIST_DIR = os.path.join(BASE_DIR, "site design", "dist")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0]
        full_path = os.path.join(DIST_DIR, path.lstrip("/"))
        if not os.path.exists(full_path) or os.path.isdir(full_path):
            self.path = "/index.html"
        return super().do_GET()

def run_server():
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            httpd.serve_forever()
    except Exception as e:
        print(f"Server notice: {e}")

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(1)

out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 960})
    page = context.new_page()

    # 1. Capture for Arjun R (VG-2026-001)
    page.goto(f"http://localhost:{PORT}/graph", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.reload(wait_until="domcontentloaded")
    time.sleep(3)
    p1 = os.path.join(out_dir, "us04_graph_persona_arjun.png")
    page.screenshot(path=p1)
    print(f"Captured Arjun R graph to {p1}")

    # 2. Capture for E2E Persona (usr_3a9fdd285b42)
    page.evaluate("localStorage.setItem('vitagraph_user_id', 'usr_3a9fdd285b42');")
    page.reload(wait_until="domcontentloaded")
    time.sleep(3)
    p2 = os.path.join(out_dir, "us04_graph_persona_e2e.png")
    page.screenshot(path=p2)
    print(f"Captured E2E Persona graph to {p2}")

    browser.close()
