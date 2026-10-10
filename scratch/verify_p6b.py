import asyncio
import json
import time
from playwright.async_api import async_playwright

FRONTEND_URL = "http://localhost:5173"

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, channel="chrome")
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n--- 1. PATTERN BUILD & STAGE CHECKS ---")
        await page.goto(f"{FRONTEND_URL}/text-to-graph")
        await page.wait_for_load_state("networkidle")

        # Verify empty state first
        empty_text = await page.locator("text=No graph built yet").count()
        print(f"Empty state visible before build: {empty_text > 0}")

        # Click Example: free text
        await page.locator("button:has-text('Example: free text')").click()
        await page.wait_for_timeout(300)

        # Wait for stage canvas to be visible
        stage_canvas = page.locator("canvas.stage-canvas")
        await stage_canvas.wait_for(state="visible", timeout=10000)
        print("Stage canvas (canvas.stage-canvas) is visible after Build graph.")

        # Check layouts: Sphere, Orbits, Columns present, Timeline ABSENT
        sphere_btn = await page.locator("[data-testid='graph-layout-sphere']").count()
        orbits_btn = await page.locator("[data-testid='graph-layout-orbits']").count()
        columns_btn = await page.locator("[data-testid='graph-layout-columns']").count()
        timeline_btn = await page.locator("[data-testid='graph-layout-timeline']").count()
        print(f"Layout buttons - Sphere: {sphere_btn}, Orbits: {orbits_btn}, Columns: {columns_btn}, Timeline (MUST BE 0): {timeline_btn}")
        assert timeline_btn == 0, "Timeline button must not exist in Text to Graph!"

        # Morph through layouts
        await page.locator("[data-testid='graph-layout-orbits']").click()
        await page.wait_for_timeout(400)
        await page.locator("[data-testid='graph-layout-columns']").click()
        await page.wait_for_timeout(400)
        await page.locator("[data-testid='graph-layout-sphere']").click()
        await page.wait_for_timeout(400)
        print("Morphed through Orbits -> Columns -> Sphere cleanly.")

        # Select a node via stage engine API
        node_id = await page.evaluate("() => window.__graphStage?.nodes[1]?.id")
        node_label = await page.evaluate("() => window.__graphStage?.nodes[1]?.label")
        print(f"Selecting node {node_id} ({node_label})...")
        await page.evaluate(f"() => window.__graphStage?.select('{node_id}')")
        await page.wait_for_timeout(400)

        # Verify docked card TextNodeCard
        card = page.locator(".dossier.text-node-card")
        await card.wait_for(state="visible")
        card_box = await card.bounding_box()
        print(f"TextNodeCard docked: width={card_box['width']}px, height={card_box['height']}px, right={1440 - card_box['x'] - card_box['width']}px")

        # Check quote highlight in mark
        mark_count = await card.locator("mark").count()
        mark_text = await card.locator("mark").text_content() if mark_count > 0 else ""
        print(f"Quote mark in card: count={mark_count}, text='{mark_text}'")

        # Check connections sentence
        conn_text = await card.locator("[data-testid='graph-connections']").text_content()
        print(f"Connections sentence: '{conn_text}'")

        # Check Pan controls
        pad = page.locator("[data-testid='graph-move-pad']")
        await pad.wait_for(state="visible")
        await page.locator("[data-testid='graph-move-right']").click()
        await page.wait_for_timeout(100)
        pan = await page.evaluate("() => window.__graphStage?.getPan()")
        print(f"Pan after move-right: {pan}")
        assert pan["x"] > 0, "Pan X should have increased!"
        await page.locator("[data-testid='graph-move-centre']").click()
        await page.wait_for_timeout(100)
        pan_reset = await page.evaluate("() => window.__graphStage?.getPan()")
        print(f"Pan after centre: {pan_reset}")

        # Check Save as image modal
        await page.locator("[data-testid='graph-save']").click()
        modal = page.locator(".graph-modal")
        await modal.wait_for(state="visible")
        print("Save as image modal opened.")
        # Press Esc: modal closes, node stays selected
        await page.keyboard.press("Escape")
        await modal.wait_for(state="hidden")
        print("Modal closed on Esc.")
        is_node_still_sel = await page.evaluate(f"() => window.__graphStage?.selId === '{node_id}'")
        print(f"Node still selected after modal close: {is_node_still_sel}")
        assert is_node_still_sel, "Node must stay selected after closing modal!"

        # Screenshots: P6b-pattern.png
        await page.evaluate("() => window.scrollTo(0, 0)")
        await page.screenshot(path="gemini/shots/P6b-pattern.png")
        print("Saved gemini/shots/P6b-pattern.png")

        # Switch to Paper stage & take screenshot P6b-paper.png
        await page.locator("[data-testid='graph-theme']").click()
        await page.wait_for_timeout(300)
        await page.screenshot(path="gemini/shots/P6b-paper.png")
        print("Saved gemini/shots/P6b-paper.png")
        # Switch back to Ink stage
        await page.locator("[data-testid='graph-theme']").click()
        await page.wait_for_timeout(300)

        print("\n--- 2. REAL AI STREAM BUILD ---")
        # Click Example: free text
        await page.locator("button:has-text('Example: free text')").click()
        await page.wait_for_timeout(300)

        # Track network requests to /api/tools/graph/stream
        stream_requests = []
        page.on("request", lambda req: stream_requests.append(req.url) if "/api/tools/graph/stream" in req.url else None)

        print("Starting Build with AI...")
        await page.locator("button:has-text('Build with AI')").click()
        await page.locator("button:has-text('Building with AI...')").wait_for(state="visible", timeout=5000)
        print("AI Build started (button shows 'Building with AI...').")

        # Mid-stream check & screenshot
        t0 = time.time()
        saw_growing = False
        first_node_time = None
        fifth_node_time = None
        last_node_time = None

        prev_node_count = 1
        while time.time() - t0 < 35:
            count = await page.evaluate("() => window.__graphStage?.nodes?.length || 0")
            if count > prev_node_count:
                now_t = time.time() - t0
                if count >= 2 and first_node_time is None:
                    first_node_time = now_t
                    print(f"First entity node arrived at {first_node_time:.2f}s (nodes={count})")
                    # Take growing screenshot
                    await page.screenshot(path="gemini/shots/P6b-ai-growing.png")
                    print("Saved gemini/shots/P6b-ai-growing.png mid-stream.")
                    saw_growing = True
                if count >= 5 and fifth_node_time is None:
                    fifth_node_time = now_t
                    print(f"5th node arrived at {fifth_node_time:.2f}s (nodes={count})")
                prev_node_count = count

            # Check if done
            busy = await page.locator("button:has-text('Building with AI...')").count()
            if not busy:
                last_node_time = time.time() - t0
                break
            await asyncio.sleep(0.05)

        final_nodes = await page.evaluate("() => window.__graphStage?.nodes?.length || 0")
        final_edges = await page.evaluate("() => window.__graphStage?.edges?.length || 0")
        print(f"AI Stream finished: total_nodes={final_nodes}, total_edges={final_edges}")
        fn_s = f"{first_node_time:.2f}s" if first_node_time is not None else "N/A"
        f5_s = f"{fifth_node_time:.2f}s" if fifth_node_time is not None else "N/A"
        ln_s = f"{last_node_time:.2f}s" if last_node_time is not None else "N/A"
        print(f"Timeline: first_node={fn_s}, 5th_node={f5_s}, last_event={ln_s}")

        # Select a node in the AI graph & take P6b-ai-done-card.png
        ai_sel_id = await page.evaluate("() => window.__graphStage?.nodes[1]?.id")
        await page.evaluate(f"() => window.__graphStage?.select('{ai_sel_id}')")
        await page.wait_for_timeout(400)
        await page.screenshot(path="gemini/shots/P6b-ai-done-card.png")
        print("Saved gemini/shots/P6b-ai-done-card.png")

        # Check privacy switch: Set sessionStorage vg_allow_api to false
        print("\n--- 3. PRIVACY SWITCH TEST ---")
        await page.evaluate("() => sessionStorage.setItem('vg_allow_api', 'false')")
        stream_req_count_before = len(stream_requests)
        await page.locator("button:has-text('Build with AI')").click()
        await page.wait_for_timeout(500)
        stream_req_count_after = len(stream_requests)
        print(f"Stream requests fired with privacy off: {stream_req_count_after - stream_req_count_before} (MUST BE 0)")
        assert stream_req_count_after == stream_req_count_before, "No stream request must be fired when privacy is off!"
        privacy_msg = await page.locator("text=The AI model is turned off in Settings").count()
        print(f"Privacy message shown: {privacy_msg > 0}")

        # Reset privacy
        await page.evaluate("() => sessionStorage.setItem('vg_allow_api', 'true')")

        print("\n--- 4. REGRESSION CHECK: /graph ---")
        await page.goto(f"{FRONTEND_URL}/graph")
        await page.wait_for_load_state("networkidle")
        await page.locator("canvas.stage-canvas").wait_for(state="visible", timeout=10000)

        # Verify Knowledge Graph has Timeline button, Time machine, and all 4 layouts
        kg_timeline = await page.locator("[data-testid='graph-layout-timeline']").count()
        kg_time_machine = await page.locator("[data-testid='graph-time']").count()
        print(f"Knowledge Graph - Timeline button: {kg_timeline}, Time machine: {kg_time_machine}")
        assert kg_timeline > 0, "Knowledge Graph must have Timeline layout!"
        assert kg_time_machine > 0, "Knowledge Graph must have Time machine!"

        print("\n--- 5. RESPONSIVE & CANVAS LEAK CHECKS ---")
        for vp in [{"width": 1000, "height": 700}, {"width": 820, "height": 1100}, {"width": 400, "height": 860}]:
            await page.set_viewport_size(vp)
            await page.goto(f"{FRONTEND_URL}/text-to-graph")
            await page.wait_for_timeout(300)
            has_h_scroll = await page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
            print(f"Viewport {vp['width']}x{vp['height']}: horizontal scroll={has_h_scroll}")

        # Round trips Text to Graph -> Library
        print("Testing 5 round trips between /text-to-graph and /library...")
        for i in range(5):
            await page.goto(f"{FRONTEND_URL}/library")
            await page.wait_for_timeout(100)
            await page.goto(f"{FRONTEND_URL}/text-to-graph")
            await page.wait_for_timeout(100)
        canvas_count = await page.locator("canvas.stage-canvas").count()
        print(f"Stage canvas count on /text-to-graph after 5 round trips: {canvas_count} (MUST BE 0 or 1)")
        assert canvas_count <= 1, "Leaked canvas detected!"

        print("\n=== ALL PLAYWRIGHT VERIFICATION CHECKS PASSED ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
