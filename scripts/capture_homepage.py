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
        print(f"Server note: {e}")

output_path = sys.argv[1] if len(sys.argv) > 1 else "homepage_screenshot.png"
os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(1)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.goto(f"http://localhost:{PORT}/", wait_until="networkidle")
    time.sleep(2)
    page.screenshot(path=output_path, full_page=False)
    print(f"Captured screenshot to: {output_path}")
    browser.close()
