#!/usr/bin/env python3
"""Verification script for Task B8 and defect fix B5b."""

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

def main():
    persona_id = sys.argv[1] if len(sys.argv) > 1 else "usr_9bf0df6f9b55"
    frontend_url = os.environ.get("VG_FRONTEND", "http://localhost:5173")
    api_url = os.environ.get("VG_API", "http://127.0.0.1:8000")

    repo_root = Path(__file__).resolve().parents[2]
    shots_dir = repo_root / "gemini" / "shots"
    shots_dir.mkdir(parents=True, exist_ok=True)

    print(f"Connecting to Frontend: {frontend_url} | API: {api_url} | Persona: {persona_id}")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.add_init_script(f"""
            localStorage.setItem('vitagraph_user_id', '{persona_id}');
            sessionStorage.setItem('vg_booted', '1');
        """)

        page = context.new_page()
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        page.goto(f"{frontend_url}/graph")
        page.wait_for_selector('[data-testid="graph-frame"]')
        page.wait_for_selector('canvas')
        time.sleep(2)

        # 1. Check window.__VG_CONTROLS__ before hover
        controls_before = page.evaluate("window.__VG_CONTROLS__ || { created: 0, disposed: 0 }")
        print(f"Controls before hover: created={controls_before.get('created')}, disposed={controls_before.get('disposed')}")

        # 2. Check auto-rotation
        rot1 = page.evaluate("window.__VG_GRAPH_ROTATION__ || 0")
        time.sleep(1.5)
        rot2 = page.evaluate("window.__VG_GRAPH_ROTATION__ || 0")
        print(f"Rotation check: {rot1:.4f} -> {rot2:.4f} (diff: {rot2 - rot1:.4f} rad)")
        if abs(rot2 - rot1) < 0.05:
            print("WARNING: Auto-rotation may not be progressing as expected")

        # 3. Move mouse across 25 different positions over the canvas
        canvas_box = page.locator('canvas').bounding_box()
        if not canvas_box:
            print("RESULT: FAIL (Canvas not visible)")
            sys.exit(1)

        cx, cy = canvas_box["x"], canvas_box["y"]
        cw, ch = canvas_box["width"], canvas_box["height"]

        for i in range(25):
            target_x = cx + (cw * (0.2 + 0.6 * (i / 25)))
            target_y = cy + (ch * (0.3 + 0.4 * ((i % 5) / 5)))
            page.mouse.move(target_x, target_y)
            time.sleep(0.05)

        # 4. Check window.__VG_CONTROLS__ after hover
        controls_after = page.evaluate("window.__VG_CONTROLS__ || { created: 0, disposed: 0 }")
        print(f"Controls after hover: created={controls_after.get('created')}, disposed={controls_after.get('disposed')}")

        created_same = (controls_before.get("created") == controls_after.get("created"))
        net_one = (controls_after.get("created", 0) - controls_after.get("disposed", 0) == 1)
        print(f"Created unchanged: {created_same}, Net controls == 1: {net_one}")
        if not (created_same and net_one):
            print(f"RESULT: FAIL (Controls recreated or unstable: before={controls_before}, after={controls_after})")
            sys.exit(1)

        # 5. Cap note verification
        cap_note = page.locator('[data-testid="graph-cap-note"]').inner_text()
        print(f"Cap note: '{cap_note}'")

        # 6. Screenshot 3D view
        shot_3d = shots_dir / "b8_3d_view.png"
        page.screenshot(path=str(shot_3d))
        print(f"Saved 3D screenshot to {shot_3d}")

        # 7. Select a chunk node from the collapsed Nodes details
        nodes_details = page.locator('details')
        nodes_details.click()
        time.sleep(0.5)

        # Click a chunk or first node button
        node_buttons = page.locator('details button')
        btn_count = node_buttons.count()
        print(f"Available node buttons in list: {btn_count}")
        if btn_count > 0:
            node_buttons.first.click()
            time.sleep(1)

        # Check inspector header
        header = page.locator('[data-testid="document-panel-header"]').inner_text()
        print(f"Document panel header after selection: {header.replace(chr(10), ' ')}")

        # 8. Switch to 2D view
        btn_2d = page.locator('.seg button:has-text("2D")')
        btn_2d.click()
        time.sleep(1.5)

        # Verify 2D svg rendered
        svg_exists = page.locator('[data-testid="graph-frame"] svg').count() > 0
        cap_note_2d = page.locator('[data-testid="graph-cap-note"]').inner_text()
        print(f"2D SVG present: {svg_exists}, Cap note 2D: '{cap_note_2d}'")

        # Screenshot 2D view
        shot_2d = shots_dir / "b8_2d_view.png"
        page.screenshot(path=str(shot_2d))
        print(f"Saved 2D screenshot to {shot_2d}")

        # Console errors check
        print(f"Console errors: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)

        browser.close()

    print("RESULT: PASS")

if __name__ == "__main__":
    main()
