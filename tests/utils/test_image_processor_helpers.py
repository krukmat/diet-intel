import os
import tempfile

from app.utils.image_processor import save_temp_image, cleanup_temp_file


def test_save_temp_image_creates_file():
    content = b"fake-bytes"
    tmp_path = save_temp_image(content, suffix=".jpg")
    try:
        assert os.path.exists(tmp_path)
        with open(tmp_path, "rb") as f:
            assert f.read() == content
    finally:
        cleanup_temp_file(tmp_path)


def test_cleanup_temp_file_swallows_errors(monkeypatch):
    fd, path = tempfile.mkstemp()
    os.close(fd)

    def _remove(_):
        raise OSError("permission denied")

    monkeypatch.setattr(os, "remove", _remove)
    cleanup_temp_file(path)
