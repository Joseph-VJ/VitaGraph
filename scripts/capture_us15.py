import time
import os
import sys
import subprocess
from playwright.sync_api import sync_playwright

PORT = 5174
out_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
os.makedirs(out_dir, exist_ok=True)
video_dir = os.path.join(out_dir, "videos")
os.makedirs(video_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1080},
        record_video_dir=video_dir,
        record_video_size={"width": 1440, "height": 1080},
    )
    page = context.new_page()

    page.on("console", lambda msg: print(f"[Browser] {msg.type}: {msg.text}", flush=True))
    page.on("pageerror", lambda err: print(f"[Browser Error] {err}", flush=True))

    print("=== US-15 Part A: Upload Page Paced Pipeline & Live Toast ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")
    page.goto(f"http://127.0.0.1:{PORT}/upload", wait_until="domcontentloaded")
    time.sleep(2)

    # Click sample synthetic panel upload button
    sample_btn = page.locator('button:has-text("Upload synthetic_panel_2025-01-15.pdf")')
    if sample_btn.count() > 0:
        sample_btn.click()
        print("Clicked upload synthetic panel button", flush=True)

        # Look for the skeleton shimmer while waiting for first event
        time.sleep(0.4)
        page.screenshot(path=os.path.join(out_dir, "us15_upload_shimmer.png"))
        print("Captured us15_upload_shimmer.png", flush=True)

        # Wait for the stepper and completion toast
        try:
            page.wait_for_selector('text="Report Ingestion Complete"', timeout=12000)
            print("Found completion toast 'Report Ingestion Complete'!", flush=True)
        except Exception as e:
            print(f"Notice waiting for upload toast: {e}", flush=True)

        time.sleep(1)
        page.screenshot(path=os.path.join(out_dir, "us15_upload_paced_done.png"))
        print("Captured us15_upload_paced_done.png", flush=True)

    print("=== US-15 Part B: Ask Page Paced Pipeline & Live ThinkingDetailsPanel ===", flush=True)
    page.goto(f"http://127.0.0.1:{PORT}/ask", wait_until="domcontentloaded")
    time.sleep(2)

    # Trigger a question
    prompt_chip = page.locator('button:has-text("What was my hemoglobin level?")')
    if prompt_chip.count() > 0:
        prompt_chip.click()
        print("Clicked prompt chip 'What was my hemoglobin level?'", flush=True)
        time.sleep(0.5)

        # Screenshot mid-flight with skeleton shimmer or first stage
        page.screenshot(path=os.path.join(out_dir, "us15_ask_shimmer_or_stream.png"))
        print("Captured us15_ask_shimmer_or_stream.png", flush=True)

        # Wait for completion toast or answer block
        try:
            page.wait_for_selector('text="Response Complete"', timeout=15000)
            print("Found completion toast 'Response Complete'!", flush=True)
        except Exception as e:
            print(f"Notice waiting for ask toast: {e}", flush=True)

        time.sleep(2)
        page.screenshot(path=os.path.join(out_dir, "us15_ask_paced_done.png"))
        print("Captured us15_ask_paced_done.png", flush=True)

    # Close page and context to save recorded video
    page_video = page.video
    page.close()
    context.close()
    browser.close()

    if page_video:
        video_path = page_video.path()
        print(f"Recorded webm video to {video_path}", flush=True)
        # Convert to mp4 using ffmpeg
        target_mp4 = os.path.join(out_dir, "us15_paced_pipeline.mp4")
        cmd = f'ffmpeg -y -i "{video_path}" -c:v libx264 -pix_fmt yuv420p "{target_mp4}"'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"Converted video successfully to {target_mp4}", flush=True)
        else:
            print(f"ffmpeg conversion stderr: {res.stderr}", flush=True)

print("US-15 browser verification script finished successfully.", flush=True)
