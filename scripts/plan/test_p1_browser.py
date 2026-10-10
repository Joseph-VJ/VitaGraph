import sys
import os
import json
import time

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed in this environment.")
    sys.exit(1)

USER_ID = "usr_51f14542d71a"
BASE_URL = "http://localhost:5173"
SHOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "gemini", "shots")
os.makedirs(SHOTS_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=True)
        except Exception as e:
            print(f"Chrome channel launch failed ({e}), falling back to bundled chromium...")
            browser = p.chromium.launch(headless=True)

        context = browser.new_context(viewport={"width": 1440, "height": 900})
        
        # Inject user ID before load
        context.add_init_script(f"localStorage.setItem('vitagraph_user_id', '{USER_ID}');")
        
        page = context.new_page()

        console_errors = []
        console_warnings = []

        def on_console(msg):
            text = msg.text
            # Filter browser extensions or third party
            if msg.type == "error":
                console_errors.append(text)
                print(f"[CONSOLE ERROR] {text}")
            elif msg.type == "warning":
                console_warnings.append(text)
                print(f"[CONSOLE WARN] {text}")

        page.on("console", on_console)

        print("1. Opening /graph at 1440x900...")
        page.goto(f"{BASE_URL}/graph", wait_until="networkidle")
        page.wait_for_selector('[data-testid="graph-stage"]', timeout=15000)
        print("   Graph stage loaded!")

        # Wait for intro to play
        time.sleep(3.5)

        # 5. Measure FPS over 5 seconds in sphere layout with data flow on
        print("2. Measuring FPS over 5 seconds in sphere layout...")
        fps_result = page.evaluate("""() => {
            return new Promise((resolve) => {
                let frames = 0;
                const start = performance.now();
                function step(now) {
                    frames++;
                    if (now - start >= 5000) {
                        const elapsed = (now - start) / 1000;
                        resolve(Math.round(frames / elapsed));
                    } else {
                        requestAnimationFrame(step);
                    }
                }
                requestAnimationFrame(step);
            });
        }""")
        print(f"   Measured FPS over 5s: {fps_result} fps")

        # Screenshot 1: Sphere layout
        sphere_path = os.path.join(SHOTS_DIR, "P1-sphere.png")
        page.screenshot(path=sphere_path)
        print(f"   Saved {sphere_path}")

        # 3. Select a node via search box or clicking
        print("3. Selecting a node via search box (Hemoglobin)...")
        search_input = page.locator('input.search')
        search_input.fill("Hemoglobin")
        search_input.press("Enter")
        time.sleep(1)

        # If search didn't select, try picking the first option
        dossier = page.locator('[data-testid="graph-dossier"]')
        if not dossier.is_visible():
            print("   Search by enter didn't trigger, trying typing and selecting node...")
            # Click directly on canvas near center or dispatch selection
            page.evaluate("""() => {
                const opt = document.querySelector('#graph-names-list option');
                if (opt) {
                    const inp = document.querySelector('input.search');
                    inp.value = opt.value;
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }""")
            time.sleep(1)

        dossier_visible = dossier.is_visible()
        print(f"   Docked card visible: {dossier_visible}")

        # Wait for AI Summary to start/load
        time.sleep(2)

        # Check data-testid="graph-connections"
        conn_el = page.locator('[data-testid="graph-connections"]')
        conn_text = conn_el.inner_text() if conn_el.is_visible() else "Not found"
        print(f"   Connections text: '{conn_text}'")

        # Screenshot 2: Selected biomarker card
        card_path = os.path.join(SHOTS_DIR, "P1-selected-card.png")
        page.screenshot(path=card_path)
        print(f"   Saved {card_path}")

        # 4. Test layouts
        print("4. Testing layouts...")
        page.locator('[data-testid="graph-layout-orbits"]').click()
        time.sleep(1.2)
        page.locator('[data-testid="graph-layout-timeline"]').click()
        time.sleep(1.2)
        timeline_path = os.path.join(SHOTS_DIR, "P1-timeline.png")
        page.screenshot(path=timeline_path)
        print(f"   Saved {timeline_path}")

        page.locator('[data-testid="graph-layout-columns"]').click()
        time.sleep(1.2)
        page.locator('[data-testid="graph-layout-sphere"]').click()
        time.sleep(1.2)

        # 5. Test Lens
        print("5. Testing Lens...")
        lens_btn = page.locator('[data-testid="graph-lens"]')
        lens_btn.click()
        time.sleep(0.5)
        lens_btn.click()
        time.sleep(0.5)

        # 6. Test Paper/Ink theme
        print("6. Testing Theme toggle...")
        theme_btn = page.locator('[data-testid="graph-theme"]')
        theme_btn.click()
        time.sleep(0.5)
        theme_btn.click()
        time.sleep(0.5)

        # 7. Test What Changed (Heat mode)
        print("7. Testing What changed mode...")
        heat_cb = page.locator('[data-testid="graph-heat"]')
        heat_cb.click()
        time.sleep(1)
        heat_path = os.path.join(SHOTS_DIR, "P1-heat.png")
        page.screenshot(path=heat_path)
        print(f"   Saved {heat_path}")
        heat_cb.click() # turn off
        time.sleep(0.5)

        # 8. Test Time Machine
        print("8. Testing Time machine...")
        page.locator('#histPlay').click()
        time.sleep(1)
        page.locator('#histPlay').click() # pause
        page.locator('#histAll').click()
        time.sleep(0.5)

        # 9. Test Find a connection
        print("9. Testing Find a connection...")
        page.locator('[data-testid="graph-path-go"]').click()
        time.sleep(1)
        page.locator('#pathClear').click()
        time.sleep(0.5)

        # 10. Test Evidence
        print("10. Testing Evidence (without and with last answer)...")
        evid_btn = page.locator('[data-testid="graph-evidence"]')
        print(f"    Evidence button disabled initially: {evid_btn.is_disabled()}")
        print(f"    Evidence button text: '{evid_btn.inner_text()}'")

        # Set last answer in sessionStorage
        page.evaluate("""() => {
            sessionStorage.setItem("vitagraph:last_answer", JSON.stringify({
                userId: "usr_51f14542d71a",
                question: "What did the latest CBC show?",
                chunkIds: ["chk_ec892cba5182", "chk_f03dda52dc4e", "chk_9261173b1381"],
                timestamp: Date.now()
            }));
        }""")
        page.reload(wait_until="networkidle")
        time.sleep(2)
        evid_btn = page.locator('[data-testid="graph-evidence"]')
        print(f"    Evidence button enabled after session set: {not evid_btn.is_disabled()}")
        if not evid_btn.is_disabled():
            evid_btn.click()
            time.sleep(1)
            evid_btn.click() # turn off

        # 11. Test Save as image modal
        print("11. Testing Save as image...")
        page.locator('[data-testid="graph-save"]').click()
        time.sleep(1)
        modal = page.locator('.graph-modal')
        print(f"    Snapshot modal visible: {modal.is_visible()}")
        modal.locator('button:has-text("Close")').click()
        time.sleep(0.5)

        # 12. Test Esc key clears selection
        print("12. Testing Esc key clears selection...")
        # Select first option again
        page.evaluate("""() => {
            const opt = document.querySelector('#graph-names-list option');
            if (opt) {
                const inp = document.querySelector('input.search');
                inp.value = opt.value;
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }""")
        time.sleep(0.5)
        print(f"    Dossier before Esc: {page.locator('[data-testid=\"graph-dossier\"]').is_visible()}")
        page.keyboard.press("Escape")
        time.sleep(0.5)
        print(f"    Dossier after Esc: {page.locator('[data-testid=\"graph-dossier\"]').is_visible()}")

        # 13. Test Replay intro
        print("13. Testing Replay intro...")
        page.locator('#replay').click()
        time.sleep(1.5)

        # 14. Mobile testing at 400x860
        print("14. Testing Mobile 400x860...")
        mobile_context = browser.new_context(viewport={"width": 400, "height": 860})
        mobile_context.add_init_script(f"localStorage.setItem('vitagraph_user_id', '{USER_ID}');")
        mobile_page = mobile_context.new_page()
        mobile_page.goto(f"{BASE_URL}/graph", wait_until="networkidle")
        mobile_page.wait_for_selector('[data-testid="graph-stage"]', timeout=15000)
        time.sleep(2.5)

        # Screenshot mobile stage
        phone_stage_path = os.path.join(SHOTS_DIR, "P1-phone-stage.png")
        mobile_page.screenshot(path=phone_stage_path)
        print(f"    Saved {phone_stage_path}")

        # Select a node on mobile
        mobile_search = mobile_page.locator('input.search')
        mobile_search.fill("Hemoglobin")
        mobile_search.press("Enter")
        time.sleep(2)
        phone_dossier_path = os.path.join(SHOTS_DIR, "P1-phone-dossier.png")
        mobile_page.screenshot(path=phone_dossier_path)
        print(f"    Saved {phone_dossier_path}")

        # Scroll to panel
        mobile_page.locator('aside.panel').scroll_into_view_if_needed()
        time.sleep(0.5)
        phone_panel_path = os.path.join(SHOTS_DIR, "P1-phone-panel.png")
        mobile_page.screenshot(path=phone_panel_path)
        print(f"    Saved {phone_panel_path}")

        # Check horizontal scroll on mobile
        scroll_width, inner_width = mobile_page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
        print(f"    Mobile scrollWidth: {scroll_width}, innerWidth: {inner_width}")
        print(f"    No horizontal overflow: {scroll_width <= inner_width}")

        # 15. Verify /text-to-graph still untouched and working
        print("15. Verifying /text-to-graph...")
        ttg_page = context.new_page()
        ttg_page.goto(f"{BASE_URL}/text-to-graph", wait_until="networkidle")
        time.sleep(2)
        ttg_title = ttg_page.title()
        print(f"    Text to Graph loaded: title='{ttg_title}'")

        browser.close()

        # Report console errors
        print("\n=== Console Summary ===")
        print(f"Console errors from our code: {len(console_errors)}")
        print(f"Console warnings from our code: {len(console_warnings)}")
        if console_errors:
            for err in console_errors:
                print(f"  ERROR: {err}")

if __name__ == "__main__":
    run()
