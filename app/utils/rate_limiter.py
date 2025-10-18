"""Rate limiter utilities for DietIntel backend."""

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict


class RateLimiter:
    """Rate limiter simple en memoria (pensado para pruebas locales / fallback sin Redis)."""

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._requests: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        """Check if request is allowed for given key.

        Args:
            key: Identifier for rate limiting (e.g., user ID)

        Returns:
            True if request is allowed, False if rate limit exceeded
        """
        now = time.time()
        with self._lock:
            queue = self._requests[key]
            # limpia eventos fuera de ventana
            while queue and queue[0] <= now - self._window_seconds:
                queue.popleft()
            if len(queue) >= self._max_requests:
                return False
            queue.append(now)
            return True

    def reset(self) -> None:
        """Sólo para pruebas: limpia el estado interno."""
        with self._lock:
            self._requests.clear()
