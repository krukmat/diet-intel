import { useState, useCallback } from 'react';
import { apiService } from '../services/ApiService';
import { isValidWeight, formatWeight, type WeightEntry } from '../utils/weightUtils';

export interface WeightRecordingState {
  status: 'idle' | 'recording' | 'recorded' | 'failed';
  lastWeight?: number;
  lastRecordedAt?: Date;
  error?: string;
}

export interface UseWeightTrackingResult {
  recordingState: WeightRecordingState;
  recordWeight: (weight: number, photo?: string) => Promise<boolean>;
  clearRecordingState: () => void;
  validateWeightInput: (weight: string) => { isValid: boolean; error?: string };
  formatWeightDisplay: (weight: number) => string;
}

// Configuration for weight recording
const WEIGHT_RECORDING_CONFIG = {
  maxRetries: 2,
  retryDelay: 1500, // 1.5 seconds
};

/**
 * Custom hook for weight tracking with validation and error handling
 */
export const useWeightTracking = (): UseWeightTrackingResult => {
  const [recordingState, setRecordingState] = useState<WeightRecordingState>({
    status: 'idle',
  });

  // Update recording state
  const updateRecordingState = useCallback((updates: Partial<WeightRecordingState>) => {
    setRecordingState(prev => ({ ...prev, ...updates }));
  }, []);

  // Validate weight input
  const validateWeightInput = useCallback((weightStr: string): { isValid: boolean; error?: string } => {
    if (!weightStr.trim()) {
      return { isValid: false, error: 'Weight is required' };
    }

    const weight = parseFloat(weightStr);
    if (isNaN(weight)) {
      return { isValid: false, error: 'Please enter a valid number' };
    }

    if (!isValidWeight(weight)) {
      return { isValid: false, error: 'Weight must be between 0.1 and 500 kg' };
    }

    return { isValid: true };
  }, []);

  // Format weight for display
  const formatWeightDisplay = useCallback((weight: number): string => {
    return formatWeight(weight);
  }, []);

  // Execute weight recording with retry logic
  const executeWeightRecording = useCallback(async (
    weight: number,
    photo: string | undefined,
    retryCount = 0
  ): Promise<boolean> => {
    updateRecordingState({ status: 'recording' });

    const weightData = {
      weight: weight,
      date: new Date().toISOString(),
      photo: photo,
    };

    try {
      await apiService.createWeightEntry(weightData);

      updateRecordingState({
        status: 'recorded',
        lastWeight: weight,
        lastRecordedAt: new Date(),
        error: undefined,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (retryCount < WEIGHT_RECORDING_CONFIG.maxRetries) {
        // Wait for retry delay and then retry
        await new Promise(resolve => setTimeout(resolve, WEIGHT_RECORDING_CONFIG.retryDelay));

        updateRecordingState({
          status: 'recording',
          error: `Retrying... (${errorMessage})`,
        });

        // Recursive retry
        return executeWeightRecording(weight, photo, retryCount + 1);
      } else {
        // Max retries reached
        updateRecordingState({
          status: 'failed',
          error: errorMessage,
        });
        return false;
      }
    }
  }, [updateRecordingState]);

  // Public method to record weight
  const recordWeight = useCallback(async (weight: number, photo?: string): Promise<boolean> => {
    // Validate input
    if (!isValidWeight(weight)) {
      updateRecordingState({
        status: 'failed',
        error: 'Invalid weight value',
      });
      return false;
    }

    // Clear any previous error
    updateRecordingState({ error: undefined });

    // Execute recording
    return executeWeightRecording(weight, photo);
  }, [updateRecordingState, executeWeightRecording]);

  // Clear recording state
  const clearRecordingState = useCallback(() => {
    setRecordingState({ status: 'idle' });
  }, []);

  return {
    recordingState,
    recordWeight,
    clearRecordingState,
    validateWeightInput,
    formatWeightDisplay,
  };
};
