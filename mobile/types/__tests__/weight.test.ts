/**
 * Tests for weight types - FASE 8.1
 */

import { WeightEntry, CreateWeightRequest, WeightFilters, WeightStats } from '../weight';

describe('Weight Types', () => {
  describe('WeightEntry', () => {
    it('should create valid weight entry', () => {
      const entry: WeightEntry = {
        id: 'w1',
        weight: 75.5,
        date: new Date('2026-01-09'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entry.id).toBe('w1');
      expect(entry.weight).toBe(75.5);
      expect(entry.date).toBeInstanceOf(Date);
    });

    it('should allow optional photoUrl', () => {
      const entry: WeightEntry = {
        id: 'w1',
        weight: 75.5,
        date: new Date(),
        photoUrl: 'https://example.com/photo.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entry.photoUrl).toBe('https://example.com/photo.jpg');
    });

    it('should accept decimal weights', () => {
      const entry: WeightEntry = {
        id: 'w1',
        weight: 75.123,
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entry.weight).toBeCloseTo(75.123);
    });
  });

  describe('CreateWeightRequest', () => {
    it('should require weight field', () => {
      const request: CreateWeightRequest = {
        weight: 75.5,
      };

      expect(request.weight).toBe(75.5);
      expect(request.date).toBeUndefined();
    });

    it('should allow optional date', () => {
      const request: CreateWeightRequest = {
        weight: 75.5,
        date: new Date('2026-01-09'),
      };

      expect(request.date).toBeInstanceOf(Date);
    });
  });

  describe('WeightFilters', () => {
    it('should allow all optional filters', () => {
      const filters: WeightFilters = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        limit: 30,
      };

      expect(filters.startDate).toBeInstanceOf(Date);
      expect(filters.endDate).toBeInstanceOf(Date);
      expect(filters.limit).toBe(30);
    });

    it('should allow empty filters', () => {
      const filters: WeightFilters = {};

      expect(filters.startDate).toBeUndefined();
      expect(filters.limit).toBeUndefined();
    });
  });

  describe('WeightStats', () => {
    it('should calculate stats correctly', () => {
      const stats: WeightStats = {
        currentWeight: 75.0,
        startingWeight: 78.0,
        totalLost: 3.0,
        averageWeight: 76.5,
        entriesCount: 10,
      };

      expect(stats.totalLost).toBe(3.0);
      expect(stats.entriesCount).toBe(10);
    });

    it('should handle weight gain', () => {
      const stats: WeightStats = {
        currentWeight: 80.0,
        startingWeight: 75.0,
        totalLost: -5.0,
        averageWeight: 77.5,
        entriesCount: 5,
      };

      expect(stats.totalLost).toBe(-5.0);
    });
  });
});
