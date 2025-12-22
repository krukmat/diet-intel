import asyncio
import base64

import pytest

from app.models.intelligent_flow import IntelligentFlowRequest
from app.services.intelligent_flow_queue import IntelligentFlowQueue


class DummyService:
    def __init__(self, result=None, fail=False):
        self.result = result or {"status": "ok"}
        self.fail = fail
        self.calls = 0

    async def run_flow(self, request):
        self.calls += 1
        if self.fail:
            raise RuntimeError("boom")
        return self.result


def _make_request():
    return IntelligentFlowRequest.construct(
        user_id="user-1",
        image_base64=base64.b64encode(b"dummy").decode(),
        meal_type="lunch"
    )


@pytest.mark.asyncio
async def test_enqueue_marks_completed():
    queue = IntelligentFlowQueue()
    service = DummyService()
    request = _make_request()

    job = await queue.enqueue(service, request)
    await asyncio.sleep(0.01)

    stored = await queue.get(job.id)
    assert stored is not None
    assert stored.status == "completed"
    assert stored.result == service.result
    assert service.calls == 1


@pytest.mark.asyncio
async def test_enqueue_marks_failed_on_exception():
    queue = IntelligentFlowQueue()
    service = DummyService(fail=True)
    request = _make_request()

    job = await queue.enqueue(service, request)
    await asyncio.sleep(0.01)

    stored = await queue.get(job.id)
    assert stored is not None
    assert stored.status == "failed"
    assert "boom" in stored.error
