/**
 * Weight Tracking Types - FASE 8.1
 * Following existing patterns from mealLog.ts
 */

export interface WeightEntry {
  id: string;
  userId: string;
  weight: number; // in kg
  date: Date;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWeightRequest {
  weight: number;
  date?: Date;
  photo?: string; // photo URI
}

export interface WeightHistoryResponse {
  entries: WeightEntry[];
  count: number;
  date_range?: {
    earliest: Date;
    latest: Date;
  };
  history: WeightEntry[];
}

export interface WeightStats {
  currentWeight: number;
  startingWeight: number;
  targetWeight: number;
  totalLost: number;
  bmi?: number;
  weeklyAverage?: number;
}

export interface WeightFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
