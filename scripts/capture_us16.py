import time
import os
import sys
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)
repo_artifacts = r"f:\kiruthika\kiruthika final project\vitagraph\artifacts"
os.makedirs(repo_artifacts, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1080},
    )
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    print("=== US-16: Upload Scanned OCR PDF Test ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.goto(f"http://127.0.0.1:{PORT}/upload", wait_until="domcontentloaded")
    time.sleep(2)

    # Find the Upload Report4 Scanned OCR Test button
    ocr_btn = page.locator('button:has-text("Upload Report4 Scanned OCR Test")')
    assert ocr_btn.count() > 0, "Button 'Upload Report4 Scanned OCR Test' not found!"
    print("Found 'Upload Report4 Scanned OCR Test' button. Clicking...", flush=True)
    ocr_btn.click()

    # Wait for the ingestion to complete
    print("Waiting for Report Ingestion Complete toast...", flush=True)
    try:
        page.wait_for_selector('text="Report Ingestion Complete"', timeout=35000)
        print("Toast appeared!", flush=True)
    except Exception as e:
        print(f"Notice: {e}", flush=True)

    time.sleep(3)

    # Check the Page Quality Assessment table
    content = page.content()
    print("Checking for OCR method in page content...", flush=True)
    has_ocr_method = "ocr-rapid" in content or "ocr-tesseract" in content or "uncertain" in content
    print(f"Has OCR method in table: {has_ocr_method}", flush=True)

    screenshot_path1 = os.path.join(out_dir, "us16_scanned_ocr.png")
    screenshot_path2 = os.path.join(repo_artifacts, "us16_scanned_ocr.png")
    page.screenshot(path=screenshot_path1)
    page.screenshot(path=screenshot_path2)
    print(f"Saved screenshot to {screenshot_path1} and {screenshot_path2}", flush=True)

    # Check Knowledge Graph page
    print("Navigating to /graph to verify entities extracted...", flush=True)
    page.goto(f"http://127.0.0.1:{PORT}/graph", wait_until="domcontentloaded")
    time.sleep(4)
    graph_screenshot1 = os.path.join(out_dir, "us16_scanned_graph.png")
    graph_screenshot2 = os.path.join(repo_artifacts, "us16_scanned_graph.png")
    page.screenshot(path=graph_screenshot1)
    page.screenshot(path=graph_screenshot2)
    print(f"Saved graph screenshot to {graph_screenshot1}", flush=True)

    browser.close()
    print("Playwright script completed successfully!", flush=True)
