import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

def verify_g1():
    print("=== VERIFY G1: DEAD CONTROLS & SPECIMENS START ===")
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(design_dir, exist_ok=True)
    video_dir = os.path.join(design_dir, "recordings_g1")
    os.makedirs(video_dir, exist_ok=True)

    base_url = "http://127.0.0.1:5174"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        # ====================================================
        # TEST SUITE A: T3 FULL MOTION
        # ====================================================
        print("\n--- TEST SUITE A: T3 Full Motion Controls ---")
        context_t3 = browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=video_dir,
            record_video_size={"width": 1280, "height": 800}
        )
        page = context_t3.new_page()

        # Helper to set tier
        def set_tier(tier):
            page.evaluate(f"""() => {{
                localStorage.setItem('motion_tier', '{tier}');
                sessionStorage.setItem('vg_booted', '1');
            }}""")

        # ----------------------------------------------------
        # 1a & 1b: TimelinePage Controls
        # ----------------------------------------------------
        print("Testing TimelinePage: 'Show answer' & 'View in graph'...")
        page.goto(f"{base_url}/timeline")
        set_tier("T3")
        page.reload(wait_until="networkidle")

        # Wait for timeline cards
        show_answer_btn = page.locator("[data-testid^='show-answer-btn-']").first
        show_answer_btn.wait_for(state="visible", timeout=10000)

        # Click "Show answer"
        print("  Clicking 'Show answer'...")
        show_answer_btn.click()
        answer_card = page.locator("[data-testid^='timeline-answer-']").first
        answer_card.wait_for(state="visible", timeout=3000)
        answer_classes = answer_card.get_attribute("class") or ""
        print(f"  Answer card mounted with classes: {answer_classes}")
        assert "m-enter-card" in answer_classes, "Timeline answer card missing m-enter-card animation"
        print("  PASS: Timeline 'Show answer' reveals grounded finding with m-enter-card.")

        # Click "View in graph"
        print("  Clicking 'View in graph'...")
        view_in_graph_btn = page.locator("[data-testid='timeline-view-in-graph-btn']")
        view_in_graph_btn.scroll_into_view_if_needed()
        view_in_graph_btn.click()
        page.wait_for_url("**/graph", timeout=5000)
        assert "/graph" in page.url, f"Expected URL /graph, got {page.url}"
        print(f"  PASS: Timeline 'View in graph' navigated to {page.url}.")

        # ----------------------------------------------------
        # 1c: UploadPage "Need help?" Items
        # ----------------------------------------------------
        print("\nTesting UploadPage: 'Need help?' expandable items...")
        page.goto(f"{base_url}/upload")
        set_tier("T3")
        page.reload(wait_until="networkidle")

        help_item_0 = page.locator("[data-testid='upload-help-item-0']")
        help_item_0.scroll_into_view_if_needed()
        help_item_0.wait_for(state="visible", timeout=5000)

        print("  Clicking help item 0...")
        help_item_0.click()
        help_detail_0 = page.locator("[data-testid='upload-help-detail-0']")
        help_detail_0.wait_for(state="visible", timeout=3000)
        detail_classes = help_detail_0.get_attribute("class") or ""
        print(f"  Help detail mounted with classes: {detail_classes}")
        assert "m-enter-card" in detail_classes, "Help detail missing m-enter-card animation"
        print("  PASS: UploadPage help item 0 expanded with m-enter-card.")

        # ----------------------------------------------------
        # 1d: AskPage Mode Select & Request Payload
        # ----------------------------------------------------
        print("\nTesting AskPage: Mode Select & request payload...")
        page.goto(f"{base_url}/ask")
        set_tier("T3")
        page.reload(wait_until="networkidle")

        # Initial mode chip check
        mode_chip = page.locator("[data-testid='ask-mode-chip']")
        mode_chip.wait_for(state="visible", timeout=5000)
        initial_mode = mode_chip.inner_text().strip()
        print(f"  Initial mode chip: {initial_mode}")
        assert initial_mode == "Paper"

        # Intercept outgoing /api/questions POST
        captured_payloads = []
        def handle_route(route):
            req = route.request
            if "/api/questions" in req.url and req.method == "POST":
                try:
                    payload = json.loads(req.post_data)
                    captured_payloads.append(payload)
                except Exception as e:
                    print(f"Error parsing payload: {e}")
            route.continue_()

        page.route("**/api/questions", handle_route)

        # Change select to "Graph"
        print("  Changing mode to Graph...")
        select_el = page.locator("select").first
        select_el.select_option("Graph")

        page.wait_for_timeout(100)
        updated_mode = mode_chip.inner_text().strip()
        chip_classes = mode_chip.get_attribute("class") or ""
        print(f"  Updated mode chip text: {updated_mode}, classes: {chip_classes}")
        assert updated_mode == "Graph", f"Expected mode chip 'Graph', got '{updated_mode}'"
        assert "animate-chip-pop" in chip_classes, "Mode chip missing animate-chip-pop class"
        print("  PASS: AskPage mode chip pops with animate-chip-pop on change.")

        # Type question and submit
        print("  Submitting question with mode=Graph...")
        input_el = page.locator("[data-testid='ask-question-input']")
        input_el.fill("Test inquiry for mode verification")
        send_btn = page.locator("[data-testid='ask-send-button']")
        send_btn.click()

        # Wait for request capture
        page.wait_for_timeout(1000)
        assert len(captured_payloads) > 0, "No /api/questions request captured!"
        outbound = captured_payloads[0]
        print(f"  Captured payload: {outbound}")
        assert outbound.get("retrieval_mode") == "Graph", f"Payload missing retrieval_mode: 'Graph': {outbound}"
        print("  PASS: AskPage outbound request includes retrieval_mode: 'Graph'.")

        # ----------------------------------------------------
        # Specimens MG.1 & MG.2 in Gallery
        # ----------------------------------------------------
        print("\nTesting Motion Gallery specimens MG.1 & MG.2...")
        page.goto(f"{base_url}/gallery")
        set_tier("T3")
        page.reload(wait_until="networkidle")

        mg1_trigger = page.locator("[data-testid='specimen-mg1-trigger']")
        mg1_trigger.scroll_into_view_if_needed()
        mg1_trigger.wait_for(state="visible", timeout=5000)
        mg1_trigger.click()
        mg1_body = page.locator("[data-testid='specimen-mg1-body']")
        mg1_body.wait_for(state="visible", timeout=3000)
        mg1_classes = mg1_body.get_attribute("class") or ""
        assert "m-enter-card" in mg1_classes, "MG.1 specimen body missing m-enter-card"
        print("  PASS: Specimen MG.1 (inline expand drawer) verified.")

        mg2_btn = page.locator("[data-testid='specimen-mg2-btn-graph']")
        mg2_btn.scroll_into_view_if_needed()
        mg2_btn.click()
        page.wait_for_timeout(100)
        mg2_chip = page.locator("[data-testid='specimen-mg2-chip']")
        mg2_classes = mg2_chip.get_attribute("class") or ""
        assert "animate-chip-pop" in mg2_classes, "MG.2 specimen chip missing animate-chip-pop"
        print("  PASS: Specimen MG.2 (chip-pop on select) verified.")

        time.sleep(1.0)
        context_t3.close()

        # Save video
        video_path = page.video.path()
        final_video = os.path.join(design_dir, "gaps-deadcontrols.webm")
        if os.path.exists(video_path):
            if os.path.exists(final_video):
                os.remove(final_video)
            os.rename(video_path, final_video)
            print(f"  Saved video: {final_video}")

        # ====================================================
        # TEST SUITE B: T0 REDUCED-MOTION GUARDS
        # ====================================================
        print("\n--- TEST SUITE B: T0 Reduced-Motion Guards ---")
        context_t0 = browser.new_context(
            viewport={"width": 1280, "height": 800},
            reduced_motion="reduce"
        )
        page_t0 = context_t0.new_page()

        # Timeline T0
        page_t0.goto(f"{base_url}/timeline")
        page_t0.evaluate("""() => {
            localStorage.setItem('motion_tier', 'T0');
            sessionStorage.setItem('vg_booted', '1');
        }""")
        page_t0.reload(wait_until="networkidle")

        show_answer_btn_t0 = page_t0.locator("[data-testid^='show-answer-btn-']").first
        show_answer_btn_t0.wait_for(state="visible", timeout=10000)
        show_answer_btn_t0.click()
        answer_card_t0 = page_t0.locator("[data-testid^='timeline-answer-']").first
        answer_card_t0.wait_for(state="visible", timeout=3000)
        t0_classes = answer_card_t0.get_attribute("class") or ""
        assert "m-enter-card" not in t0_classes, f"T0 answer card should NOT have m-enter-card: {t0_classes}"
        print("  PASS: Timeline answer toggles instantly in T0 with no entrance animation class.")

        # UploadPage T0
        page_t0.goto(f"{base_url}/upload")
        page_t0.evaluate("""() => {
            localStorage.setItem('motion_tier', 'T0');
            sessionStorage.setItem('vg_booted', '1');
        }""")
        page_t0.reload(wait_until="networkidle")

        help_0_t0 = page_t0.locator("[data-testid='upload-help-item-0']")
        help_0_t0.scroll_into_view_if_needed()
        help_0_t0.click()
        detail_0_t0 = page_t0.locator("[data-testid='upload-help-detail-0']")
        detail_0_t0.wait_for(state="visible", timeout=3000)
        detail_t0_classes = detail_0_t0.get_attribute("class") or ""
        assert "m-enter-card" not in detail_t0_classes, f"T0 help detail should NOT have m-enter-card: {detail_t0_classes}"
        print("  PASS: UploadPage help item expands instantly in T0 with no entrance animation class.")

        # AskPage T0
        page_t0.goto(f"{base_url}/ask")
        page_t0.evaluate("""() => {
            localStorage.setItem('motion_tier', 'T0');
            sessionStorage.setItem('vg_booted', '1');
        }""")
        page_t0.reload(wait_until="networkidle")

        mode_chip_t0 = page_t0.locator("[data-testid='ask-mode-chip']")
        mode_chip_t0.wait_for(state="visible", timeout=5000)
        select_t0 = page_t0.locator("select").first
        select_t0.select_option("Graph")
        page_t0.wait_for_timeout(100)
        chip_t0_classes = mode_chip_t0.get_attribute("class") or ""
        assert "animate-chip-pop" not in chip_t0_classes, f"T0 chip should NOT have animate-chip-pop: {chip_t0_classes}"
        print("  PASS: AskPage mode chip updates instantly in T0 without animate-chip-pop.")

        # Capture T0 screenshot
        t0_screenshot = os.path.join(design_dir, "gaps-deadcontrols-t0.png")
        page_t0.screenshot(path=t0_screenshot)
        print(f"  Saved T0 still: {t0_screenshot}")

        context_t0.close()
        browser.close()

    print("\n=== VERIFY G1: 100% GREEN (All dead controls wired with motion and T0 guards) ===")

if __name__ == "__main__":
    verify_g1()
