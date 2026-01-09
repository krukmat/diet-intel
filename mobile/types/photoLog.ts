/**
 * Photo Log Types - FASE 9.1
 * Following existing patterns from mealLog.ts
 */

export type PhotoLogType = 'meal' | 'weigh-in' | 'ocr';

export interface PhotoLogEntry {
  id: string;
  timestamp: Date;
  photoUrl: string;
  type: PhotoLogType;
  description?: string;
}

export interface PhotoLogsResponse {
  logs: PhotoLogEntry[];
  count: number;
}

export interface PhotoFilters {
  type?: PhotoLogType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
