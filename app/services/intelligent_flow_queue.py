"""
In-memory job queue for Intelligent Flow executions.

Provides a light async wrapper so the API can enqueue long-running IA flows
without blocking the request/response cycle.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional

from app.models.intelligent_flow import IntelligentFlowRequest, IntelligentFlowResponse


@dataclass
class IntelligentFlowJob:
    """Job state stored in the in-memory queue."""

    id: str
    user_id: str
    status: str = "queued"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    result: Optional[IntelligentFlowResponse] = None
    error: Optional[str] = None

    def mark_running(self) -> None:
        self.status = "running"
        self.updated_at = datetime.utcnow()

    def mark_completed(self, result: IntelligentFlowResponse) -> None:
        self.status = "completed"
        self.result = result
        self.updated_at = datetime.utcnow()

    def mark_failed(self, error: str) -> None:
        self.status = "failed"
        self.error = error
        self.updated_at = datetime.utcnow()


class IntelligentFlowQueue:
    """Singleton-like queue that manages background execution of flows."""

    def __init__(self) -> None:
        self._jobs: Dict[str, IntelligentFlowJob] = {}
        self._lock = asyncio.Lock()

    async def enqueue(self, service, request: IntelligentFlowRequest) -> IntelligentFlowJob:
        """
        Enqueue a new intelligent flow job.

        Returns:
            IntelligentFlowJob: Job metadata (initially queued)
        """
        job_id = str(uuid.uuid4())
        job = IntelligentFlowJob(id=job_id, user_id=request.user_id)

        async with self._lock:
            self._jobs[job_id] = job

        async def runner() -> None:
            job.mark_running()
            try:
                result = await service.run_flow(request)
                job.mark_completed(result)
            except Exception as exc:  # pragma: no cover - defensive
                job.mark_failed(str(exc))

        loop = asyncio.get_running_loop()
        loop.create_task(runner())

        return job

    async def get(self, job_id: str) -> Optional[IntelligentFlowJob]:
        """Retrieve job metadata if it exists."""
        async with self._lock:
            return self._jobs.get(job_id)


intelligent_flow_queue = IntelligentFlowQueue()
