"""
Image Processor Utility - Image handling utilities for food vision analysis

Part of FEAT-PROPORTIONS implementation
Provides utilities for image validation, processing, and temporary storage
"""

import logging
from typing import Tuple, Optional
from PIL import Image
import io

logger = logging.getLogger(__name__)

class ImageProcessor:
    """Utilities for processing and validating images in food analysis"""

    @staticmethod
    def validate_image_format(content: bytes) -> bool:
        """
        Validate that the byte content is a supported image format

        Supported: JPEG, PNG, WebP
        """
        try:
            Image.open(io.BytesIO(content)).verify()
            return True
        except Exception as e:
            logger.warning(f"Image format validation failed: {e}")
            return False

    @staticmethod
    def get_image_dimensions(content: bytes) -> Tuple[int, int]:
        """
        Get image dimensions (width, height) from byte content

        Returns:
            Tuple of (width, height) in pixels
        """
        try:
            with Image.open(io.BytesIO(content)) as img:
                return img.size  # (width, height)
        except Exception as e:
            logger.warning(f"Could not get image dimensions: {e}")
            return (0, 0)

    @staticmethod
    def validate_image_size(content: bytes, max_size_mb: int = 10) -> bool:
        """
        Validate image file size against maximum limit

        Args:
            content: Image byte content
            max_size_mb: Maximum size in MB (default: 10)

        Returns:
            True if within size limits
        """
        max_size_bytes = max_size_mb * 1024 * 1024
        return len(content) <= max_size_bytes

    @staticmethod
    def get_image_format(content: bytes) -> Optional[str]:
        """
        Detect image format from byte content

        Returns:
            Format string (JPEG, PNG, WebP) or None if unknown
        """
        try:
            with Image.open(io.BytesIO(content)) as img:
                return img.format  # JPEG, PNG, WebP, etc.
        except Exception:
            return None

    @staticmethod
    def validate_image_resolution(content: bytes, min_pixels: int = 256) -> bool:
        """
        Validate minimum image resolution for analysis

        Args:
            content: Image byte content
            min_pixels: Minimum pixels on shortest side

        Returns:
            True if resolution meets minimum requirements
        """
        width, height = ImageProcessor.get_image_dimensions(content)
        min_dimension = min(width, height)
        return min_dimension >= min_pixels

    @staticmethod
    def optimize_image_for_analysis(content: bytes, max_dimension: int = 1024) -> bytes:
        """
        Optimize image for analysis by resizing while maintaining aspect ratio

        Args:
            content: Original image bytes
            max_dimension: Maximum dimension (width or height)

        Returns:
            Optimized image bytes
        """
        try:
            with Image.open(io.BytesIO(content)) as img:
                # Convert to RGB for consistent processing
                if img.mode not in ['RGB', 'RGBA']:
                    img = img.convert('RGB')

                # Calculate new dimensions maintaining aspect ratio
                width, height = img.size
                if width > height:
                    if width > max_dimension:
                        new_width = max_dimension
                        new_height = int((height * max_dimension) / width)
                    else:
                        new_width, new_height = width, height
                else:
                    if height > max_dimension:
                        new_height = max_dimension
                        new_width = int((width * max_dimension) / height)
                    else:
                        new_width, new_height = width, height

                # Only resize if necessary
                if new_width != width or new_height != height:
                    img = img.resize((new_width, new_height), Image.LANCZOS)

                # Save optimized image
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=85, optimize=True)
                return output.getvalue()

        except Exception as e:
            logger.warning(f"Image optimization failed, returning original: {e}")
            return content

    @staticmethod
    def save_image_temp(content: bytes, analysis_id: str, temp_dir: str = "/tmp/vision") -> Optional[str]:
        """
        Save image temporarily for processing

        MVP Implementation:
        - Currently validates but doesn't save to disk
        - Returns mock path for compatibility
        - Can be enhanced to save to secure temp directory

        Args:
            content: Image byte content
            analysis_id: Unique analysis identifier
            temp_dir: Temporary directory path

        Returns:
            Path to saved temporary image or None if failed
        """
        try:
            # Validate image before "saving"
            if not ImageProcessor.validate_image_format(content):
                return None

            # In MVP: just return a mock path
            # TODO: Implement actual secure temp file creation
            temp_path = f"{temp_dir}/vision_{analysis_id}.jpg"

            logger.debug(f"Mock image save to: {temp_path}")
            return temp_path

        except Exception as e:
            logger.warning(f"Failed to save temp image: {e}")
            return None

    @staticmethod
    def cleanup_temp_image(image_path: str) -> bool:
        """
        Clean up temporary image file

        MVP Implementation:
        - Currently no-op (no real files saved)
        - Can be enhanced to remove temp files

        Args:
            image_path: Path to temporary image

        Returns:
            True if cleanup successful (or not needed)
        """
        # TODO: Implement actual temp file cleanup
        logger.debug(f"Mock cleanup of: {image_path}")
        return True

    @staticmethod
    def calculate_image_hash(content: bytes) -> Optional[str]:
        """
        Calculate hash of image content for deduplication

        Args:
            content: Image byte content

        Returns:
            SHA256 hash string or None if failed
        """
        try:
            import hashlib
            return hashlib.sha256(content).hexdigest()
        except Exception as e:
            logger.warning(f"Hash calculation failed: {e}")
            return None

    @staticmethod
    def get_image_metadata(content: bytes) -> dict:
        """
        Extract comprehensive metadata from image

        Returns:
            Dictionary with image metadata
        """
        try:
            metadata = {
                "format": ImageProcessor.get_image_format(content),
                "dimensions": ImageProcessor.get_image_dimensions(content),
                "size_bytes": len(content),
                "size_mb": round(len(content) / (1024 * 1024), 2),
                "hash": ImageProcessor.calculate_image_hash(content),
                "valid": ImageProcessor.validate_image_format(content),
                "resolution_ok": ImageProcessor.validate_image_resolution(content, 256)
            }

            # Add PIL metadata if available
            try:
                with Image.open(io.BytesIO(content)) as img:
                    metadata.update({
                        "mode": img.mode,
                        "has_transparency": img.mode == 'RGBA' or (hasattr(img, 'has_transparency') and img.has_transparency),
                        "exif_available": bool(img.getexif())
                    })
            except Exception:
                pass

            return metadata

        except Exception as e:
            logger.warning(f"Metadata extraction failed: {e}")
            return {
                "valid": False,
                "error": str(e)
            }

    @staticmethod
    def generate_image_thumbnail(content: bytes, size: Tuple[int, int] = (200, 200)) -> Optional[bytes]:
        """
        Generate thumbnail image

        Args:
            content: Original image bytes
            size: Tuple of (width, height) for thumbnail

        Returns:
            Thumbnail image bytes or None if failed
        """
        try:
            with Image.open(io.BytesIO(content)) as img:
                # Convert to RGB for consistent thumbnails
                if img.mode not in ['RGB', 'RGBA']:
                    img = img.convert('RGB')

                # Create thumbnail maintaining aspect ratio
                img.thumbnail(size, Image.LANCZOS)

                # Save thumbnail
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=80)
                return output.getvalue()

        except Exception as e:
            logger.warning(f"Thumbnail generation failed: {e}")
            return None
