import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/ApiService';
import { analyticsService } from '../services/AnalyticsService';
import { DiscoverFeedItem, DiscoverFeedResponse } from '../types/feed';

interface UseDiscoverFeedOptions {
  limit?: number;
  surface?: 'mobile' | 'web';
  autoLoad?: boolean;
}

interface UseDiscoverFeedState {
  items: DiscoverFeedItem[];
  loading: boolean;
  error: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  variant: string;
  requestId: string | null;
}

type FetchParams = {
  cursor?: string;
  append?: boolean;
  surfaceOverride?: 'mobile' | 'web';
};

export const useDiscoverFeed = (options: UseDiscoverFeedOptions = {}) => {
  const { limit = 20, surface = 'mobile', autoLoad = true } = options;

  const [state, setState] = useState<UseDiscoverFeedState>({
    items: [],
    loading: false,
    error: null,
    nextCursor: null,
    hasMore: false,
    variant: 'control',
    requestId: null,
  });

  const [currentSurface, setCurrentSurface] = useState<'mobile' | 'web'>(surface);

  const fetchFeed = useCallback(
    async ({ cursor, append = false, surfaceOverride }: FetchParams = {}) => {
      const surfaceToUse = surfaceOverride ?? currentSurface;

      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const response = await apiService.getDiscoverFeed({
          limit,
          cursor,
          surface: surfaceToUse,
        });

        const data: DiscoverFeedResponse = response.data ?? { items: [], next_cursor: null, variant: 'control' };
        const fetchedItems = data.items ?? [];
        const nextCursor = data.next_cursor ?? null;
        const variantFromResponse = data.variant || 'control';
        const requestId = (data as any).request_id || null;

        setState(prev => ({
          items: append ? [...prev.items, ...fetchedItems] : fetchedItems,
          loading: false,
          error: null,
          nextCursor,
          hasMore: Boolean(nextCursor),
          variant: variantFromResponse,
          requestId,
        }));

        try {
          if (append) {
            if (fetchedItems.length) {
              analyticsService
                .trackDiscoverLoadMore(fetchedItems.length, surfaceToUse, cursor || null)
                .catch(() => undefined);
            }
          } else {
            if (fetchedItems.length) {
              analyticsService
                .trackDiscoverView(fetchedItems.length, surfaceToUse)
                .catch(() => undefined);
            }
          }
        } catch (analyticsError) {
          console.debug('discover analytics error', analyticsError);
        }
      } catch (error) {
        console.error('useDiscoverFeed.fetchFeed failed:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unable to load discover feed';

        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
      }
    },
    [currentSurface, limit],
  );

  const refresh = useCallback(() => {
    fetchFeed({ append: false });
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    if (state.loading || !state.nextCursor) {
      return;
    }

    fetchFeed({ cursor: state.nextCursor, append: true });
  }, [state.loading, state.nextCursor, fetchFeed]);

  const switchSurface = useCallback(
    (newSurface: 'mobile' | 'web') => {
      analyticsService
        .trackDiscoverSurfaceSwitch(currentSurface, newSurface)
        .catch(() => undefined);

      setCurrentSurface(newSurface);
      setState(prev => ({
        ...prev,
        items: [],
        nextCursor: null,
        hasMore: false,
        variant: 'control',
        requestId: null,
      }));

      fetchFeed({ surfaceOverride: newSurface, append: false });
    },
    [currentSurface, fetchFeed],
  );

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    if (autoLoad) {
      fetchFeed({ append: false });
    }
  }, [autoLoad, fetchFeed]);

  return {
    ...state,
    surface: currentSurface,
    refresh,
    loadMore,
    switchSurface,
    clearError,
  };
};

export default useDiscoverFeed;
