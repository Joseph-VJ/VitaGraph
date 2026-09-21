from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1600})
    page.goto("http://localhost:5174/gallery")
    page.wait_for_timeout(1000)
    sec = page.locator('[data-testid="motion-specimens-section"]')
    sec.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    sec.screenshot(path="design-board/motion/gallery-specimens-m1.png")
    browser.close()

print("Screenshot captured to design-board/motion/gallery-specimens-m1.png")
