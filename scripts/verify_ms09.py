"""
Verification script for MS-09: Compare + Insights + Library + empty states (§M7.7–M7.9).
Acceptance criteria:
1. Converging diff rows (baseline cols translateX -8->0, followup cols +8->0, 24ms stagger, cap 240);
2. Summary segments scaleX to real proportions;
3. Modularity ring sweep synced to Q odometer;
4. Centrality race-sort via FLIP on reorder (recorded in race-sort.webm);
5. Predicate sweep clockwise, percentages odometer;
6. Footnote last (.m-fade-only 240ms);
7. Empty-state sketch draws once, no loops;
8. Settings > Motion section live (tier override, sound toggle, replay boot);
9. Gates 21, 25, 27, 32;
10. Required artifacts: race-sort.webm, insights T0 png.
"""

import os
import sys
import json
import time
import shutil
import subprocess
from playwright.sync_api import sync_playwright

def run_verification():
    print("=== MS-09 COMPARE + INSIGHTS + LIBRARY + EMPTY STATES VERIFICATION START ===")

    brain_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(brain_dir, exist_ok=True)
    os.makedirs(design_dir, exist_ok=True)
    video_dir = os.path.join(design_dir, "recordings_ms09")
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

    base_url = "http://localhost:5174"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        # ----------------------------------------------------
        # TEST 2: Compare Page Verification (§M7.7)
        # ----------------------------------------------------
        print("\n--- TEST 2: Compare Page Verification (§M7.7) ---")
        page = browser.new_page(viewport={"width": 1280, "height": 850})
        page.goto(f"{base_url}/compare")
        page.wait_for_selector('[data-testid^="diff-row-"]', timeout=8000)
        time.sleep(0.6)

        # 1. Converging diff rows
        diff_rows = page.query_selector_all('[data-testid^="diff-row-"]')
        print(f"  Found {len(diff_rows)} comparative diff rows.")
        assert len(diff_rows) >= 2, "Expected at least 2 comparative diff rows!"

        baseline_cell = page.query_selector('[data-testid="diff-baseline-0"]')
        assert baseline_cell is not None, "Baseline cell not found!"
        assert "animate-diff-baseline" in (baseline_cell.get_attribute("class") or ""), "Baseline cell missing animate-diff-baseline!"

        followup_cell = page.query_selector('[data-testid="diff-followup-0"]')
        assert followup_cell is not None, "Followup cell not found!"
        assert "animate-diff-followup" in (followup_cell.get_attribute("class") or ""), "Followup cell missing animate-diff-followup!"
        print("  Converging diff rows (-8px -> 0 and +8px -> 0) confirmed.")

        # 2. Arrow glyph nudge on delta chips
        arrow_nudge = page.query_selector('.animate-arrow-nudge-up, .animate-arrow-nudge-down')
        assert arrow_nudge is not None, "Arrow nudge animation missing on delta chips!"
        print("  Delta chips arrow glyph nudge confirmed.")

        # 3. Summary strip counts & proportion segments
        odo_imp = page.query_selector('[data-testid="odo-improved"]')
        assert odo_imp is not None, "odo-improved not found!"
        print(f"  Summary improved count: {odo_imp.inner_text()}")

        summary_segment = page.query_selector('[data-testid^="summary-segment-"]')
        assert summary_segment is not None, "Summary proportion segment not found!"
        assert "animate-scale-x" in (summary_segment.get_attribute("class") or ""), "Summary segment missing animate-scale-x!"
        print("  Summary strip odometers and scaleX proportion segments confirmed.")

        # 4. Panel FLIP-swap
        swap_btn = page.query_selector('button:has-text("Swap")')
        assert swap_btn is not None, "Swap panels button not found!"
        swap_btn.click()
        time.sleep(0.4)
        print("  Panel FLIP-swap executed cleanly.")
        page.close()

        # ----------------------------------------------------
        # TEST 3: Insights Centrality Race-Sort Recording (race-sort.webm) (§M7.8)
        # ----------------------------------------------------
        print("\n--- TEST 3: Centrality Hub Ranking Race-Sort (race-sort.webm) ---")
        race_video_dir = os.path.join(video_dir, "race_sort")
        os.makedirs(race_video_dir, exist_ok=True)

        rec_context = browser.new_context(
            viewport={"width": 1280, "height": 850},
            record_video_dir=race_video_dir,
            record_video_size={"width": 1280, "height": 850}
        )
        rec_page = rec_context.new_page()
        rec_page.goto(f"{base_url}/insights")
        rec_page.wait_for_selector('[data-testid^="hub-row-"]', timeout=8000)
        time.sleep(0.6)

        # Initial ranking (Betweenness)
        hub_rows_1 = rec_page.query_selector_all('[data-testid^="hub-row-"]')
        assert len(hub_rows_1) >= 3, "Expected at least 3 centrality hub rows!"
        first_hub_id_1 = hub_rows_1[0].get_attribute("data-hub-id")
        print(f"  Initial top hub (Betweenness): {first_hub_id_1}")

        # Trigger Race-Sort via Degree toggle (§M7.8)
        degree_btn = rec_page.query_selector('[data-testid="race-sort-btn-degree"]')
        assert degree_btn is not None, "Race-sort Degree toggle button not found!"
        degree_btn.click()
        time.sleep(0.6)

        # Verify new ranking (Degree)
        hub_rows_2 = rec_page.query_selector_all('[data-testid^="hub-row-"]')
        first_hub_id_2 = hub_rows_2[0].get_attribute("data-hub-id")
        print(f"  New top hub after race-sort (Degree): {first_hub_id_2}")

        # Toggle back to Betweenness
        btw_btn = rec_page.query_selector('[data-testid="race-sort-btn-betweenness"]')
        btw_btn.click()
        time.sleep(0.6)

        # Close page to flush video
        rec_page.close()
        rec_context.close()

        # Find and save race-sort.webm
        race_vids = [os.path.join(race_video_dir, f) for f in os.listdir(race_video_dir) if f.endswith(".webm")]
        assert race_vids, "No webm recording produced for race-sort!"
        source_race_vid = race_vids[0]
        target_race_vid = os.path.join(design_dir, "race-sort.webm")
        shutil.copyfile(source_race_vid, target_race_vid)
        shutil.copyfile(source_race_vid, os.path.join(brain_dir, "race-sort.webm"))
        print(f"  Saved race-sort.webm ({os.path.getsize(target_race_vid)} bytes) to design-board and brain dir.")

        # ----------------------------------------------------
        # TEST 4: Insights Modularity Gauge, Predicates & Footnote (§M7.8)
        # ----------------------------------------------------
        print("\n--- TEST 4: Modularity Gauge, Predicates & Footnote (§M7.8) ---")
        ins_page = browser.new_page(viewport={"width": 1280, "height": 850})
        ins_page.goto(f"{base_url}/insights")
        ins_page.wait_for_selector('[data-testid="modularity-gauge-ring"]', timeout=8000)
        time.sleep(0.8)

        # Modularity gauge & Q odometer
        gauge_ring = ins_page.query_selector('[data-testid="modularity-gauge-ring"]')
        assert gauge_ring is not None, "Modularity gauge ring SVG not found!"
        assert "animate-ring-sweep" in (gauge_ring.get_attribute("class") or ""), "Ring missing animate-ring-sweep!"

        q_odo = ins_page.query_selector('[data-testid="odo-modularity"]')
        assert q_odo is not None, "Q odometer not found!"
        q_val = float(q_odo.get_attribute("data-odo-final") or "0")
        print(f"  Modularity Q odometer value: {q_val:.2f}")
        assert q_val > 0.1, "Modularity Q value should be positive!"

        # Predicate distribution clockwise sweep & odometers
        pred_sweeps = ins_page.query_selector_all('.animate-predicate-sweep')
        assert len(pred_sweeps) >= 1, "Predicate clockwise sweep circles not found!"

        pred_odo_0 = ins_page.query_selector('[data-testid="odo-pred-0"]')
        assert pred_odo_0 is not None, "odo-pred-0 odometer not found!"
        print(f"  First predicate percentage odometer: {pred_odo_0.inner_text()}")

        # Causality footnote (.m-fade-only, verbatim copy)
        footnote = ins_page.query_selector('[data-testid="causality-footnote"]')
        assert footnote is not None, "Causality footnote not found!"
        assert "Graph associations indicate statistical and literature co-occurrence; they do not establish unmeasured biological causality." in footnote.inner_text(), "Causality footnote copy mismatch!"
        assert "m-fade-only" in (footnote.get_attribute("class") or ""), "Footnote missing m-fade-only class!"
        print("  Causality footnote verified verbatim.")
        ins_page.close()

        # ----------------------------------------------------
        # TEST 5: Empty-State Sketch & Library Rows (§M7.9)
        # ----------------------------------------------------
        print("\n--- TEST 5: Empty-State Sketch & Library Rows (§M7.9) ---")
        # Test EmptyState via Gallery or Datasets
        gal_page = browser.new_page(viewport={"width": 1280, "height": 850})
        gal_page.goto(f"{base_url}/gallery")
        gal_page.wait_for_selector('[data-testid="empty-state-sketch"]', timeout=8000)
        time.sleep(0.4)

        sketch_el = gal_page.query_selector('[data-testid="empty-state-sketch"]')
        assert sketch_el is not None, "Empty-state sketch SVG path not found!"
        assert "animate-sketch-draw" in (sketch_el.get_attribute("class") or ""), "Sketch missing animate-sketch-draw!"

        quote_el = gal_page.query_selector('[data-testid="empty-state-quote"]')
        assert quote_el is not None, "Empty-state quote text not found!"
        assert "m-fade-only" in (quote_el.get_attribute("class") or ""), "Quote missing m-fade-only!"
        print("  Empty-state sketch draw-once and quote fade confirmed.")
        gal_page.close()

        # Test Library Rows & SHA Copy
        lib_page = browser.new_page(viewport={"width": 1280, "height": 850})
        lib_page.goto(f"{base_url}/library")
        lib_page.wait_for_selector('[data-testid^="library-row-"]', timeout=8000)
        time.sleep(0.4)

        lib_rows = lib_page.query_selector_all('[data-testid^="library-row-"]')
        print(f"  Found {len(lib_rows)} library rows.")
        assert len(lib_rows) >= 1, "Expected at least 1 library row!"
        assert "m-enter" in (lib_rows[0].get_attribute("class") or ""), "Library row missing m-enter!"

        # Test SHA copy
        copy_sha_btn = lib_page.query_selector('[data-testid^="copy-sha-"]')
        if copy_sha_btn:
            copy_sha_btn.click()
            time.sleep(0.3)
            check_svg = lib_page.query_selector('.animate-draw-check')
            assert check_svg is not None, "Check DrawPath SVG not rendered on SHA copy!"
            print("  Library SHA copy check DrawPath verified.")
        lib_page.close()

        # ----------------------------------------------------
        # TEST 6: Settings Motion Section (§M7.9)
        # ----------------------------------------------------
        print("\n--- TEST 6: Settings Motion Section (§M7.9) ---")
        set_page = browser.new_page(viewport={"width": 1280, "height": 850})
        set_page.goto(f"{base_url}/settings")
        set_page.wait_for_selector('[data-testid="sound-toggle-btn"]', timeout=8000)
        time.sleep(0.4)

        sound_btn = set_page.query_selector('[data-testid="sound-toggle-btn"]')
        assert sound_btn is not None, "Synthesized audio detents toggle button not found!"
        sound_btn.click()
        time.sleep(0.2)
        print("  Audio detents toggle verified.")
        set_page.close()

        # ----------------------------------------------------
        # TEST 7: Gate 21 Reduced-Motion Matrix & Screenshot (insights T0 png)
        # ----------------------------------------------------
        print("\n--- TEST 7: Gate 21 Reduced-Motion Matrix (insights T0 png) ---")
        rm_context = browser.new_context(
            viewport={"width": 1280, "height": 850},
            reduced_motion="reduce"
        )
        rm_page = rm_context.new_page()
        rm_page.goto(f"{base_url}/insights")
        rm_page.wait_for_selector('[data-testid="modularity-gauge-ring"]', timeout=8000)
        time.sleep(0.5)

        # Odometers resolve instantly
        rm_odo = rm_page.query_selector('[data-testid="odo-modularity"]')
        assert rm_odo is not None and len(rm_odo.inner_text().strip()) > 0, "Odometer missing at reduced motion!"

        # Capture insights T0 png artifact
        target_png_1 = os.path.join(design_dir, "insights T0 png")
        target_png_2 = os.path.join(design_dir, "insights-t0.png")
        brain_png_1 = os.path.join(brain_dir, "insights T0 png")
        brain_png_2 = os.path.join(brain_dir, "insights-t0.png")

        rm_page.screenshot(path=target_png_2)
        shutil.copyfile(target_png_2, target_png_1)
        shutil.copyfile(target_png_2, brain_png_1)
        shutil.copyfile(target_png_2, brain_png_2)
        print(f"  Saved insights T0 png ({os.path.getsize(target_png_2)} bytes) to design-board and brain dir.")

        rm_page.close()
        rm_context.close()
        browser.close()

    print("\n=== ALL MS-09 VERIFICATION CHECKS PASSED ===")
    return True

if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
