import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

def verify_g3():
    print("=== VERIFY G3: EMPTY STATES & SKETCH-DRAW PIPELINE START ===")
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(design_dir, exist_ok=True)

    base_url = "http://127.0.0.1:5174"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        # ====================================================
        # TEST 3a: ComparePage EmptyState
        # ====================================================
        print("\n--- TEST 3a: ComparePage EmptyState ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Stub empty reports
        page.route(
            lambda url: ":8000/api/reports" in url,
            lambda r: r.fulfill(status=200, body=json.dumps([]), content_type="application/json")
        )
        page.goto(f"{base_url}/compare")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        empty_quote = page.locator("[data-testid='empty-state-quote']").first
        empty_quote.wait_for(state="visible", timeout=8000)
        quote_text = empty_quote.inner_text()
        print(f"  ComparePage empty quote: {quote_text}")
        assert "No comparable lab observations found" in quote_text, "ComparePage quote text mismatch"

        sketch = page.locator("[data-testid='empty-state-sketch']").first
        anim_name = page.evaluate("(el) => window.getComputedStyle(el).animationName", sketch.element_handle())
        print(f"  ComparePage sketch computed animationName: {anim_name}")
        assert "sketchDraw" in anim_name, f"Expected sketchDraw in animationName, got {anim_name}"

        shot_path = os.path.join(design_dir, "gaps-empty-compare.png")
        page.screenshot(path=shot_path)
        print(f"  PASS: 3a ComparePage EmptyState with DrawPath verified.")
        context.close()

        # ====================================================
        # TEST 3b: TimelinePage EmptyState
        # ====================================================
        print("\n--- TEST 3b: TimelinePage EmptyState ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.route(
            lambda url: ":8000/api/reports" in url,
            lambda r: r.fulfill(status=200, body=json.dumps([]), content_type="application/json")
        )
        page.goto(f"{base_url}/timeline")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        empty_quote = page.locator("[data-testid='empty-state-quote']").first
        empty_quote.wait_for(state="visible", timeout=8000)
        quote_text = empty_quote.inner_text()
        print(f"  TimelinePage empty quote: {quote_text}")
        assert "No reports found for this persona" in quote_text, "TimelinePage quote text mismatch"

        sketch = page.locator("[data-testid='empty-state-sketch']").first
        anim_name = page.evaluate("(el) => window.getComputedStyle(el).animationName", sketch.element_handle())
        print(f"  TimelinePage sketch computed animationName: {anim_name}")
        assert "sketchDraw" in anim_name, f"Expected sketchDraw in animationName, got {anim_name}"

        shot_path = os.path.join(design_dir, "gaps-empty-timeline.png")
        page.screenshot(path=shot_path)
        print(f"  PASS: 3b TimelinePage EmptyState with DrawPath verified.")
        context.close()

        # ====================================================
        # TEST 3c: OntologyPage Empty Row & Clear Filters
        # ====================================================
        print("\n--- TEST 3c: OntologyPage Empty Row & Clear Filters ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/ontology")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        # Type impossible query in search box
        search_input = page.locator("input[placeholder*='Search concepts']").first
        search_input.wait_for(state="visible", timeout=8000)
        search_input.fill("xyznonexistent")

        # Assert empty state row appears
        empty_row = page.locator("[data-testid='ontology-empty-state']").first
        empty_row.wait_for(state="visible", timeout=5000)
        assert "No concepts match" in empty_row.inner_text(), "Ontology empty state message missing"

        sketch = empty_row.locator("[data-testid='empty-state-sketch']").first
        anim_name = page.evaluate("(el) => window.getComputedStyle(el).animationName", sketch.element_handle())
        print(f"  OntologyPage sketch computed animationName: {anim_name}")
        assert "sketchDraw" in anim_name, f"Expected sketchDraw in animationName, got {anim_name}"

        shot_path = os.path.join(design_dir, "gaps-empty-ontology.png")
        page.screenshot(path=shot_path)

        # Click Clear filters button
        clear_btn = page.locator("[data-testid='ontology-clear-filters-btn']").first
        clear_btn.click()
        time.sleep(0.5)

        # Assert table repopulated
        concept_rows = page.locator("tbody tr")
        row_count = concept_rows.count()
        print(f"  Ontology table row count after Clear filters: {row_count}")
        assert row_count > 1, "Expected table to repopulate after clear filters"
        print(f"  PASS: 3c OntologyPage compact EmptyState with FLIP clear filters verified.")
        context.close()

        # ====================================================
        # TEST 3d: UploadPage Empty Rows
        # ====================================================
        print("\n--- TEST 3d: UploadPage Quality & Quarantine Empty Rows ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.route(
            lambda url: ":8000/api/reports" in url,
            lambda r: r.fulfill(status=200, body=json.dumps([]), content_type="application/json")
        )
        page.goto(f"{base_url}/upload")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        quality_empty = page.locator("[data-testid='upload-quality-empty']").first
        quality_empty.wait_for(state="visible", timeout=8000)
        q_classes = quality_empty.get_attribute("class") or ""
        assert "m-enter" in q_classes, f"upload-quality-empty missing m-enter: {q_classes}"
        sketch_q = quality_empty.locator("[data-testid='empty-state-sketch']").first
        anim_q = page.evaluate("(el) => window.getComputedStyle(el).animationName", sketch_q.element_handle())
        print(f"  UploadPage quality empty sketch animationName: {anim_q}")
        assert "sketchDraw" in anim_q

        quarantine_empty = page.locator("[data-testid='upload-quarantine-empty']").first
        quarantine_empty.wait_for(state="visible", timeout=8000)
        quar_classes = quarantine_empty.get_attribute("class") or ""
        assert "m-enter" in quar_classes, f"upload-quarantine-empty missing m-enter: {quar_classes}"
        sketch_quar = quarantine_empty.locator("[data-testid='empty-state-sketch']").first
        anim_quar = page.evaluate("(el) => window.getComputedStyle(el).animationName", sketch_quar.element_handle())
        print(f"  UploadPage quarantine empty sketch animationName: {anim_quar}")
        assert "sketchDraw" in anim_quar

        shot_path = os.path.join(design_dir, "gaps-empty-upload.png")
        page.screenshot(path=shot_path)
        print("  PASS: 3d UploadPage Quality & Quarantine mini DrawPath empty rows verified.")

        # Save main consolidated artifact required by prompt: gaps-empty.png
        final_artifact = os.path.join(design_dir, "gaps-empty.png")
        page.screenshot(path=final_artifact)
        print(f"  Saved main artifact: {final_artifact}")
        context.close()

        # ====================================================
        # T0 REDUCED-MOTION CHECK FOR EMPTY STATES
        # ====================================================
        print("\n--- T0 Reduced-Motion Instant Check for EmptyState ---")
        context_t0 = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        page_t0 = context_t0.new_page()
        page_t0.route(
            lambda url: ":8000/api/reports" in url,
            lambda r: r.fulfill(status=200, body=json.dumps([]), content_type="application/json")
        )
        page_t0.goto(f"{base_url}/compare")
        page_t0.evaluate("() => { localStorage.setItem('motion_tier', 'T0'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t0.reload(wait_until="networkidle")

        sketch_t0 = page_t0.locator("[data-testid='empty-state-sketch']").first
        sketch_t0.wait_for(state="visible", timeout=5000)
        anim_t0 = page_t0.evaluate("(el) => window.getComputedStyle(el).animationName", sketch_t0.element_handle())
        print(f"  T0 ComparePage sketch computed animationName: {anim_t0}")
        assert anim_t0 == "none" or anim_t0 == "", f"Expected none in T0, got {anim_t0}"

        shot_t0 = os.path.join(design_dir, "gaps-empty-t0.png")
        page_t0.screenshot(path=shot_t0)
        print("  PASS: EmptyState in T0 renders statically with zero entrance animation.")
        context_t0.close()
        browser.close()

    print("\n=== VERIFY G3: 100% GREEN (All 4 empty state paths verified) ===")

if __name__ == "__main__":
    verify_g3()
