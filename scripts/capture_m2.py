import os
import time
from playwright.sync_api import sync_playwright

def capture_m2():
    design_dir = os.path.abspath("design-board/motion")
    brain_dir = os.path.abspath(r"C:\Users\Admin\.gemini\antigravity\brain\82952bdd-dce5-47fa-9042-f388a010ce49")
    os.makedirs(design_dir, exist_ok=True)
    os.makedirs(brain_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 960})
        page = context.new_page()

        # 1. Capture Upload Page
        print("Capturing Upload Page...")
        page.goto("http://localhost:5174/upload", wait_until="networkidle")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1000)

        upload_path_design = os.path.join(design_dir, "upload-m2.png")
        upload_path_brain = os.path.join(brain_dir, "upload-m2.png")
        page.screenshot(path=upload_path_design, full_page=True)
        page.screenshot(path=upload_path_brain, full_page=True)
        print(f"Saved: {upload_path_design}")

        # 2. Capture Ask Page
        print("Capturing Ask Page...")
        page.goto("http://localhost:5174/ask", wait_until="networkidle")
        page.wait_for_timeout(1200)

        ask_path_design = os.path.join(design_dir, "ask-m2.png")
        ask_path_brain = os.path.join(brain_dir, "ask-m2.png")
        page.screenshot(path=ask_path_design, full_page=True)
        page.screenshot(path=ask_path_brain, full_page=True)
        print(f"Saved: {ask_path_design}")

        browser.close()
        print("Capture complete.")

if __name__ == "__main__":
    capture_m2()
