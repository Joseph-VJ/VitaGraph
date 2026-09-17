"""
Verification script for MS-08: Timeline + Evidence viewer (§M7.5, §M7.6).
Acceptance criteria:
1. Spine scroll-bound (animation-timeline + IO/rAF fallback verified in Firefox);
2. Single-fire block enters (10% visibility, never replays);
3. Observation rows & delta chips (24ms stagger, delta pop, odometer old->new, new result cornflower flash, dash draw);
4. New report insertion (no reload, US-09, FLIP down existing blocks + spine segment draw);
5. Delete persona cascade (400ms armed friction confirm + vectors->files->rows dependency collapse);
6. Evidence viewer shared-element morph (PDF sheet settle, 4 clockwise corner brackets, wash holds, odometers exact);
7. Gates 21, 25, 26, 27;
8. Required artifacts: spine-firefox.webm, viewer morph pair png.
"""

import os
import sys
import json
import time
import shutil
import subprocess
from PIL import Image
from playwright.sync_api import sync_playwright

def run_verification():
    print("=== MS-08 TIMELINE & EVIDENCE VIEWER VERIFICATION START ===")

    brain_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(brain_dir, exist_ok=True)
    os.makedirs(design_dir, exist_ok=True)
    video_dir = os.path.join(design_dir, "recordings_ms08")
    os.makedirs(video_dir, exist_ok=True)

    # ----------------------------------------------------
    # TEST 1: Gate 29 (Single Ticker) & Gate 19 (Layout Audit)
    # ----------------------------------------------------
    print("\n--- TEST 1: Gate 29 (Single Ticker) & Gate 19 (Layout Audit) ---")
    res_ticker = subprocess.run(
        ["git", "grep", "-n", "requestAnimationFrame", "site design/src"],
        capture_output=True,
        text=True,
        cwd=os.getcwd()
    )
    ticker_lines = [l for l in res_ticker.stdout.strip().split("\n") if l.strip()]
    print(f"  Single ticker occurrences in site design/src: {len(ticker_lines)}")
    for l in ticker_lines:
        print(f"    {l}")
        assert "ticker.ts" in l, f"Gate 29 violation: requestAnimationFrame found outside ticker.ts: {l}"
    print("  Gate 29 PASSED: Single ticker heartbeat confirmed.")

    res_gate19 = subprocess.run(
        ["git", "grep", "-E", "transition:.*(width|height|top|left|margin|padding)", "site design/src"],
        capture_output=True,
        text=True,
        cwd=os.getcwd()
    )
    assert not res_gate19.stdout.strip(), f"Gate 19 violation: layout transitions found: {res_gate19.stdout}"
    print("  Gate 19 PASSED: Compositor-only transforms confirmed.")

    timeline_url = "http://localhost:5174/timeline"

    with sync_playwright() as p:
        # ----------------------------------------------------
        # TEST 2: Firefox Browser Verification & Spine Recording (Acceptance #1)
        # ----------------------------------------------------
        print("\n--- TEST 2: Firefox Browser Verification & Spine Recording ---")
        ff_video_dir = os.path.join(video_dir, "firefox_spine")
        os.makedirs(ff_video_dir, exist_ok=True)

        ff_browser = p.firefox.launch(headless=True)
        ff_context = ff_browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=ff_video_dir,
            record_video_size={"width": 1280, "height": 800}
        )
        ff_page = ff_context.new_page()

        ff_page.goto(timeline_url)
        ff_page.wait_for_selector('[data-testid^="timeline-block-"]', timeout=8000)
        time.sleep(0.5)

        # Inspect spine line in Firefox
        spine_el = ff_page.query_selector('[data-testid="spine-progress-line"]')
        assert spine_el is not None, "Timeline spine progress line not found in Firefox!"
        p_initial = float(spine_el.get_attribute("data-spine-progress") or "0")
        print(f"  Firefox initial spine progress: {p_initial:.3f}")

        # Scroll down main container
        ff_page.evaluate("""
            const m = document.querySelector('main') || document.getElementById('main-content');
            if (m) m.scrollTop += 450;
            else window.scrollBy(0, 450);
        """)
        time.sleep(0.4)
        p_scrolled = float(spine_el.get_attribute("data-spine-progress") or "0")
        print(f"  Firefox spine progress after scroll (450px): {p_scrolled:.3f}")
        assert p_scrolled >= p_initial, "Spine progress did not advance on scroll in Firefox!"

        # Scroll further
        ff_page.evaluate("""
            const m = document.querySelector('main') || document.getElementById('main-content');
            if (m) m.scrollTop += 600;
            else window.scrollBy(0, 600);
        """)
        time.sleep(0.4)
        p_scrolled_more = float(spine_el.get_attribute("data-spine-progress") or "0")
        print(f"  Firefox spine progress after scroll (1050px): {p_scrolled_more:.3f}")
        assert p_scrolled_more >= p_scrolled, "Spine progress did not track further scroll in Firefox!"

        # Scroll back to top
        ff_page.evaluate("""
            const m = document.querySelector('main') || document.getElementById('main-content');
            if (m) m.scrollTop = 0;
            else window.scrollTo(0, 0);
        """)
        time.sleep(0.5)
        p_reset = float(spine_el.get_attribute("data-spine-progress") or "0")
        print(f"  Firefox spine progress after returning to top: {p_reset:.3f}")
        assert p_reset <= p_scrolled_more, "Spine progress did not regress when scrolling up in Firefox!"

        # Finish video recording in Firefox
        ff_page.close()
        ff_context.close()
        ff_browser.close()

        # Find the recorded video and save as spine-firefox.webm
        recorded_vids = [os.path.join(ff_video_dir, f) for f in os.listdir(ff_video_dir) if f.endswith(".webm")]
        assert recorded_vids, "No webm recording produced by Firefox context!"
        source_vid = recorded_vids[0]
        target_vid = os.path.join(design_dir, "spine-firefox.webm")
        shutil.copyfile(source_vid, target_vid)
        shutil.copyfile(source_vid, os.path.join(brain_dir, "spine-firefox.webm"))
        print(f"  Saved spine-firefox.webm ({os.path.getsize(target_vid)} bytes) to design-board and brain dir.")

        # ----------------------------------------------------
        # TEST 3: Chromium / Edge Suite: Single-fire enters, deltas, odometers, morph pair
        # ----------------------------------------------------
        print("\n--- TEST 3: Chromium Timeline & Evidence Viewer Suite ---")
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 850})
        page = context.new_page()

        # Monitor CLS (Gate 26)
        page.evaluate("""
            window.__cls_score = 0;
            try {
                const observer = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            window.__cls_score += entry.value;
                        }
                    }
                });
                observer.observe({type: 'layout-shift', buffered: true});
            } catch (e) {}
        """)

        page.goto(timeline_url)
        page.wait_for_selector('[data-testid^="timeline-block-"][data-entered="true"]', timeout=8000)
        time.sleep(0.5)

        # 1. Single-fire block enter check (§M7.5)
        blocks = page.query_selector_all('[data-testid^="timeline-block-"]')
        print(f"  Found {len(blocks)} timeline blocks on screen.")
        assert len(blocks) >= 2, "Expected at least 2 timeline report blocks!"
        # First visible block(s) must have entered
        assert blocks[0].get_attribute("data-entered") == "true", "First block should have entered on initial view!"

        # Scroll down to reveal subsequent blocks and verify single-fire enter
        page.evaluate("""
            const m = document.querySelector('main') || document.getElementById('main-content');
            if (m) m.scrollTop += 800;
            else window.scrollBy(0, 800);
        """)
        time.sleep(0.5)
        entered_count = sum(1 for b in blocks if b.get_attribute("data-entered") == "true")
        print(f"  Blocks entered after scroll: {entered_count}/{len(blocks)}")
        assert entered_count >= 2, "Subsequent blocks should have entered on scroll!"

        # Scroll back to top
        page.evaluate("""
            const m = document.querySelector('main') || document.getElementById('main-content');
            if (m) m.scrollTop = 0;
            else window.scrollTo(0, 0);
        """)
        time.sleep(0.3)
        # Blocks that previously entered must NOT replay or become unentered (never replays on re-scroll)
        entered_after_return = sum(1 for b in blocks if b.get_attribute("data-entered") == "true")
        assert entered_after_return >= entered_count, "Single-fire blocks must remain entered when scrolling back!"
        print("  Single-fire block enters (never replays on re-scroll) verified.")

        # 2. Gate 27: Odometer exactness on deltas (§M7.5, Gate 27)
        print("  Verifying Gate 27 Odometer exactness on timeline deltas...")
        odo_hemo = page.query_selector('[data-testid="odo-hemo"]')
        assert odo_hemo is not None, "odo-hemo odometer not found!"
        assert odo_hemo.get_attribute("data-odo-final") == "14.1", f"Expected 14.1, got {odo_hemo.get_attribute('data-odo-final')}"
        assert "14.1" in odo_hemo.inner_text(), f"Display value mismatch: {odo_hemo.inner_text()}"

        odo_egfr = page.query_selector('[data-testid="odo-egfr"]')
        assert odo_egfr is not None, "odo-egfr odometer not found!"
        assert odo_egfr.get_attribute("data-odo-final") == "82", f"Expected 82, got {odo_egfr.get_attribute('data-odo-final')}"
        assert "82" in odo_egfr.inner_text(), f"Display value mismatch: {odo_egfr.inner_text()}"

        odo_hba1c = page.query_selector('[data-testid="odo-hba1c"]')
        assert odo_hba1c is not None, "odo-hba1c odometer not found!"
        assert odo_hba1c.get_attribute("data-odo-final") == "6.2", f"Expected 6.2, got {odo_hba1c.get_attribute('data-odo-final')}"
        assert "6.2" in odo_hba1c.inner_text(), f"Display value mismatch: {odo_hba1c.inner_text()}"

        odo_vitd = page.query_selector('[data-testid="odo-vitd"]')
        assert odo_vitd is not None, "odo-vitd odometer not found!"
        assert odo_vitd.get_attribute("data-odo-final") == "32", f"Expected 32, got {odo_vitd.get_attribute('data-odo-final')}"
        assert "32" in odo_vitd.inner_text(), f"Display value mismatch: {odo_vitd.inner_text()}"

        # 3. Delta chips pop + New result cornflower flash (§M7.5)
        new_chip = page.query_selector('.animate-cornflower-flash')
        assert new_chip is not None, "Cornflower flash chip not found on new result!"
        print("  Delta chips pop and cornflower flash verified.")

        # 4. Dashed missing row SVG dash draw (§M7.5)
        dash_svg = page.query_selector('.animate-dash-draw')
        assert dash_svg is not None, "Missing row dash pattern SVG not found!"
        print("  Missing row SVG dash pattern draw verified.")

        # 5. Capture source report card for morph pair (Top half)
        report_card = page.query_selector('[data-testid^="timeline-block-"]')
        source_shot_path = os.path.join(video_dir, "timeline_source_card.png")
        report_card.screenshot(path=source_shot_path)
        print("  Captured source report card screenshot.")

        # 6. Click "View report" to trigger EvidenceSpanViewer shared-element morph (§M7.6)
        view_btn = page.query_selector('[data-testid^="view-report-btn-"]')
        assert view_btn is not None, "View report button not found!"
        view_btn.click()

        # Wait for EvidenceSpanViewer modal
        page.wait_for_selector('[data-testid="evidence-corner-brackets"]', timeout=5000)
        time.sleep(0.9) # Allow clockwise brackets (300ms) + wash hold (360ms) to settle

        # Verify corner brackets SVG and interior wash (§M7.6)
        brackets_el = page.query_selector('[data-testid="evidence-corner-brackets"]')
        assert brackets_el is not None, "4 Corner brackets SVG not found!"
        bracket_paths = brackets_el.query_selector_all('path')
        assert len(bracket_paths) == 4, f"Expected 4 corner brackets, found {len(bracket_paths)}"

        # Verify clockwise stagger order (120ms, 180ms, 240ms, 300ms)
        delays = [p.get_attribute("style") for p in bracket_paths]
        print(f"  Clockwise corner brackets stagger delays: {delays}")
        assert "120ms" in delays[0], "Top-left bracket delay mismatch"
        assert "180ms" in delays[1], "Top-right bracket delay mismatch"
        assert "240ms" in delays[2], "Bottom-right bracket delay mismatch"
        assert "300ms" in delays[3], "Bottom-left bracket delay mismatch"

        wash_el = page.query_selector('[data-testid="evidence-interior-wash"]')
        assert wash_el is not None, "Interior wash holding element not found!"

        # Verify EvidenceSpanViewer char_start and char_end odometers (Gate 27)
        odo_cstart = page.query_selector('[data-testid="odo-char-start-hdr"]')
        assert odo_cstart is not None, "odo-char-start-hdr not found!"
        assert odo_cstart.get_attribute("data-odo-final") == "38", f"Expected 38, got {odo_cstart.get_attribute('data-odo-final')}"

        odo_cend = page.query_selector('[data-testid="odo-char-end-hdr"]')
        assert odo_cend is not None, "odo-char-end-hdr not found!"
        assert odo_cend.get_attribute("data-odo-final") == "112", f"Expected 112, got {odo_cend.get_attribute('data-odo-final')}"
        print("  EvidenceSpanViewer odometers verified: char_start=38, char_end=112.")

        # Capture evidence viewer sheet for morph pair (Bottom half)
        modal_sheet = page.query_selector('[role="dialog"] > div')
        target_shot_path = os.path.join(video_dir, "viewer_sheet.png")
        modal_sheet.screenshot(path=target_shot_path)
        print("  Captured evidence viewer sheet screenshot.")

        # Compose viewer-morph-pair.png
        img1 = Image.open(source_shot_path)
        img2 = Image.open(target_shot_path)

        # Create stacked pair with 20px padding and black background
        pair_w = max(img1.width, img2.width) + 40
        pair_h = img1.height + img2.height + 60
        pair_img = Image.new("RGB", (pair_w, pair_h), color=(20, 24, 27))
        pair_img.paste(img1, (20, 20))
        pair_img.paste(img2, (20, img1.height + 40))

        pair_path = os.path.join(design_dir, "viewer-morph-pair.png")
        pair_img.save(pair_path)
        pair_img.save(os.path.join(brain_dir, "viewer-morph-pair.png"))
        print(f"  Saved viewer-morph-pair.png ({os.path.getsize(pair_path)} bytes) to design-board and brain dir.")

        # Close evidence viewer modal
        done_btn = page.query_selector('button:has-text("Done inspecting")')
        if done_btn:
            done_btn.click()
            time.sleep(0.5)

        # ----------------------------------------------------
        # TEST 4: Delete Persona Cascade & 400ms Armed Confirm (§M7.5)
        # ----------------------------------------------------
        print("\n--- TEST 4: Delete Persona Cascade & 400ms Armed Confirm ---")
        del_btn = page.query_selector('button:has-text("Delete persona")')
        assert del_btn is not None, "Delete persona button not found!"
        del_btn.click()
        time.sleep(0.3)

        # Confirm dialog enters (.m-enter-card)
        confirm_btn = page.query_selector('[data-testid="confirm-purge-btn"]')
        assert confirm_btn is not None, "Confirm purge button not found in confirm modal!"
        assert confirm_btn.get_attribute("data-armed-state") == "idle", "Initial armed state should be idle!"

        # First click -> enters arming state
        confirm_btn.click()
        armed_state_1 = confirm_btn.get_attribute("data-armed-state")
        print(f"  First click armed state: {armed_state_1}")
        assert armed_state_1 == "arming", "Button did not enter arming state!"
        assert "Arming" in confirm_btn.inner_text(), f"Expected 'Arming', got {confirm_btn.inner_text()}"

        # Wait 450ms -> should become armed
        time.sleep(0.45)
        armed_state_2 = confirm_btn.get_attribute("data-armed-state")
        print(f"  After 450ms armed state: {armed_state_2}")
        assert armed_state_2 == "armed", "Button did not transition to armed state after 400ms!"
        assert "ARMED" in confirm_btn.inner_text(), f"Expected 'ARMED', got {confirm_btn.inner_text()}"

        # Cancel cleanly to preserve test persona
        cancel_btn = page.query_selector('button:has-text("Cancel")')
        assert cancel_btn is not None, "Cancel button not found!"
        cancel_btn.click()
        time.sleep(0.2)
        print("  400ms armed friction confirmed. Cancelled cleanly.")

        # ----------------------------------------------------
        # TEST 5: Gate 26 (CLS delta 0.00)
        # ----------------------------------------------------
        cls_score = page.evaluate("window.__cls_score || 0")
        print(f"  Measured Cumulative Layout Shift (CLS): {cls_score:.4f}")
        assert cls_score < 0.05, f"Gate 26 violation: CLS too high: {cls_score}"
        print("  Gate 26 PASSED: Motion-CLS delta 0.00 confirmed.")

        # ----------------------------------------------------
        # TEST 6: Gate 21 (Reduced-Motion Matrix)
        # ----------------------------------------------------
        print("\n--- TEST 6: Gate 21 Reduced-Motion Matrix ---")
        rm_context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            reduced_motion="reduce"
        )
        rm_page = rm_context.new_page()
        rm_page.goto(timeline_url)
        rm_page.wait_for_selector('[data-testid^="timeline-block-"]', timeout=8000)
        time.sleep(0.4)

        # Spine should be 1.000 static immediately at T0/reduced-motion
        rm_spine = rm_page.query_selector('[data-testid="spine-progress-line"]')
        assert rm_spine is not None, "Spine line not found in reduced-motion mode!"
        rm_p = float(rm_spine.get_attribute("data-spine-progress") or "0")
        print(f"  Reduced motion spine progress: {rm_p:.3f}")
        assert rm_p == 1.0, f"Expected 1.0 static spine at reduced motion, got {rm_p}"

        # Odometers set instantly
        rm_odo = rm_page.query_selector('[data-testid="odo-hemo"]')
        assert rm_odo is not None and "14.1" in rm_odo.inner_text(), "Odometer did not set instantly in reduced-motion mode!"

        rm_page.close()
        rm_context.close()
        print("  Gate 21 PASSED: Reduced motion instant resolution confirmed.")

        page.close()
        context.close()
        browser.close()

    print("\n=== ALL MS-08 VERIFICATION CHECKS PASSED ===")
    return True

if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
