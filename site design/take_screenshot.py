import http.server
import socketserver
import threading
import time
import os
from playwright.sync_api import sync_playwright

PORT = 5212
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

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.goto(f"http://localhost:{PORT}/gallery", wait_until="networkidle")
    time.sleep(1.5)

    # Capture sections systematically
    sections = [
        ("gallery_p1_items01_06.png", 0),
        ("gallery_p2_items07_10.png", 850),
        ("gallery_p3_items11_15.png", 1750),
        ("gallery_p4_item16_graph.png", 2600),
        ("gallery_p5_items17_19.png", 3450),
        ("gallery_p6_items20_22.png", 4600),
        ("gallery_p7_items23_26.png", 6100),
    ]

    for fname, y in sections:
        page.evaluate(f"window.scrollTo(0, {y})")
        time.sleep(0.4)
        path = os.path.join(base_dir, fname)
        page.screenshot(path=path)
        print(f"Saved: {fname} at Y={y}")

    browser.close()
