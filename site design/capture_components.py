import http.server
import socketserver
import threading
import time
import os
from playwright.sync_api import sync_playwright

PORT = 5218
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0]
        full_path = os.path.join(DIRECTORY, path.lstrip("/"))
        if not os.path.exists(full_path) or os.path.isdir(full_path):
            self.path = "/index.html"
        return super().do_GET()

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(1)

base_dir = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(base_dir, "gallery_components")
os.makedirs(out_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1200})
    page.goto(f"http://localhost:{PORT}/gallery", wait_until="networkidle")
    time.sleep(1.5)

    sections = page.locator("section").all()
    print(f"Found {len(sections)} sections in gallery.")

    for i, sec in enumerate(sections, 1):
        sec.scroll_into_view_if_needed()
        time.sleep(0.1)
        filename = os.path.join(out_dir, f"component_{i:02d}.png")
        sec.screenshot(path=filename)
        print(f"Captured Item {i:02d} -> {filename}")

    browser.close()
print("All individual component screenshots captured!")
