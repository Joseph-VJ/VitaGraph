"""Job lifecycle and Server-Sent Events (SSE) stream broker.

Implements plan Section 12 real pipeline event streaming. No fake timers,
no synthetic traces — events are published directly by the question flow
as each stage executes (retrieval, reranking, graph, generation, safety, citation, done).
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any, AsyncGenerator


class JobEventBroker:
    RETENTION_SECONDS: float = 600.0  # 10 minutes retention per US-15

    def __init__(self) -> None:
        # job_id -> dict with status, events list, and active subscriber queues
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock() if hasattr(asyncio, "Lock") else None

    def _prune_expired_jobs(self) -> None:
        """Prune jobs that have exceeded the 10-minute retention period."""
        now = time.time()
        expired = [
            jid for jid, j in self._jobs.items()
            if (now - j.get("created_at", now)) > self.RETENTION_SECONDS
        ]
        for jid in expired:
            self._jobs.pop(jid, None)

    def get_or_create_job(self, job_id: str | None = None) -> str:
        self._prune_expired_jobs()
        jid = job_id or f"job_{uuid.uuid4().hex[:12]}"
        if jid not in self._jobs:
            self._jobs[jid] = {
                "id": jid,
                "status": "running",
                "created_at": time.time(),
                "events": [],
                "subscribers": [],
                "result": None,
                "error": None,
            }
        return jid

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        self._prune_expired_jobs()
        return self._jobs.get(job_id)

    def set_job_result(self, job_id: str, result: Any) -> None:
        """Store final computation output in the job record."""
        if job_id in self._jobs:
            self._jobs[job_id]["result"] = result

    def publish_event(
        self,
        job_id: str,
        stage: str,
        description: str,
        sub_description: str = "",
        latency_ms: int = 0,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Publish a real processing stage event to the job event stream."""
        jid = self.get_or_create_job(job_id)
        job = self._jobs[jid]

        evt_index = f"{len(job['events']) + 1:02d}"
        event = {
            "index": evt_index,
            "stage": stage,
            "description": description,
            "subDescription": sub_description,
            "latency": f"{latency_ms} ms" if latency_ms else "",
            "timestamp": time.time(),
            "metadata": metadata or {},
        }
        job["events"].append(event)

        # Notify active streaming subscribers
        dead_subscribers = []
        for queue in job["subscribers"]:
            try:
                queue.put_nowait(event)
            except Exception:
                dead_subscribers.append(queue)
        for dead in dead_subscribers:
            if dead in job["subscribers"]:
                job["subscribers"].remove(dead)

        return event

    def complete_job(
        self,
        job_id: str,
        description: str = "Response completed",
        latency_ms: int = 0,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Mark job as completed and publish the terminal 'done' event."""
        if job_id not in self._jobs:
            self.get_or_create_job(job_id)
        self.publish_event(
            job_id,
            stage="done",
            description=description,
            sub_description="Pipeline executed successfully",
            latency_ms=latency_ms,
            metadata=metadata,
        )
        self._jobs[job_id]["status"] = "completed"
        if metadata:
            self._jobs[job_id]["result"] = metadata

    def fail_job(
        self,
        job_id: str,
        error_message: str,
        stage: str = "done",
    ) -> None:
        """Mark job as failed and emit termination event."""
        if job_id not in self._jobs:
            self.get_or_create_job(job_id)
        self.publish_event(
            job_id,
            stage=stage,
            description=f"Error: {error_message}",
            sub_description="Pipeline failed",
            metadata={"error": error_message},
        )
        self._jobs[job_id]["status"] = "error"
        self._jobs[job_id]["error"] = error_message

    def publish_error(self, job_id: str, error_message: str) -> None:
        """Alias for fail_job."""
        self.fail_job(job_id, error_message)

    async def event_generator(self, job_id: str) -> AsyncGenerator[str, None]:
        """Async generator yielding Server-Sent Events for a job."""
        jid = self.get_or_create_job(job_id)
        job = self._jobs[jid]

        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        job["subscribers"].append(queue)

        try:
            # Yield initial connection comment
            yield ": connected to pipeline stream\n\n"

            # Check if this connection is a replay of an already completed/past job
            is_replay = job.get("status") in ("completed", "error")

            # 1. Replay past events that were already recorded
            for past_event in list(job["events"]):
                event_payload = dict(past_event)
                if is_replay:
                    event_payload["is_replay"] = True
                data_str = json.dumps(event_payload)
                yield f"data: {data_str}\n\n"
                if past_event.get("stage") == "done":
                    return

            # If job is already completed and no more events, terminate
            if is_replay:
                return

            # 2. Stream new live events as they occur
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    data_str = json.dumps(event)
                    yield f"data: {data_str}\n\n"
                    if event.get("stage") == "done":
                        break
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat
                    yield ": keep-alive\n\n"
        finally:
            if queue in job["subscribers"]:
                job["subscribers"].remove(queue)


# Singleton broker instance
job_broker = JobEventBroker()
