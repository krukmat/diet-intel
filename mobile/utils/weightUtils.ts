// Pure utility functions for weight-related calculations
// Following TDD approach - tests written first, then implementation

export interface WeightEntry {
  date: string;
  weight: number;
  photo?: string;
}

export interface WeightStats {
  current: number;
  start: number;
  delta: number;
}

/**
 * Calculate weight delta between two entries
 */
export const calculateWeightDelta = (
  current: WeightEntry | null,
  previous: WeightEntry | null
): number | null => {
  if (!current || !previous) return null;
  return current.weight - previous.weight;
};

/**
 * Format weight delta for display
 */
export const formatWeightDelta = (delta: number | null): string => {
  if (delta === null) return 'No data';
  if (delta === 0) return 'No change';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} kg`;
};

/**
 * Calculate weight statistics from history
 */
export const calculateWeightStats = (history: WeightEntry[]): WeightStats | null => {
  if (history.length === 0) return null;

  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const current = sortedHistory[sortedHistory.length - 1];
  const start = sortedHistory[0];

  return {
    current: current.weight,
    start: start.weight,
    delta: current.weight - start.weight,
  };
};

/**
 * Validate weight input
 */
export const isValidWeight = (weight: number): boolean => {
  return typeof weight === 'number' &&
         !isNaN(weight) &&
         weight > 0 &&
         weight < 500; // Reasonable bounds
};

/**
 * Format weight for display
 */
export const formatWeight = (weight: number): string => {
  return `${weight.toFixed(1)} kg`;
};

/**
 * Get weight trend direction
 */
export const getWeightTrend = (delta: number | null): 'up' | 'down' | 'stable' | 'unknown' => {
  if (delta === null) return 'unknown';
  if (delta > 0.1) return 'up';
  if (delta < -0.1) return 'down';
  return 'stable';
};
