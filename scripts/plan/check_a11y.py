#!/usr/bin/env python3
"""Check accessibility, keyboard focus, and reduced motion."""

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


def main():
    if len(sys.argv) < 2:
        print("Usage: check_a11y.py <persona_id> [route ...]")
        sys.exit(2)

    persona_id = sys.argv[1]
    routes = sys.argv[2:] if len(sys.argv) > 2 else DEFAULT_ROUTES

    repo_root = Path(__file__).resolve().parents[2]
    axe_path = repo_root / "site design" / "node_modules" / "axe-core" / "axe.min.js"
    if not axe_path.exists():
        print(f"Error: axe-core script not found at {axe_path}")
        sys.exit(1)

    failed_checks = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")

        for route in routes:
            route_failed = False
            print(f"\n--- Checking {route} ---")

            # Context 1: Accessibility & Keyboard Focus (1440x900)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            context.add_init_script(f"""
                localStorage.setItem('vitagraph_user_id', '{persona_id}');
                sessionStorage.setItem('vg_booted', '1');
            """)

            page = context.new_page()
            url = f"http://localhost:5173{route}"
            try:
                page.goto(url, wait_until="load")
            except Exception as e:
                print(f"FAIL navigation to {route}: {e}")
                failed_checks += 1
                page.close()
                context.close()
                continue

            page.wait_for_timeout(2000)

            # Check 1: Accessibility via axe-core
            try:
                page.add_script_tag(path=str(axe_path))
                results = page.evaluate("""() => {
                    return axe.run({
                        runOnly: {
                            type: 'tag',
                            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
                        }
                    });
                }""")
                violations = results.get("violations", [])
                bad_violations = [
                    v for v in violations if v.get("impact") in ("serious", "critical")
                ]
                if bad_violations:
                    route_failed = True
                    print(f"FAIL a11y: {len(bad_violations)} serious/critical violations on {route}")
                    for v in bad_violations:
                        rule_id = v.get("id")
                        impact = v.get("impact")
                        nodes = v.get("nodes", [])
                        node_count = len(nodes)
                        first_target = (
                            nodes[0].get("target", ["unknown"])[0] if nodes else "unknown"
                        )
                        print(
                            f"  AXE {impact.upper()} [{rule_id}] count:{node_count} target:{first_target}"
                        )
                else:
                    print(f"OK a11y: 0 serious/critical violations on {route}")
            except Exception as e:
                print(f"FAIL a11y execution error: {e}")
                route_failed = True

            # Check 2: Keyboard focus
            tab_stops = 0
            focus_failed = False
            for step in range(1, 41):
                page.keyboard.press("Tab")
                page.wait_for_timeout(50)
                info = page.evaluate("""() => {
                    const el = document.activeElement;
                    if (!el || el === document.body) {
                        return { isBody: true };
                    }
                    if (el._tabVisited) {
                        return { isBody: false, visited: true };
                    }
                    el._tabVisited = true;
                    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    const outlineStyle = style.outlineStyle;
                    const outlineWidth = parseFloat(style.outlineWidth) || 0;
                    const hasOutline = outlineStyle !== 'none' && outlineWidth >= 1;
                    const hasShadow = style.boxShadow && style.boxShadow !== 'none';
                    const inViewport = rect.width > 0 && rect.height > 0 &&
                                       rect.bottom >= 0 && rect.right >= 0 &&
                                       rect.top <= window.innerHeight && rect.left <= window.innerWidth;
                    return {
                        isBody: false,
                        visited: false,
                        inViewport,
                        hasIndicator: hasOutline || hasShadow,
                        selector: el.getAttribute('data-testid') || el.id || el.className || el.tagName
                    };
                }""")

                if info.get("visited"):
                    break

                tab_stops += 1

                if step == 1 and info.get("isBody"):
                    print(f"FAIL focus: activeElement is body after first Tab on {route}")
                    focus_failed = True
                    break

                if not info.get("isBody"):
                    if not info.get("inViewport"):
                        print(
                            f"FAIL focus: tab stop {tab_stops} ({info.get('selector')}) is not visible in viewport on {route}"
                        )
                        focus_failed = True
                        break
                    if not info.get("hasIndicator"):
                        print(
                            f"FAIL focus: tab stop {tab_stops} ({info.get('selector')}) lacks outline/boxShadow indicator on {route}"
                        )
                        focus_failed = True
                        break

            if focus_failed:
                route_failed = True
            else:
                print(f"OK focus: {tab_stops} tab stops checked on {route}")

            page.close()
            context.close()

            # Context 2: Reduced motion
            context_rm = browser.new_context(
                viewport={"width": 1440, "height": 900},
                reduced_motion="reduce",
            )
            context_rm.add_init_script(f"""
                localStorage.setItem('vitagraph_user_id', '{persona_id}');
                sessionStorage.setItem('vg_booted', '1');
            """)
            page_rm = context_rm.new_page()
            try:
                page_rm.goto(url, wait_until="load")
                page_rm.wait_for_timeout(1500)

                running_anims = page_rm.evaluate("""() => {
                    if (typeof document.getAnimations !== 'function') return 0;
                    return document.getAnimations().filter(a => a.playState === 'running').length;
                }""")

                if running_anims > 0:
                    print(f"FAIL reduced-motion: {running_anims} running animations on {route}")
                    route_failed = True
                else:
                    print(f"OK reduced-motion: 0 running animations on {route}")

                if route == "/graph":
                    rot1 = page_rm.evaluate("() => window.__VG_GRAPH_ROTATION__")
                    page_rm.wait_for_timeout(2000)
                    rot2 = page_rm.evaluate("() => window.__VG_GRAPH_ROTATION__")
                    if rot1 is not None and rot2 is not None and rot1 != rot2:
                        print("FAIL reduced-motion: graph rotation changed under reduced motion")
                        route_failed = True
            except Exception as e:
                print(f"FAIL reduced-motion check error: {e}")
                route_failed = True

            page_rm.close()
            context_rm.close()

            if route_failed:
                failed_checks += 1

        browser.close()

    if failed_checks == 0:
        print("\nRESULT: PASS")
        sys.exit(0)
    else:
        print(f"\nRESULT: FAIL ({failed_checks})")
        sys.exit(1)


if __name__ == "__main__":
    main()
