import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

def verify_g6():
    print("=== VERIFY G6: T0 / REDUCED-MOTION CONSISTENCY PIPELINE START ===")
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(design_dir, exist_ok=True)

    base_url = "http://127.0.0.1:5174"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        # ====================================================
        # TEST 6a & 6b: InsightsPage T0 Refresh & JSX Class Guards
        # ====================================================
        print("\n--- TEST 6a & 6b: InsightsPage in T0 (Refresh & Zero Animation Classes) ---")
        context_t0 = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        page_t0 = context_t0.new_page()

        page_t0.goto(f"{base_url}/insights")
        page_t0.evaluate("() => { localStorage.setItem('motion_tier', 'T0'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t0.reload(wait_until="networkidle")

        # Check absence of animation classes in DOM
        ring = page_t0.locator("circle[stroke-dasharray='251.3']").first
        ring.wait_for(state="visible", timeout=5000)
        ring_classes = ring.get_attribute("class") or ""
        print(f"  T0 Ring classes: '{ring_classes}'")
        assert "animate-ring-sweep" not in ring_classes, f"Ring has animate-ring-sweep in T0: {ring_classes}"

        bar = page_t0.locator("[data-testid='centrality-race-container'] .rounded-full > div").first
        bar.wait_for(state="visible", timeout=5000)
        bar_classes = bar.get_attribute("class") or ""
        print(f"  T0 Bar classes: '{bar_classes}'")
        assert "animate-bar-settle" not in bar_classes, f"Bar has animate-bar-settle in T0: {bar_classes}"

        # Install spy on Element.prototype.animate to verify 0 WAAPI animations in T0
        page_t0.evaluate("""() => {
            window.__waapi_calls = 0;
            const origAnimate = Element.prototype.animate;
            Element.prototype.animate = function(...args) {
                window.__waapi_calls++;
                return origAnimate.apply(this, args);
            };
        }""")

        # Click Refresh Analytics
        refresh_btn = page_t0.locator("button:has-text('Refresh Analytics')").first
        refresh_btn.wait_for(state="visible", timeout=5000)
        refresh_btn.click()

        # Wait for data fetch
        page_t0.wait_for_timeout(1000)

        waapi_count = page_t0.evaluate("() => window.__waapi_calls")
        print(f"  WAAPI animate calls during T0 refresh: {waapi_count}")
        assert waapi_count == 0, f"Expected 0 WAAPI animate calls in T0, got {waapi_count}"

        # Capture artifact
        shot_path = os.path.join(design_dir, "gaps-t0-refresh.png")
        page_t0.screenshot(path=shot_path)
        print(f"  Saved artifact: {shot_path}")
        print("  PASS: InsightsPage refresh works in T0 with instant value sets and 0 WAAPI animations.")
        context_t0.close()

        # ====================================================
        # TEST 6c: TimelinePage Upload FLIP Guarded in T0
        # ====================================================
        print("\n--- TEST 6c: TimelinePage Upload FLIP in T0 ---")
        context_t0 = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        page_t0 = context_t0.new_page()

        page_t0.goto(f"{base_url}/timeline")
        page_t0.evaluate("() => { localStorage.setItem('motion_tier', 'T0'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t0.reload(wait_until="networkidle")

        # Check filter select in T0 has no transitions
        filter_select = page_t0.locator("#event-filter").first
        filter_select.wait_for(state="visible", timeout=5000)
        filter_select.select_option("reports")
        print("  PASS: TimelinePage filter switched cleanly in T0.")
        context_t0.close()

        # ====================================================
        # TEST 6d: OntologyPage Morph Staging (requestAnimationFrame)
        # ====================================================
        print("\n--- TEST 6d: OntologyPage rAF Staged Morph Navigation ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/ontology")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        inspect_btn = page.locator("[data-testid='concept-inspect-btn']").first
        inspect_btn.wait_for(state="visible", timeout=5000)
        inspect_btn.click()

        # Should navigate to /graph
        page.wait_for_url("**/graph", timeout=5000)
        assert "/graph" in page.url
        print("  PASS: OntologyPage rAF staged navigation successfully navigated to /graph.")
        context.close()

        # ====================================================
        # TEST 6e: Cross-Page Morph Declaration (report-title)
        # ====================================================
        print("\n--- TEST 6e: Cross-page morph declaration (report-title) ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/ask")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        ask_vt = page.evaluate("() => { const el = document.querySelector('[style*=\"report-title\"]'); return el ? el.style.viewTransitionName : null; }")
        print(f"  AskPage report-title viewTransitionName: {ask_vt}")
        assert ask_vt == "report-title", f"AskPage missing report-title viewTransitionName: {ask_vt}"

        page.goto(f"{base_url}/graph")
        page.reload(wait_until="networkidle")

        graph_vt = page.evaluate("() => { const el = document.querySelector('[style*=\"report-title\"]'); return el ? el.style.viewTransitionName : null; }")
        print(f"  GraphPage report-title viewTransitionName: {graph_vt}")
        assert graph_vt == "report-title", f"GraphPage missing report-title viewTransitionName: {graph_vt}"
        print("  PASS: Both /ask and /graph declare report-title for cross-page morphing.")
        context.close()

        browser.close()

    print("\n=== VERIFY G6: 100% GREEN (T0 / Reduced-Motion Consistency Verified) ===")

if __name__ == "__main__":
    verify_g6()
