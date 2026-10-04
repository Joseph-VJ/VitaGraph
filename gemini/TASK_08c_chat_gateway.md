# TASK 08c: make the chat work against the real AI gateway (backend micro-task, unblocks the Ask page)

Read `gemini/RULES.md` first (branch guard 3b, report 5, **work report file 5b**, **quality bar 5c**). Read `gemini/reviews/TASK_08b_review.md` and obey it (compare what you see with what the API says; paste raw output).

This is the fourth and last backend micro-task before the Ask page. After it, `POST /api/chat/stream` is proven to work against the real gateway.

## Why (found by the reviewer with real experiments on the live gateway)
The chat endpoint kept failing with `content-blocked`. The reviewer ran a test matrix against the real gateway (read-only, no data stored). Facts:
1. The gateway's content filter is **deterministic but arbitrary**. `What was my hemoglobin?` is blocked every time (3 of 3), `Is my vitamin D low?` too, while `Hello` and `Explain that in one sentence` pass. The system prompt and the tools are NOT the cause (bisected).
2. The same words pass when slightly rephrased: `User message: What was my hemoglobin?` passes; `What was my hemoglobin? Please.` passes. But a fixed prefix is not a universal fix: `Question: Hello` is blocked while `Hello` passes.
3. So the current "retry once with the identical text" in `_stream_with_fallback` (`app/services/chat_service.py`) can never succeed for a blocked text, and the code then wrongly jumps to the next model, which is blocked too.
4. Second, smaller defect seen in real output: the text the model writes BEFORE a tool call runs straight into the answer (`...from your reports.I found two hemoglobin results...`), because the rounds are joined with nothing in between.

Fix: (A) when a message is blocked, retry the SAME model with the last user message rephrased (up to three rephrasings), remember the rephrasing that worked for the later tool rounds, and only then move to the next model; (B) put a paragraph break between the text before a tool call and the text after it.

## Files you may change (closed list)
1. `vitagraph/backend/app/services/chat_service.py` (three edits below)
2. NEW `vitagraph/backend/tests/test_chat_blocked.py`
3. NEW `gemini/reports/TASK_08c_report.md`

Never edit an existing test. Never edit anything else. NEVER print, paste or commit `vitagraph/backend/.env` or any key.

## Step 0: guard and baseline
```
git branch --show-current
cd "F:\kiruthika\kiruthika final project\vitagraph\backend"
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```
Branch must be `redesign/modernist-app`. The suite must end with `98 passed`. If not, STOP and write the report file (BLOCKED).

## Step 1: write the tests FIRST
Create `vitagraph/backend/tests/test_chat_blocked.py` with exactly this content:
```python
"""The gateway's content filter blocks some ordinary messages; the chat must rephrase and retry, not fail."""

from __future__ import annotations

import httpx
from openai import BadRequestError

from app.core.config import settings
from app.services import llm_service
from tests.test_chat_stream import _Chunk, _Delta, _ToolCall, _collect, _enable_ai, _persona_with_report

QUESTION = "What was my hemoglobin?"


def _blocked() -> BadRequestError:
    req = httpx.Request("POST", "http://gateway/v1/chat/completions")
    return BadRequestError("content-blocked (request id: x)", response=httpx.Response(400, request=req), body=None)


def _last_user(messages: list[dict]) -> str:
    return [m for m in messages if m["role"] == "user"][-1]["content"]


def _answer_stream(text: str):
    async def s():
        yield _Chunk(_Delta(content=text))
    return s()


def test_a_blocked_message_is_retried_rephrased_on_the_same_model(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    sent: list[tuple[str, str]] = []

    async def fake_call(client_, messages, model, tools=None):
        text = _last_user(messages)
        sent.append((model, text))
        if text == QUESTION:
            raise _blocked()
        return _answer_stream("Your hemoglobin is in the report.")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    kinds = [k for k, _ in events]
    assert kinds[-1] == "completed" and "model_fallback" not in kinds and "error" not in kinds
    assert sent[0][1] == QUESTION
    assert sent[1][1] == "User message: " + QUESTION
    assert sent[0][0] == sent[1][0], "still the same model"


def test_when_every_rephrasing_is_blocked_the_next_model_is_tried(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    first = settings.effective_model
    sent: list[str] = []

    async def fake_call(client_, messages, model, tools=None):
        sent.append(model)
        if model == first:
            raise _blocked()
        return _answer_stream("Answer from the backup engine.")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    kinds = [k for k, _ in events]
    assert "model_fallback" in kinds and kinds[-1] == "completed"
    assert sent.count(first) == 4, "as typed plus three rephrasings, then the next model"


def test_later_tool_rounds_start_from_the_rephrasing_that_worked(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    sent: list[str] = []
    passed = {"n": 0}

    async def fake_call(client_, messages, model, tools=None):
        text = _last_user(messages)
        sent.append(text)
        if text == QUESTION:
            raise _blocked()
        passed["n"] += 1
        if passed["n"] == 1:
            async def first():
                yield _Chunk(_Delta(tool_calls=[_ToolCall(0, "call_1", "search_chroma", '{"query": "Hemoglobin"}')]))
            return first()
        return _answer_stream("Done [1].")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    assert events[-1][0] == "completed"
    assert sent.count(QUESTION) == 1, "only the very first attempt used the blocked wording"
    assert len(sent) == 3


def test_other_bad_requests_are_not_retried(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    calls: list[int] = []

    async def fake_call(client_, messages, model, tools=None):
        calls.append(1)
        req = httpx.Request("POST", "http://gateway/v1/chat/completions")
        raise BadRequestError("invalid tool schema", response=httpx.Response(400, request=req), body=None)

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    assert events[-1][0] == "error"
    assert len(calls) == 1


def test_text_before_a_tool_call_is_separated_from_the_answer(monkeypatch):
    _enable_ai(monkeypatch)
    user = _persona_with_report()
    calls = {"n": 0}

    async def fake_call(client_, messages, model, tools=None):
        calls["n"] += 1
        if calls["n"] == 1:
            async def first():
                yield _Chunk(_Delta(content="Let me check your reports."))
                yield _Chunk(_Delta(tool_calls=[_ToolCall(0, "call_1", "search_chroma", '{"query": "Hemoglobin"}')]))
            return first()
        return _answer_stream("Your hemoglobin is listed [1].")

    monkeypatch.setattr(llm_service, "_call_agentrouter_stream", fake_call)
    events = _collect(user["id"], [{"role": "user", "content": QUESTION}])
    done = events[-1][1]
    assert done["summary_text"] == "Let me check your reports.\n\nYour hemoglobin is listed [1]."
    streamed = "".join(d["delta"] for k, d in events if k == "text_delta")
    assert streamed == done["summary_text"]
```
Run only this file: `.venv\Scripts\python.exe -m pytest tests/test_chat_blocked.py -q -p no:cacheprovider`
Expected: **4 failed, 1 passed** (the 4th test, `test_other_bad_requests_are_not_retried`, passes already; it guards that unrelated errors are not retried). Paste the last 10 lines. If the numbers differ, STOP and report BLOCKED.

## Step 2: the three edits in `vitagraph/backend/app/services/chat_service.py`

### Edit 1: helpers (new code, placed directly ABOVE the line `async def _stream_with_fallback(`)
Insert exactly this block (it ends with two blank lines before `async def _stream_with_fallback(`):
```python
# The gateway's content filter rejects some ordinary messages and accepts the same words slightly rephrased
# (checked live: "What was my hemoglobin?" is blocked, "User message: What was my hemoglobin?" passes). The filter
# is deterministic for a given text, so retrying the identical text never helps; each retry wraps the LAST user
# message differently instead. Only the copy sent to the model changes, never the stored conversation.
_BLOCK_VARIANTS = (
    lambda text: text,
    lambda text: f"User message: {text}",
    lambda text: f"{text} Please.",
    lambda text: f"Question: {text}",
)


def _wrap_last_user_message(messages: list[dict], variant: int) -> list[dict]:
    if variant == 0:
        return messages
    wrapped = [dict(m) for m in messages]
    for i in range(len(wrapped) - 1, -1, -1):
        if wrapped[i].get("role") == "user":
            wrapped[i]["content"] = _BLOCK_VARIANTS[variant](str(wrapped[i].get("content", "")))
            break
    return wrapped


```

### Edit 2: replace the whole function `_stream_with_fallback`
Delete the existing function `_stream_with_fallback` completely (from its line `async def _stream_with_fallback(` down to the line before `def _run_tool(`), and put exactly this in its place (two blank lines after it, before `def _run_tool(`):
```python
async def _stream_with_fallback(client: Any, messages: list[dict], tools: list[dict] | None, state: dict):
    """Stream one model call. A "content-blocked" rejection is retried with a rephrased last user message;
    402/403/404/429 (or every rephrasing blocked) moves to the next model in the verified chain."""
    candidates = [state["model"]] + [m for m in settings.model_chain if m != state["model"]]
    for idx, model in enumerate(candidates):
        first_variant = state.get("variant", 0) if state.get("variant_model") == model else 0
        for variant in range(first_variant, len(_BLOCK_VARIANTS)):
            emitted = False
            try:
                state["model"] = model
                stream = await llm_service._call_agentrouter_stream(
                    client, _wrap_last_user_message(messages, variant), model=model, tools=tools
                )
                async for chunk in stream:
                    emitted = True
                    yield ("chunk", chunk)
                state["variant"], state["variant_model"] = variant, model
                return
            except (PermissionDeniedError, NotFoundError, RateLimitError, APIStatusError) as exc:
                code = getattr(exc, "status_code", None)
                blocked = "content-blocked" in str(exc)
                if blocked and not emitted and variant + 1 < len(_BLOCK_VARIANTS):
                    continue
                can_fall_back = isinstance(exc, (PermissionDeniedError, NotFoundError, RateLimitError)) or code in (
                    400, 402, 403, 404, 429) and (blocked or code != 400)
                if can_fall_back and not emitted and idx + 1 < len(candidates):
                    yield ("model_fallback", {"from": model, "to": candidates[idx + 1], "reason": str(exc)})
                    break
                raise


```

### Edit 3: paragraph break between rounds (three small changes inside `stream_chat`)
3a. Find these two lines (they exist once):
```python
    shown: list[str] = []
    try:
```
and change them to:
```python
    shown: list[str] = []
    needs_break = False
    try:
```
3b. Find these two lines (they exist once):
```python
                if delta.content:
                    round_text.append(delta.content)
```
and change them to:
```python
                if delta.content:
                    if needs_break:
                        shown.append("\n\n")
                        yield ("text_delta", {"delta": "\n\n"})
                        needs_break = False
                    round_text.append(delta.content)
```
3c. Find this line (it exists once, inside the tool loop, indented 16 spaces):
```python
                messages.append({"role": "tool", "tool_call_id": call_id, "content": json.dumps(result)})
```
and add directly BELOW it, indented 12 spaces (so it runs once after ALL tool results of the round, one level left of the line above):
```python
            needs_break = bool(shown)
```
If any "find" text does not exist exactly once, STOP and report BLOCKED.

## Step 3: verify
1. `.venv\Scripts\python.exe -m pytest tests/test_chat_blocked.py -q -p no:cacheprovider` must print `5 passed`.
2. The existing chat tests: `.venv\Scripts\python.exe -m pytest tests/test_chat_stream.py -q -p no:cacheprovider` must print `9 passed` (paste it).
3. The whole suite: `.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider` must end with `103 passed` (98 + 5). If ANY existing test fails: do NOT edit it; undo with `git checkout -- vitagraph/backend/app/services/chat_service.py`, STOP, write the report (BLOCKED).
4. **Live check against the real gateway (read-only: it stores nothing).** Save the script below as `$env:TEMP\live_chat_t08c.py` (NOT in the repo) and run it from `vitagraph\backend` with `.venv\Scripts\python.exe $env:TEMP\live_chat_t08c.py`. It calls the chat logic directly with the persona `usr_d1d7f9b2a4b1` and three messages that used to be blocked or that need memory:
```python
import asyncio, sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, r"F:\kiruthika\kiruthika final project\vitagraph\backend")
from app.services import chat_service

UID = "usr_d1d7f9b2a4b1"


async def turn(turns):
    text, final, fallbacks = [], None, 0
    async for kind, data in chat_service.stream_chat(UID, turns):
        if kind == "text_delta":
            text.append(data["delta"])
        if kind == "model_fallback":
            fallbacks += 1
        if kind in ("completed", "error"):
            final = data
    return "".join(text), final, fallbacks


async def main():
    q1 = "What was my hemoglobin?"
    a1, f1, fb1 = await turn([{"role": "user", "content": q1}])
    print("TURN 1", f1.get("status"), "evidence:", f1.get("evidence_count"), "ai:", f1.get("ai_status"), "fallbacks:", fb1)
    print("   ", a1[:260].replace("\n", " "))
    a2, f2, fb2 = await turn([{"role": "user", "content": q1}, {"role": "assistant", "content": a1}, {"role": "user", "content": "Explain that in one sentence"}])
    print("TURN 2", f2.get("status"), "ai:", f2.get("ai_status"), "fallbacks:", fb2)
    print("   ", a2[:260].replace("\n", " "))
    a3, f3, fb3 = await turn([{"role": "user", "content": "Is my vitamin D low?"}])
    print("TURN 3", f3.get("status"), "safety_passed:", f3.get("safety_passed"), "fallbacks:", fb3)
    print("   ", a3[:260].replace("\n", " "))


asyncio.run(main())
```
Expected: all three turns print `answered` with `ai: ok` (turn 3 prints `safety_passed: True`); turn 1 has `evidence: 2` or more; the answers mention the real values (hemoglobin 13.8 and 14.1 g/dL; vitamin D 18 and 34 ng/mL); no turn is an error. Text before a tool call is followed by a space or blank line, never glued to the next sentence. Paste the whole output. The wording of the answers may differ from run to run, the statuses must not. If a turn returns `error`, paste it and STOP (report PARTIAL): do not change anything else. After the run delete the temp script.
5. `git status --short vitagraph/backend` lists only `chat_service.py` (modified) and `tests/test_chat_blocked.py` (new). `.env` is ignored by git; do not touch it.

## Step 4: work report
Write `gemini/reports/TASK_08c_report.md` with the nine headings of RULES 5b. Section 6 must say whether any live answer contradicted the data you can see in the Library API (`/api/reports/<id>/measurements`). Section 3 line counts must be copied from `git diff --stat`.

## COMMIT
Stage ONLY these three paths by explicit path:
```
git add vitagraph/backend/app/services/chat_service.py vitagraph/backend/tests/test_chat_blocked.py gemini/reports/TASK_08c_report.md
git commit -m "fix(backend): chat retries a blocked message rephrased; paragraph break between tool rounds"
git show --stat HEAD
git branch --show-current
git log --oneline -3
```
`git show --stat HEAD` must list exactly those three files.

## ACCEPTANCE (PASS/FAIL each with evidence)
- Tests 1, 2, 3 and 5 failed before the edits (4 failed, 1 passed) and all 5 pass after.
- Existing chat tests `9 passed`; full suite `103 passed`; no existing test file changed.
- Live: three turns answered with `ai: ok`, no error, answers match the real data, memory works in turn 2.
- Temp script deleted; `.env` untouched.
- Report file exists with all nine headings and is in the commit. Branch `redesign/modernist-app`; exactly three files in the commit.
