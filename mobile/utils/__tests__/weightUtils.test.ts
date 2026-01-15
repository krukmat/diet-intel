import {
  calculateWeightDelta,
  formatWeightDelta,
  calculateWeightStats,
  isValidWeight,
  formatWeight,
  getWeightTrend,
  type WeightEntry,
  type WeightStats,
} from '../weightUtils';

describe('weightUtils', () => {
  describe('calculateWeightDelta', () => {
    it('should return null when current is null', () => {
      const result = calculateWeightDelta(null, { date: '2024-01-01', weight: 70 });
      expect(result).toBeNull();
    });

    it('should return null when previous is null', () => {
      const result = calculateWeightDelta({ date: '2024-01-01', weight: 70 }, null);
      expect(result).toBeNull();
    });

    it('should calculate positive delta correctly', () => {
      const current: WeightEntry = { date: '2024-01-02', weight: 71 };
      const previous: WeightEntry = { date: '2024-01-01', weight: 70 };
      const result = calculateWeightDelta(current, previous);
      expect(result).toBe(1);
    });

    it('should calculate negative delta correctly', () => {
      const current: WeightEntry = { date: '2024-01-02', weight: 69 };
      const previous: WeightEntry = { date: '2024-01-01', weight: 70 };
      const result = calculateWeightDelta(current, previous);
      expect(result).toBe(-1);
    });

    it('should handle decimal weights', () => {
      const current: WeightEntry = { date: '2024-01-02', weight: 70.5 };
      const previous: WeightEntry = { date: '2024-01-01', weight: 70.2 };
      const result = calculateWeightDelta(current, previous);
      expect(result).toBeCloseTo(0.3);
    });
  });

  describe('formatWeightDelta', () => {
    it('should format null delta as "No data"', () => {
      const result = formatWeightDelta(null);
      expect(result).toBe('No data');
    });

    it('should format zero delta as "No change"', () => {
      const result = formatWeightDelta(0);
      expect(result).toBe('No change');
    });

    it('should format positive delta with plus sign', () => {
      const result = formatWeightDelta(1.5);
      expect(result).toBe('+1.5 kg');
    });

    it('should format negative delta without extra sign', () => {
      const result = formatWeightDelta(-2.3);
      expect(result).toBe('-2.3 kg');
    });

    it('should round to 1 decimal place', () => {
      const result = formatWeightDelta(1.234);
      expect(result).toBe('+1.2 kg');
    });
  });

  describe('calculateWeightStats', () => {
    it('should return null for empty history', () => {
      const result = calculateWeightStats([]);
      expect(result).toBeNull();
    });

    it('should calculate stats for single entry', () => {
      const history: WeightEntry[] = [{ date: '2024-01-01', weight: 70 }];
      const result = calculateWeightStats(history);
      expect(result).toEqual({
        current: 70,
        start: 70,
        delta: 0,
      });
    });

    it('should sort history by date and calculate correctly', () => {
      const history: WeightEntry[] = [
        { date: '2024-01-03', weight: 72 },
        { date: '2024-01-01', weight: 70 },
        { date: '2024-01-02', weight: 71 },
      ];
      const result = calculateWeightStats(history);
      expect(result).toEqual({
        current: 72, // Latest date
        start: 70,   // Earliest date
        delta: 2,    // 72 - 70
      });
    });

    it('should handle dates in different formats', () => {
      const history: WeightEntry[] = [
        { date: '2024-01-01', weight: 70 },
        { date: '2024-12-31', weight: 75 },
      ];
      const result = calculateWeightStats(history);
      expect(result?.delta).toBe(5);
    });
  });

  describe('isValidWeight', () => {
    it('should validate reasonable weights', () => {
      expect(isValidWeight(70)).toBe(true);
      expect(isValidWeight(50)).toBe(true);
      expect(isValidWeight(150)).toBe(true);
    });

    it('should reject zero or negative weights', () => {
      expect(isValidWeight(0)).toBe(false);
      expect(isValidWeight(-5)).toBe(false);
    });

    it('should reject unreasonably high weights', () => {
      expect(isValidWeight(500)).toBe(false);
      expect(isValidWeight(1000)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidWeight(NaN)).toBe(false);
    });

    it('should reject non-numbers', () => {
      // TypeScript will catch this, but for runtime safety
      expect(isValidWeight('70' as any)).toBe(false);
    });
  });

  describe('formatWeight', () => {
    it('should format weight with kg suffix', () => {
      const result = formatWeight(70.5);
      expect(result).toBe('70.5 kg');
    });

    it('should round to 1 decimal place', () => {
      const result = formatWeight(70.123);
      expect(result).toBe('70.1 kg');
    });

    it('should handle integer weights', () => {
      const result = formatWeight(70);
      expect(result).toBe('70.0 kg');
    });
  });

  describe('getWeightTrend', () => {
    it('should return "unknown" for null delta', () => {
      const result = getWeightTrend(null);
      expect(result).toBe('unknown');
    });

    it('should return "up" for positive delta above threshold', () => {
      expect(getWeightTrend(0.2)).toBe('up');
      expect(getWeightTrend(1)).toBe('up');
    });

    it('should return "down" for negative delta below threshold', () => {
      expect(getWeightTrend(-0.2)).toBe('down');
      expect(getWeightTrend(-1)).toBe('down');
    });

    it('should return "stable" for delta within threshold', () => {
      expect(getWeightTrend(0)).toBe('stable');
      expect(getWeightTrend(0.05)).toBe('stable');
      expect(getWeightTrend(-0.05)).toBe('stable');
    });
  });
});
