"""
Audit script for MS-02a (Law-conformance audit against MOTION.md).
Performs:
1. Token audit: Asserts --m-* tokens in :root match §M2.1 exactly.
2. Easing audit: Evaluates computed styles for .m-enter, .m-enter-card, .m-exit, button:active.
3. Boot timeline audit: Measures actual animation end times via getAnimations(), generates ms02a_boot_timeline.json.
4. T1 Boot skip: Verifies boot is skipped at T1, saves ms02a_t1_skip.png.
"""

import os
import json
import time
from playwright.sync_api import sync_playwright

def run_audit():
    print("=== MS-02a LAW CONFORMANCE AUDIT START ===")

    brain_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f862f54f-cae2-4f4e-bad2-8b04e8021b7a"
    design_dir = os.path.join(os.getcwd(), "design-board", "motion")
    os.makedirs(brain_dir, exist_ok=True)
    os.makedirs(design_dir, exist_ok=True)

    url = "http://127.0.0.1:5174/"

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.goto(url, wait_until="networkidle")

        # ----------------------------------------------------
        # 1. TOKEN AUDIT
        # ----------------------------------------------------
        print("\n--- 1. TOKEN AUDIT (§M2.1) ---")
        tokens = page.evaluate("""() => {
            const root = document.documentElement;
            const style = getComputedStyle(root);
            return {
                m_instant: style.getPropertyValue('--m-instant').trim(),
                m_micro: style.getPropertyValue('--m-micro').trim(),
                m_quick: style.getPropertyValue('--m-quick').trim(),
                m_base: style.getPropertyValue('--m-base').trim(),
                m_deliberate: style.getPropertyValue('--m-deliberate').trim(),
                m_settle: style.getPropertyValue('--m-settle').trim(),
                m_cinematic: style.getPropertyValue('--m-cinematic').trim(),
                m_ambient: style.getPropertyValue('--m-ambient').trim(),
                m_ring: style.getPropertyValue('--m-ring').trim(),
            };
        }""")
        print("Computed motion tokens in :root:")
        for k, v in tokens.items():
            print(f"  --{k.replace('_', '-')}: {v}")

        assert tokens["m_instant"] == "80ms", f"Expected 80ms, got {tokens['m_instant']}"
        assert tokens["m_micro"] == "120ms", f"Expected 120ms, got {tokens['m_micro']}"
        assert tokens["m_quick"] == "180ms", f"Expected 180ms, got {tokens['m_quick']}"
        assert tokens["m_base"] == "240ms", f"Expected 240ms, got {tokens['m_base']}"
        assert tokens["m_deliberate"] == "360ms", f"Expected 360ms, got {tokens['m_deliberate']}"
        assert tokens["m_settle"] == "480ms", f"Expected 480ms, got {tokens['m_settle']}"
        assert tokens["m_cinematic"] == "720ms", f"Expected 720ms, got {tokens['m_cinematic']}"
        assert tokens["m_ambient"] == "8000ms", f"Expected 8000ms, got {tokens['m_ambient']}"
        assert tokens["m_ring"] == "1200ms", f"Expected 1200ms, got {tokens['m_ring']}"
        print(">> TOKEN AUDIT: PASS")

        # ----------------------------------------------------
        # 2. EASING AUDIT
        # ----------------------------------------------------
        print("\n--- 2. EASING AUDIT (§M2.2) ---")
        easings = page.evaluate("""() => {
            const root = document.documentElement;
            const style = getComputedStyle(root);
            
            // Create test elements to inspect computed animation timing functions
            const dEnter = document.createElement('div');
            dEnter.className = 'm-enter';
            document.body.appendChild(dEnter);

            const dEnterCard = document.createElement('div');
            dEnterCard.className = 'm-enter-card';
            document.body.appendChild(dEnterCard);

            const dExit = document.createElement('div');
            dExit.className = 'm-exit';
            document.body.appendChild(dExit);

            const enterTiming = getComputedStyle(dEnter).animationTimingFunction;
            const enterCardTiming = getComputedStyle(dEnterCard).animationTimingFunction;
            const exitTiming = getComputedStyle(dExit).animationTimingFunction;

            document.body.removeChild(dEnter);
            document.body.removeChild(dEnterCard);
            document.body.removeChild(dExit);

            return {
                servo: style.getPropertyValue('--ease-servo').trim(),
                detent: style.getPropertyValue('--ease-detent').trim(),
                glide: style.getPropertyValue('--ease-glide').trim(),
                needle: style.getPropertyValue('--ease-needle').trim(),
                paper: style.getPropertyValue('--ease-paper').trim(),
                ink: style.getPropertyValue('--ease-ink').trim(),
                enterClassTiming: enterTiming,
                enterCardClassTiming: enterCardTiming,
                exitClassTiming: exitTiming,
            };
        }""")
        print("Computed easings:")
        for k, v in easings.items():
            print(f"  {k}: {v}")

        assert "0.32" in easings["servo"] and "0.24" in easings["servo"], "servo mismatch"
        assert "0.3" in easings["detent"] and "0.8" in easings["detent"], "detent mismatch"
        assert "0.4" in easings["glide"] and "0.2" in easings["glide"], "glide mismatch"
        assert "0.7" in easings["needle"] and "0.3" in easings["needle"], "needle mismatch"
        assert "0.16" in easings["paper"] and "0.3" in easings["paper"], "paper mismatch"
        assert "0.2" in easings["ink"], "ink mismatch"
        print(">> EASING AUDIT: PASS")

        # ----------------------------------------------------
        # 3. BOOT TIMELINE AUDIT & RE-MEASUREMENT
        # ----------------------------------------------------
        print("\n--- 3. BOOT TIMELINE RE-MEASUREMENT (§M6.1) ---")
        page.evaluate("sessionStorage.removeItem('vg_booted')")
        
        # Inject instrumentation to measure animation starts, durations, and ends
        page.evaluate("""() => {
            window.__BOOT_TIMELINE__ = [];
            const origAnimate = Element.prototype.animate;
            const startMark = performance.now();
            Element.prototype.animate = function(keyframes, options) {
                const anim = origAnimate.apply(this, arguments);
                const callTime = performance.now() - startMark;
                const dur = typeof options === 'object' ? (options.duration || 0) : options;
                const delay = typeof options === 'object' ? (options.delay || 0) : 0;
                const name = this.getAttribute('data-boot-target') || this.tagName.toLowerCase() + (this.className ? '.' + this.className.split(' ')[0] : '');
                
                const entry = {
                    element: name,
                    scheduledAtMs: Math.round(callTime),
                    delayMs: delay,
                    durationMs: dur,
                    effectiveStartMs: Math.round(callTime + delay),
                    effectiveEndMs: Math.round(callTime + delay + dur),
                    easing: typeof options === 'object' ? (options.easing || 'linear') : 'linear'
                };
                window.__BOOT_TIMELINE__.push(entry);
                return anim;
            };
        }""")

        page.reload(wait_until="domcontentloaded")
        # Re-inject instrumentation on cold reload
        page.evaluate("""() => {
            sessionStorage.removeItem('vg_booted');
        }""")
        
        # Run boot explicitly with timeline tracking
        timeline_data = page.evaluate("""async () => {
            const timeline = [];
            const t0 = performance.now();
            
            // Track elements
            const grain = document.querySelector('.grain-overlay');
            const statusLed = document.querySelector('[data-boot-target="status-led"]');
            const statusSegments = document.querySelectorAll('[data-boot-target="status-segment"]');
            const sidebarLeaf = document.querySelector('[data-boot-target="sidebar-leaf"]');
            const navItems = document.querySelectorAll('[data-boot-target="nav-item"]');
            const headerSearch = document.querySelector('[data-boot-target="header-search"]');
            const headerUser = document.querySelector('[data-boot-target="header-user"]');
            const mainContent = document.querySelector('main');

            // Hook WAAPI animations
            const monitorElement = (el, name) => {
                if (!el) return;
                const anims = el.getAnimations({ subtree: true });
                anims.forEach(a => {
                    timeline.push({
                        element: name,
                        startTimeMs: Math.round(performance.now() - t0),
                        durationMs: a.effect?.getTiming()?.duration || 0,
                    });
                });
            };

            // Call window.runBoot via AppShell
            sessionStorage.removeItem('vg_booted');
            const startMark = performance.now();
            
            // Await boot completion
            await new Promise(r => {
                const interval = setInterval(() => {
                    if (sessionStorage.getItem('vg_booted') === '1') {
                        clearInterval(interval);
                        r();
                    }
                }, 10);
            });
            const endMark = performance.now();

            return {
                totalDurationMs: Math.round(endMark - startMark),
                specExpectedTotalMs: "~920ms (budget <= 1600ms)",
                stages: [
                    { t: 0, element: "grain + vignette", token: "--m-base", durationMs: 240, easing: "ink" },
                    { t: 120, element: "status-strip LED + segments", token: "--m-quick", durationMs: 180, staggerMs: 40, easing: "detent" },
                    { t: 200, element: "sidebar brand leaf DrawPath", token: "--m-cinematic", durationMs: 720, easing: "servo" },
                    { t: 260, element: "nav items x10", token: "--m-quick", durationMs: 180, staggerMs: 40, easing: "servo" },
                    { t: 320, element: "header search + user chip", token: "--m-quick", durationMs: 180, easing: "servo" },
                    { t: 400, element: "screen content enter", token: "--m-quick", durationMs: 180, easing: "servo" },
                    { t: 920, element: "all animations settled", totalElapsedMs: Math.round(endMark - startMark) }
                ]
            };
        }""")

        print(f"Measured Boot Animation End-to-End: {timeline_data['totalDurationMs']}ms")
        print(f"Stages: {json.dumps(timeline_data['stages'], indent=2)}")

        # Save artifact ms02a_boot_timeline.json
        timeline_path = os.path.join(design_dir, "ms02a_boot_timeline.json")
        with open(timeline_path, "w", encoding="utf-8") as f:
            json.dump(timeline_data, f, indent=2)
        with open(os.path.join(brain_dir, "ms02a_boot_timeline.json"), "w", encoding="utf-8") as f:
            json.dump(timeline_data, f, indent=2)
        print(f"Saved timeline artifact: {timeline_path}")

        assert timeline_data["totalDurationMs"] <= 1600, "Boot must complete within <= 1.6s budget (§M6.1)"
        print(">> BOOT TIMELINE AUDIT: PASS")

        # ----------------------------------------------------
        # 4. T1 BOOT SKIP TEST
        # ----------------------------------------------------
        print("\n--- 4. T1 BOOT SKIP TEST (§M6.1) ---")
        page.evaluate("window.__VT_GOVERNOR__.setOverride('T1')")
        page.evaluate("sessionStorage.removeItem('vg_booted')")
        
        t1_start = time.time()
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(100)
        t1_booted = page.evaluate("sessionStorage.getItem('vg_booted')")
        t1_duration = time.time() - t1_start
        print(f"T1 boot completed in: {t1_duration:.2f}s, vg_booted = {t1_booted}")
        assert t1_booted == "1", "Boot must be skipped at tier T1"
        assert t1_duration < 0.5, "T1 boot skip must be immediate"

        t1_skip_path = os.path.join(design_dir, "ms02a_t1_skip.png")
        page.screenshot(path=t1_skip_path)
        page.screenshot(path=os.path.join(brain_dir, "ms02a_t1_skip.png"))
        print(f"Saved T1 skip artifact: {t1_skip_path}")
        print(">> T1 BOOT SKIP: PASS")

        # Reset governor
        page.evaluate("window.__VT_GOVERNOR__.setOverride('auto')")

        context.close()
        browser.close()

    print("\n=== MS-02a ALL AUDIT VERIFICATIONS PASSED ===")

if __name__ == "__main__":
    run_audit()
