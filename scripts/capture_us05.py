import time
import os
import sys
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 960})
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    # 1. Load Knowledge Graph Page for Arjun R (VG-2026-001)
    page.goto(f"http://localhost:{PORT}/graph", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.reload(wait_until="domcontentloaded")
    time.sleep(3)
    print("Initial graph loaded for Arjun R", flush=True)

    # 2. Ask Question 1: "What was my hemoglobin level?"
    input_box = page.locator('input[placeholder*="Ask a question"]')
    input_box.click()
    input_box.fill("What was my hemoglobin level?")
    input_box.press("Enter")
    print("Sent question 1: What was my hemoglobin level?", flush=True)

    # Wait for response and subgraph activation
    try:
        page.wait_for_selector('text="Activated concepts"', timeout=15000)
        print("Found 'Activated concepts' chip for Question 1!", flush=True)
    except Exception as e:
        print(f"Wait notice Q1: {e}", flush=True)

    time.sleep(2)
    p1 = os.path.join(out_dir, "us05_question_hemoglobin.png")
    page.screenshot(path=p1)
    print(f"Captured Question 1 screenshot to {p1}", flush=True)

    # 3. Ask Question 2: "What was my vitamin D level?"
    input_box.click()
    input_box.fill("What was my vitamin D level?")
    input_box.press("Enter")
    print("Sent question 2: What was my vitamin D level?", flush=True)

    # Wait for response and subgraph activation
    try:
        page.wait_for_selector('text="Vitamin D"', timeout=15000)
        print("Found 'Vitamin D' chip for Question 2!", flush=True)
    except Exception as e:
        print(f"Wait notice Q2: {e}", flush=True)

    time.sleep(2)
    p2 = os.path.join(out_dir, "us05_question_vitamind.png")
    page.screenshot(path=p2)
    print(f"Captured Question 2 screenshot to {p2}", flush=True)

    browser.close()
    print("Browser closed successfully.", flush=True)
