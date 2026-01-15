import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMealTracking } from '../useMealTracking';
import { apiService } from '../../services/ApiService';

// Mock the API service
jest.mock('../../services/ApiService', () => ({
  apiService: {
    consumePlanItem: jest.fn(),
  },
}));

const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock timers for retry testing
jest.useFakeTimers();

describe('useMealTracking', () => {
  const flushTimersAndPromises = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  const runAllTimersAndPromises = async () => {
    await act(async () => {
      jest.runAllTimers();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should initialize with empty consumption states', () => {
    const { result } = renderHook(() => useMealTracking());

    expect(result.current.consumptionStates.size).toBe(0);
    expect(result.current.hasPendingConsumptions).toBe(false);
  });

  it('should optimistically mark item as consumed immediately', async () => {
    mockApiService.consumePlanItem.mockResolvedValue({
      data: { success: true, message: 'Consumed successfully', item_id: 'item1' },
    } as any);

    const { result } = renderHook(() => useMealTracking());

    await act(async () => {
      await result.current.consumeMealItem('item1');
    });

    const state = result.current.getConsumptionStatus('item1');
    expect(state?.status).toBe('consumed');
    expect(state?.consumedAt).toBeInstanceOf(Date);
  });

  it('should successfully consume an item', async () => {
    mockApiService.consumePlanItem.mockResolvedValue({
      data: { success: true, message: 'Success', item_id: 'item1' },
    } as any);

    const { result } = renderHook(() => useMealTracking());

    const success = await act(async () => {
      return await result.current.consumeMealItem('item1');
    });

    expect(success).toBe(true);
    expect(mockApiService.consumePlanItem).toHaveBeenCalledWith('item1', expect.any(String));

    const state = result.current.getConsumptionStatus('item1');
    expect(state?.status).toBe('consumed');
    expect(state?.retryCount).toBe(0);
  });

  it('should handle API failure and schedule retry', async () => {
    mockApiService.consumePlanItem
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: { success: true, message: 'Success', item_id: 'item1' } } as any);

    const { result } = renderHook(() => useMealTracking());

    const success = await result.current.consumeMealItem('item1');

    // First attempt fails, but retry is scheduled
    expect(success).toBe(false);

    // After retry completes, state should be consumed
    await flushTimersAndPromises(1500); // Advance timers for retry

    const finalState = result.current.getConsumptionStatus('item1');
    expect(finalState?.status).toBe('consumed');
    expect(finalState?.retryCount).toBe(0);
  });





  it('should not retry non-failed items', async () => {
    const { result } = renderHook(() => useMealTracking());

    const retrySuccess = await act(async () => {
      return await result.current.retryFailedConsumption('item1');
    });

    expect(retrySuccess).toBe(false);
  });

  it('should clear consumption state', () => {
    const { result } = renderHook(() => useMealTracking());

    act(() => {
      result.current.clearConsumptionState('item1');
    });

    expect(result.current.getConsumptionStatus('item1')).toBeNull();
  });

  it('should track pending consumptions', async () => {
    mockApiService.consumePlanItem.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100))
    );

    const { result } = renderHook(() => useMealTracking());

    act(() => {
      result.current.consumeMealItem('item1');
    });

    expect(result.current.hasPendingConsumptions).toBe(true);

    // Wait for completion
    await flushTimersAndPromises(200);

    expect(result.current.hasPendingConsumptions).toBe(false);
  });

  it('should sync with trackData consumed items', () => {
    const mockTrackData = {
      consumedItems: ['item1', 'item2'],
      updateConsumedItems: jest.fn(),
    };

    const { result } = renderHook(() => useMealTracking(mockTrackData as any));

    // Should sync consumed items from trackData
    expect(result.current.getConsumptionStatus('item1')?.status).toBe('consumed');
    expect(result.current.getConsumptionStatus('item2')?.status).toBe('consumed');
  });

  it('should update trackData when consumption succeeds', async () => {
    const mockTrackData = {
      consumedItems: [],
      updateConsumedItems: jest.fn(),
    };

    mockApiService.consumePlanItem.mockResolvedValue({
      data: { success: true, message: 'Success', item_id: 'item1' },
    } as any);

    const { result } = renderHook(() => useMealTracking(mockTrackData as any));

    await act(async () => {
      await result.current.consumeMealItem('item1');
    });

    expect(mockTrackData.updateConsumedItems).toHaveBeenCalledWith(['item1']);
  });

  it('should handle concurrent consumptions', async () => {
    mockApiService.consumePlanItem.mockResolvedValue({
      data: { success: true, message: 'Success', item_id: 'item1' },
    } as any);

    const { result } = renderHook(() => useMealTracking());

    await act(async () => {
      const promises = [
        result.current.consumeMealItem('item1'),
        result.current.consumeMealItem('item2'),
        result.current.consumeMealItem('item3'),
      ];
      await Promise.all(promises);
    });

    expect(result.current.consumptionStates.size).toBe(3);
    expect(result.current.getConsumptionStatus('item1')?.status).toBe('consumed');
    expect(result.current.getConsumptionStatus('item2')?.status).toBe('consumed');
    expect(result.current.getConsumptionStatus('item3')?.status).toBe('consumed');
  });

  it('should clear retry timeouts when clearing state', () => {
    const { result } = renderHook(() => useMealTracking());

    act(() => {
      result.current.consumeMealItem('item1');
    });

    // Clear state
    act(() => {
      result.current.clearConsumptionState('item1');
    });

    expect(result.current.getConsumptionStatus('item1')).toBeNull();
  });

  it('should handle API response failure (success: false)', async () => {
    mockApiService.consumePlanItem.mockResolvedValue({
      data: { success: false },
    } as any);

    const { result } = renderHook(() => useMealTracking());

    const success = await act(async () => {
      return await result.current.consumeMealItem('item1');
    });

    expect(success).toBe(false);
    // After rollback, failed consumption should be removed from state
    expect(result.current.getConsumptionStatus('item1')).toBeNull();
  });
});
