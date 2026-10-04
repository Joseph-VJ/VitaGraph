# TASK 08a: a privacy switch that always works and is remembered (backend micro-task, prepares Settings)

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report file 5b**, **quality bar 5c**). Also read `gemini/reviews/TASK_07b_review.md` and obey it (copy numbers from git, never estimate).

This is the third and last backend micro-task. The Settings page (Task 08) needs three things from the backend that do not exist yet. The reviewer found them while preparing Task 08.

## Why (real defects, found by the reviewer, all confirmed by reading the code)
1. **The privacy switch can silently fail.** The only way to change `allow_api` today is `POST /api/ai/config`. That route first PINGS the remote AI service. If the ping fails (no internet, rate limit, gateway block) and the user is switching AI OFF, the route does NOT save anything and returns status "error". A privacy control that fails when the network is bad is unacceptable. A switch that turns the AI off must never need the network.
2. **Settings are never saved to disk.** `Settings.update_ai_config(..., persist=True)` in `app/core/config.py` builds the new `.env` text in a list `new_lines` and then never writes it. So every change is lost when the backend restarts.
3. **The Settings page needs two real numbers** (characters per chunk) that only the backend knows (`CHUNK_TARGET_CHARS` and `CHUNK_MAX_CHARS` in `app/ingestion/chunker.py`). `GET /api/health` should report them, next to the `embedding_model` it already reports.

## Files you may change (closed list)
1. `vitagraph/backend/app/core/config.py` (one added line)
2. `vitagraph/backend/app/routes/ai.py` (one new request class + one new route)
3. `vitagraph/backend/app/main.py` (health: one added import line, two added dictionary lines)
4. NEW `vitagraph/backend/tests/test_ai_privacy.py`
5. NEW `gemini/reports/TASK_08a_report.md`

Never edit an existing test. Never edit anything else. NEVER print, paste, or commit the contents of `vitagraph/backend/.env` (it holds an API key). You may only print lines that start with `ALLOW_API`.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Branch must be `redesign/modernist-app`. The suite must end with `93 passed`. If not, STOP, write the report file (BLOCKED).

## Step 1: write the tests FIRST
Create `vitagraph/backend/tests/test_ai_privacy.py` with exactly this content:
```python
"""POST /api/ai/privacy: the privacy switch must work offline, be remembered, and /api/health must report chunk sizes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core import config
from app.generation import ai_client
from app.ingestion import chunker
from app.main import app

client = TestClient(app)


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    """Point the .env writer at a temp folder so the real backend/.env is never touched."""
    monkeypatch.setattr(config, "BACKEND_DIR", tmp_path)
    monkeypatch.setattr(config.settings, "allow_api", True)
    monkeypatch.setattr(config.settings, "ai_service_url", "https://example.invalid/v1")
    monkeypatch.setattr(config.settings, "ai_service_model", "deepseek-v4-flash")
    monkeypatch.setattr(config.settings, "ai_service_api_key", "test-key-1234567890")
    return tmp_path


def test_turning_privacy_off_makes_no_network_call(isolated, monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("the privacy switch must never call the AI service")

    monkeypatch.setattr(ai_client, "test_connection", boom)
    res = client.post("/api/ai/privacy", json={"allow_api": False})
    assert res.status_code == 200
    body = res.json()
    assert body["allow_api"] is False
    assert body["status"] == "offline"
    assert config.settings.allow_api is False


def test_turning_privacy_on_reports_configured_when_a_key_exists(isolated):
    res = client.post("/api/ai/privacy", json={"allow_api": True})
    assert res.status_code == 200
    body = res.json()
    assert body["allow_api"] is True
    assert body["status"] == "configured"
    assert body["has_api_key"] is True


def test_the_choice_is_written_to_the_env_file_and_other_lines_survive(isolated):
    env = isolated / ".env"
    env.write_text("ALLOW_API=true\nTOP_K_RESULTS=5\n", encoding="utf-8")
    client.post("/api/ai/privacy", json={"allow_api": False})
    lines = env.read_text(encoding="utf-8").splitlines()
    assert lines.count("ALLOW_API=false") == 1
    assert "ALLOW_API=true" not in lines
    assert "TOP_K_RESULTS=5" in lines
    assert not any(line.startswith("AI_SERVICE_API_KEY=") for line in lines)
    client.post("/api/ai/privacy", json={"allow_api": True})
    lines = env.read_text(encoding="utf-8").splitlines()
    assert lines.count("ALLOW_API=true") == 1
    assert "ALLOW_API=false" not in lines


def test_the_request_must_contain_allow_api(isolated):
    assert client.post("/api/ai/privacy", json={}).status_code == 422


def test_health_reports_the_real_chunk_sizes():
    body = client.get("/api/health").json()
    assert body["chunk_target_chars"] == chunker.CHUNK_TARGET_CHARS
    assert body["chunk_max_chars"] == chunker.CHUNK_MAX_CHARS
    assert body["embedding_model"]
```
Run only this file: `.venv\Scripts\python.exe -m pytest tests/test_ai_privacy.py -q -p no:cacheprovider`
Expected: **5 failed**. Paste the last 10 lines. If any of the five PASSES now, STOP and report BLOCKED.

## Step 2: the three edits

### Edit 1: `vitagraph/backend/app/core/config.py` (make `persist=True` really write the file)
Find these exact lines (the end of the `if persist:` block in `update_ai_config`):
```python
            for k, v in settings_map.items():
                if k not in handled_keys:
                    new_lines.append(f"{k}={v}")
```
Add this block directly below them (one blank line, then one line, 12 spaces of indentation, so it stays inside `if persist:`):
```python

            env_file.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
```
The next thing in the file must still be the blank line and `def validate_models(self) -> None:`.

### Edit 2: `vitagraph/backend/app/routes/ai.py` (the new route)
Find this exact text (the start of the existing config POST route):
```python
@router.post("/config", response_model=AiConfigResponse)
def set_ai_config(
```
Insert the following block directly ABOVE it (keep two blank lines between the new block and the old decorator):
```python
class AiPrivacyRequest(BaseModel):
    allow_api: bool


@router.post("/privacy", response_model=AiConfigResponse)
def set_ai_privacy(payload: AiPrivacyRequest) -> dict:
    """Turn sending retrieved passages to the AI service on or off. No network call, so Off can never fail."""
    settings.update_ai_config(
        allow_api=payload.allow_api,
        url=settings.ai_service_url,
        key="",
        model=settings.ai_service_model,
        persist=True,
    )
    return get_ai_config()


```
Do not change `get_ai_config`, `set_ai_config` or anything else in the file.

### Edit 3: `vitagraph/backend/app/main.py` (health)
In the function `health()` find the line `    from app.rag import vector_store` and put this line directly ABOVE it:
```python
    from app.ingestion import chunker
```
Then, in the dictionary that `health()` returns, find the line `        "embedding_model": settings.embedding_model_name,` and add these two lines directly BELOW it:
```python
        "chunk_target_chars": chunker.CHUNK_TARGET_CHARS,
        "chunk_max_chars": chunker.CHUNK_MAX_CHARS,
```

## Step 3: verify
1. `.venv\Scripts\python.exe -m pytest tests/test_ai_privacy.py -q -p no:cacheprovider` must print `5 passed`.
2. The whole suite: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` must end with `98 passed` (93 + 5). If ANY existing test fails: do NOT edit it; undo with `git checkout -- <the three source files>`, STOP, write the report (BLOCKED).
3. Confirm the real `.env` was NOT changed by the tests: run `git status --short vitagraph/backend` ; it must list nothing except your three edited source files and the new test file (`.env` is ignored by git, so also run this PowerShell line and paste only its output: `Get-Item "vitagraph\backend\.env" | Select-Object LastWriteTime`; compare it with the time BEFORE you ran the suite, which you must read first with the same command in Step 0).
4. Live check against the real backend (this also proves the setting is remembered across a restart). Do these in order, in PowerShell, from `vitagraph\backend`:
   a. Back up the config: `Copy-Item .env "$env:TEMP\vitagraph_env_backup_t08a"`. Do NOT print it.
   b. Start the backend in the background: `.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`, wait 10 s.
   c. `(Invoke-RestMethod http://127.0.0.1:8000/api/ai/config).allow_api` : note the value (call it START).
   d. `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/ai/privacy -ContentType application/json -Body '{"allow_api": false}'` : paste the fields `allow_api` and `status` (expected `False`, `offline`).
   e. `Select-String -Path .env -Pattern '^ALLOW_API'` : expected `ALLOW_API=false`.
   f. Stop the backend (`Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`), start it again (b), wait 10 s, then `(Invoke-RestMethod http://127.0.0.1:8000/api/ai/config).allow_api` : expected `False` (it was REMEMBERED). Also `Invoke-RestMethod http://127.0.0.1:8000/api/health | Select-Object chunk_target_chars, chunk_max_chars, embedding_model` : paste it (expected 200, 800, and the model name).
   g. Restore EXACTLY what the user had: `Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/ai/privacy -ContentType application/json -Body '{"allow_api": true}'` if START was True (or `false` if START was False). Check `.env` again with `Select-String -Path .env -Pattern '^ALLOW_API'`.
   h. Stop the backend. Then `Copy-Item "$env:TEMP\vitagraph_env_backup_t08a" .env -Force` (restores the original byte for byte) and `Remove-Item "$env:TEMP\vitagraph_env_backup_t08a"`.
   i. Paste only the outputs named above; never paste other `.env` lines.

## Step 4: work report
Write `gemini/reports/TASK_08a_report.md` with the nine headings of RULES 5b. In section 6 say whether anything else looked wrong. Section 3 numbers must be copied from `git diff --stat` (RULES review of 07b).

## COMMIT
Stage ONLY these five paths by explicit path:
```
git add vitagraph/backend/app/core/config.py vitagraph/backend/app/routes/ai.py vitagraph/backend/app/main.py vitagraph/backend/tests/test_ai_privacy.py gemini/reports/TASK_08a_report.md
git commit -m "feat(backend): privacy switch that works offline and is remembered; health reports chunk sizes"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list exactly those five files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- All five new tests failed before the edits and pass after.
- Full suite `98 passed`; no existing test file changed.
- The real `.env` was not modified by the test run (timestamps equal), and after the live check it is byte-identical to the backup.
- Live: Off returns `allow_api False, status offline`; after a restart `/api/ai/config` still says False; `/api/health` shows `chunk_target_chars 200`, `chunk_max_chars 800`; the original value was restored.
- Backend stopped afterwards; backup deleted.
- Report file exists, has all nine headings, is in the commit.
- Branch `redesign/modernist-app`; exactly five files in `git show --stat HEAD`.
