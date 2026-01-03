import * as ImageManipulator from 'expo-image-manipulator';
import { ImageUtils } from '../imageUtils';

const mockManipulator = ImageManipulator as jest.Mocked<typeof ImageManipulator>;

describe('ImageUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes images for vision', async () => {
    mockManipulator.manipulateAsync.mockResolvedValueOnce({
      uri: 'file://image.jpg',
      base64: 'abc',
      width: 800,
      height: 600,
    } as any);

    const result = await ImageUtils.processImageForVision('file://input.jpg', { maxWidth: 800 });

    expect(result.uri).toBe('file://image.jpg');
    expect(result.base64).toBe('abc');
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('throws when image processing fails', async () => {
    mockManipulator.manipulateAsync.mockRejectedValueOnce(new Error('boom'));

    await expect(ImageUtils.processImageForVision('file://input.jpg')).rejects.toThrow(
      'Image processing failed: boom'
    );
  });

  it('converts images to base64', async () => {
    mockManipulator.manipulateAsync.mockResolvedValueOnce({
      uri: 'file://image.jpg',
      base64: 'encoded',
    } as any);

    const result = await ImageUtils.convertToBase64('file://input.jpg', 0.5);
    expect(result).toBe('encoded');
  });

  it('validates images for vision constraints', () => {
    const result = ImageUtils.validateImageForVision({
      uri: 'file://image.jpg',
      base64: '',
      width: 200,
      height: 200,
      size: 12 * 1024 * 1024,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('creates thumbnails and falls back on error', async () => {
    mockManipulator.manipulateAsync.mockResolvedValueOnce({ uri: 'file://thumb.jpg' } as any);
    const result = await ImageUtils.createThumbnail('file://input.jpg');
    expect(result).toBe('file://thumb.jpg');

    mockManipulator.manipulateAsync.mockRejectedValueOnce(new Error('fail'));
    const fallback = await ImageUtils.createThumbnail('file://input.jpg');
    expect(fallback).toBe('file://input.jpg');
  });

  it('calculates metadata', () => {
    const image = { uri: 'file://image.png', base64: '', width: 1000, height: 500, size: 1024 * 1024 };
    const metadata = ImageUtils.generateImageMetadata(image);

    expect(metadata.dimensions).toBe('1000x500');
    expect(metadata.format).toBe('PNG');
    expect(metadata.sizeMB).toBeCloseTo(1, 2);
  });
});
