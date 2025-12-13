from app.utils.rate_limiter import RateLimiter


class FakeClock:
    """Simulates time progress for deterministic rate-limiter tests."""

    def __init__(self, start: float = 1_000.0):
        self.current = start

    def advance(self, seconds: float) -> None:
        self.current += seconds

    def time(self) -> float:
        return self.current


def test_allow_grants_requests_until_limit(monkeypatch):
    clock = FakeClock()
    monkeypatch.setattr("app.utils.rate_limiter.time.time", clock.time)
    limiter = RateLimiter(max_requests=2, window_seconds=10)

    assert limiter.allow("user-123")
    assert limiter.allow("user-123")
    assert not limiter.allow("user-123")


def test_allow_resets_after_window(monkeypatch):
    clock = FakeClock()
    monkeypatch.setattr("app.utils.rate_limiter.time.time", clock.time)
    limiter = RateLimiter(max_requests=1, window_seconds=5)

    assert limiter.allow("user-123")
    assert not limiter.allow("user-123")

    clock.advance(6)
    assert limiter.allow("user-123")


def test_reset_clears_state(monkeypatch):
    clock = FakeClock()
    monkeypatch.setattr("app.utils.rate_limiter.time.time", clock.time)
    limiter = RateLimiter(max_requests=1, window_seconds=10)

    assert limiter.allow("user-123")
    limiter.reset()
    assert limiter.allow("user-123")
