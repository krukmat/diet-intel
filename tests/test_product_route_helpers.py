import builtins
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes import product as product_routes


def _make_app():
    app = FastAPI()
    app.include_router(product_routes.router, prefix="/product")
    return app


@pytest.mark.asyncio
async def test_normalize_legacy_ocr_result_non_dict():
    assert product_routes._normalize_legacy_ocr_result([], default_engine="x") is None


@pytest.mark.asyncio
async def test_normalize_legacy_ocr_result_serving_info_confidence():
    payload = {
        "serving_info": {"detected": "250g", "unit": "g"},
        "confidence": "bad",
        "parsed_nutriments": {"energy_kcal": 100},
    }
    normalized = product_routes._normalize_legacy_ocr_result(payload, default_engine="legacy")
    assert normalized["confidence"] == 0.0
    assert normalized["serving_info"]["detected"] == "250g"


@pytest.mark.asyncio
async def test_run_local_ocr_legacy_pipeline(monkeypatch):
    async def _no_ocr(*args, **kwargs):
        return None

    class _LegacyService:
        def extract_text(self, image_path):
            return "Calories 100"

    class _LegacyParser:
        def parse_nutrition_text(self, text):
            return {"nutrition_data": {"energy_kcal": 100}}

    legacy_ocr = SimpleNamespace(
        ocr_service=_LegacyService(),
        nutrition_parser=_LegacyParser(),
    )

    monkeypatch.setattr(product_routes, "extract_nutrients_from_image", _no_ocr)
    monkeypatch.setattr(product_routes, "_import_legacy_ocr", lambda: legacy_ocr)

    result = await product_routes._run_local_ocr("dummy.jpg")
    assert result["processing_details"]["ocr_engine"] == "legacy_ocr"


@pytest.mark.asyncio
async def test_run_local_ocr_legacy_extract_nutrients(monkeypatch):
    async def _no_ocr(*args, **kwargs):
        return None

    class _LegacyService:
        def extract_nutrients(self, image_path):
            return {"raw_text": "", "parsed_nutriments": {"energy_kcal": 20}}

    legacy_ocr = SimpleNamespace(ocr_service=_LegacyService())

    monkeypatch.setattr(product_routes, "extract_nutrients_from_image", _no_ocr)
    monkeypatch.setattr(product_routes, "_import_legacy_ocr", lambda: legacy_ocr)
    monkeypatch.setattr(product_routes, "_run_legacy_text_pipeline", AsyncMock(return_value=None))

    result = await product_routes._run_local_ocr("dummy.jpg")
    assert result["processing_details"]["ocr_engine"] == "legacy_ocr"


@pytest.mark.asyncio
async def test_parse_text_with_legacy_parser_handles_non_dict(monkeypatch):
    class _LegacyParser:
        def parse_nutrition_text(self, text):
            return ["bad"]

    legacy_ocr = SimpleNamespace(nutrition_parser=_LegacyParser())
    result = await product_routes._parse_text_with_legacy_parser(
        legacy_ocr, "text", engine_label="legacy"
    )
    assert result["parsed_nutriments"] == {}


@pytest.mark.asyncio
async def test_parse_text_with_legacy_parser_awaitable(monkeypatch):
    async def _parse(text):
        return {"nutrition_data": {"protein_g": 5}}

    class _LegacyParser:
        def parse_nutrition_text(self, text):
            return _parse(text)

    legacy_ocr = SimpleNamespace(nutrition_parser=_LegacyParser())
    result = await product_routes._parse_text_with_legacy_parser(
        legacy_ocr, "text", engine_label="legacy"
    )
    assert result["parsed_nutriments"]["protein_g"] == 5


@pytest.mark.asyncio
async def test_normalize_external_payload_from_text(monkeypatch):
    class _LegacyParser:
        def parse_nutrition_text(self, text):
            return {"nutrition_data": {"energy_kcal": 50}}

    legacy_ocr = SimpleNamespace(nutrition_parser=_LegacyParser())
    result = await product_routes._normalize_external_payload(
        "Calories 50", legacy_ocr, engine_label="external_ocr"
    )
    assert result["processing_details"]["ocr_engine"] == "external_ocr"


@pytest.mark.asyncio
async def test_normalize_external_payload_unknown_type():
    result = await product_routes._normalize_external_payload(
        123, None, engine_label="external_ocr"
    )
    assert result is None


def test_get_httpx_attr_mock_returns_fallback():
    httpx_module = product_routes._MockType()
    fallback = Exception
    assert product_routes._get_httpx_attr(httpx_module, "TimeoutException", fallback) is fallback


def test_coerce_exception_class_non_exception():
    assert product_routes._coerce_exception_class(object()) is Exception


def test_coerce_exception_class_mock():
    assert product_routes._coerce_exception_class(product_routes._MockType()) is Exception


def test_route_post_with_mock_decorator(monkeypatch):
    mock_decorator = Mock()
    monkeypatch.setattr(product_routes.router, "post", Mock(return_value=mock_decorator))

    decorator = product_routes._route_post("/fake")

    def _target():
        return "ok"

    assert decorator(_target) is _target


@pytest.mark.asyncio
async def test_write_bytes_to_tempfile_with_context(monkeypatch, tmp_path):
    path = tmp_path / "image.bin"

    class _Writer:
        async def write(self, data):
            path.write_bytes(data)

    class _Context:
        async def __aenter__(self):
            return _Writer()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(product_routes.aiofiles, "open", lambda *args, **kwargs: _Context())

    await product_routes._write_bytes_to_tempfile(str(path), b"data")
    assert path.read_bytes() == b"data"


@pytest.mark.asyncio
async def test_write_bytes_to_tempfile_no_aiofiles_open(monkeypatch, tmp_path):
    path = tmp_path / "image.bin"
    monkeypatch.setattr(product_routes.aiofiles, "open", None)
    await product_routes._write_bytes_to_tempfile(str(path), b"data")
    assert path.read_bytes() == b"data"


def test_import_legacy_ocr_handles_import_error(monkeypatch):
    original_import = builtins.__import__

    def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "app.services" and "ocr" in fromlist:
            raise ImportError("nope")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", _fake_import)
    assert product_routes._import_legacy_ocr() is None


def test_get_legacy_helpers_with_none():
    assert product_routes._get_legacy_service(None) is None
    assert product_routes._get_legacy_text_extractor(None) is None


@pytest.mark.asyncio
async def test_run_legacy_text_pipeline_no_extractor():
    legacy_ocr = SimpleNamespace(ocr_service=None)
    result = await product_routes._run_legacy_text_pipeline(legacy_ocr, "dummy.jpg")
    assert result is None


@pytest.mark.asyncio
async def test_run_legacy_text_pipeline_awaits_extractor(monkeypatch):
    async def _extract(path):
        return "Calories 10"

    class _LegacyService:
        def extract_text(self, image_path):
            return _extract(image_path)

    class _LegacyParser:
        def parse_nutrition_text(self, text):
            return {"nutrition_data": {"energy_kcal": 10}}

    legacy_ocr = SimpleNamespace(
        ocr_service=_LegacyService(),
        nutrition_parser=_LegacyParser(),
    )

    result = await product_routes._run_legacy_text_pipeline(legacy_ocr, "dummy.jpg")
    assert result["parsed_nutriments"]["energy_kcal"] == 10


@pytest.mark.asyncio
async def test_parse_text_with_legacy_parser_none_callable():
    legacy_ocr = SimpleNamespace(nutrition_parser=None)
    result = await product_routes._parse_text_with_legacy_parser(
        legacy_ocr, "text", engine_label="legacy"
    )
    assert result is None


def test_barcode_length_exceeds_limit(monkeypatch):
    app = _make_app()
    client = TestClient(app)
    payload = {"barcode": "A" * 257}
    response = client.post("/product/by-barcode", json=payload)
    assert response.status_code == 422
    assert "exceeds maximum length" in response.json()["detail"]


def test_barcode_api_error_branch(monkeypatch):
    app = _make_app()
    client = TestClient(app)

    class _FailingClient:
        async def get_product(self, barcode):
            raise RuntimeError("boom")

    monkeypatch.setattr(product_routes, "_get_openfoodfacts_backend", lambda: _FailingClient())
    monkeypatch.setattr(product_routes.analytics_service, "log_product_lookup", AsyncMock())

    response = client.post("/product/by-barcode", json={"barcode": "12345"})
    assert response.status_code == 503
    assert "temporarily unavailable" in response.json()["detail"]


def test_scan_label_cleanup_file_not_found(monkeypatch):
    app = _make_app()
    client = TestClient(app)

    ocr_result = {
        "raw_text": "calories",
        "parsed_nutriments": {},
        "confidence": 0.8,
        "processing_details": {},
    }
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=ocr_result))
    monkeypatch.setattr(product_routes.analytics_service, "log_ocr_scan", AsyncMock())
    monkeypatch.setattr(product_routes.os, "unlink", Mock(side_effect=FileNotFoundError()))

    response = client.post(
        "/product/scan-label",
        files={"image": ("label.jpg", BytesIO(b"img"), "image/jpeg")},
    )
    assert response.status_code == 200


def test_scan_label_external_missing_file():
    app = _make_app()
    client = TestClient(app)

    response = client.post("/product/scan-label-external")
    assert response.status_code == 422


def test_scan_label_external_fallback_hook_failure(monkeypatch):
    app = _make_app()
    client = TestClient(app)

    ocr_result = {
        "raw_text": "calories",
        "parsed_nutriments": {},
        "confidence": 0.6,
        "processing_details": {},
    }

    monkeypatch.setattr(product_routes, "_import_legacy_ocr", lambda: None)
    monkeypatch.setattr(product_routes, "call_external_ocr", Mock(side_effect=RuntimeError("fail")))
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=ocr_result))
    monkeypatch.setattr(product_routes.analytics_service, "log_ocr_scan", AsyncMock())

    response = client.post(
        "/product/scan-label-external",
        files={"image": ("label.jpg", BytesIO(b"img"), "image/jpeg")},
    )
    assert response.status_code == 200


def test_scan_label_external_processing_error(monkeypatch):
    app = _make_app()
    client = TestClient(app)

    monkeypatch.setattr(product_routes, "_import_legacy_ocr", lambda: None)
    monkeypatch.setattr(product_routes, "call_external_ocr", Mock(return_value=None))
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(side_effect=RuntimeError("boom")))
    monkeypatch.setattr(product_routes.analytics_service, "log_ocr_scan", AsyncMock())

    response = client.post(
        "/product/scan-label-external",
        files={"image": ("label.jpg", BytesIO(b"img"), "image/jpeg")},
    )
    assert response.status_code == 500


def test_scan_label_external_cleanup_os_error(monkeypatch):
    app = _make_app()
    client = TestClient(app)

    ocr_result = {
        "raw_text": "calories",
        "parsed_nutriments": {},
        "confidence": 0.8,
        "processing_details": {},
    }
    monkeypatch.setattr(product_routes, "_import_legacy_ocr", lambda: None)
    monkeypatch.setattr(product_routes, "call_external_ocr", Mock(return_value=None))
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=ocr_result))
    monkeypatch.setattr(product_routes.analytics_service, "log_ocr_scan", AsyncMock())
    monkeypatch.setattr(product_routes.os, "unlink", Mock(side_effect=OSError("nope")))

    response = client.post(
        "/product/scan-label-external",
        files={"image": ("label.jpg", BytesIO(b"img"), "image/jpeg")},
    )
    assert response.status_code == 200


def test_scan_label_external_cleanup_file_not_found(monkeypatch):
    app = _make_app()
    client = TestClient(app)

    ocr_result = {
        "raw_text": "calories",
        "parsed_nutriments": {},
        "confidence": 0.8,
        "processing_details": {},
    }
    monkeypatch.setattr(product_routes, "_import_legacy_ocr", lambda: None)
    monkeypatch.setattr(product_routes, "call_external_ocr", Mock(return_value=None))
    monkeypatch.setattr(product_routes, "_run_local_ocr", AsyncMock(return_value=ocr_result))
    monkeypatch.setattr(product_routes.analytics_service, "log_ocr_scan", AsyncMock())
    monkeypatch.setattr(product_routes.os, "unlink", Mock(side_effect=FileNotFoundError()))

    response = client.post(
        "/product/scan-label-external",
        files={"image": ("label.jpg", BytesIO(b"img"), "image/jpeg")},
    )
    assert response.status_code == 200
