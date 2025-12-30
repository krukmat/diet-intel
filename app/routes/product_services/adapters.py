"""
HTTP and Backend Adapters

Provides adapters for HTTP client configuration, exception handling, and backend service access.
Task: Phase 1 Tarea 3 - Product Helpers Refactoring
"""

import sys
import logging
import inspect
from typing import Tuple, Type
from unittest.mock import Mock as _MockType

from fastapi import APIRouter, HTTPException, status
from app.services import cache as cache_module
from app.services import openfoodfacts as openfoodfacts_module
from app.services.cache import cache_service
from app.services.openfoodfacts import openfoodfacts_service
from app.services.auth import RequestContext

# Try to import aiofiles for backward compatibility with tests
try:
    import aiofiles
except ImportError:
    aiofiles = None

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────
# HTTP Exception and Client Management
# ─────────────────────────────────────────────────────────────


class _TimeoutProxy(Exception):
    """Sentinel used when httpx.TimeoutException is unavailable."""


class _RequestErrorProxy(Exception):
    """Sentinel used when httpx.RequestError is unavailable."""


try:
    import httpx as _httpx_module
except Exception:  # pragma: no cover - triggered when httpx missing
    _httpx_module = None

if isinstance(_httpx_module, _MockType) or _httpx_module is None:
    httpx = _httpx_module
    _HTTPX_TIMEOUT_CLASS = _TimeoutProxy
    _HTTPX_REQUEST_ERROR_CLASS = _RequestErrorProxy
else:
    httpx = _httpx_module
    _HTTPX_TIMEOUT_CLASS = getattr(httpx, 'TimeoutException', _TimeoutProxy)
    _HTTPX_REQUEST_ERROR_CLASS = getattr(httpx, 'RequestError', _RequestErrorProxy)


def _coerce_exception_class(candidate):
    """Coerce a candidate to a valid exception class, handling mocks."""
    if isinstance(candidate, _MockType):
        return Exception
    if isinstance(candidate, type) and issubclass(candidate, BaseException):
        return candidate
    return Exception


def _get_httpx_attr(httpx_module, attr_name: str, fallback):
    """Get an attribute from httpx module, honoring mocks."""
    if isinstance(httpx_module, _MockType) and attr_name not in httpx_module.__dict__:
        return fallback
    return getattr(httpx_module, attr_name, fallback)


def _get_httpx_exceptions() -> Tuple[Type[Exception], Type[Exception]]:
    """Return the active Timeout and RequestError classes honoring patched modules."""
    httpx_module = sys.modules.get('httpx', httpx)
    timeout_exc = _coerce_exception_class(
        _get_httpx_attr(
            httpx_module,
            'TimeoutException',
            _HTTPX_TIMEOUT_CLASS
        )
    )
    request_error_exc = _coerce_exception_class(
        _get_httpx_attr(
            httpx_module,
            'RequestError',
            _HTTPX_REQUEST_ERROR_CLASS
        )
    )
    return timeout_exc, request_error_exc


def _raise_http_exception(status_code: int, detail: str):
    """Create HTTPException, honoring FastAPI test doubles when present."""
    fastapi_module = sys.modules.get('fastapi')
    exc_cls = getattr(fastapi_module, 'HTTPException', HTTPException)
    return exc_cls(status_code=status_code, detail=detail)


def _is_http_exception(exc: Exception) -> bool:
    """Determine whether an exception is FastAPI's HTTPException or a patched variant."""
    fastapi_module = sys.modules.get('fastapi')
    exc_cls = getattr(fastapi_module, 'HTTPException', HTTPException)
    return isinstance(exc, exc_cls)


# ─────────────────────────────────────────────────────────────
# Backend Service Adapters
# ─────────────────────────────────────────────────────────────


def _get_cache_backend():
    """Get the active cache backend, honoring test doubles."""
    return getattr(cache_module, 'cache_service', cache_service)


def _get_openfoodfacts_backend():
    """Get the active OpenFoodFacts backend, honoring test doubles."""
    return getattr(openfoodfacts_module, 'openfoodfacts_service', openfoodfacts_service)


# ─────────────────────────────────────────────────────────────
# Request Context Helpers
# ─────────────────────────────────────────────────────────────


def _ensure_request_context(context: RequestContext) -> RequestContext:
    """Provide a safe fallback when route functions are invoked directly in tests."""
    if isinstance(context, RequestContext):
        return context
    # Any other type (including FastAPI Depends placeholders or mocks) -> anonymous context
    return RequestContext(user=None, session_id=None, token=None)


# ─────────────────────────────────────────────────────────────
# Route Decorator Helpers
# ─────────────────────────────────────────────────────────────


def _route_post(*args, **kwargs):
    """Create a POST route, honoring test doubles when router is mocked."""
    decorator = router.post(*args, **kwargs)
    if _MockType is not None and isinstance(decorator, _MockType):
        def _noop(func):
            return func
        return _noop
    return decorator


# ─────────────────────────────────────────────────────────────
# File Operations
# ─────────────────────────────────────────────────────────────


async def _write_bytes_to_tempfile(path: str, data: bytes):
    """Write upload bytes to disk, tolerating aiofiles mocks used in tests."""
    open_callable = getattr(aiofiles, 'open', None)
    if open_callable is None:
        with open(path, 'wb') as f:  # pragma: no cover - safety fallback
            f.write(data)
        return

    ctx = open_callable(path, 'wb')
    if inspect.isawaitable(ctx):
        ctx = await ctx

    if hasattr(ctx, '__aenter__'):
        async with ctx as f:
            write_result = f.write(data)
            if inspect.isawaitable(write_result):
                await write_result
        return

    # As a last resort, fall back to synchronous write.
    with open(path, 'wb') as f:  # pragma: no cover - safety fallback
        f.write(data)
