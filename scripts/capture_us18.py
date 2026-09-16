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

    print("=== US-18 Full Tour: Global Liveliness Pass ===", flush=True)
    context.add_init_script("localStorage.setItem('vitagraph_user_id', 'VG-2026-001');")

    # Step 1: HomePage - Shimmer and Live Bindings
    print("1. Loading HomePage...", flush=True)
    page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
    time.sleep(2)
    page.screenshot(path=os.path.join(out_dir, "us18_tour_home.png"))

    # Step 2: Navigate to Timeline (Tests 120ms route fade and Timeline spine)
    print("2. Navigating to Timeline...", flush=True)
    timeline_link = page.locator('nav a[href="/timeline"]')
    if timeline_link.count() > 0:
        timeline_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/timeline", wait_until="domcontentloaded")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(out_dir, "us18_tour_timeline.png"))

    # Step 3: Test Delete Persona confirmation modal & micro-feedback
    print("3. Testing Delete Persona button...", flush=True)
    del_btn = page.locator('button:has-text("Delete Persona")')
    if del_btn.count() > 0:
        del_btn.click()
        time.sleep(0.8)
        page.screenshot(path=os.path.join(out_dir, "us18_tour_delete_modal.png"))
        # Cancel button to keep test data safe
        cancel_btn = page.locator('button:has-text("Cancel")')
        if cancel_btn.count() > 0:
            cancel_btn.click()
            time.sleep(0.5)

    # Step 4: Navigate to Library
    print("4. Navigating to Library...", flush=True)
    lib_link = page.locator('nav a[href="/library"]')
    if lib_link.count() > 0:
        lib_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/library", wait_until="domcontentloaded")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(out_dir, "us18_tour_library.png"))

    # Step 5: Navigate to Compare
    print("5. Navigating to Compare...", flush=True)
    cmp_link = page.locator('nav a[href="/compare"]')
    if cmp_link.count() > 0:
        cmp_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/compare", wait_until="domcontentloaded")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(out_dir, "us18_tour_compare.png"))

    # Step 6: Navigate to Insights
    print("6. Navigating to Insights...", flush=True)
    ins_link = page.locator('nav a[href="/insights"]')
    if ins_link.count() > 0:
        ins_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/insights", wait_until="domcontentloaded")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(out_dir, "us18_tour_insights.png"))

    # Step 7: Navigate to Knowledge Graph
    print("7. Navigating to Knowledge Graph...", flush=True)
    graph_link = page.locator('nav a[href="/graph"]')
    if graph_link.count() > 0:
        graph_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/graph", wait_until="domcontentloaded")
    time.sleep(2.5) # Allow staggered node reveal and metrics count-up
    page.screenshot(path=os.path.join(out_dir, "us18_tour_graph.png"))

    # Step 8: Navigate to Upload
    print("8. Navigating to Upload...", flush=True)
    upl_link = page.locator('nav a[href="/upload"]')
    if upl_link.count() > 0:
        upl_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/upload", wait_until="domcontentloaded")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(out_dir, "us18_tour_upload.png"))

    # Step 9: Navigate to Ask
    print("9. Navigating to Ask...", flush=True)
    ask_link = page.locator('nav a[href="/ask"]')
    if ask_link.count() > 0:
        ask_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/ask", wait_until="domcontentloaded")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(out_dir, "us18_tour_ask.png"))

    # Return to Home and observe latency probe ticker
    print("10. Returning to Home and watching latency ticker...", flush=True)
    home_link = page.locator('nav a[href="/"]')
    if home_link.count() > 0:
        home_link.click()
    else:
        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
    time.sleep(6) # Wait for health probe tick to increment
    page.screenshot(path=os.path.join(out_dir, "us18_tour_ticker.png"))

    # Close page and context to finalize recorded video
    page_video = page.video
    page.close()
    context.close()
    browser.close()

    if page_video:
        video_path = page_video.path()
        print(f"Recorded tour webm video to {video_path}", flush=True)
        # Convert to mp4 using ffmpeg
        target_mp4 = os.path.join(out_dir, "us18_tour.mp4")
        cmd = f'ffmpeg -y -i "{video_path}" -c:v libx264 -pix_fmt yuv420p "{target_mp4}"'
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"Converted tour video successfully to {target_mp4}", flush=True)
        else:
            print(f"ffmpeg conversion stderr: {res.stderr}", flush=True)

print("US-18 full tour verification script completed successfully.", flush=True)
