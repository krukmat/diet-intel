from io import BytesIO

import pytest
from PIL import Image

from app.utils.image_processor import ImageProcessor


def _make_image(color=(100, 150, 200), size=(512, 512)):
    img = Image.new("RGB", size, color)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def test_validate_and_format():
    content = _make_image()
    assert ImageProcessor.validate_image_format(content)
    assert ImageProcessor.get_image_format(content) == "PNG"
    assert ImageProcessor.get_image_dimensions(content) == (512, 512)
    assert ImageProcessor.validate_image_size(content, max_size_mb=1)

def test_invalid_image_handled():
    content = b"not an image"
    assert not ImageProcessor.validate_image_format(content)
    assert ImageProcessor.get_image_format(content) is None
    assert ImageProcessor.get_image_dimensions(content) == (0, 0)
    assert not ImageProcessor.validate_image_resolution(content)

def test_optimize_and_thumbnail():
    content = _make_image(size=(2048, 1024))
    optimized = ImageProcessor.optimize_image_for_analysis(content, max_dimension=800)
    assert optimized

    thumbnail = ImageProcessor.generate_image_thumbnail(content, size=(100, 100))
    assert thumbnail
    dims = ImageProcessor.get_image_dimensions(thumbnail)
    assert dims[0] <= 100 and dims[1] <= 100

def test_metadata_and_hash():
    content = _make_image()
    metadata = ImageProcessor.get_image_metadata(content)
    assert metadata["valid"]
    assert metadata["dimensions"] == (512, 512)
    assert metadata["format"] == "PNG"
    assert metadata["resolution_ok"]
    assert metadata["hash"]

def test_save_and_cleanup_temp(monkeypatch):
    content = _make_image()
    assert ImageProcessor.save_image_temp(content, "analysis-1") is not None
    assert ImageProcessor.cleanup_temp_image("/tmp/mock.jpg")
