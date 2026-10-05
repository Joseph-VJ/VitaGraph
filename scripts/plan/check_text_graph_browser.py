# Browser check for the Text to Graph page: console errors + screenshots at 1440x900.
import re, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

FREE = "Arjun visited Dr. Meera at Apollo Hospital in Chennai on 12 March 2026. He complained of fatigue and headache. Dr. Meera prescribed Metformin and advised a diet change. Apollo Hospital will follow up in April."
STORY = ("The old lighthouse keeper climbed the spiral staircase every evening. Marlow had lived on the island for thirty years, and the lighthouse was his only companion besides the gulls.\n\n"
         "One stormy night a small fishing boat appeared near the rocks. Marlow lit the great lamp and signalled the fishermen toward the harbour. The fishermen reached the harbour safely, and the village thanked the lighthouse keeper with fresh bread.\n\n"
         "Years later the lighthouse was replaced by an automatic beacon. Marlow still climbed the staircase each evening, because the lighthouse had become his home and the sea his oldest friend.")

root = Path(__file__).resolve().parents[2]
shots = root / "gemini" / "shots"
shots.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script("sessionStorage.setItem('vg_booted','1');")
    page = ctx.new_page()
    page.on("console", lambda m: m.type == "error" and "ERR_CONNECTION_REFUSED" not in m.text and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://localhost:5173/text-to-graph", wait_until="networkidle")

    # empty text
    page.get_by_role("button", name="Build graph").click()
    assert "Type or paste some text first." in page.inner_text("body"), "empty message missing"

    def build(text, shot=None):
        page.fill("textarea", text)
        page.get_by_role("button", name="Build graph").click()
        page.wait_for_timeout(2500)
        if shot:
            page.screenshot(path=str(shots / shot))
        return re.search(r"(\d+) entit\w+ · (\d+) sentences? .*?(\d+) nodes, (\d+) edges", page.inner_text("body"))

    for name, text, shot in [("free", FREE, "S6-free-text-1440.png"), ("story", STORY, "S6-story-1440.png"), ("numbers", "12 45 78", None), ("two words", "hello world", None)]:
        m = build(text, shot)
        print(name, m.group(0) if m else page.inner_text("body")[:200].replace("\n", " | "))
    page.get_by_role("button", name="Example: lab report").click()
    page.wait_for_timeout(1500)
    print("lab example:", re.search(r"\d+ entit.*edges", page.inner_text("body")).group(0))
    b.close()
print("console errors:", errors)
sys.exit(1 if errors else 0)
