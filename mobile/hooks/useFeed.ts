// EPIC_A.A4: Custom React Hook for Social Feed Data Management
// Provides paginated feed data with loading states and error handling

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/ApiService';

export interface FeedItem {
  id: string;
  user_id: string;
  actor_id: string;
  event_name: string;
  payload: Record<string, any>;
  created_at: string;
}

export interface FeedResponse {
  items: FeedItem[];
  next_cursor?: string;
}

export interface UseFeedState {
  data: FeedItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor: string | null;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
}

// Hook for managing social feed state and API interactions
export function useFeed(limit: number = 20): UseFeedState {
  const [data, setData] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);

  // Fetch feed data from API
  const fetchFeed = useCallback(async (
    feedCursor: string | null = null,
    append: boolean = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getFeed({
        limit: limit,
        cursor: feedCursor || undefined
      });

      const feedData: FeedResponse = response.data;

      setData(prevData =>
        append ? [...prevData, ...feedData.items] : feedData.items
      );

      setCursor(feedData.next_cursor || null);
      setHasMore(!!feedData.next_cursor);

    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail ||
                          err?.message ||
                          'Failed to load feed';
      setError(errorMessage);
      console.error('useFeed.fetchFeed error:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Load more items (pagination)
  const loadMore = useCallback(() => {
    if (!loading && hasMore && cursor) {
      fetchFeed(cursor, true);
    }
  }, [loading, hasMore, cursor, fetchFeed]);

  // Refresh feed (pull-to-refresh)
  const refresh = useCallback(() => {
    fetchFeed(null, false);
  }, [fetchFeed]);

  // Retry after error
  const retry = useCallback(() => {
    refresh();
  }, [refresh]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    hasMore,
    cursor,
    loadMore,
    refresh,
    retry,
  };
}
