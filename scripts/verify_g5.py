import os
import sys
import time
from playwright.sync_api import sync_playwright

def verify_g5():
    print("=== VERIFY G5: ENTRANCES & BOUNDED SCROLL REVEALS START ===")
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(design_dir, exist_ok=True)

    base_url = "http://127.0.0.1:5174"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        # ====================================================
        # TEST 5a: NotebooksPage Entrances (T3 vs T0)
        # ====================================================
        print("\n--- TEST 5a: NotebooksPage Entrances ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/notebooks")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        # Check notebook cards stagger
        card0 = page.locator("[data-testid='notebook-card-nb-1']").first
        card1 = page.locator("[data-testid='notebook-card-nb-2']").first
        card2 = page.locator("[data-testid='notebook-card-nb-3']").first
        header = page.locator("[data-testid='notebook-preview-header']").first

        card0.wait_for(state="visible", timeout=5000)
        assert "m-enter" in (card0.get_attribute("class") or "")
        assert "m-enter" in (card1.get_attribute("class") or "")
        assert "m-enter" in (header.get_attribute("class") or "")

        delay0 = page.evaluate("(el) => el.style.animationDelay", card0.element_handle())
        delay1 = page.evaluate("(el) => el.style.animationDelay", card1.element_handle())
        delay2 = page.evaluate("(el) => el.style.animationDelay", card2.element_handle())
        delay_header = page.evaluate("(el) => el.style.animationDelay", header.element_handle())

        print(f"  Notebook delays: card0={delay0}, card1={delay1}, card2={delay2}, header={delay_header}")
        assert delay0 == "0ms" or delay0 == ""
        assert delay1 == "60ms"
        assert delay2 == "120ms"
        assert delay_header == "180ms"
        print("  PASS: NotebooksPage list and preview header have staggered m-enter entrance.")
        context.close()

        # T0 check for NotebooksPage
        context_t0 = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        page_t0 = context_t0.new_page()
        page_t0.goto(f"{base_url}/notebooks")
        page_t0.evaluate("() => { localStorage.setItem('motion_tier', 'T0'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t0.reload(wait_until="networkidle")

        card0_t0 = page_t0.locator("[data-testid='notebook-card-nb-1']").first
        card0_t0.wait_for(state="visible", timeout=5000)
        assert "m-enter" not in (card0_t0.get_attribute("class") or "")
        delay0_t0 = page_t0.evaluate("(el) => el.style.animationDelay", card0_t0.element_handle())
        assert delay0_t0 == "" or delay0_t0 == "0s"
        print("  PASS: NotebooksPage in T0 has no m-enter and content renders immediately.")
        context_t0.close()

        # ====================================================
        # TEST 5b: SettingsPage Staggered Cards (T3 vs T0)
        # ====================================================
        print("\n--- TEST 5b: SettingsPage Cards Stagger ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/settings")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        sc0 = page.locator("[data-testid='settings-card-0']").first
        sc1 = page.locator("[data-testid='settings-card-1']").first
        sc2 = page.locator("[data-testid='settings-card-2']").first
        sc3 = page.locator("[data-testid='settings-motion-card']").first

        sc0.wait_for(state="visible", timeout=5000)
        assert "m-enter" in (sc0.get_attribute("class") or "")
        assert "m-enter" in (sc1.get_attribute("class") or "")
        assert "m-enter" in (sc2.get_attribute("class") or "")
        assert "m-enter" in (sc3.get_attribute("class") or "")

        sc_delay0 = page.evaluate("(el) => el.style.animationDelay", sc0.element_handle())
        sc_delay1 = page.evaluate("(el) => el.style.animationDelay", sc1.element_handle())
        sc_delay2 = page.evaluate("(el) => el.style.animationDelay", sc2.element_handle())
        sc_delay3 = page.evaluate("(el) => el.style.animationDelay", sc3.element_handle())

        print(f"  Settings card delays: sc0={sc_delay0}, sc1={sc_delay1}, sc2={sc_delay2}, sc3={sc_delay3}")
        assert sc_delay0 == "0ms" or sc_delay0 == ""
        assert sc_delay1 == "60ms"
        assert sc_delay2 == "120ms"
        assert sc_delay3 == "180ms"
        print("  PASS: SettingsPage cards 0-3 have staggered m-enter entrance.")
        context.close()

        # T0 check for SettingsPage
        context_t0 = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        page_t0 = context_t0.new_page()
        page_t0.goto(f"{base_url}/settings")
        page_t0.evaluate("() => { localStorage.setItem('motion_tier', 'T0'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t0.reload(wait_until="networkidle")

        sc0_t0 = page_t0.locator("[data-testid='settings-card-0']").first
        sc0_t0.wait_for(state="visible", timeout=5000)
        assert "m-enter" not in (sc0_t0.get_attribute("class") or "")
        sc_delay0_t0 = page_t0.evaluate("(el) => el.style.animationDelay", sc0_t0.element_handle())
        assert sc_delay0_t0 == "" or sc_delay0_t0 == "0s"
        print("  PASS: SettingsPage in T0 has no m-enter and cards render immediately.")
        context_t0.close()

        # ====================================================
        # TEST 5c: Scroll reveals (Library & Datasets)
        # ====================================================
        print("\n--- TEST 5c: Bounded Scroll Reveals ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Library rows container
        page.goto(f"{base_url}/library")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        lib_list = page.locator("[data-testid='library-reports-list']").first
        lib_list.wait_for(state="visible", timeout=5000)
        lib_classes = lib_list.get_attribute("class") or ""
        assert "m-scroll-reveal" in lib_classes, f"Library list missing m-scroll-reveal: {lib_classes}"
        print("  PASS: Library reports list container has m-scroll-reveal.")

        # Datasets cards
        page.goto(f"{base_url}/datasets")
        page.reload(wait_until="networkidle")

        ds0 = page.locator("[data-testid='dataset-card-0']").first
        ds0.wait_for(state="visible", timeout=5000)
        ds0_classes = ds0.get_attribute("class") or ""
        assert "m-scroll-reveal" in ds0_classes, f"Dataset card missing m-scroll-reveal: {ds0_classes}"
        assert "m-enter" in ds0_classes, f"Dataset card missing m-enter: {ds0_classes}"
        print("  PASS: Datasets cards have m-scroll-reveal and m-enter.")

        context.close()
        browser.close()

    print("\n=== VERIFY G5: 100% GREEN (Entrances & Bounded Scroll Reveals Verified) ===")

if __name__ == "__main__":
    verify_g5()
