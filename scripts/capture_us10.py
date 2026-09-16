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

    print("=== US-10 PART A: LibraryPage Live Documents & Metadata ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.goto(f"http://localhost:{PORT}/library", wait_until="domcontentloaded")
    time.sleep(3)
    print("LibraryPage loaded for Arjun R", flush=True)

    # Check Overview Stat Strip
    page.wait_for_selector('text=Total indexed', timeout=10000)
    print("Found Overview Stat Strip!", flush=True)

    # Check document rows with chunks & SHA256
    page.wait_for_selector('text=chunks', timeout=5000)
    print("Found real chunks counts on document cards!", flush=True)

    # Click SHA256 copy button
    copy_btns = page.locator('button[title="Copy SHA256"]')
    if copy_btns.count() > 0:
        print("Clicking first SHA256 copy button...", flush=True)
        copy_btns.first.click()
        page.wait_for_selector('text=Copied', timeout=3000)
        print("Verified 'Copied' badge appeared on hash copy!", flush=True)

    time.sleep(1)
    p1 = os.path.join(out_dir, "us10_library_live_reports.png")
    page.screenshot(path=p1)
    print(f"Captured library page screenshot to {p1}", flush=True)

    print("=== US-10 PART B: ComparePage Longitudinal Diffs & Summary Strip ===", flush=True)
    page.goto(f"http://localhost:{PORT}/compare", wait_until="domcontentloaded")
    time.sleep(3)
    print("ComparePage loaded for Arjun R", flush=True)

    # Check Summary Strip
    page.wait_for_selector('text=Longitudinal shifts:', timeout=10000)
    print("Found Summary Strip for longitudinal shifts!", flush=True)

    # Check that improved/declined/stable/unavailable badges exist
    page.wait_for_selector('text=improved', timeout=5000)
    page.wait_for_selector('text=stable', timeout=5000)
    print("Found real summary count badges!", flush=True)

    # Check diff table rows
    page.wait_for_selector('text=Biomarker / Test', timeout=5000)
    page.wait_for_selector('text=Hemoglobin', timeout=5000)
    print("Found real Hemoglobin diff row in table!", flush=True)

    time.sleep(1)
    p2 = os.path.join(out_dir, "us10_compare_live_diff.png")
    page.screenshot(path=p2)
    print(f"Captured compare page screenshot to {p2}", flush=True)

    browser.close()
    print("US-10 browser verification completed successfully.", flush=True)
