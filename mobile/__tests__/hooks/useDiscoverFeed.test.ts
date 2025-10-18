import { renderHook, act, waitFor } from '@testing-library/react-native';
import { apiService } from '../../services/ApiService';
import { useDiscoverFeed } from '../../hooks/useDiscoverFeed';

// Mock the apiService
jest.mock('../../services/ApiService', () => ({
  apiService: {
    getDiscoverFeed: jest.fn(),
  },
}));

describe('useDiscoverFeed Hook', () => {
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiService.getDiscoverFeed.mockResolvedValue({
      data: {
        items: [
          {
            id: 'post-1',
            author_id: 'author-1',
            author_handle: 'test-user',
            text: 'Test post',
            rank_score: 0.85,
            reason: 'fresh',
            created_at: '2025-01-01T10:00:00Z',
            metadata: { likes_count: 5, comments_count: 2 },
          }
        ],
        next_cursor: 'cursor123'
      }
    });
  });

  test('should initialize with default state', () => {
    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: false }));

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(result.current.surface).toBe('mobile');
  });

  test('should load data on mount when autoLoad is true', async () => {
    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: true }));

    // Should be loading initially
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items).toHaveLength(1);
      expect(result.current.hasMore).toBe(true);
    });

    expect(mockApiService.getDiscoverFeed).toHaveBeenCalledWith({
      limit: 20,
      surface: 'mobile'
    });
  });

  test('should not load on mount when autoLoad is false', () => {
    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: false }));

    expect(result.current.loading).toBe(false);
    expect(mockApiService.getDiscoverFeed).not.toHaveBeenCalled();
  });

  test('should refresh data correctly', async () => {
    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: false }));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });

    expect(mockApiService.getDiscoverFeed).toHaveBeenCalledWith({
      limit: 20,
      surface: 'mobile',
    });
  });

  test('should load more items correctly', async () => {
    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: true }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.hasMore).toBe(true);
    });

    // Setup additional data for loadMore
    mockApiService.getDiscoverFeed.mockResolvedValue({
      data: {
        items: [
          {
            id: 'post-2',
            author_id: 'author-2',
            author_handle: 'user-2',
            text: 'Second post',
            rank_score: 0.75,
            reason: 'engagement',
            created_at: '2025-01-02T10:00:00Z',
            metadata: { likes_count: 3, comments_count: 1 },
          }
        ],
        next_cursor: null
      }
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items).toHaveLength(2);
      expect(result.current.hasMore).toBe(false);
    });

    expect(mockApiService.getDiscoverFeed).toHaveBeenCalledTimes(2);
  });

  test('should handle errors gracefully', async () => {
    const errorMessage = 'Network error';
    mockApiService.getDiscoverFeed.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: true }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.items).toEqual([]);
    });
  });

  test('should switch surface correctly', async () => {
    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: false, surface: 'mobile' }));

    act(() => {
      result.current.switchSurface('web');
    });

    await waitFor(() => {
      expect(mockApiService.getDiscoverFeed).toHaveBeenCalledWith({
        limit: 20,
        surface: 'web',
      });
      expect(result.current.surface).toBe('web');
    });

    expect(mockApiService.getDiscoverFeed).toHaveBeenCalledTimes(1);
  });

  test('should clear error correctly', async () => {
    const errorMessage = 'Network error';
    mockApiService.getDiscoverFeed.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: true }));

    await waitFor(() => expect(result.current.error).toBe(errorMessage));

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  test('should pass custom limit correctly', async () => {
    const limit = 10;
    const { result } = renderHook(() => useDiscoverFeed({
      autoLoad: false,
      limit
    }));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApiService.getDiscoverFeed).toHaveBeenCalledWith({
      limit,
      surface: 'mobile'
    });
  });

  test('should not load more when no more items available', async () => {
    mockApiService.getDiscoverFeed.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'post-1',
            author_id: 'author-1',
            text: 'Only post',
            rank_score: 0.9,
            reason: 'fresh',
            created_at: '2025-01-01T10:00:00Z',
            metadata: { likes_count: 10, comments_count: 1 },
          },
        ],
        next_cursor: null,
      },
    });

    const { result } = renderHook(() => useDiscoverFeed({ autoLoad: true }));

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });

    expect(mockApiService.getDiscoverFeed).toHaveBeenCalledTimes(1);
  });
});
