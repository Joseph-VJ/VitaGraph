#!/usr/bin/env python3
"""Verification script for Task C2: Upload page six stages with real output."""

import json
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_PDF = REPO_ROOT / "vitagraph" / "sample_data" / "synthetic_panel_2025-06-20.pdf"
SHOTS_DIR = REPO_ROOT / "gemini" / "shots"
PERSONA_ID = "usr_51f14542d71a"


def main():
    if not SAMPLE_PDF.exists():
        print(f"Error: Sample PDF not found at {SAMPLE_PDF}", flush=True)
        sys.exit(1)

    SHOTS_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error" and "net::ERR" not in msg.text
            else None,
        )

        page.goto("http://localhost:5173/upload")
        page.evaluate(
            f"""() => {{
            localStorage.setItem('vitagraph_user_id', '{PERSONA_ID}');
            sessionStorage.setItem('vg_booted', '1');
            localStorage.setItem('vitagraph_preferences', JSON.stringify({{ cinematic: false, reduceMotion: false }}));
        }}"""
        )
        page.goto("http://localhost:5173/upload")

        job_id_holder = []
        def on_request(req):
            if "/api/jobs/" in req.url and "/events" in req.url:
                parts = req.url.split("/api/jobs/")[1].split("/events")[0]
                job_id_holder.append(parts)

        page.on("request", on_request)

        page.wait_for_selector('[data-testid="upload-file-input"]', state="attached")
        file_input = page.locator('[data-testid="upload-file-input"]')
        file_input.set_input_files(str(SAMPLE_PDF))
        print("File uploaded, waiting for pipeline stages to complete...", flush=True)

        # Wait for "upload-ask" button with 60s timeout
        page.wait_for_selector('[data-testid="upload-ask"]', timeout=60000)
        time.sleep(2)

        # Count stage rows via document.querySelectorAll in browser
        count = page.evaluate('document.querySelectorAll(\'[data-testid="upload-stage-row"]\').length')
        print(f"Stage rows count from document.querySelectorAll: {count}", flush=True)
        if count != 6:
            print(f"FAIL: Expected 6 stage rows, got {count}", flush=True)
            sys.exit(1)

        stage_rows = page.locator('[data-testid="upload-stage-row"]')
        for i in range(count):
            row = stage_rows.nth(i)
            state = row.get_attribute("data-state")
            text = row.inner_text().replace("\n", " | ")
            print(f"  Row {i+1} [{state}]: {text}", flush=True)

        ask_btn = page.locator('[data-testid="upload-ask"]')
        is_visible = ask_btn.is_visible()
        btn_text = ask_btn.inner_text().replace("\n", " ").strip()
        print(f"Ask button visible: {is_visible}, text: '{btn_text}'", flush=True)

        # Fetch job events from backend
        if job_id_holder:
            jid = job_id_holder[-1]
            print(f"\n--- Events for Job {jid} from GET /api/jobs/{jid} ---", flush=True)
            req = urllib.request.Request(f"http://127.0.0.1:8000/api/jobs/{jid}")
            with urllib.request.urlopen(req) as resp:
                job_data = json.loads(resp.read().decode())
                print(f"Job Status: {job_data.get('status')}", flush=True)
                for ev in job_data.get("events", []):
                    stage = ev.get("stage")
                    desc = ev.get("description")
                    meta = ev.get("metadata")
                    print(f"  Stage '{stage}': {desc} | metadata: {json.dumps(meta)}", flush=True)

        shot_path = (SHOTS_DIR / "TASK_C2_upload_six_stages.png").resolve()
        page.screenshot(path=str(shot_path))
        print(f"Saved screenshot: {shot_path} (exists={shot_path.exists()}, size={shot_path.stat().st_size})", flush=True)

        if console_errors:
            print(f"Console errors detected ({len(console_errors)}):", flush=True)
            for err in console_errors:
                print(f"  {err}", flush=True)

        print("RESULT: PASS", flush=True)


if __name__ == "__main__":
    main()
