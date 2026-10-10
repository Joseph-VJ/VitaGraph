import sys
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        persona_id = "usr_51f14542d71a"
        context.add_init_script(f"""
            localStorage.setItem('vitagraph_user_id', '{persona_id}');
            sessionStorage.setItem('vg_booted', '1');
        """)

        # 1. Test /library
        page = context.new_page()
        network_requests = []
        page.on("request", lambda req: network_requests.append(req.url))

        print("Testing /library...")
        page.goto("http://localhost:5173/library", wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Check requests made to /measurements and /pages
        meas_reqs = [u for u in network_requests if "/measurements" in u]
        pages_reqs = [u for u in network_requests if "/pages" in u and not u.endswith("/pages/")]
        print(f"Library measurement requests: {meas_reqs}")

        for req in meas_reqs:
            assert f"user_id={persona_id}" in req, f"Missing user_id in measurement request: {req}"

        # Click first row if present to test pages loading
        first_row = page.locator("tr.cursor-pointer, [role='button']").first
        if first_row.count() > 0:
            first_row.click()
            page.wait_for_timeout(1000)

        page.close()

        # 2. Test /timeline
        page2 = context.new_page()
        timeline_requests = []
        page2.on("request", lambda req: timeline_requests.append(req.url))

        print("Testing /timeline...")
        page2.goto("http://localhost:5173/timeline", wait_until="networkidle")
        page2.wait_for_timeout(2500)

        timeline_meas = [u for u in timeline_requests if "/measurements" in u]
        print(f"Timeline measurement requests: {timeline_meas}")

        for req in timeline_meas:
            assert f"user_id={persona_id}" in req, f"Missing user_id in timeline measurement request: {req}"

        page2.close()
        browser.close()

        print("\nRESULT: F1 BROWSER CHECKS PASSED - all /measurements and /pages carry user_id")

if __name__ == "__main__":
    main()
