import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SHOT_PATH = Path("gemini/shots/TASK_C2_upload_six_stages.png").resolve()
PDF_PATH = Path("vitagraph/sample_data/synthetic_panel_2025-06-20.pdf").resolve()

p = sync_playwright().start()
browser = p.chromium.launch(channel="chrome")
context = browser.new_context(viewport={"width": 1440, "height": 900})
page = context.new_page()

page.goto("http://localhost:5173/upload")
page.evaluate("""() => {
    localStorage.setItem('vitagraph_user_id', 'usr_51f14542d71a');
    sessionStorage.setItem('vg_booted', '1');
    localStorage.setItem('vitagraph_preferences', JSON.stringify({ cinematic: false, reduceMotion: false }));
}""")
page.goto("http://localhost:5173/upload")

page.wait_for_selector('[data-testid="upload-dropzone"]')
time.sleep(1)

inp = page.locator('[data-testid="upload-file-input"]')
inp.set_input_files(str(PDF_PATH))
print("File uploaded. Polling...", flush=True)

for i in range(25):
    time.sleep(1)
    ask_count = page.locator('[data-testid="upload-ask"]').count()
    rows = page.locator('[data-testid="upload-stage-row"]')
    count = rows.count()
    states = [rows.nth(j).get_attribute("data-state") for j in range(count)]
    if count == 6 and all(s == "done" for s in states) and ask_count > 0:
        print(f"Done at {i+1}s! Capturing screenshot...", flush=True)
        time.sleep(1)
        page.screenshot(path=str(SHOT_PATH))
        print("Screenshot saved to", SHOT_PATH, flush=True)
        break

browser.close()
p.stop()
