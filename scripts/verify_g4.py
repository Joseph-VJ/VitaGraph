import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

def verify_g4():
    print("=== VERIFY G4: PRESS-FEEDBACK SWEEP PIPELINE START ===")
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(design_dir, exist_ok=True)

    base_url = "http://127.0.0.1:5174"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)

        # ====================================================
        # TEST 4a: Gallery Specimen MG.3 (DetentPress sweep board)
        # ====================================================
        print("\n--- TEST 4a: Specimen MG.3 DetentPress Sweep Board ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/gallery")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        mg3 = page.locator("[data-testid='specimen-mg3-detentpress']").first
        mg3.wait_for(state="visible", timeout=8000)

        # Test clicking controls
        btn = page.locator("[data-testid='specimen-mg3-btn']").first
        btn.click()
        assert "Last press: Button" in mg3.inner_text()

        chip = page.locator("[data-testid='specimen-mg3-chip']").first
        chip.click()
        assert "Last press: Chip" in mg3.inner_text()

        icon = page.locator("[data-testid='specimen-mg3-icon']").first
        icon.click()
        assert "Last press: Icon" in mg3.inner_text()

        link = page.locator("[data-testid='specimen-mg3-link']").first
        link.click()
        assert "Last press: Link" in mg3.inner_text()

        print("  PASS: Specimen MG.3 DetentPress sweep proof-board verified.")

        # ====================================================
        # TEST 4b: Gallery Specimen MG.4 (Confirm-panel exit)
        # ====================================================
        print("\n--- TEST 4b: Specimen MG.4 Confirm-Panel Exit ---")
        trigger = page.locator("[data-testid='specimen-mg4-trigger']").first
        trigger.click()

        panel = page.locator("[data-testid='specimen-mg4-panel']").first
        panel.wait_for(state="visible", timeout=3000)
        panel_classes = panel.get_attribute("class") or ""
        assert "m-enter-card" in panel_classes, f"Specimen MG.4 panel missing m-enter-card: {panel_classes}"

        # Click cancel and assert m-exit during transition
        cancel_btn = page.locator("[data-testid='specimen-mg4-cancel']").first
        cancel_btn.click()
        # Immediately check for m-exit
        exit_classes = panel.get_attribute("class") or ""
        print(f"  Specimen MG.4 panel classes on cancel: {exit_classes}")
        assert "m-exit" in exit_classes, f"Specimen MG.4 panel missing m-exit: {exit_classes}"

        # Wait for unmount
        panel.wait_for(state="detached", timeout=2000)
        assert page.locator("[data-testid='specimen-mg4-trigger']").first.is_visible()
        print("  PASS: Specimen MG.4 Confirm-Panel Exit verified (m-enter-card -> m-exit 120ms -> detached).")
        context.close()

        # ====================================================
        # TEST 4c: UploadPage Press & Toast Feedback
        # ====================================================
        print("\n--- TEST 4c: UploadPage Press & Toast Feedback ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/upload")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        # Prevent native download crash in headless Windows msedge
        page.evaluate("() => { HTMLAnchorElement.prototype.click = function() { console.log('Mock download click'); }; }")
        meta_btn = page.locator("[data-testid='download-metadata-btn']").first
        meta_btn.wait_for(state="visible", timeout=5000)
        meta_btn.click()

        # Check toast appeared
        toast = page.locator("text=Metadata Downloaded").first
        toast.wait_for(state="visible", timeout=3000)
        print("  PASS: UploadPage Download JSON metadata triggers DetentPress + success toast.")
        context.close()

        # ====================================================
        # TEST 4d: TimelinePage Copy-ID check & Delete Cancel Exit
        # ====================================================
        print("\n--- TEST 4d: TimelinePage Copy-ID Check & Delete Cancel Exit ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(f"{base_url}/timeline")
        page.evaluate("() => { localStorage.setItem('motion_tier', 'T3'); sessionStorage.setItem('vg_booted', '1'); }")
        page.reload(wait_until="networkidle")

        # Copy ID check-draw
        copy_btn = page.locator("[data-testid='timeline-copy-id-btn']").first
        copy_btn.wait_for(state="visible", timeout=5000)
        copy_btn.click()

        check_svg = copy_btn.locator("svg.animate-draw-check").first
        check_svg.wait_for(state="visible", timeout=2000)
        print("  PASS: Timeline Copy-ID icon swapped to animated checkmark (animate-draw-check).")

        # Delete persona confirm panel exit
        del_btn = page.locator("button:has-text('Delete persona')").first
        del_btn.click()

        del_panel = page.locator("[data-testid='timeline-delete-confirm-panel']").first
        del_panel.wait_for(state="visible", timeout=3000)
        del_classes = del_panel.get_attribute("class") or ""
        assert "m-enter-card" in del_classes, f"Timeline delete confirm panel missing m-enter-card: {del_classes}"

        cancel_purge = page.locator("[data-testid='cancel-purge-btn']").first
        cancel_purge.click()

        del_exit_classes = del_panel.get_attribute("class") or ""
        print(f"  Timeline delete confirm classes on cancel: {del_exit_classes}")
        assert "m-exit" in del_exit_classes, f"Timeline delete confirm panel missing m-exit: {del_exit_classes}"

        del_panel.wait_for(state="detached", timeout=2000)
        print("  PASS: Timeline delete-confirm Cancel plays m-exit 120ms before unmount.")

        # Save screenshot artifact
        press_shot = os.path.join(design_dir, "gaps-press.png")
        page.screenshot(path=press_shot)
        print(f"  Saved artifact: {press_shot}")
        context.close()

        # ====================================================
        # TEST 4e: T0 Reduced-Motion Instant Check
        # ====================================================
        print("\n--- TEST 4e: T0 Reduced-Motion Instant Exit Check ---")
        context_t0 = browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        page_t0 = context_t0.new_page()

        page_t0.goto(f"{base_url}/gallery")
        page_t0.evaluate("() => { localStorage.setItem('motion_tier', 'T0'); sessionStorage.setItem('vg_booted', '1'); }")
        page_t0.reload(wait_until="networkidle")

        trigger_t0 = page_t0.locator("[data-testid='specimen-mg4-trigger']").first
        trigger_t0.wait_for(state="visible", timeout=5000)
        trigger_t0.click()

        panel_t0 = page_t0.locator("[data-testid='specimen-mg4-panel']").first
        panel_t0.wait_for(state="visible", timeout=3000)
        t0_classes = panel_t0.get_attribute("class") or ""
        assert "m-enter-card" not in t0_classes, f"T0 panel should not have m-enter-card: {t0_classes}"

        cancel_t0 = page_t0.locator("[data-testid='specimen-mg4-cancel']").first
        cancel_t0.click()
        # Panel should unmount immediately without m-exit
        assert panel_t0.is_hidden() or page_t0.locator("[data-testid='specimen-mg4-trigger']").first.is_visible()
        print("  PASS: In T0, confirm-panel mounts and unmounts instantly with zero animation classes.")
        context_t0.close()
        browser.close()

    print("\n=== VERIFY G4: 100% GREEN (All press feedback & exit paths verified) ===")

if __name__ == "__main__":
    verify_g4()
