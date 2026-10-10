import json
import urllib.request
import sys
from playwright.sync_api import sync_playwright

PAGES = [
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

def create_fresh_user():
    req = urllib.request.Request(
        "http://localhost:8000/api/users",
        data=json.dumps({"display_label": "Fresh Zero Report Persona"}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        # accept consent as well
        consent_req = urllib.request.Request(
            f"http://localhost:8000/api/users/{data['id']}/consent",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(consent_req)
        return data["id"]

def run_pass(persona_name, persona_id, p):
    print(f"\n==========================================")
    print(f"RUNNING PASS: {persona_name} ({persona_id})")
    print(f"==========================================")
    
    browser = p.chromium.launch(channel="chrome")
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.add_init_script(f"""
        localStorage.setItem('vitagraph_user_id', '{persona_id}');
        sessionStorage.setItem('vg_booted', '1');
    """)

    pass_ok = True

    for route in PAGES:
        page = context.new_page()
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type in ("error",) else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        url = f"http://localhost:5173{route}"
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1000)

        # 1. Header height
        header = page.locator("header.vg-header").first
        box = header.bounding_box()
        h_height = round(box["height"]) if box else -1

        # 2. Check crash / content
        body_text = page.inner_text("body")
        has_content = len(body_text.strip()) > 50

        # 3. Check for raw 'undefined' or 'NaN' in visible text
        has_undefined = " undefined " in body_text or "undefined" in page.locator("h1, h2, h3, .tag, .stat-value").all_inner_texts()
        has_nan = " NaN " in body_text or "NaN" in page.locator("h1, h2, h3, .tag, .stat-value").all_inner_texts()

        # Check issues
        status_parts = []
        if h_height != 76:
            status_parts.append(f"HEADER={h_height}px (EXPECTED 76)")
            pass_ok = False
        if console_errors:
            status_parts.append(f"CONSOLE_ERRORS={console_errors}")
            pass_ok = False
        if not has_content:
            status_parts.append("PAGE_EMPTY_OR_CRASHED")
            pass_ok = False
        if has_undefined:
            status_parts.append("TEXT_HAS_UNDEFINED")
            pass_ok = False
        if has_nan:
            status_parts.append("TEXT_HAS_NAN")
            pass_ok = False

        if not status_parts:
            print(f"  [OK]   {route:16} | header: 76px | console: 0 errors | content: OK")
        else:
            print(f"  [FAIL] {route:16} | {'; '.join(status_parts)}")

        page.close()

    browser.close()
    return pass_ok

def main():
    with sync_playwright() as p:
        # Pass 1: existing test persona with reports
        p1_ok = run_pass("Test Persona with Reports", "usr_51f14542d71a", p)

        # Pass 2: fresh persona with 0 reports
        fresh_id = create_fresh_user()
        p2_ok = run_pass("Fresh Persona (0 reports)", fresh_id, p)

        if p1_ok and p2_ok:
            print("\nRESULT: ALL 11 PAGES PASSED BOTH PASSES (76px header, no console error, no crashes, clean empty states)!")
        else:
            print("\nRESULT: FAILED CHECKS")
            sys.exit(1)

if __name__ == "__main__":
    main()
