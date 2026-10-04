# TASK 08b: Settings must say "Loading" while loading, not "backend unreachable" (tiny frontend fix)

Read `gemini/RULES.md` (branch guard 3b, report 5, work report 5b, quality bar 5c) and `gemini/reviews/TASK_08_review.md`. Obey the review.

## Why
While `GET /api/ai/config` and `GET /api/health` are still loading, the Settings page prints "Not available while the backend is unreachable." in the Chunk size and Embedding model rows. That is false when the backend is up (your own `task08-settings-820.png` shows it next to a footer that says "Backend online"). The text must only claim "unreachable" when a request really failed.

## Files you may change (closed list)
1. `site design/src/pages/SettingsPage.tsx` (ONE line)
2. NEW `gemini/reports/TASK_08b_report.md`
3. NEW screenshot `gemini/shots/task08b-loading.png`

## Step 0
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\site design"
npm run build
```
Branch must be `redesign/modernist-app`; the build must exit 0.

## Step 1: the edit
In `site design/src/pages/SettingsPage.tsx` find this exact line (it exists once):
```tsx
  const unavailable = "Not available while the backend is unreachable.";
```
Replace it with exactly:
```tsx
  const unavailable = loadFailed ? "Not available while the backend is unreachable." : "Loading";
```
Nothing else changes.

## Step 2: verify
1. `npm run build` exits 0 (paste the last 3 lines).
2. Start both servers (backend: `cd vitagraph\backend; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, background; frontend: `cd "site design"; npm run dev -- --port 5173`, background), wait 12 s.
3. Loading state, with Playwright in Chrome (`channel="chrome"`), viewport 1440x900, persona set by init script `localStorage.setItem('vitagraph_user_id','usr_d1d7f9b2a4b1')`. Slow the health call so the loading state lasts long enough to see, then sample the Chunk size row every 60 ms:
```python
page.route("**/api/health", lambda r: (page.wait_for_timeout(1200), r.continue_()))
page.goto("http://localhost:5173/settings")
page.wait_for_selector('[data-testid="setting-chunk-size"]')
seen = []
for _ in range(40):
    t = page.inner_text('[data-testid="setting-chunk-size"]').replace("\n", " | ")
    if not seen or seen[-1] != t:
        seen.append(t)
    page.wait_for_timeout(60)
print(seen)
```
Expected output exactly: `['Chunk size | Loading', 'Chunk size | About 200 characters per chunk, never more than 800.']`. Paste it. Take a screenshot DURING the loading (for example right after `wait_for_selector`, before the sampling loop) and save it as `gemini/shots/task08b-loading.png`; it must show "Loading" in the Chunk size and Embedding model rows and NO red "backend is not reachable" line.
4. Error state still honest: stop the backend (`Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`), reload `/settings`, wait 3 s. The Chunk size row must read `Not available while the backend is unreachable.` and the red line `The backend is not reachable, so this setting cannot be read or changed.` must be visible. Paste the two texts.
5. Normal state: start the backend again, reload without any throttling, wait 3 s. Chunk size shows the real values; the privacy On button is red and enabled. Paste the texts.
6. Console during 3 to 5: zero errors and zero warnings from the app (the connection-refused network errors of step 4 are expected; say so).
7. Stop both servers; `Get-NetTCPConnection -LocalPort 5173,8000 -State Listen` prints nothing.

## Step 3: work report
Write `gemini/reports/TASK_08b_report.md` (nine headings). In section 6 write whether anything on any screenshot contradicts something else on the page (review rule 1). Copy line counts from `git diff --stat`.

## COMMIT
```
git add "site design/src/pages/SettingsPage.tsx" gemini/reports/TASK_08b_report.md gemini/shots/task08b-loading.png
git commit -m "fix(redesign): T08b Settings says Loading, not unreachable, while loading"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list exactly those three files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Build exits 0; the diff is exactly one changed line in `SettingsPage.tsx`.
- The loading sample prints exactly the expected two-item list; screenshot shows "Loading" and no red line.
- Backend stopped: "unreachable" text and red line appear. Backend up: real values.
- Console clean; servers stopped; branch correct; exactly three files in the commit.
