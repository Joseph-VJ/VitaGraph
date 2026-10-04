"""Standalone worker process hosting the DeepSeek Harness runtime."""

from __future__ import annotations

import json
import os
import sys

# Stdout hygiene: duplicate wire stdout, redirect fd 1 to stderr
real_stdout_fd = os.dup(1)
wire_stdout = open(real_stdout_fd, "w", encoding="utf-8", buffering=1)
try:
    os.dup2(2, 1)
except Exception:
    pass


def send(msg: dict) -> None:
    line = json.dumps(msg, ensure_ascii=False, default=str)
    wire_stdout.write(line + "\n")
    wire_stdout.flush()


def main() -> None:
    harness = None
    active_api_key: str | None = None

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception as exc:
            send({"type": "error", "message": f"Malformed request JSON: {exc}"})
            continue

        cmd = req.get("cmd")
        if cmd == "start":
            cfg = req.get("config", {})
            active_api_key = cfg.get("api_key")
            try:
                from deepseek_harness import DeepSeekHarness

                patches = tuple(cfg.get("patches", ()))
                harness = DeepSeekHarness(
                    profile=cfg.get("profile", "sdk-minimal"),
                    patches=patches,
                    dsh_home=cfg.get("dsh_home"),
                    cwd=cfg.get("cwd"),
                    model=cfg.get("model", "deepseek-v4-flash"),
                    base_url=cfg.get("base_url"),
                    api_key=active_api_key,
                    initialize_timeout_seconds=cfg.get("initialize_timeout_seconds", 30.0),
                )
                harness.start()
                send({"type": "ready"})
            except Exception as exc:
                msg = str(exc)
                if active_api_key:
                    msg = msg.replace(active_api_key, "***")
                send({"type": "error", "message": msg})

        elif cmd == "run":
            run_id = req.get("run_id", "run-default")
            session_id = req.get("session_id", "session-default")
            user_input = req.get("input", "")

            if harness is None:
                send({
                    "type": "run_error",
                    "run_id": run_id,
                    "message": "Worker harness not initialized",
                    "kind": "RuntimeError",
                })
                continue

            def on_notif(notif):
                payload = getattr(notif, "payload", {})
                if hasattr(payload, "model_dump"):
                    payload = payload.model_dump(mode="json")
                elif hasattr(payload, "dict"):
                    payload = payload.dict()
                send({
                    "type": "notification",
                    "run_id": run_id,
                    "method": getattr(notif, "method", ""),
                    "payload": payload,
                })

            try:
                res = harness.run(user_input, session_id=session_id, on_notification=on_notif)
                send({
                    "type": "result",
                    "run_id": run_id,
                    "final_response": getattr(res, "final_response", ""),
                    "finish_reason": getattr(res, "finish_reason", "stop"),
                })
            except Exception as exc:
                msg = str(exc)
                if active_api_key:
                    msg = msg.replace(active_api_key, "***")
                send({
                    "type": "run_error",
                    "run_id": run_id,
                    "message": msg,
                    "kind": type(exc).__name__,
                })

        elif cmd == "close":
            if harness:
                try:
                    harness.close()
                except Exception:
                    pass
                harness = None
            send({"type": "closed"})
            break

    if harness:
        try:
            harness.close()
        except Exception:
            pass
    wire_stdout.close()


if __name__ == "__main__":
    main()
