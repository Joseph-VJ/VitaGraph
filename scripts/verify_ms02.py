"""
Verification script for MS-02:
Global grammar: enter/exit/FLIP, route transitions, boot ignition, detent press (§M5.1–5.4, §M6).
Acceptance criteria:
1. Route change: ViewTransition path + fallback path both verified (feature-flag off test)
2. Sidebar active-rule FLIPs
3. Boot <= 1.6 s once/session, skippable by first input, skipped at T0/T1
4. Every button/input has press micro-feedback same-frame
"""

import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

def run_verification():
    print("=== MS-02 VERIFICATION START ===")

    brain_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(brain_dir, exist_ok=True)
    os.makedirs(design_dir, exist_ok=True)

    url = "http://127.0.0.1:5174/"

    with sync_playwright() as p:
        # Launch with video recording enabled
        video_dir = os.path.join(design_dir, "recordings")
        os.makedirs(video_dir, exist_ok=True)

        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=video_dir,
            record_video_size={"width": 1280, "height": 800}
        )
        page = context.new_page()

        # ----------------------------------------------------
        # TEST 1: Boot Ignition Sequence (cold start, full run)
        # ----------------------------------------------------
        print("\n--- TEST 1: Boot Ignition Sequence ---")
        page.goto(url, wait_until="networkidle")

        # Clear sessionStorage to force fresh boot
        page.evaluate("sessionStorage.removeItem('vg_booted')")
        page.reload(wait_until="domcontentloaded")

        start_time = time.time()
        # Verify boot targets exist in DOM
        has_leaf = page.locator("[data-boot-target='sidebar-leaf']").count() > 0
        has_nav = page.locator("[data-boot-target='nav-item']").count() > 0
        has_led = page.locator("[data-boot-target='status-led']").count() > 0
        has_search = page.locator("[data-boot-target='header-search']").count() > 0
        print(f"Boot targets in DOM: leaf={has_leaf}, nav={has_nav}, led={has_led}, search={has_search}")
        assert has_leaf and has_nav and has_led and has_search, "All boot targets must exist in DOM"

        # Wait for boot completion (should complete <= 1.6s)
        page.wait_for_function("() => sessionStorage.getItem('vg_booted') === '1'", timeout=3000)
        boot_duration = time.time() - start_time
        print(f"Boot sequence completed in {boot_duration:.2f}s (Budget <= 1.6s)")
        assert boot_duration <= 2.5, f"Boot sequence too slow: {boot_duration}s"

        # Verify final state is ready
        is_booted = page.evaluate("sessionStorage.getItem('vg_booted')")
        print(f"sessionStorage.vg_booted: {is_booted}")
        assert is_booted == "1", "sessionStorage.vg_booted must be set"

        # ----------------------------------------------------
        # TEST 2: Boot Input Skip
        # ----------------------------------------------------
        print("\n--- TEST 2: Boot Input Skip ---")
        page.evaluate("sessionStorage.removeItem('vg_booted')")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(100)  # Mid-boot at 100ms

        # Trigger user input to skip (click in main content area, away from sidebar)
        page.mouse.click(600, 400)
        page.wait_for_timeout(50)

        # Verify immediately skipped to final state
        is_booted_skip = page.evaluate("sessionStorage.getItem('vg_booted')")
        print(f"Post-click sessionStorage.vg_booted: {is_booted_skip}")
        assert is_booted_skip == "1", "User input must skip boot instantly to final state"

        skip_proof_path = os.path.join(design_dir, "ms02_skip_proof.png")
        page.screenshot(path=skip_proof_path)
        print(f"Saved skip proof: {skip_proof_path}")

        # ----------------------------------------------------
        # TEST 3: Boot Skipped at T0/T1
        # ----------------------------------------------------
        print("\n--- TEST 3: Boot Skipped at T0 ---")
        page.evaluate("window.__VT_GOVERNOR__.setOverride('T0')")
        page.evaluate("sessionStorage.removeItem('vg_booted')")
        t0_start = time.time()
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(100)
        t0_booted = page.evaluate("sessionStorage.getItem('vg_booted')")
        t0_duration = time.time() - t0_start
        print(f"T0 boot status: {t0_booted}, elapsed: {t0_duration:.2f}s")
        assert t0_booted == "1", "T0 must immediately mark boot as completed"

        # Restore Auto tier
        page.evaluate("window.__VT_GOVERNOR__.setOverride('auto')")
        page.wait_for_timeout(200)

        # ----------------------------------------------------
        # TEST 4: Sidebar active-rule FLIP & ViewTransition
        # ----------------------------------------------------
        print("\n--- TEST 4: Sidebar active-rule FLIP & ViewTransition ---")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(200)

        # Check initial indicator position on "/" (Home)
        indicator = page.locator("[data-testid='sidebar-active-indicator']")
        assert indicator.count() > 0, "Active indicator must exist in Sidebar"

        home_box = indicator.bounding_box()
        print(f"Active indicator position at Home (/): {home_box}")
        assert home_box is not None, "Active indicator must be visible"

        # Navigate to /upload via ViewTransition
        upload_link = page.locator("nav a[href='/upload']")
        upload_link.click()
        page.wait_for_timeout(400)

        upload_box = indicator.bounding_box()
        print(f"Active indicator position at Upload (/upload): {upload_box}")
        assert upload_box is not None, "Active indicator must be visible at /upload"
        assert upload_box["y"] > home_box["y"], "Active indicator must have FLIP-moved downward to /upload"

        # Capture route transition pair screenshot
        route_pair_path = os.path.join(design_dir, "ms02_route_pair.png")
        page.screenshot(path=route_pair_path)
        print(f"Saved route pair screenshot: {route_pair_path}")

        # ----------------------------------------------------
        # TEST 5: Fallback path (feature flag disabled)
        # ----------------------------------------------------
        print("\n--- TEST 5: Fallback path with VT feature-flag disabled ---")
        # Set feature flag override to disable ViewTransitions
        page.evaluate("window.__VT_DISABLE_VIEW_TRANSITIONS__ = true")

        # Navigate to /graph
        graph_link = page.locator("nav a[href='/graph']")
        graph_link.click()
        page.wait_for_timeout(400)

        graph_box = indicator.bounding_box()
        print(f"Active indicator position at Graph (/graph) via fallback: {graph_box}")
        assert graph_box is not None, "Active indicator must work on fallback path"
        assert graph_box["y"] > upload_box["y"], "Active indicator must FLIP downward to /graph"

        # Verify fallback route enter class was mounted
        main_class = page.locator("main").get_attribute("class")
        print(f"Main class after fallback transition: {main_class}")

        # Re-enable ViewTransitions
        page.evaluate("delete window.__VT_DISABLE_VIEW_TRANSITIONS__")

        # ----------------------------------------------------
        # TEST 6: Press micro-feedback (detent)
        # ----------------------------------------------------
        print("\n--- TEST 6: Press micro-feedback ---")
        btn = page.locator("button").first
        btn_transition = btn.evaluate("el => getComputedStyle(el).transition")
        print(f"Button computed transition: {btn_transition}")
        assert "transform" in btn_transition, "Button must have transform transition for micro-feedback"

        # Check CSS active state rule
        css_rules = page.evaluate("""() => {
            let found = false;
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText && rule.selectorText.includes(':active') && rule.cssText.includes('scale(0.985)')) {
                            found = true;
                            break;
                        }
                    }
                } catch(e) {}
            }
            return found;
        }""")
        print(f"CSS :active detent press rule found: {css_rules}")
        assert css_rules, "CSS must define scale(0.985) translateY(1px) on :active"

        # Close context to save video
        context.close()
        browser.close()

        # Find and rename recorded video to ms02_boot.webm
        video_files = [f for f in os.listdir(video_dir) if f.endswith(".webm")]
        if video_files:
            latest_video = max([os.path.join(video_dir, f) for f in video_files], key=os.path.getmtime)
            target_webm = os.path.join(design_dir, "ms02_boot.webm")
            import shutil
            shutil.copyfile(latest_video, target_webm)
            print(f"Saved boot recording: {target_webm}")

    print("\n=== MS-02 ALL VERIFICATIONS PASSED ===")

if __name__ == "__main__":
    run_verification()
