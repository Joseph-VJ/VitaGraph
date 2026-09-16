import urllib.request
import json
import threading
import time

job_id = "test_stream_003"

def ask():
    time.sleep(0.5)
    data = json.dumps({
        "user_id": "VG-2026-001",
        "text": "What is my hemoglobin level?",
        "job_id": job_id
    }).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/questions",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        print("Ask response code:", resp.status)

t = threading.Thread(target=ask)
t.start()

req = urllib.request.Request(f"http://127.0.0.1:8000/api/jobs/{job_id}/events")
print("Connecting to SSE stream...")
with urllib.request.urlopen(req, timeout=10) as resp:
    for line in resp:
        decoded = line.decode("utf-8").strip()
        if decoded:
            print("SSE LINE:", decoded)
        if '"stage": "done"' in decoded:
            print("Received done stage, exiting.")
            break

t.join()
print("SSE Stream test successfully completed.")
