import time
import os
import sys
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    # Use larger viewport height so full graph, ask bar, and thinking details panel are completely visible
    context = browser.new_context(viewport={"width": 1440, "height": 1350})
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    print("=== PART A: Live SSE Streaming in Thinking Details Panel ===", flush=True)
    page.goto(f"http://localhost:{PORT}/graph", wait_until="domcontentloaded")
    page.evaluate("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.reload(wait_until="domcontentloaded")
    time.sleep(3)
    print("Initial graph loaded for Arjun R", flush=True)

    input_box = page.locator('input[placeholder*="Ask a question"]')
    input_box.click()
    input_box.fill("What was my hemoglobin level?")
    input_box.press("Enter")
    print("Sent question: 'What was my hemoglobin level?'", flush=True)

    # Wait for Thinking Details panel to receive real events and complete
    try:
        page.wait_for_selector('text="Thinking details"', timeout=10000)
        print("Found 'Thinking details' panel header", flush=True)
        page.wait_for_selector('text="[done]"', timeout=20000)
        print("Found live trace [done] row!", flush=True)
    except Exception as e:
        print(f"Notice while waiting for live stream: {e}", flush=True)

    time.sleep(2)
    thinking_panel = page.locator('text="Thinking details"').first
    thinking_panel.scroll_into_view_if_needed()
    time.sleep(1)

    p1 = os.path.join(out_dir, "us06_thinking_details_live.png")
    page.screenshot(path=p1)
    print(f"Captured live SSE stream screenshot to {p1}", flush=True)

    print("=== PART B: Stopped Backend Error State ===", flush=True)
    page_error = context.new_page()
    page_error.goto(f"http://localhost:{PORT}/graph", wait_until="domcontentloaded")
    page_error.evaluate("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page_error.reload(wait_until="domcontentloaded")
    time.sleep(2)

    # Abort backend connections to simulate stopped backend / network disconnect
    page_error.route("http://127.0.0.1:8000/**", lambda route: route.abort("connectionfailed"))

    input_box_err = page_error.locator('input[placeholder*="Ask a question"]')
    input_box_err.click()
    input_box_err.fill("What are my glucose levels?")
    input_box_err.press("Enter")
    print("Sent question with stopped backend simulation", flush=True)

    try:
        page_error.wait_for_selector('text="Backend Stream Interrupted"', timeout=10000)
        print("Found 'Backend Stream Interrupted' badge and banner!", flush=True)
    except Exception as e:
        print(f"Notice while waiting for error state: {e}", flush=True)

    time.sleep(2)
    err_panel = page_error.locator('text="Thinking details"').first
    err_panel.scroll_into_view_if_needed()
    time.sleep(1)

    p2 = os.path.join(out_dir, "us06_thinking_details_error.png")
    page_error.screenshot(path=p2)
    print(f"Captured stopped backend error screenshot to {p2}", flush=True)

    browser.close()
    print("Browser run complete.", flush=True)
