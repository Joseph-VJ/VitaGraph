#!/usr/bin/env python3
"""Check layout overflow and console errors across viewports and routes."""

import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

DEFAULT_ROUTES = [
    "/upload",
    "/library",
    "/agent",
    "/graph",
    "/timeline",
    "/compare",
    "/insights",
    "/settings",
]

VIEWPORTS = [
    (360, 740),
    (820, 1100),
    (1440, 900),
]


def main():
    if len(sys.argv) < 2:
        print("Usage: check_layout.py <persona_id> [route ...]")
        sys.exit(2)

    persona_id = sys.argv[1]
    routes = sys.argv[2:] if len(sys.argv) > 2 else DEFAULT_ROUTES

    repo_root = Path(__file__).resolve().parents[2]
    shots_dir = repo_root / "gemini" / "shots"
    shots_dir.mkdir(parents=True, exist_ok=True)

    failed_checks = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")

        for width, height in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height}
            )
            context.add_init_script(f"""
                localStorage.setItem('vitagraph_user_id', '{persona_id}');
                sessionStorage.setItem('vg_booted', '1');
            """)

            for route in routes:
                page = context.new_page()
                console_errors = []

                page.on(
                    "console",
                    lambda msg: console_errors.append(msg.text)
                    if msg.type == "error" and "net::ERR" not in msg.text
                    else None,
                )
                page.on(
                    "pageerror",
                    lambda exc: console_errors.append(str(exc))
                    if "net::ERR" not in str(exc)
                    else None,
                )

                url = f"http://localhost:5173{route}"
                try:
                    page.goto(url, wait_until="load")
                except Exception as e:
                    console_errors.append(f"Navigation error: {e}")

                page.wait_for_timeout(3000)

                doc_sw, doc_iw = page.evaluate(
                    "() => [document.documentElement.scrollWidth, window.innerWidth]"
                )
                main_sw, main_cw = page.evaluate("""() => {
                    const el = document.querySelector('main#main-content') || document.querySelector('main');
                    return el ? [el.scrollWidth, el.clientWidth] : [window.innerWidth, window.innerWidth];
                }""")

                doc_overflow = doc_sw > (doc_iw + 1)
                main_overflow = main_sw > (main_cw + 1)
                has_errors = len(console_errors) > 0

                passed = not doc_overflow and not main_overflow and not has_errors
                status = "OK" if passed else "FAIL"

                err_summary = f"errors: {len(console_errors)}"
                if console_errors:
                    err_summary += f" ({'; '.join(console_errors[:3])})"

                print(
                    f"{status} {width}px {route} doc:{doc_sw}/{doc_iw} main:{main_sw}/{main_cw} {err_summary}"
                )

                if width in (360, 1440):
                    safe_route = route.replace("/", "-")
                    shot_path = shots_dir / f"layout-{width}{safe_route}.png"
                    page.screenshot(path=str(shot_path), full_page=True)

                if not passed:
                    failed_checks += 1

                page.close()

            context.close()

        browser.close()

    if failed_checks == 0:
        print("RESULT: PASS")
        sys.exit(0)
    else:
        print(f"RESULT: FAIL ({failed_checks})")
        sys.exit(1)


if __name__ == "__main__":
    main()
