import time
import os
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    print("=== US-13: Evidence Span Viewer with Character Offset Highlighting ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.goto(f"http://localhost:{PORT}/ask", wait_until="domcontentloaded")
    print("Navigated to /ask...", flush=True)

    # Wait for the initial question or answer block to load
    page.wait_for_selector('text=What the reports say', timeout=20000)
    print("Grounded 4-part answer block rendered!", flush=True)

    # Wait for evidence cards (PaperSlips) to appear
    page.wait_for_selector('text=Evidence used', timeout=10000)
    time.sleep(1)

    # Click the first PaperSlip
    print("Clicking on evidence PaperSlip...", flush=True)
    paper_slip = page.locator('figure').first
    paper_slip.wait_for(state="visible", timeout=5000)
    paper_slip.click()

    # Wait for the EvidenceSpanViewer modal dialog to open
    print("Waiting for Evidence Span Viewer modal dialog...", flush=True)
    modal = page.locator('[role="dialog"]')
    modal.wait_for(state="visible", timeout=10000)
    print("Evidence Span Viewer modal opened!", flush=True)

    # Verify key elements in the modal
    page.wait_for_selector('text=evidence span', timeout=5000)
    page.wait_for_selector('text=Chunk Provenance', timeout=5000)
    page.wait_for_selector('text=Highlight matches snippet', timeout=8000)
    print("Found 'Highlight matches snippet' and Chunk Provenance card!", flush=True)

    # Check for highlight element
    highlight = page.locator('[data-testid="evidence-highlight"]')
    highlight.wait_for(state="visible", timeout=5000)
    highlight_text = highlight.inner_text()
    print(f"Verified highlighted text span: '{highlight_text[:60]}...' ({len(highlight_text)} chars)", flush=True)

    time.sleep(1.5)
    p1 = os.path.join(out_dir, "us13_evidence_span_viewer.png")
    page.screenshot(path=p1)
    print(f"Captured evidence span viewer screenshot to {p1}", flush=True)

    # Close modal using Done inspecting button
    print("Closing modal via 'Done inspecting' button...", flush=True)
    page.click('text=Done inspecting')
    modal.wait_for(state="hidden", timeout=5000)
    print("Modal closed cleanly!", flush=True)

    # Now test opening from Drawer 'Retrieved chunks'
    print("Testing opening evidence span viewer from Drawer Retrieved chunks tab...", flush=True)
    page.click('text=Retrieved chunks')
    time.sleep(1)

    # Click the first chunk in the drawer
    first_chunk = page.locator('text=Inspect span').first
    first_chunk.click()

    # Verify modal opens again
    modal.wait_for(state="visible", timeout=10000)
    print("Opened Evidence Span Viewer directly from drawer chunk click!", flush=True)
    time.sleep(1.5)

    p2 = os.path.join(out_dir, "us13_evidence_chunk_drawer.png")
    page.screenshot(path=p2)
    print(f"Captured drawer chunk evidence viewer screenshot to {p2}", flush=True)

    browser.close()
    print("US-13 Verification completed successfully!", flush=True)
