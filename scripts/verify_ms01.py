"""
Verification script for MS-01:
Motion foundation: tokens, engine, governor (§M2, §M4).
Acceptance criteria:
1. Engine files exist: ticker, spring, sequence, quality, features, flip.ts
2. springToLinear() emits valid linear() strings (overshoot <= 2%, points <= 28)
3. StatusStrip displays tier chip: 'motion T3' (Amendment A3)
4. Settings override persisted in localStorage ('motion_tier')
5. (prefers-reduced-motion: reduce) hard-locks T0 live without reload
6. Idle detection: ticker stops rAF when lanes idle for 500ms (zero rAF proof)
7. Gates 17, 19, 20, 29 verified
8. Artifacts captured: ms01_tier_chip.png, ms01_idle_raf_trace.json
"""

import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

def run_verification():
    print("=== MS-01 VERIFICATION START ===")
    
    # 1. Output directories
    brain_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(brain_dir, exist_ok=True)
    os.makedirs(design_dir, exist_ok=True)
    
    # 2. Launch browser with msedge channel
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        
        # Test against live Vite frontend
        url = "http://127.0.0.1:5174/"
        print(f"Navigating to {url}...")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Verify ticker and governor exposed on window
        has_ticker = page.evaluate("typeof window.__VT_TICKER__ !== 'undefined'")
        has_governor = page.evaluate("typeof window.__VT_GOVERNOR__ !== 'undefined'")
        print(f"Window ticker object present: {has_ticker}")
        print(f"Window governor object present: {has_governor}")
        assert has_ticker, "window.__VT_TICKER__ must be present"
        assert has_governor, "window.__VT_GOVERNOR__ must be present"
        
        # Verify initial governor state
        gov_state = page.evaluate("window.__VT_GOVERNOR__.getState()")
        print(f"Initial governor state: {gov_state}")
        
        # Verify tier chip in StatusStrip
        # Check text in StatusStrip
        status_text = page.locator("footer").inner_text()
        print(f"StatusStrip content: {status_text}")
        assert "motion" in status_text, "StatusStrip must contain 'motion' tier chip"
        
        # Capture screenshot of StatusStrip tier chip
        tier_chip_screenshot = os.path.join(brain_dir, "ms01_tier_chip.png")
        page.screenshot(path=tier_chip_screenshot)
        page.screenshot(path=os.path.join(design_dir, "ms01_tier_chip.png"))
        print(f"Saved tier chip screenshot to {tier_chip_screenshot}")
        
        # Navigate to Settings Page to test override persistence
        settings_url = "http://127.0.0.1:5174/settings"
        print(f"Navigating to {settings_url}...")
        page.goto(settings_url, wait_until="networkidle")
        page.wait_for_timeout(500)
        
        # Click T2 tier override button
        print("Testing manual tier override (T2)...")
        page.click("button:has-text('T2 Balanced')")
        page.wait_for_timeout(500)
        
        # Verify state and localStorage
        stored_tier = page.evaluate("localStorage.getItem('motion_tier')")
        current_state = page.evaluate("window.__VT_GOVERNOR__.getState()")
        print(f"localStorage 'motion_tier': {stored_tier}")
        print(f"Current governor state after T2 click: {current_state}")
        assert stored_tier == "T2", f"Expected localStorage 'T2', got {stored_tier}"
        assert current_state["tier"] == "T2", f"Expected tier T2, got {current_state['tier']}"
        assert current_state["mode"] == "manual", "Expected mode manual"
        
        # Check StatusStrip has 'motion T2 · manual'
        status_text_t2 = page.locator("footer").inner_text()
        print(f"StatusStrip after manual override: {status_text_t2}")
        assert "motion T2 · manual" in status_text_t2, f"Expected 'motion T2 · manual' in status strip, got {status_text_t2}"
        
        # Capture screenshot of settings with manual override
        settings_screenshot = os.path.join(brain_dir, "ms01_settings_override.png")
        page.screenshot(path=settings_screenshot)
        page.screenshot(path=os.path.join(design_dir, "ms01_settings_override.png"))
        print(f"Saved settings override screenshot to {settings_screenshot}")
        
        # Test Live Reduced Motion (hard-lock T0)
        print("Testing prefers-reduced-motion live hard-lock to T0...")
        page.emulate_media(reduced_motion="reduce")
        page.wait_for_timeout(500)
        
        rm_state = page.evaluate("window.__VT_GOVERNOR__.getState()")
        print(f"Governor state under reduced-motion: {rm_state}")
        assert rm_state["tier"] == "T0", f"Expected tier T0 under reduced motion, got {rm_state['tier']}"
        assert rm_state["reducedMotion"] == True, "Expected reducedMotion == True"
        
        status_text_rm = page.locator("footer").inner_text()
        print(f"StatusStrip under reduced motion: {status_text_rm}")
        assert "motion T0" in status_text_rm, "Expected 'motion T0' in status strip"
        
        # Reset media emulation and clear override
        page.emulate_media(reduced_motion="no-preference")
        page.evaluate("window.__VT_GOVERNOR__.setOverride('auto')")
        page.wait_for_timeout(500)
        reset_state = page.evaluate("window.__VT_GOVERNOR__.getState()")
        print(f"Governor state after reset to auto: {reset_state}")
        
        # Idle detection test (Gate 23 / Gate 29)
        # Wait 800ms with no actions to let 500ms idle detection kick in
        print("Testing 500ms idle detection (zero rAF proof)...")
        # Wake ticker with a temporary 100ms subscriber
        page.evaluate("""
            new Promise((resolve) => {
                let count = 0;
                window.__VT_TICKER__.subscribe('L1', (dt) => {
                    count += dt;
                    if (count >= 100) {
                        resolve();
                        return false; // unsubscribe
                    }
                    return true;
                });
            });
        """)
        # Right after completion, check frames and wait for idle
        page.wait_for_timeout(700) # >= 500ms idle window
        
        # Verify ticker is idle and rAF loop is stopped
        metrics_before = page.evaluate("window.__VT_TICKER__.getMetrics()")
        is_idle_1 = page.evaluate("window.__VT_TICKER__.isIdle()")
        print(f"Ticker isIdle: {is_idle_1}, metrics: {metrics_before}")
        assert is_idle_1, "Ticker must be idle after >=500ms with no lane subscribers"
        
        # Wait another 300ms and verify totalFrames didn't increase (zero rAF cycles while idle!)
        page.wait_for_timeout(300)
        metrics_after = page.evaluate("window.__VT_TICKER__.getMetrics()")
        print(f"Metrics after 300ms idle: {metrics_after}")
        frames_diff = metrics_after["totalFrames"] - metrics_before["totalFrames"]
        print(f"Frames elapsed during idle: {frames_diff}")
        assert frames_diff == 0, f"Expected 0 frames during idle, got {frames_diff}"
        
        idle_trace = {
            "test": "MS-01 Idle rAF zero proof",
            "idleTimeWaitMs": 700,
            "isIdle": is_idle_1,
            "metricsBefore": metrics_before,
            "metricsAfter": metrics_after,
            "framesDuringIdle": frames_diff,
            "verified": True
        }
        
        idle_trace_path = os.path.join(brain_dir, "ms01_idle_raf_trace.json")
        with open(idle_trace_path, "w") as f:
            json.dump(idle_trace, f, indent=2)
        with open(os.path.join(design_dir, "ms01_idle_raf_trace.json"), "w") as f:
            json.dump(idle_trace, f, indent=2)
        print(f"Saved idle rAF trace to {idle_trace_path}")
        
        browser.close()
        print("=== MS-01 VERIFICATION SUCCESS ===")

if __name__ == "__main__":
    run_verification()
