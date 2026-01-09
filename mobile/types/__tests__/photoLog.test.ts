/**
 * Tests for photoLog types - FASE 9.1
 */

import { PhotoLogEntry, PhotoLogType, PhotoLogsResponse, PhotoFilters } from '../photoLog';

describe('PhotoLog Types', () => {
  describe('PhotoLogType', () => {
    it('should accept meal type', () => {
      const type: PhotoLogType = 'meal';
      expect(type).toBe('meal');
    });

    it('should accept weigh-in type', () => {
      const type: PhotoLogType = 'weigh-in';
      expect(type).toBe('weigh-in');
    });

    it('should accept ocr type', () => {
      const type: PhotoLogType = 'ocr';
      expect(type).toBe('ocr');
    });
  });

  describe('PhotoLogEntry', () => {
    it('should create valid entry with required fields', () => {
      const entry: PhotoLogEntry = {
        id: 'p1',
        photoUrl: 'https://example.com/photo.jpg',
        type: 'meal',
        timestamp: new Date('2026-01-09'),
      };

      expect(entry.id).toBe('p1');
      expect(entry.photoUrl).toBe('https://example.com/photo.jpg');
      expect(entry.type).toBe('meal');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should allow optional description', () => {
      const entry: PhotoLogEntry = {
        id: 'p1',
        photoUrl: 'https://example.com/photo.jpg',
        type: 'meal',
        timestamp: new Date(),
        description: 'Breakfast photo',
      };

      expect(entry.description).toBe('Breakfast photo');
    });

    it('should work with all photo types', () => {
      const types: PhotoLogType[] = ['meal', 'weigh-in', 'ocr'];
      
      types.forEach((type) => {
        const entry: PhotoLogEntry = {
          id: 'p1',
          photoUrl: 'https://example.com/photo.jpg',
          type,
          timestamp: new Date(),
        };
        expect(entry.type).toBe(type);
      });
    });
  });

  describe('PhotoLogsResponse', () => {
    it('should contain logs array and count', () => {
      const response: PhotoLogsResponse = {
        logs: [
          {
            id: 'p1',
            photoUrl: 'https://example.com/photo1.jpg',
            type: 'meal',
            timestamp: new Date(),
          },
        ],
        count: 1,
      };

      expect(response.logs).toHaveLength(1);
      expect(response.count).toBe(1);
    });

    it('should handle empty logs', () => {
      const response: PhotoLogsResponse = {
        logs: [],
        count: 0,
      };

      expect(response.logs).toEqual([]);
      expect(response.count).toBe(0);
    });
  });

  describe('PhotoFilters', () => {
    it('should allow type filter', () => {
      const filters: PhotoFilters = {
        type: 'meal',
      };

      expect(filters.type).toBe('meal');
    });

    it('should allow date range filters', () => {
      const filters: PhotoFilters = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      };

      expect(filters.startDate).toBeInstanceOf(Date);
      expect(filters.endDate).toBeInstanceOf(Date);
    });

    it('should allow limit filter', () => {
      const filters: PhotoFilters = {
        limit: 50,
      };

      expect(filters.limit).toBe(50);
    });

    it('should allow combined filters', () => {
      const filters: PhotoFilters = {
        type: 'weigh-in',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        limit: 100,
      };

      expect(filters.type).toBe('weigh-in');
      expect(filters.limit).toBe(100);
    });
  });
});
