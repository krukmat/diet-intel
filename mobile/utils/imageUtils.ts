import * as ImageManipulator from 'expo-image-manipulator';
import { ImageProcessingResult } from '../types/visionLog';

export class ImageUtils {
  /**
   * Process image for vision analysis
   * Optimizes image size and quality while maintaining aspect ratio
   */
  static async processImageForVision(
    imageUri: string,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
    } = {}
  ): Promise<ImageProcessingResult> {
    const { maxWidth = 1024, maxHeight = 1024, quality = 0.8 } = options;

    try {
      // Process image using expo-image-manipulator
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      return {
        uri: processedImage.uri,
        base64: processedImage.base64 || '',
        width: processedImage.width,
        height: processedImage.height,
        size: processedImage.uri.length,
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert image to base64 for API upload
   */
  static async convertToBase64(imageUri: string, quality: number = 0.8): Promise<string> {
    try {
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      return processedImage.base64 || '';
    } catch (error) {
      throw new Error(`Base64 conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate image dimensions and size for vision analysis
   */
  static validateImageForVision(image: ImageProcessingResult): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const { width, height, size } = image;

    // Check minimum dimensions
    if (width < 256 || height < 256) {
      errors.push('Image too small. Minimum 256x256 pixels required.');
    }

    // Check maximum dimensions to prevent memory issues
    if (width > 2048 || height > 2048) {
      errors.push('Image too large. Maximum 2048x2048 pixels allowed.');
    }

    // Check file size (limit to 10MB as per specs)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (size > maxSizeInBytes) {
      errors.push('Image file too large. Maximum 10MB allowed.');
    }

    // Check aspect ratio (avoid extremely narrow/wide images)
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    if (aspectRatio > 5) {
      errors.push('Image aspect ratio too extreme. Please use a more balanced crop.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create thumbnail for UI display
   */
  static async createThumbnail(
    imageUri: string,
    size: { width: number; height: number } = { width: 200, height: 200 }
  ): Promise<string> {
    try {
      const thumbnail = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: size,
          },
        ],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return thumbnail.uri;
    } catch (error) {
      console.warn('Thumbnail creation failed:', error);
      return imageUri; // Return original if thumbnail fails
    }
  }

  /**
   * Calculate image file size in MB
   */
  static calculateImageSize(image: ImageProcessingResult): number {
    return image.size / (1024 * 1024);
  }

  /**
   * Generate image metadata for logging
   */
  static generateImageMetadata(image: ImageProcessingResult): {
    dimensions: string;
    sizeMB: number;
    aspectRatio: number;
    format: 'JPEG' | 'PNG';
  } {
    return {
      dimensions: `${image.width}x${image.height}`,
      sizeMB: this.calculateImageSize(image),
      aspectRatio: image.width / image.height,
      format: image.uri.includes('.png') ? 'PNG' : 'JPEG',
    };
  }
}
