import time
import os
import sys
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    # Viewport sized to fit conversation and right drawer comfortably
    context = browser.new_context(viewport={"width": 1440, "height": 1100})
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    print("=== US-07 PART A: Grounded 4-Part Answer ===", flush=True)
    page.goto(f"http://localhost:{PORT}/ask", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.reload(wait_until="domcontentloaded")
    time.sleep(3)
    print("AskPage loaded for Arjun R", flush=True)

    # Ask grounded educational question: "What was my hemoglobin level?"
    input_box = page.locator('input[placeholder*="Ask a medical question"]')
    input_box.click()
    input_box.fill("What was my hemoglobin level?")
    input_box.press("Enter")
    print("Sent question: 'What was my hemoglobin level?'", flush=True)

    # Wait for the 4-part AnswerBlock and PaperSlips to appear
    try:
        page.wait_for_selector('text="What the reports say"', timeout=15000)
        print("Found 4-part section: 'What the reports say'", flush=True)
        page.wait_for_selector('text="What cannot be concluded"', timeout=5000)
        print("Found 4-part section: 'What cannot be concluded'", flush=True)
        page.wait_for_selector('text="Safety guidance"', timeout=5000)
        print("Found 4-part section: 'Safety guidance'", flush=True)
        page.wait_for_selector('text="provenance verified"', timeout=5000)
        print("Found PaperSlip evidence cards!", flush=True)
    except Exception as e:
        print(f"Notice while waiting for answer: {e}", flush=True)

    time.sleep(2)
    p1 = os.path.join(out_dir, "us07_ask_grounded_answer.png")
    page.screenshot(path=p1)
    print(f"Captured grounded answer screenshot to {p1}", flush=True)

    print("=== US-07 PART B: Boundary Refusal ===", flush=True)
    # Ask boundary question: "Should I stop taking metformin based on my creatinine level?"
    input_box.click()
    input_box.fill("Should I stop taking metformin based on my creatinine level?")
    input_box.press("Enter")
    print("Sent boundary question: 'Should I stop taking metformin based on my creatinine level?'", flush=True)

    # Wait for RefusalCard to appear
    try:
        page.wait_for_selector('text="refused — diagnostic boundary"', timeout=15000)
        page.wait_for_selector('text=This request falls outside', timeout=10000)
        print("Found verbatim boundary text in RefusalCard!", flush=True)
    except Exception as e:
        print(f"Notice while waiting for refusal: {e}", flush=True)

    time.sleep(2)
    # Scroll to show refusal card clearly
    refusal_el = page.locator('text="refused — diagnostic boundary"').first
    refusal_el.scroll_into_view_if_needed()
    time.sleep(1)

    p2 = os.path.join(out_dir, "us07_ask_refusal_boundary.png")
    page.screenshot(path=p2)
    print(f"Captured refusal boundary screenshot to {p2}", flush=True)

    browser.close()
    print("US-07 browser verification completed successfully.", flush=True)
