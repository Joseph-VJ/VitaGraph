import os
import sys
import time
from playwright.sync_api import sync_playwright

def verify_g0():
    print("=== VERIFY G0: RESURRECT ANIMATE-FADE-IN START ===")
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(design_dir, exist_ok=True)
    video_dir = os.path.join(design_dir, "recordings_g0")
    os.makedirs(video_dir, exist_ok=True)

    url = "http://127.0.0.1:5174/"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        # ----------------------------------------------------
        # TEST 1: T3 Full Motion Toast Entrance (fadeIn, 180ms)
        # ----------------------------------------------------
        print("\n--- TEST 1: T3 Toast Entrance ---")
        context_t3 = browser.new_context(
            viewport={"width": 1280, "height": 800},
            record_video_dir=video_dir,
            record_video_size={"width": 1280, "height": 800}
        )
        page_t3 = context_t3.new_page()
        page_t3.on("console", lambda msg: print(f"[Browser] {msg.text}"))
        page_t3.on("pageerror", lambda err: print(f"[Browser Error] {err}"))
        page_t3.goto(url)
        page_t3.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t3.reload(wait_until="networkidle")

        # Trigger toast
        print("  Waiting for ToastProvider mount...")
        page_t3.wait_for_function("() => typeof window.__VG_ADD_TOAST__ === 'function'", timeout=10000)
        print("  Triggering toast in T3...")
        page_t3.evaluate("() => window.__VG_ADD_TOAST__('info', 'System Notification', 'G0 animate-fade-in resurrected')")
        page_t3.wait_for_selector("[role='alert']", timeout=5000)

        toast_el = page_t3.locator("[role='alert']").first
        anim_name = toast_el.evaluate("el => window.getComputedStyle(el).animationName")
        anim_dur = toast_el.evaluate("el => window.getComputedStyle(el).animationDuration")
        classes = toast_el.get_attribute("class") or ""

        print(f"  Toast classes: {classes}")
        print(f"  Toast computed animationName: '{anim_name}'")
        print(f"  Toast computed animationDuration: '{anim_dur}'")

        assert "animate-fade-in" in classes, "Toast missing animate-fade-in class"
        assert anim_name == "fadeIn", f"Expected animationName 'fadeIn', got '{anim_name}'"
        assert anim_dur in ["0.18s", "180ms"], f"Expected animationDuration '0.18s' or '180ms', got '{anim_dur}'"
        print("PASS: T3 Toast entrance correctly uses resurrected @keyframes fadeIn.")

        time.sleep(1.0) # record video
        context_t3.close()

        video_path = page_t3.video.path()
        final_t3_video = os.path.join(design_dir, "gaps-toast-t3.webm")
        if os.path.exists(video_path):
            if os.path.exists(final_t3_video):
                os.remove(final_t3_video)
            os.rename(video_path, final_t3_video)
            print(f"  Saved {final_t3_video}")

        # ----------------------------------------------------
        # TEST 2: T0 Reduced-Motion Toast Entrance
        # ----------------------------------------------------
        print("\n--- TEST 2: T0 Reduced-Motion Toast Entrance ---")
        context_t0 = browser.new_context(
            viewport={"width": 1280, "height": 800},
            reduced_motion="reduce"
        )
        page_t0 = context_t0.new_page()
        page_t0.goto(url)
        page_t0.evaluate("() => { localStorage.setItem('motion_tier', 'T0'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t0.reload(wait_until="networkidle")

        print("  Waiting for ToastProvider mount in T0...")
        page_t0.wait_for_function("() => typeof window.__VG_ADD_TOAST__ === 'function'", timeout=10000)
        print("  Triggering toast in T0...")
        page_t0.evaluate("() => window.__VG_ADD_TOAST__('done', 'Reduced Motion Toast', 'Instant render without animation')")
        page_t0.wait_for_selector("[role='alert']", timeout=5000)

        toast_t0 = page_t0.locator("[role='alert']").first
        t0_anim_name = toast_t0.evaluate("el => window.getComputedStyle(el).animationName")
        t0_opacity = toast_t0.evaluate("el => window.getComputedStyle(el).opacity")

        print(f"  T0 Toast computed animationName: '{t0_anim_name}'")
        print(f"  T0 Toast computed opacity: '{t0_opacity}'")

        assert t0_anim_name in ["none", ""], f"Expected T0 animationName 'none', got '{t0_anim_name}'"
        assert float(t0_opacity) >= 0.99, f"Expected instant opacity 1 in T0, got {t0_opacity}"
        print("PASS: T0 Toast entrance settles instantly without animation.")

        final_t0_png = os.path.join(design_dir, "gaps-toast-t0.png")
        page_t0.screenshot(path=final_t0_png)
        print(f"  Saved {final_t0_png}")

        context_t0.close()
        browser.close()

    print("=== G0 VERIFICATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    verify_g0()
