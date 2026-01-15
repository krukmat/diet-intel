import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWeightTracking } from '../useWeightTracking';
import { apiService } from '../../services/ApiService';

// Mock the API service
jest.mock('../../services/ApiService', () => ({
  apiService: {
    createWeightEntry: jest.fn(),
  },
}));

const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock timers for retry testing
jest.useFakeTimers();

describe('useWeightTracking', () => {
  const flushTimersAndPromises = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useWeightTracking());

    expect(result.current.recordingState.status).toBe('idle');
    expect(result.current.recordingState.lastWeight).toBeUndefined();
    expect(result.current.recordingState.lastRecordedAt).toBeUndefined();
    expect(result.current.recordingState.error).toBeUndefined();
  });

  it('should successfully record weight', async () => {
    mockApiService.createWeightEntry.mockResolvedValue({
      data: { success: true },
    } as any);

    const { result } = renderHook(() => useWeightTracking());

    const success = await act(async () => {
      return await result.current.recordWeight(75.5);
    });

    expect(success).toBe(true);
    expect(mockApiService.createWeightEntry).toHaveBeenCalledWith({
      weight: 75.5,
      date: expect.any(String),
      photo: undefined,
    });

    expect(result.current.recordingState.status).toBe('recorded');
    expect(result.current.recordingState.lastWeight).toBe(75.5);
    expect(result.current.recordingState.lastRecordedAt).toBeInstanceOf(Date);
    expect(result.current.recordingState.error).toBeUndefined();
  });

  it('should record weight with photo', async () => {
    mockApiService.createWeightEntry.mockResolvedValue({
      data: { success: true },
    } as any);

    const { result } = renderHook(() => useWeightTracking());

    await act(async () => {
      await result.current.recordWeight(70.0, 'weight-photo.jpg');
    });

    expect(mockApiService.createWeightEntry).toHaveBeenCalledWith({
      weight: 70.0,
      date: expect.any(String),
      photo: 'weight-photo.jpg',
    });
  });

  it('should handle API failure and retry', async () => {
    mockApiService.createWeightEntry
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: { success: true } } as any);

    const { result } = renderHook(() => useWeightTracking());

    await act(async () => {
      await result.current.recordWeight(72.0);
    });

    // Advance timer for first retry
    await flushTimersAndPromises(1500);

    await waitFor(() => {
      expect(result.current.recordingState.status).toBe('recorded');
      expect(result.current.recordingState.lastWeight).toBe(72.0);
    });
  });

  it('should handle API failure gracefully', async () => {
    mockApiService.createWeightEntry.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWeightTracking());

    const success = await act(async () => {
      return await result.current.recordWeight(68.0);
    });

    expect(success).toBe(false);
    expect(result.current.recordingState.status).toBe('failed');
    expect(result.current.recordingState.error).toContain('Network error');
  });

  it('should reject invalid weight values', async () => {
    const { result } = renderHook(() => useWeightTracking());

    const success = await act(async () => {
      return await result.current.recordWeight(-5); // Invalid weight
    });

    expect(success).toBe(false);
    expect(result.current.recordingState.status).toBe('failed');
    expect(result.current.recordingState.error).toBe('Invalid weight value');
    expect(mockApiService.createWeightEntry).not.toHaveBeenCalled();
  });

  it('should validate weight input strings', () => {
    const { result } = renderHook(() => useWeightTracking());

    // Valid inputs
    expect(result.current.validateWeightInput('70.5')).toEqual({ isValid: true });
    expect(result.current.validateWeightInput(' 80 ')).toEqual({ isValid: true });

    // Invalid inputs
    expect(result.current.validateWeightInput('')).toEqual({
      isValid: false,
      error: 'Weight is required'
    });
    expect(result.current.validateWeightInput('abc')).toEqual({
      isValid: false,
      error: 'Please enter a valid number'
    });
    expect(result.current.validateWeightInput('600')).toEqual({
      isValid: false,
      error: 'Weight must be between 0.1 and 500 kg'
    });
    expect(result.current.validateWeightInput('0')).toEqual({
      isValid: false,
      error: 'Weight must be between 0.1 and 500 kg'
    });
  });

  it('should format weight for display', () => {
    const { result } = renderHook(() => useWeightTracking());

    expect(result.current.formatWeightDisplay(75.5)).toBe('75.5 kg');
    expect(result.current.formatWeightDisplay(70)).toBe('70.0 kg');
    expect(result.current.formatWeightDisplay(82.123)).toBe('82.1 kg');
  });

  it('should clear recording state', async () => {
    const { result } = renderHook(() => useWeightTracking());

    // Set some state
    act(() => {
      result.current.clearRecordingState();
    });

    expect(result.current.recordingState.status).toBe('idle');
    expect(result.current.recordingState.lastWeight).toBeUndefined();
    expect(result.current.recordingState.lastRecordedAt).toBeUndefined();
    expect(result.current.recordingState.error).toBeUndefined();
  });

  it('should handle concurrent weight recordings', async () => {
    mockApiService.createWeightEntry.mockResolvedValue({
      data: { success: true },
    } as any);

    const { result } = renderHook(() => useWeightTracking());

    const promises = [
      result.current.recordWeight(70.0),
      result.current.recordWeight(71.0),
      result.current.recordWeight(72.0),
    ];

    const results = await act(async () => {
      return await Promise.all(promises);
    });

    // All should succeed
    expect(results).toEqual([true, true, true]);
    expect(mockApiService.createWeightEntry).toHaveBeenCalledTimes(3);
  });

  it('should clear previous errors on new recording', async () => {
    // First recording fails
    mockApiService.createWeightEntry.mockRejectedValueOnce(new Error('Error'));

    const { result } = renderHook(() => useWeightTracking());

    await act(async () => {
      await result.current.recordWeight(70.0);
    });

    // Should have error
    expect(result.current.recordingState.error).toBeDefined();

    // Second recording succeeds
    mockApiService.createWeightEntry.mockResolvedValueOnce({
      data: { success: true },
    } as any);

    await act(async () => {
      await result.current.recordWeight(71.0);
    });

    // Error should be cleared
    expect(result.current.recordingState.error).toBeUndefined();
    expect(result.current.recordingState.status).toBe('recorded');
    expect(result.current.recordingState.lastWeight).toBe(71.0);
  });

  it('should handle API response structure correctly', async () => {
    mockApiService.createWeightEntry.mockResolvedValue({
      data: { success: true, message: 'Weight recorded' },
    } as any);

    const { result } = renderHook(() => useWeightTracking());

    await act(async () => {
      await result.current.recordWeight(75.0);
    });

    expect(result.current.recordingState.status).toBe('recorded');
    expect(result.current.recordingState.lastWeight).toBe(75.0);
  });
});
