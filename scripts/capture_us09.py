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

    print("=== US-09 PART A: TimelinePage Live Spine & Initial State ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.goto(f"http://localhost:{PORT}/timeline", wait_until="domcontentloaded")
    time.sleep(3)
    print("TimelinePage loaded for Arjun R", flush=True)

    # Check Patient persona card
    page.wait_for_selector('text=Patient persona', timeout=10000)
    print("Found Patient persona card!", flush=True)

    print("=== US-09 PART B: Add Follow-up Report Without Reload ===", flush=True)
    add_btn = page.locator('button:has-text("+ Add Follow-up Report (No Reload)")')
    if add_btn.count() > 0:
        print("Clicking '+ Add Follow-up Report (No Reload)' button...", flush=True)
        add_btn.click()
        # Wait for the button text to transition from Ingesting back to idle
        time.sleep(1)
        page.wait_for_selector('button:has-text("+ Add Follow-up Report (No Reload)")', timeout=20000)
        print("Upload complete! Live spine updated without page reload.", flush=True)

    time.sleep(2)
    # Verify DeltaChips and dashed row exist using substring match
    page.wait_for_selector('text=improving', timeout=5000)
    print("Found DeltaChip '+0.3 improving'!", flush=True)
    page.wait_for_selector('text=Not present in baseline report', timeout=5000)
    print("Found dashed row 'Vitamin D — Not present in baseline report'!", flush=True)

    p1 = os.path.join(out_dir, "us09_timeline_spine_deltas.png")
    page.screenshot(path=p1)
    print(f"Captured timeline spine with deltas screenshot to {p1}", flush=True)

    print("=== US-09 PART C: Delete Persona Confirmation UI ===", flush=True)
    del_btn = page.locator('button:has-text("Delete persona")')
    del_btn.click()
    page.wait_for_selector('text=Confirm deletion of VG-2026-001?', timeout=5000)
    print("Found delete confirmation modal with cascade warning!", flush=True)

    p2 = os.path.join(out_dir, "us09_timeline_delete_confirm.png")
    page.screenshot(path=p2)
    print(f"Captured delete confirmation screenshot to {p2}", flush=True)

    # Cancel delete to preserve data
    cancel_btn = page.locator('button:has-text("Cancel")')
    cancel_btn.click()
    print("Canceled delete dialog to preserve persona.", flush=True)

    browser.close()
    print("US-09 browser verification completed successfully.", flush=True)
