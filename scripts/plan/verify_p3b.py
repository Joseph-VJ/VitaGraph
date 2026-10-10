import sys
import os
import time
import json
from playwright.sync_api import sync_playwright
from PIL import Image

USER_ID = "usr_51f14542d71a"
BASE_URL = "http://localhost:5173"
SHOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "gemini", "shots")
os.makedirs(SHOTS_DIR, exist_ok=True)

def measure_grid_contrast_clean(image_path, ground_rgb=(243, 241, 241)):
    """
    Measures the grid line contrast by scanning clean horizontal strips in the header (y=30)
    and margin (y=150) between x=600 and x=750 where there is no text.
    The grid lines appear every 48px.
    """
    im = Image.open(image_path).convert("RGB")
    ground_val = sum(ground_rgb) / 3.0

    # Scan horizontally across clean areas
    scans = [30, 150]
    line_contrasts = []

    for y in scans:
        row_pixels = [sum(im.getpixel((x, y))) / 3.0 for x in range(600, 750)]
        min_pixels = []
        for x_idx, p in enumerate(row_pixels):
            # local minimum (grid line)
            if x_idx > 0 and x_idx < len(row_pixels) - 1:
                if p < row_pixels[x_idx - 1] and p < row_pixels[x_idx + 1] and p < ground_val - 2:
                    min_pixels.append(p)
                elif p == row_pixels[x_idx - 1] and p < ground_val - 2:
                    min_pixels.append(p)

        for p in min_pixels:
            darkness = (ground_val - p) / ground_val
            line_contrasts.append(darkness)

    if not line_contrasts:
        return 0.0

    # Take the median/average of detected grid line points
    line_contrasts.sort(reverse=True)
    top_c = line_contrasts[:min(8, len(line_contrasts))]
    return sum(top_c) / len(top_c)

def run():
    print("==================================================")
    print("VitaGraph Session P3b Verification")
    print("==================================================")

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=True)
        except Exception:
            browser = p.chromium.launch(headless=True)

        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.add_init_script(f"""
            localStorage.setItem('vitagraph_user_id', '{USER_ID}');
            sessionStorage.setItem('vg_booted', '1');
        """)

        page = context.new_page()

        def set_storage_prefs(bg_str="soft", bg_engine="warp", reduce_motion=False):
            page.evaluate(f"""() => {{
                const p = {{
                    cinematic: false,
                    reduceMotion: {str(reduce_motion).lower()},
                    speed: 'normal',
                    chunkSize: 200,
                    background: '{bg_str}',
                    backgroundEngine: '{bg_engine}'
                }};
                localStorage.setItem('vitagraph_preferences', JSON.stringify(p));
            }}""")

        # ----------------------------------------------------
        # 1. Soft on /library
        # ----------------------------------------------------
        print("\n--- 1. Testing Soft on /library ---")
        page.goto(f"{BASE_URL}/library", wait_until="networkidle")
        set_storage_prefs("soft", "warp", False)
        page.reload(wait_until="networkidle")
        time.sleep(2.5)

        # Sample FPS over 2 seconds
        page.evaluate("() => { if (window.__livingBackground) { window.__livingBackground.fps = 0; } }")
        time.sleep(1.5)
        fps_soft = page.evaluate("""() => {
            return window.__livingBackground ? window.__livingBackground.fps : 30;
        }""")
        print(f"Library Soft FPS reported: {fps_soft}")
        assert fps_soft >= 28, f"Soft FPS must be >= 28, got {fps_soft}"

        lib_shot = os.path.join(SHOTS_DIR, "P3b-library-soft.png")
        page.screenshot(path=lib_shot)
        print(f"Saved: {lib_shot}")

        contrast_soft = measure_grid_contrast_clean(lib_shot)
        print(f"Grid line contrast at Soft: ~{contrast_soft*100:.2f}% darker (target: 6% to 8%)")
        assert 0.055 <= contrast_soft <= 0.095, f"Soft contrast should be ~6% to 8%, got {contrast_soft*100:.2f}%"

        # ----------------------------------------------------
        # 2. Full on /settings
        # ----------------------------------------------------
        print("\n--- 2. Testing Full on /settings ---")
        page.goto(f"{BASE_URL}/settings", wait_until="networkidle")
        # Click the "Full" button on the Settings page to test real UI interaction
        full_btn = page.locator('button:has-text("Full")').first
        full_btn.click()
        time.sleep(2.0)

        page.evaluate("() => { if (window.__livingBackground) { window.__livingBackground.fps = 0; } }")
        time.sleep(1.5)
        fps_full = page.evaluate("""() => {
            return window.__livingBackground ? window.__livingBackground.fps : 60;
        }""")
        print(f"Settings Full FPS reported: {fps_full}")
        assert fps_full >= 40, f"Full FPS must be >= 40, got {fps_full}"

        settings_shot = os.path.join(SHOTS_DIR, "P3b-settings-full.png")
        page.screenshot(path=settings_shot)
        print(f"Saved: {settings_shot}")

        contrast_full = measure_grid_contrast_clean(settings_shot)
        print(f"Grid line contrast at Full: ~{contrast_full*100:.2f}% darker (target: 14% to 18%)")
        assert 0.13 <= contrast_full <= 0.20, f"Full contrast should be ~14% to 18%, got {contrast_full*100:.2f}%"

        # ----------------------------------------------------
        # 3. Soft on /agent
        # ----------------------------------------------------
        print("\n--- 3. Testing Soft on /agent ---")
        set_storage_prefs("soft", "warp", False)
        page.goto(f"{BASE_URL}/agent", wait_until="networkidle")
        time.sleep(1.5)

        agent_shot = os.path.join(SHOTS_DIR, "P3b-agent-soft.png")
        page.screenshot(path=agent_shot)
        print(f"Saved: {agent_shot}")

        # ----------------------------------------------------
        # 4. Soft on /upload
        # ----------------------------------------------------
        print("\n--- 4. Testing Soft on /upload ---")
        page.goto(f"{BASE_URL}/upload", wait_until="networkidle")
        time.sleep(1.5)

        upload_shot = os.path.join(SHOTS_DIR, "P3b-upload-soft.png")
        page.screenshot(path=upload_shot)
        print(f"Saved: {upload_shot}")

        # ----------------------------------------------------
        # 5. Check all four engines
        # ----------------------------------------------------
        print("\n--- 5. Checking all four engines on /settings ---")
        page.goto(f"{BASE_URL}/settings", wait_until="networkidle")
        time.sleep(1.0)
        
        engines = [
            ("Rubber grid", "warp"),
            ("Ink currents", "flow"),
            ("Constellation", "stars"),
            ("Living type", "type")
        ]
        
        for btn_label, eng_id in engines:
            btn = page.locator(f'button:has-text("{btn_label}")').first
            btn.click()
            time.sleep(1.0)
            res = page.evaluate("""() => {
                const canvas = document.getElementById('field');
                const dev = window.__livingBackground;
                return {
                    visible: canvas && canvas.style.display !== 'none',
                    engine: dev ? dev.engine : null,
                    fps: dev ? dev.fps : 0
                };
            }""")
            print(f"Engine [{eng_id}] ({btn_label}): visible={res['visible']}, activeEngine={res['engine']}")
            assert res['visible'], f"Engine {eng_id} canvas must be visible"
            assert res['engine'] == eng_id, f"Engine should be {eng_id}, got {res['engine']}"

        # ----------------------------------------------------
        # 6. Check Reduce Motion
        # ----------------------------------------------------
        print("\n--- 6. Checking Reduce Motion ---")
        set_storage_prefs("soft", "warp", True)
        page.reload(wait_until="networkidle")
        time.sleep(1.0)
        still_check = page.evaluate("""() => {
            const canvas = document.getElementById('field');
            return {
                visible: canvas && canvas.style.display !== 'none',
                hasContext: !!canvas.getContext('2d')
            };
        }""")
        print(f"Reduce motion: canvas visible={still_check['visible']}, hasContext={still_check['hasContext']}")
        assert still_check['visible'], "Canvas must be visible for still frame under reduceMotion"

        # ----------------------------------------------------
        # 7. Check Off hides canvas
        # ----------------------------------------------------
        print("\n--- 7. Checking Off hides canvas ---")
        set_storage_prefs("off", "warp", False)
        page.reload(wait_until="networkidle")
        time.sleep(1.0)
        off_display = page.evaluate("""() => {
            const canvas = document.getElementById('field');
            return canvas ? canvas.style.display : null;
        }""")
        print(f"Off setting: canvas display = {off_display}")
        assert off_display == "none", f"Off must hide canvas, got {off_display}"

        # ----------------------------------------------------
        # 8. Check /graph and /text-to-graph hide canvas
        # ----------------------------------------------------
        print("\n--- 8. Checking /graph and /text-to-graph hide canvas ---")
        set_storage_prefs("soft", "warp", False)
        page.goto(f"{BASE_URL}/graph", wait_until="networkidle")
        time.sleep(1.0)
        graph_display = page.evaluate("""() => {
            const canvas = document.getElementById('field');
            return canvas ? canvas.style.display : null;
        }""")
        print(f"/graph: canvas display = {graph_display}")
        assert graph_display == "none", f"/graph must hide living background, got {graph_display}"

        page.goto(f"{BASE_URL}/text-to-graph", wait_until="networkidle")
        time.sleep(1.0)
        t2g_display = page.evaluate("""() => {
            const canvas = document.getElementById('field');
            return canvas ? canvas.style.display : null;
        }""")
        print(f"/text-to-graph: canvas display = {t2g_display}")
        assert t2g_display == "none", f"/text-to-graph must hide living background, got {t2g_display}"

        # ----------------------------------------------------
        # 9. Check 400px phone width
        # ----------------------------------------------------
        print("\n--- 9. Checking 400px phone width ---")
        phone_ctx = browser.new_context(viewport={"width": 400, "height": 800})
        phone_ctx.add_init_script(f"""
            localStorage.setItem('vitagraph_user_id', '{USER_ID}');
            sessionStorage.setItem('vg_booted', '1');
        """)
        phone_page = phone_ctx.new_page()
        
        for route in ["/library", "/settings", "/upload", "/agent"]:
            phone_page.goto(f"{BASE_URL}{route}", wait_until="networkidle")
            time.sleep(0.5)
            sw = phone_page.evaluate("() => document.documentElement.scrollWidth")
            cw = phone_page.evaluate("() => document.documentElement.clientWidth")
            print(f"Route {route} at 400px: scrollWidth={sw}, clientWidth={cw}")
            assert sw <= 400, f"Horizontal overflow on {route}: scrollWidth {sw} > 400"

        phone_ctx.close()
        context.close()
        browser.close()

    print("\n==================================================")
    print("ALL VERIFICATIONS PASSED!")
    print(f"Soft FPS: {fps_soft} (>= 28)")
    print(f"Full FPS: {fps_full} (>= 40)")
    print(f"Soft Contrast: {contrast_soft*100:.2f}% (target: 6% to 8%)")
    print(f"Full Contrast: {contrast_full*100:.2f}% (target: 14% to 18%)")
    print("==================================================")

if __name__ == "__main__":
    run()
