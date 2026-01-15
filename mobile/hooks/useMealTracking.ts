import { useState, useCallback, useRef, useEffect } from 'react';
import { apiService } from '../services/ApiService';
import type { UseTrackDataResult } from './useTrackData';

export interface MealConsumptionState {
  itemId: string;
  status: 'pending' | 'consuming' | 'consumed' | 'failed';
  retryCount: number;
  lastError?: string;
  consumedAt?: Date;
}

export interface UseMealTrackingResult {
  consumptionStates: Map<string, MealConsumptionState>;
  consumeMealItem: (itemId: string) => Promise<boolean>;
  retryFailedConsumption: (itemId: string) => Promise<boolean>;
  clearConsumptionState: (itemId: string) => void;
  getConsumptionStatus: (itemId: string) => MealConsumptionState | null;
  hasPendingConsumptions: boolean;
}

// Configuration for retry logic
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Calculate delay for exponential backoff
 */
const calculateRetryDelay = (retryCount: number): number => {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
};

/**
 * Custom hook for meal consumption tracking with optimistic UI and retry logic
 */
export const useMealTracking = (trackData?: UseTrackDataResult): UseMealTrackingResult => {
  const [consumptionStates, setConsumptionStates] = useState<Map<string, MealConsumptionState>>(new Map());
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

  // Update consumption state for a specific item
  const updateConsumptionState = useCallback((
    itemId: string,
    updates: Partial<MealConsumptionState>
  ) => {
    setConsumptionStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(itemId);

      if (!currentState && !updates.status) {
        // If no existing state and no status update, do nothing
        return newMap;
      }

      const newState: MealConsumptionState = {
        itemId,
        status: 'pending',
        retryCount: 0,
        ...currentState,
        ...updates,
      };

      newMap.set(itemId, newState);
      return newMap;
    });
  }, []);

  // Clear any pending retry timeout for an item
  const clearRetryTimeout = useCallback((itemId: string) => {
    const timeout = retryTimeouts.current.get(itemId);
    if (timeout) {
      clearTimeout(timeout);
      retryTimeouts.current.delete(itemId);
    }
  }, []);

  // Execute consumption with retry logic
  const executeConsumption = useCallback(async (
    itemId: string,
    retryCount = 0
  ): Promise<boolean> => {
    try {
      // For first attempt, keep optimistic status. For retries, show pending
      if (retryCount > 0) {
        updateConsumptionState(itemId, {
          status: 'pending',
          retryCount,
        });
      }

      const consumedAt = new Date().toISOString();
      const response = await apiService.consumePlanItem(itemId, consumedAt);

      if (response.data.success) {
        updateConsumptionState(itemId, {
          status: 'consumed',
          consumedAt: new Date(),
          retryCount: 0,
        });
        // Remove from pending operations on success
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
        return true;
      } else {
        // API returned success: false - fail immediately without retries
        updateConsumptionState(itemId, {
          status: 'failed',
          retryCount,
          lastError: 'Consumption failed',
        });
        // Remove from pending operations on failure
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (retryCount < RETRY_CONFIG.maxRetries) {
        // Schedule retry with exponential backoff
        const nextRetryCount = retryCount + 1;
        const delay = calculateRetryDelay(retryCount);
        const timeout = setTimeout(() => {
          executeConsumption(itemId, nextRetryCount);
        }, delay);

        retryTimeouts.current.set(itemId, timeout);

        // For first retry, keep optimistic status while scheduling
        if (retryCount > 0) {
          updateConsumptionState(itemId, {
            status: 'pending',
            retryCount: nextRetryCount,
            lastError: `Retrying in ${delay}ms... (${errorMessage})`,
          });
        } else {
          updateConsumptionState(itemId, {
            retryCount: nextRetryCount,
            lastError: `Will retry in ${delay}ms... (${errorMessage})`,
          });
        }
      } else {
        // Max retries reached
        updateConsumptionState(itemId, {
          status: 'failed',
          retryCount,
          lastError: errorMessage,
        });
        // Remove from pending operations when max retries reached
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }
      return false;
    }
  }, [updateConsumptionState]);

  // Public method to consume a meal item
  const consumeMealItem = useCallback(async (itemId: string): Promise<boolean> => {
    // Clear any existing retry timeout
    clearRetryTimeout(itemId);

    // Add to pending operations
    setPendingOperations(prev => new Set(prev).add(itemId));

    // Optimistically mark as consumed immediately for UI
    updateConsumptionState(itemId, {
      status: 'consumed',
      consumedAt: new Date(),
    });

    // Execute actual consumption (will handle failures and retries)
    const success = await executeConsumption(itemId);

    // If consumption failed after all retries, rollback optimistic state
    if (!success) {
      // Remove optimistic state entirely since consumption failed
      setConsumptionStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(itemId);
        return newMap;
      });
      // Remove from pending operations
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }

    return success;
  }, [clearRetryTimeout, updateConsumptionState, executeConsumption]);

  // Retry a failed consumption
  const retryFailedConsumption = useCallback(async (itemId: string): Promise<boolean> => {
    const currentState = consumptionStates.get(itemId);
    if (!currentState || currentState.status !== 'failed') {
      return false;
    }

    clearRetryTimeout(itemId);
    return executeConsumption(itemId, 0); // Reset retry count
  }, [consumptionStates, clearRetryTimeout, executeConsumption]);

  // Clear consumption state for an item
  const clearConsumptionState = useCallback((itemId: string) => {
    clearRetryTimeout(itemId);
    setConsumptionStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });
    setPendingOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
  }, [clearRetryTimeout]);

  // Get consumption status for an item
  const getConsumptionStatus = useCallback((itemId: string): MealConsumptionState | null => {
    return consumptionStates.get(itemId) || null;
  }, [consumptionStates]);

  // Sync with trackData consumed items
  useEffect(() => {
    if (!trackData?.consumedItems) return;

    // Update local states based on remote consumed items
    setConsumptionStates(prev => {
      const newMap = new Map(prev);

      // Mark items as consumed if they're in the remote list but not locally tracked
      trackData.consumedItems.forEach(itemId => {
        if (!newMap.has(itemId)) {
          newMap.set(itemId, {
            itemId,
            status: 'consumed',
            retryCount: 0,
            consumedAt: new Date(), // We don't know when, but mark as consumed
          });
        }
      });

      return newMap;
    });
  }, [trackData?.consumedItems]);

  // Update trackData when consumption succeeds
  useEffect(() => {
    if (!trackData?.updateConsumedItems) return;

    const successfulConsumptions = Array.from(consumptionStates.values())
      .filter(state => state.status === 'consumed')
      .map(state => state.itemId);

    if (successfulConsumptions.length > 0) {
      // Merge with existing consumed items
      const allConsumed = Array.from(new Set([
        ...(trackData.consumedItems || []),
        ...successfulConsumptions,
      ]));

      trackData.updateConsumedItems(allConsumed);
    }
  }, [consumptionStates, trackData]);

  // Check if there are any pending consumptions or pending operations
  const hasPendingConsumptions = Array.from(consumptionStates.values())
    .some(state => state.status === 'pending' || state.status === 'consuming') ||
    retryTimeouts.current.size > 0 ||
    pendingOperations.size > 0;

  return {
    consumptionStates,
    consumeMealItem,
    retryFailedConsumption,
    clearConsumptionState,
    getConsumptionStatus,
    hasPendingConsumptions,
  };
};
