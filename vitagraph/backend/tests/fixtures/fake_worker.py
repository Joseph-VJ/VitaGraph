"""Fake worker process fixture speaking the agent runtime protocol without the SDK."""

from __future__ import annotations

import json
import os
import sys
import time

TOOL_NAMES = (
    "mcp__vitagraph__get_measurements",
    "mcp__vitagraph__graph_lookup",
    "mcp__vitagraph__list_reports",
    "mcp__vitagraph__search_reports",
)


def main():
    mode = "normal"
    dump_file = None

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--mode" and i + 1 < len(args):
            mode = args[i + 1]
            i += 2
        elif args[i] == "--dump-file" and i + 1 < len(args):
            dump_file = args[i + 1]
            i += 2
        else:
            if dump_file is None and mode == "envdump":
                dump_file = args[i]
            i += 1

    if mode == "crash_on_start":
        sys.stderr.write("boom: intentional worker start crash\n")
        sys.stderr.flush()
        sys.exit(3)

    if mode == "envdump" and dump_file:
        data = {
            "names": sorted(os.environ.keys()),
            "env": dict(os.environ),
        }
        with open(dump_file, "w", encoding="utf-8") as f:
            json.dump(data, f)

    # Stdout hygiene: duplicate wire stdout, redirect fd 1 to stderr
    real_stdout_fd = os.dup(1)
    wire_out = open(real_stdout_fd, "w", encoding="utf-8", buffering=1)
    try:
        os.dup2(2, 1)
    except Exception:
        pass

    if mode == "noisy":
        # Print directly to fd 1 (which now points to stderr)
        sys.stderr.write("noisy stderr line\n")
        sys.stderr.flush()

    def send(msg: dict):
        line = json.dumps(msg, ensure_ascii=False)
        wire_out.write(line + "\n")
        wire_out.flush()

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
            send({"type": "ready"})
        elif cmd == "run":
            run_id = req.get("run_id", "run-1")
            session_id = req.get("session_id", "s-1")

            if mode == "slow":
                send({
                    "type": "notification",
                    "run_id": run_id,
                    "method": "session.event",
                    "payload": {
                        "sessionId": session_id,
                        "event": {"type": "turn/start", "data": {}},
                    },
                })
                for _ in range(300):
                    time.sleep(0.1)
                send({
                    "type": "result",
                    "run_id": run_id,
                    "final_response": "slow done",
                    "finish_reason": "stop",
                })
            elif mode == "badtools":
                bad_tools = [{"name": n} for n in TOOL_NAMES] + [{"name": "pwsh"}]
                send({
                    "type": "notification",
                    "run_id": run_id,
                    "method": "session.event",
                    "payload": {
                        "sessionId": session_id,
                        "event": {"type": "turn/start", "data": {}},
                    },
                })
                time.sleep(0.1)
                send({
                    "type": "notification",
                    "run_id": run_id,
                    "method": "session.event",
                    "payload": {
                        "sessionId": session_id,
                        "event": {
                            "type": "request/header",
                            "data": {"header": {"tools": bad_tools}},
                        },
                    },
                })
                time.sleep(0.1)
                send({
                    "type": "result",
                    "run_id": run_id,
                    "final_response": "bad done",
                    "finish_reason": "stop",
                })
            else:
                # normal, noisy, envdump
                time.sleep(0.3)
                send({
                    "type": "notification",
                    "run_id": run_id,
                    "method": "session.event",
                    "payload": {
                        "sessionId": session_id,
                        "event": {"type": "turn/start", "data": {}},
                    },
                })
                time.sleep(0.3)
                allowed_tools = [{"name": n} for n in TOOL_NAMES]
                send({
                    "type": "notification",
                    "run_id": run_id,
                    "method": "session.event",
                    "payload": {
                        "sessionId": session_id,
                        "event": {
                            "type": "request/header",
                            "data": {"header": {"tools": allowed_tools}},
                        },
                    },
                })
                time.sleep(0.3)
                send({
                    "type": "notification",
                    "run_id": run_id,
                    "method": "session.event",
                    "payload": {
                        "sessionId": session_id,
                        "event": {"type": "turn/end", "data": {}},
                    },
                })
                send({
                    "type": "result",
                    "run_id": run_id,
                    "final_response": "done",
                    "finish_reason": "stop",
                })
        elif cmd == "close":
            send({"type": "closed"})
            break

    wire_out.close()


if __name__ == "__main__":
    main()
