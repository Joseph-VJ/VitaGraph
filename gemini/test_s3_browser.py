import os
import sys
import time
from playwright.sync_api import sync_playwright

os.environ["PYTHONIOENCODING"] = "utf-8"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.add_init_script("localStorage.setItem('vitagraph_user_id','usr_51f14542d71a')")
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("Navigating to http://localhost:5173/agent...")
        page.goto("http://localhost:5173/agent")
        page.wait_for_selector('[data-testid="agent-page"]')
        page.wait_for_selector('[data-testid="agent-conversations"]')
        page.wait_for_selector('[data-testid="agent-composer"]')

        time.sleep(1)

        # 1. Ask refusal question
        print("Asking refusal question: 'Do I have diabetes? Please diagnose me.'...")
        input_el = page.locator('[data-testid="agent-input"]')
        input_el.fill("Do I have diabetes? Please diagnose me.")
        page.locator('[data-testid="agent-composer"] button[type="submit"]').click()

        # Wait for entry
        print("Waiting for response...")
        page.wait_for_selector('[data-testid="agent-entry"]', timeout=15000)
        time.sleep(2)

        # Check refusal text
        entry_text = page.locator('[data-testid="agent-entry"]').first.inner_text()
        print("Entry text contains Declined by policy:", "Declined by policy" in entry_text or "policy" in entry_text)

        # Check URL updated with ?c=
        url = page.url
        print("Current URL:", url)
        assert "?c=conv_" in url or "&c=conv_" in url, f"Expected ?c= in url, got {url}"

        # Check conversation appears in ConversationList
        print("Waiting for conversation to appear in list...")
        page.wait_for_selector('[data-testid="agent-conversation-row"]', timeout=15000)
        conv_rows = page.locator('[data-testid="agent-conversation-row"]')
        count = conv_rows.count()
        print(f"Conversation list has {count} item(s)")
        assert count > 0, "Expected at least 1 conversation in list"

        # Check session totals line
        totals_el = page.locator('[data-testid="agent-session-totals"]')
        if totals_el.count() > 0:
            print("Session totals:", totals_el.inner_text())

        # Screenshot S3-agent-1440.png
        os.makedirs("gemini/shots", exist_ok=True)
        screenshot_path = "gemini/shots/S3-agent-1440.png"
        page.screenshot(path=screenshot_path)
        print(f"Captured screenshot to {screenshot_path}")

        # 2. Test reload with ?c=
        print(f"Reloading page with URL: {url}...")
        page.goto(url)
        page.wait_for_selector('[data-testid="agent-entry"]', timeout=15000)
        reloaded_entry_text = page.locator('[data-testid="agent-entry"]').first.inner_text()
        print("Reloaded successfully, has question:", "Do I have diabetes?" in reloaded_entry_text)

        # 3. Test New Conversation
        print("Clicking 'New conversation'...")
        page.locator('[data-testid="agent-conversations"] button:has-text("New conversation")').click()
        time.sleep(2)
        print("URL after New conversation:", page.url)
        print("agent-threads count:", page.locator('[data-testid="agent-threads"]').count())
        print("agent-entry count:", page.locator('[data-testid="agent-entry"]').count())
        print("agent-empty count:", page.locator('[data-testid="agent-empty"]').count())
        assert "?c=" not in page.url, f"Expected c to be removed from URL, got {page.url}"
        assert page.locator('[data-testid="agent-empty"]').count() > 0, "Expected empty state after new conversation"

        # 4. Reopen conversation from list
        print("Reopening conversation from list...")
        page.locator('[data-testid="agent-conversation-row"]').first.click()
        page.wait_for_selector('[data-testid="agent-entry"]', timeout=15000)
        print("URL after reopening:", page.url)
        assert "?c=" in page.url, f"Expected ?c= in URL, got {page.url}"

        # 5. Test Delete Conversation
        print("Testing delete confirmation...")
        # Hover or reveal delete button
        delete_btn = page.locator('[data-testid="agent-conversation-delete"]').first
        delete_btn.click()
        time.sleep(0.5)

        # Confirmation row should appear
        confirm_btn = page.locator('[data-testid="agent-conversation-confirm-delete"]').first
        print("Confirm delete button visible:", confirm_btn.is_visible())
        confirm_btn.click()
        
        # Wait for URL to not have ?c=
        page.wait_for_url(lambda u: "?c=" not in u, timeout=10000)

        print("Conversation deleted. Active URL:", page.url)
        assert "?c=" not in page.url, "URL should reset after deleting active conversation"

        print(f"Console errors: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)

        browser.close()
        print("All browser checks PASSED!")

if __name__ == "__main__":
    main()
