import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROUTES = [
    "/upload",
    "/library",
    "/agent",
    "/graph",
    "/timeline",
    "/compare",
    "/insights",
    "/image-to-text",
    "/pdf-to-text",
    "/text-to-graph",
    "/settings",
]

def main():
    repo_root = Path(__file__).resolve().parents[2]
    shots_dir = repo_root / "gemini" / "shots"
    shots_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.add_init_script("""
            localStorage.setItem('vitagraph_user_id', 'usr_51f14542d71a');
            sessionStorage.setItem('vg_booted', '1');
        """)

        all_ok = True

        for route in ROUTES:
            page = context.new_page()
            console_msgs = []
            page.on("console", lambda msg: console_msgs.append((msg.type, msg.text)))
            page.on("pageerror", lambda err: console_msgs.append(("pageerror", str(err))))

            page.goto(f"http://localhost:5173{route}", wait_until="networkidle")
            page.wait_for_timeout(1000)

            # Measure header height
            header = page.locator("header.vg-header").first
            box = header.bounding_box()
            height = round(box["height"]) if box else -1
            print(f"Route {route:16} -> header height: {height}px")

            if height != 76:
                print(f"  [FAIL] Header height is {height}px, expected 76px!")
                all_ok = False

            if route == "/upload":
                # Check for console errors
                errors = [m for m in console_msgs if m[0] in ("error", "pageerror")]
                print(f"  Upload console logs total: {len(console_msgs)}, errors: {len(errors)}")
                for err in errors:
                    print(f"    Upload console error: {err}")

            if route == "/agent":
                shot_path = shots_dir / "S5-agent-1440.png"
                page.screenshot(path=str(shot_path))
                print(f"  Saved screenshot to {shot_path}")

            page.close()

        browser.close()

        if all_ok:
            print("\nRESULT: ALL 11 PAGES 76PX HEADER CONFIRMED")
        else:
            print("\nRESULT: FAILED")
            sys.exit(1)

if __name__ == "__main__":
    main()
