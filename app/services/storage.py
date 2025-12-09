import base64
import os
import uuid
from datetime import datetime
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

PHOTO_STORAGE_PATH = os.environ.get("DIETINTEL_PHOTO_DIR", "/tmp/dietintel_photos")


def ensure_photo_directory() -> None:
    os.makedirs(PHOTO_STORAGE_PATH, exist_ok=True)


async def save_photo(photo_base64: str, prefix: str) -> Optional[Dict[str, str]]:
    """Persist a base64-encoded photo to disk and return metadata."""
    try:
        ensure_photo_directory()

        data = photo_base64.split(",", 1)[1] if "," in photo_base64 else photo_base64
        image_bytes = base64.b64decode(data)

        filename = f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(PHOTO_STORAGE_PATH, filename)

        with open(filepath, "wb") as fp:
            fp.write(image_bytes)

        return {"photo_url": filepath}
    except Exception as exc:  # pragma: no cover
        logger.error(f"Failed to save photo: {exc}")
        return None
