# TASK T1: AI connection, BACKEND (Gemini session 1 of 2)

You are session T1. Another Gemini session (T2) builds the Settings page at the same time; you never touch its files. Claude reviews your work. Be exact: copy the code blocks below, then do what the "Write yourself" lists say. If anything is unclear or a rule below would be broken, STOP and write BLOCKED in your report instead of guessing.

## Read first (in this order)
1. `gemini/PLAN_T_ai_connection.md` (the contract; section 0 facts, section 1 routes).
2. `gemini/RULES.md` sections 2, 4, 5c, 5d (ignore its old branch name: the branch for this task is `feature/privacy-shield-and-rag-lab`).
3. `vitagraph/backend/app/core/config.py`, `app/routes/ai.py`, `app/agent/runs.py` (class `RunRegistry`), `tests/test_ai_privacy.py` (the pattern for tests that must never touch the real `.env`), `tests/conftest.py`.

## Hard rules
- First command: `git branch --show-current` must print `feature/privacy-shield-and-rag-lab`. Last command: the same plus `git status --short` (paste both).
- Edit ONLY: `app/core/config.py`, `app/routes/ai.py`, `app/agent/runs.py`, and create `tests/test_ai_model_connection.py` and `tests/test_env_writer.py`. Nothing else. Never edit an existing test.
- NEVER open, print, `cat`, copy, edit or search inside `vitagraph/backend/.env`. You may only compare its modification time (`(Get-Item .env).LastWriteTime`) before and after your work; it must be unchanged.
- No git writes (no add, commit, stash, checkout, reset, restore, clean, push, merge, rebase, amend).
- Never start, stop or use ports 8000 or 5173 (the owner's running app). Your own scratch backend uses port 8001 and the fake model server port 8099 (section "Live check").
- Do not run `npm` anything. Do not touch frontend files.
- Never print an API key. Test keys in tests are fake strings like `test-key-ABCDEFGH1234`.

## Progress ladder (report each rung with its check output)
- 25 %: Part A done, `pytest tests/test_env_writer.py -q` green.
- 50 %: Part B + C done (config + registry), still green.
- 75 %: Part D done (routes), `pytest tests/test_ai_model_connection.py -q` green.
- 90 %: full suite green.
- 100 %: live check done and report written.

## Part A: `app/core/config.py`

A1. Imports: change the top to also have `import os` (next to the `from pathlib import Path` / `import logging` lines).

A2. Add this module-level function right AFTER the line `logger = logging.getLogger(__name__)` and the `ALLOWED_AGENTROUTER_MODELS` block (i.e. before `class Settings`). Copy exactly:

```python
def _env_file_path() -> Path:
    """The file settings are saved to: backend/.env, or the path in VITAGRAPH_ENV_FILE (used by scratch servers and tests)."""
    override = os.environ.get("VITAGRAPH_ENV_FILE", "").strip()
    return Path(override) if override else BACKEND_DIR / ".env"


def write_env_values(updates: dict[str, str]) -> None:
    """Save KEY=value lines in the .env file.

    The first `KEY=` (or `#KEY=`) line of each key is replaced, repeated `KEY=` lines are dropped, keys that are not in the file are
    appended. Every other line (comments, other settings) stays as it is. The file is replaced in one step, so a crash never leaves a
    half-written file. A value must be a single line.
    """
    for name, value in updates.items():
        if any(ch in value for ch in ("\r", "\n", "\x00")):
            raise ValueError(f"{name} must be a single line")
    env_file = _env_file_path()
    lines = env_file.read_text(encoding="utf-8").splitlines() if env_file.exists() else []
    handled: set[str] = set()
    out: list[str] = []
    for line in lines:
        hit = next((name for name in updates if line.startswith(f"{name}=") or line.startswith(f"#{name}=")), None)
        if hit is None:
            out.append(line)
        elif hit in handled:
            if not line.startswith(f"{hit}="):
                out.append(line)  # a second commented example stays; a second active line is a duplicate and goes
        else:
            out.append(f"{hit}={updates[hit]}")
            handled.add(hit)
    for name, value in updates.items():
        if name not in handled:
            out.append(f"{name}={value}")
    tmp = env_file.with_name(env_file.name + ".tmp")
    tmp.write_text("\n".join(out) + "\n", encoding="utf-8")
    os.replace(tmp, env_file)
```
NOTE: `BACKEND_DIR` is defined later in the file (`BACKEND_DIR = Path(__file__)...`). That is fine because `_env_file_path` reads it when it is CALLED, not when it is defined. Do not move `BACKEND_DIR`. The tests change `config.BACKEND_DIR` with `monkeypatch`, so keep reading the module global `BACKEND_DIR` inside the function (do not copy it into a default argument).

A3. In `Settings.update_ai_config`, replace the whole inline block that starts at `if persist:` / `env_file = BACKEND_DIR / ".env"` and ends with `env_file.write_text(...)` by:
```python
        if persist:
            settings_map = {
                "ALLOW_API": "true" if self.allow_api else "false",
                "AI_SERVICE_URL": self.ai_service_url,
                "AI_SERVICE_MODEL": self.ai_service_model,
            }
            if key.strip():
                settings_map["AI_SERVICE_API_KEY"] = self.ai_service_api_key
            write_env_values(settings_map)
```
`tests/test_ai_privacy.py` must still pass unchanged (it checks that `ALLOW_API` is replaced, other lines survive, and that no `AI_SERVICE_API_KEY=` line is written when no key is given).

A4. Split the validator. Replace the existing `_apply_model_api` method by these TWO methods (same place in the class):
```python
    def _derive_from_model_api(self) -> None:
        """Copy MODEL_API_URL / MODEL_NAME onto the active fields. Only done together with the key, so an old gateway key can never go to a new host."""
        key = self.model_api_key.strip()
        if not key:
            return
        self.agentrouter_api_key = key
        if self.model_api_url.strip():
            self.agentrouter_base_url = self.model_api_url.strip()
        if self.model_name.strip():
            self.agentrouter_model = self.model_name.strip()
            self.agentrouter_fallback_models = self.model_fallback_models

    @model_validator(mode="after")
    def _apply_model_api(self) -> "Settings":
        if not self.model_api_key.strip():
            if self.model_api_url.strip() or self.model_name.strip():
                logger.warning("MODEL_API_URL / MODEL_NAME are set but MODEL_API_KEY is empty; ignoring them.")
            return self
        self._derive_from_model_api()
        return self
```

A5. Add these two methods to `Settings` (put them right after `update_ai_config`):
```python
    def apply_model_connection(
        self,
        *,
        url: str,
        key: str,
        model: str,
        api_format: str,
        reasoning_effort: str,
        persist: bool = True,
    ) -> None:
        """Use a new model endpoint at once and (by default) remember it in the .env file.

        `key` empty keeps the key that is already saved. `api_format` is "responses" or "chat". `reasoning_effort` is
        minimal | low | medium | high, or "" to leave the choice to the provider.
        """
        self.model_api_url = url.strip()
        if key.strip():
            self.model_api_key = key.strip()
        self.model_name = model.strip()
        self.model_api_format = api_format
        self.model_reasoning_effort = reasoning_effort
        self._derive_from_model_api()
        if persist:
            updates = {
                "MODEL_API_URL": self.model_api_url,
                "MODEL_NAME": self.model_name,
                "MODEL_API_FORMAT": self.model_api_format,
                "MODEL_REASONING_EFFORT": self.model_reasoning_effort,
            }
            if key.strip():
                updates["MODEL_API_KEY"] = self.model_api_key
            write_env_values(updates)

    def forget_model_key(self, persist: bool = True) -> None:
        """Remove the saved key everywhere it is used."""
        self.model_api_key = ""
        self.agentrouter_api_key = ""
        self.ai_service_api_key = ""
        if persist:
            write_env_values({"MODEL_API_KEY": ""})
```

### Write yourself: `tests/test_env_writer.py`
Use `monkeypatch.setattr(config, "BACKEND_DIR", tmp_path)`. Tests (each one small, names in plain words):
1. replaces an existing `KEY=` line and keeps every other line (comments, blank lines, other keys) in the same order;
2. replaces a `#KEY=` commented line;
3. appends a key that is not in the file; creates the file when it does not exist;
4. drops a second active `KEY=` line (duplicate) but keeps a second commented `#KEY=` example;
5. rejects a value containing `\n`, `\r` or `\x00` with `ValueError` and leaves the file untouched;
6. leaves no `.env.tmp` file behind;
7. honours `VITAGRAPH_ENV_FILE` (set with `monkeypatch.setenv` to a path in `tmp_path`; the file in `BACKEND_DIR` is not created);
8. `Settings.apply_model_connection(...)` (with every touched settings field first saved through `monkeypatch.setattr(config.settings, name, value)` so they restore afterwards: `model_api_url, model_api_key, model_name, model_api_format, model_reasoning_effort, agentrouter_api_key, agentrouter_base_url, agentrouter_model, agentrouter_fallback_models, ai_service_api_key`): after `apply_model_connection(url="https://example.invalid/v1", key="test-key-ABCDEFGH1234", model="m1", api_format="responses", reasoning_effort="low", persist=False)` you have `settings.effective_api_key == "test-key-ABCDEFGH1234"`, `effective_base_url == "https://example.invalid/v1"`, `effective_model == "m1"` and `settings.api_format == "responses"`; with `api_format="chat"` then `settings.api_format == "chat"`; with a blank key the old key stays; the `.env` lines are written when `persist=True`;
9. `forget_model_key()` empties `effective_api_key` and writes `MODEL_API_KEY=` (empty value).

## Part B: `app/agent/runs.py`
Add this method to class `RunRegistry` right after `running_ids`:
```python
    def any_running(self) -> bool:
        """True while any person's answer is still being written."""
        self._purge()
        for run in self._runs.values():
            self._settle(run)
            if run.running:
                return True
        return False
```
Add one test for it in `tests/test_env_writer.py`? NO: put it in `tests/test_ai_model_connection.py` (below). Do not edit existing run tests.

## Part C: nothing else in config.py. Re-run `pytest tests/test_env_writer.py tests/test_ai_privacy.py tests/test_agent_runs.py -q -p no:cacheprovider`.

## Part D: `app/routes/ai.py`

D1. Imports at the top: add
```python
import asyncio
from typing import Any, Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Request
from app.agent.pool import get_pool
from app.agent.runs import get_registry
```
(keep the existing imports; merge `Request` into the existing `from fastapi import ...` line and `Literal` into the existing `typing` line so there is no duplicate import).

D2. Append this block at the END of the file (after `_compose_offline_summary`). Copy exactly:

```python
# --------------------------------------------------------------------------------------------------
# AI connection (plan T): endpoint, key and model name saved from the Settings page.
# Changing it is allowed only from the computer that runs the backend: there is no login, and the
# endpoint decides where the person's report passages are sent.
# --------------------------------------------------------------------------------------------------

LOCAL_HOSTS = frozenset({"127.0.0.1", "::1", "localhost", "testclient"})
_LOCAL_URL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
_MODEL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@+\-]{0,99}$")


class ModelConnectionIn(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    key: str = Field(default="", max_length=500)
    model: str = Field(min_length=1, max_length=100)
    api_format: Literal["auto", "responses", "chat"] = "auto"
    reasoning: Literal["minimal", "low", "medium", "high", "default"] = "low"
    skip_test: bool = False


class ModelConnectionOut(BaseModel):
    url: str
    model: str
    api_format: Literal["responses", "chat"]
    reasoning: Literal["minimal", "low", "medium", "high", "default"]
    has_key: bool
    masked_key: str
    allow_api: bool
    shield_covered: bool
    can_edit: bool
    message: str = ""


class ModelTestOut(BaseModel):
    ok: bool
    message: str
    api_format: Literal["responses", "chat"]


def _is_local(request: Request) -> bool:
    host = request.client.host if request.client else ""
    return host in LOCAL_HOSTS


def _require_local(request: Request) -> None:
    if not _is_local(request):
        raise HTTPException(status_code=403, detail="The AI connection can only be changed from the computer that runs VitaGraph.")


def _clean_url(raw: str) -> str:
    url = raw.strip()
    if not url or re.search(r"\s", url):
        raise HTTPException(status_code=422, detail="The endpoint address cannot be empty or contain spaces.")
    try:
        parts = urlsplit(url)
        host = parts.hostname
    except ValueError:
        raise HTTPException(status_code=422, detail="The endpoint address is not a valid web address.")
    if parts.scheme not in ("http", "https") or not host:
        raise HTTPException(status_code=422, detail="The endpoint address must start with http:// or https://")
    if parts.username or parts.password:
        raise HTTPException(status_code=422, detail="Do not put a user name or password in the endpoint address.")
    if parts.query or parts.fragment:
        raise HTTPException(status_code=422, detail="Remove everything after ? or # from the endpoint address.")
    if parts.scheme == "http" and host not in _LOCAL_URL_HOSTS:
        raise HTTPException(status_code=422, detail="Use https:// for an endpoint that is not on this computer.")
    return url.rstrip("/")


def _clean_model_name(raw: str) -> str:
    name = raw.strip()
    if not _MODEL_NAME.match(name):
        raise HTTPException(status_code=422, detail="The model name can only use letters, digits and the characters . _ : / @ + -")
    return name


def _clean_key(raw: str) -> str:
    key = raw.strip()
    if key and (len(key) < 8 or re.search(r"\s", key)):
        raise HTTPException(status_code=422, detail="The key looks wrong: it is too short or contains spaces or line breaks.")
    return key


def _resolve_format(url: str, requested: str) -> str:
    if requested in ("responses", "chat"):
        return requested
    return "responses" if urlsplit(url).path.rstrip("/").endswith("/responses") else "chat"


def _test_url(url: str, api_format: str) -> str:
    # Same address the app really calls: the base address plus /responses or /chat/completions.
    base = settings._normalise_base(url)
    return f"{base}/responses" if api_format == "responses" else f"{base}/chat/completions"


def _run_test(url: str, key: str, model: str, api_format: str) -> tuple[bool, str]:
    use_key = key or settings.effective_api_key
    ok, message = ai_client.test_connection(url=_test_url(url, api_format), key=use_key, model=model)
    for secret in (key, settings.effective_api_key):
        if secret:
            message = message.replace(secret, "…")
    return ok, message


def _model_out(request: Request, message: str = "") -> dict[str, Any]:
    key = settings.effective_api_key
    effort = settings.model_reasoning_effort.strip().lower()
    return {
        "url": settings.model_api_url.strip(),
        "model": settings.model_name.strip(),
        "api_format": "responses" if settings.model_api_format.strip().lower() == "responses" else "chat",
        "reasoning": effort if effort in ("minimal", "low", "medium", "high") else "default",
        "has_key": bool(key),
        "masked_key": ("••••" + key[-4:]) if len(key) >= 8 else ("••••" if key else ""),
        "allow_api": settings.allow_api,
        "shield_covered": settings.api_format == "responses",
        "can_edit": _is_local(request),
        "message": message,
    }


def _checked_input(payload: ModelConnectionIn) -> tuple[str, str, str, str]:
    url = _clean_url(payload.url)
    model = _clean_model_name(payload.model)
    key = _clean_key(payload.key)
    if not key and not settings.effective_api_key:
        raise HTTPException(status_code=422, detail="Enter an API key.")
    return url, key, model, _resolve_format(url, payload.api_format)


@router.get("/model", response_model=ModelConnectionOut)
def get_model_connection(request: Request) -> dict[str, Any]:
    """The saved connection, without the key."""
    return _model_out(request)


@router.post("/model/test", response_model=ModelTestOut)
async def test_model_connection(payload: ModelConnectionIn, request: Request) -> dict[str, Any]:
    """Try the connection with the values typed in. Saves nothing."""
    _require_local(request)
    url, key, model, api_format = _checked_input(payload)
    ok, message = await asyncio.to_thread(_run_test, url, key, model, api_format)
    return {"ok": ok, "message": message, "api_format": api_format}


@router.post("/model", response_model=ModelConnectionOut)
async def save_model_connection(payload: ModelConnectionIn, request: Request) -> dict[str, Any]:
    """Test the connection, then use it at once and remember it in the .env file."""
    _require_local(request)
    url, key, model, api_format = _checked_input(payload)
    if get_registry().any_running():
        raise HTTPException(status_code=409, detail="The AI Agent is still answering. Wait for it to finish, then save.")
    message = "Saved without a test."
    if not payload.skip_test:
        ok, message = await asyncio.to_thread(_run_test, url, key, model, api_format)
        if not ok:
            raise HTTPException(status_code=422, detail=message)
    settings.apply_model_connection(
        url=url,
        key=key,
        model=model,
        api_format=api_format,
        reasoning_effort="" if payload.reasoning == "default" else payload.reasoning,
    )
    await get_pool().close_all()  # running agent workers keep the old values until they restart
    return _model_out(request, message)


@router.post("/model/remove-key", response_model=ModelConnectionOut)
async def remove_model_key(request: Request) -> dict[str, Any]:
    """Forget the saved key (the AI then stays off until a new key is saved)."""
    _require_local(request)
    if get_registry().any_running():
        raise HTTPException(status_code=409, detail="The AI Agent is still answering. Wait for it to finish, then remove the key.")
    settings.forget_model_key()
    await get_pool().close_all()
    return _model_out(request, "The saved key was removed.")
```
Check after pasting: `Request` is imported; there is exactly one `from fastapi import` line; `python -c "import app.routes.ai"` works from `vitagraph/backend` with the venv.

### Write yourself: `tests/test_ai_model_connection.py`
Pattern: `client = TestClient(app)`; a fixture `isolated(tmp_path, monkeypatch)` that (1) `monkeypatch.setattr(config, "BACKEND_DIR", tmp_path)` and writes `tmp_path/".env"` with `"TOP_K_RESULTS=5\n"`, (2) `monkeypatch.setattr(config.settings, name, value)` for every field `apply_model_connection` / `forget_model_key` can touch (the ten listed in test 8 above) with a known starting state: key `"test-key-OLDOLD9999"`, url `"https://old.example.invalid/v1"`, name `"old-model"`, format `"chat"`, effort `"low"`, `allow_api` True, (3) replaces `get_pool` in `app.routes.ai` with a fake object whose async `close_all` counts calls, (4) monkeypatches `ai_client.test_connection` with a recorder (returns `(True, "Connection verified.")` unless a test sets otherwise; stores the `url`, `key`, `model` it got). Never let any test reach the network.
Tests to write (plain names):
1. `GET /api/ai/model` returns url, model, format, `has_key`, `masked_key` ending in the last 4 characters of the key (`9999`), `can_edit` true, `shield_covered` false for chat; the full key is nowhere in `res.text`; there is no field called `key`.
2. Save with a new key: 200; live settings changed (`effective_*`); `.env` has `MODEL_API_URL`, `MODEL_NAME`, `MODEL_API_FORMAT`, `MODEL_API_KEY`, `MODEL_REASONING_EFFORT` lines and still has `TOP_K_RESULTS=5`; the reply has no key; `close_all` was called once; the test got the URL `https://.../v1/chat/completions` for auto-chat.
3. Save with `key=""` keeps the old key (`effective_api_key` unchanged) and writes NO `MODEL_API_KEY=` line.
4. A failed test (recorder returns `(False, "Authentication failed")`): 422, `detail` equals that message, settings and `.env` unchanged, `close_all` not called.
5. `skip_test=true` saves without calling `test_connection`; `message == "Saved without a test."`.
6. Format: `api_format="auto"` with a URL ending `/responses` saves `responses` and the test URL ends with `/responses`; with `.../v1` saves `chat` and the test URL ends `/chat/completions`; explicit `"responses"` with a `.../v1` URL tests `.../v1/responses`.
7. Validation (each is 422 and changes nothing): `ftp://x`, `http://example.com/v1` (not local), a URL with `user:pw@`, a URL with `?x=1`, a URL with a space, `javascript:alert(1)`, an empty model, a model name with a space or `;`, a key shorter than 8, a key with a space, a key with `\n`. And `http://localhost:11434/v1` and `http://127.0.0.1:8080/v1` are accepted.
8. A remote caller: `TestClient(app, client=("203.0.113.9", 50000))` gets 403 on test, save and remove-key, and `GET` works with `can_edit` false. Nothing changed.
9. While an answer runs (`monkeypatch.setattr(get_registry(), "any_running", lambda: True)` using `from app.agent.runs import get_registry`): save and remove-key return 409 and change nothing; `POST /model/test` still works.
10. `POST /model/test` returns `ok`, message and the concrete format, changes nothing and does not call `close_all`.
11. A test message that contains the key is returned with the key replaced by `…` (recorder returns `(False, "bad key test-key-NEWNEW1234 here")` for a request with that key).
12. `remove-key`: 200, `has_key` false, `masked_key == ""`, `.env` has `MODEL_API_KEY=` with nothing after the equals sign, `close_all` called once.
13. `RunRegistry.any_running`: false on a fresh `RunRegistry()`; true after you put a `Run(...)` with `finished=False` into `registry._runs`; false when `finished=True` (build `Run` the way `tests/test_agent_runs.py` does; read that file first).
14. The existing route `POST /api/ai/privacy` still works (one quick call, `.env` redirected to `tmp_path`).

## Verify
1. `cd vitagraph/backend && .venv\Scripts\python.exe -m pytest tests/test_env_writer.py tests/test_ai_model_connection.py tests/test_ai_privacy.py tests/test_agent_runs.py tests/test_agent_route.py -q -p no:cacheprovider` (paste the last 3 lines).
2. Full suite once at the end: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` (755 passed before this task; expect 755 plus your new tests, nothing failing; takes about 6 minutes; paste the last line).
3. Real `.env` untouched: paste `(Get-Item vitagraph\backend\.env).LastWriteTime` from before your first edit and after the full suite. They must be equal.

## Live check (scratch server, fake model; do it after the full suite)
1. Create a scratch folder `C:\Users\Admin\AppData\Local\Temp\claude\F--kiruthika-kiruthika-final-project\786634aa-bb5c-4969-adcc-2b21ab433542\scratchpad\t1live` (or any folder under your own temp dir) with an EMPTY file `scratch.env`.
2. Fake model server (write it in that folder, port 8099, Python `http.server`): `POST /v1/responses` replies JSON `{"output_text": "OK"}`; `POST /v1/chat/completions` replies `{"choices":[{"message":{"content":"OK"}}]}`; any other path 404; it records the `Authorization` header it received in a list so you can check the key arrived.
3. Start the scratch backend with ALL of these set (a missing one would use the real data or the real `.env`): `DATA_DIR`, `DB_PATH`, `CHROMA_DIR`, `UPLOADS_DIR` (all inside the scratch folder), `VITAGRAPH_ENV_FILE=<scratch>\scratch.env`, `MODEL_API_KEY=`, `MODEL_API_URL=`, `MODEL_NAME=` (empty), `ALLOW_API=false`, `BACKEND_URL=http://127.0.0.1:8001`, then `.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001` from `vitagraph/backend`. First `GET http://127.0.0.1:8001/api/health` must show `"chunks": 0` (proof that it is not the real data).
4. With curl/PowerShell against 8001 prove: GET before (has_key false, url ""), test with the fake (ok true, the fake saw `Bearer <the key>`), save (200, `scratch.env` has the five MODEL_ lines, GET now shows `masked_key` with the last 4 only), a wrong URL (`http://127.0.0.1:8099/nothing`) gives 422 and `scratch.env` is unchanged, a remote-style call is not possible locally so skip it, remove-key (`scratch.env` has `MODEL_API_KEY=`). Paste the outputs with the key replaced by `<KEY>`.
5. Stop the scratch backend and the fake server (ports 8001 and 8099 free; check with `Get-NetTCPConnection`). Delete nothing else.

## Report (write `gemini/reports/T1_summary.md`, then tell the owner)
Headings: Status (COMPLETE | PARTIAL | BLOCKED), Files changed (from `git diff --numstat` for the three edited files + the two new test files with line counts), Ladder results, Test output (pasted), `.env` timestamps, Live check (pasted, key redacted), Deviations (none unless you had to), Open points, Branch proof (`git branch --show-current`, `git status --short`). Believe the output when it contradicts the checklist; say PARTIAL when evidence is partial; never claim a check you did not run.
