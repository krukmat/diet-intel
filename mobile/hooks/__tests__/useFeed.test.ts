import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFeed } from '../useFeed';
import { apiService } from '../../services/ApiService';

jest.mock('../../services/ApiService', () => ({
  apiService: {
    getFeed: jest.fn(),
  }
}));

describe('useFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads initial feed data', async () => {
    (apiService.getFeed as jest.Mock).mockResolvedValue({
      data: { items: [{ id: '1', user_id: 'u1', actor_id: 'a1', event_name: 'post', payload: {}, created_at: 'now' }], next_cursor: 'next' }
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.cursor).toBe('next');
  });

  it('appends data when loading more', async () => {
    (apiService.getFeed as jest.Mock)
      .mockResolvedValueOnce({
        data: { items: [{ id: '1', user_id: 'u1', actor_id: 'a1', event_name: 'post', payload: {}, created_at: 'now' }], next_cursor: 'next' }
      })
      .mockResolvedValueOnce({
        data: { items: [{ id: '2', user_id: 'u2', actor_id: 'a2', event_name: 'post', payload: {}, created_at: 'later' }], next_cursor: null }
      });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('sets error when request fails', async () => {
    (apiService.getFeed as jest.Mock).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('boom');
  });
});
