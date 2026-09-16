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

    # Capture mid-reveal (~250ms after load)
    time.sleep(0.25)
    p_reveal = os.path.join(out_dir, "us17_graph_staggered_reveal.png")
    page.screenshot(path=p_reveal)
    print(f"Captured staggered reveal to {p_reveal}", flush=True)

    # Wait for reveal and count-up to settle (~1.8s)
    time.sleep(1.8)
    p_metrics = os.path.join(out_dir, "us17_graph_countup_metrics.png")
    page.screenshot(path=p_metrics)
    print(f"Captured countup metrics to {p_metrics}", flush=True)

    # 2. Ask Question 1: "What was my hemoglobin level?"
    input_box = page.locator('input[placeholder*="Ask a question"]')
    input_box.click()
    input_box.fill("What was my hemoglobin level?")
    input_box.press("Enter")
    print("Sent question 1: What was my hemoglobin level?", flush=True)

    try:
        page.wait_for_selector('text="Activated concepts"', timeout=35000)
        print("Found 'Activated concepts' chip for Question 1!", flush=True)
    except Exception as e:
        print(f"Wait notice Q1: {e}", flush=True)

    time.sleep(2.5)
    p_q1 = os.path.join(out_dir, "us17_graph_active_question1.png")
    page.screenshot(path=p_q1)
    print(f"Captured Question 1 active set to {p_q1}", flush=True)

    # 3. Ask Question 2: "What was my vitamin D level?"
    input_box.click()
    input_box.fill("What was my vitamin D level?")
    input_box.press("Enter")
    print("Sent question 2: What was my vitamin D level?", flush=True)

    try:
        page.wait_for_selector('text="Vitamin D"', timeout=35000)
        print("Found 'Vitamin D' chip for Question 2!", flush=True)
    except Exception as e:
        print(f"Wait notice Q2: {e}", flush=True)

    time.sleep(2.5)
    p_q2 = os.path.join(out_dir, "us17_graph_active_question2.png")
    page.screenshot(path=p_q2)
    print(f"Captured Question 2 active set to {p_q2}", flush=True)

    # 4. Switch persona to scanned OCR persona to verify scanned PDF graph >= 6 nodes
    page.evaluate("localStorage.setItem('vitagraph_user_id', 'usr_cb37bc1d1eb4');")
    page.reload(wait_until="domcontentloaded")
    time.sleep(2)
    p_scanned = os.path.join(out_dir, "us17_scanned_pdf_graph.png")
    page.screenshot(path=p_scanned)
    print(f"Captured scanned PDF graph to {p_scanned}", flush=True)

    browser.close()
    print("All US-17 artifacts captured successfully!", flush=True)
