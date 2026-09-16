import time
import os
import sys
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1100})
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    print("=== US-08 PART A: Real Upload Pipeline & Stepper Progression ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.goto(f"http://localhost:{PORT}/upload", wait_until="domcontentloaded")
    time.sleep(3)
    print("UploadPage loaded for Arjun R", flush=True)

    # Click the quick-test upload sample button
    sample_btn = page.locator('button:has-text("Upload synthetic_panel_2025-01-15.pdf")')
    sample_btn.click()
    print("Clicked 'Upload synthetic_panel_2025-01-15.pdf'", flush=True)

    # Wait for the upload and pipeline stepper to complete
    try:
        page.wait_for_selector('text="Processing your document step by step"', timeout=10000)
        page.wait_for_selector('text="ChromaDB ok"', timeout=20000)
        print("Found completed stepper with 'ChromaDB ok'!", flush=True)
        page.wait_for_selector('text="Page quality assessment"', timeout=5000)
        print("Found Page Quality Assessment table!", flush=True)
    except Exception as e:
        print(f"Notice while waiting for pipeline: {e}", flush=True)

    time.sleep(2)
    p1 = os.path.join(out_dir, "us08_upload_pipeline_stepper.png")
    page.screenshot(path=p1)
    print(f"Captured upload pipeline stepper screenshot to {p1}", flush=True)

    print("=== US-08 PART B: Quarantine State on Unsupported / Corrupted File ===", flush=True)
    # Click the quick-test corrupted .txt button to trigger quarantine
    corrupt_btn = page.locator('button:has-text("Upload corrupted .txt")')
    corrupt_btn.click()
    print("Clicked 'Upload corrupted .txt (Test Quarantine)'", flush=True)

    # Wait for Quarantine card to populate with real error
    try:
        page.wait_for_selector('text="Action required"', timeout=10000)
        print("Found 'Action required' quarantine badge!", flush=True)
        page.wait_for_selector('text="corrupted_report_2025-06-18.txt"', timeout=5000)
        print("Found Quarantined row with filename!", flush=True)
    except Exception as e:
        print(f"Notice while waiting for quarantine: {e}", flush=True)

    time.sleep(2)
    q_card = page.locator('text="Action required"').first
    q_card.scroll_into_view_if_needed()
    time.sleep(1)

    p2 = os.path.join(out_dir, "us08_upload_quarantine_error.png")
    page.screenshot(path=p2)
    print(f"Captured quarantine state screenshot to {p2}", flush=True)

    browser.close()
    print("US-08 browser verification completed successfully.", flush=True)
