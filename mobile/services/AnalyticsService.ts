import { apiService } from './ApiService';
import { authService } from './AuthService';
import { DiscoverFeedItem } from '../types/feed';

// EPIC_B.B5: Mobile Analytics Service for Discover Feed
class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private maxStoredEvents = 100;

  async trackDiscoverView(itemsCount: number, surface: 'mobile' | 'web'): Promise<void> {
    const event: DiscoverViewEvent = {
      type: 'discover_view',
      surface,
      items_count: itemsCount,
      timestamp: new Date().toISOString(),
      user_id: await this.getCurrentUserId(),
      user_agent: this.getUserAgent(),
    };

    await this.recordEvent(event, 'Discover feed viewed');
  }

  async trackDiscoverLoadMore(itemsCount: number, surface: 'mobile' | 'web', cursor?: string): Promise<void> {
    const event: DiscoverLoadMoreEvent = {
      type: 'discover_load_more',
      surface,
      items_count: itemsCount,
      cursor: cursor || null,
      timestamp: new Date().toISOString(),
      user_id: await this.getCurrentUserId(),
      user_agent: this.getUserAgent(),
    };

    await this.recordEvent(event, 'More discover feed items loaded');
  }

  async trackDiscoverSurfaceSwitch(surfaceFrom: 'mobile' | 'web', surfaceTo: 'mobile' | 'web'): Promise<void> {
    const event: DiscoverSurfaceSwitchEvent = {
      type: 'discover_surface_switch',
      surface_from: surfaceFrom,
      surface_to: surfaceTo,
      timestamp: new Date().toISOString(),
      user_id: await this.getCurrentUserId(),
      user_agent: this.getUserAgent(),
    };

    await this.recordEvent(event, 'Discover feed surface changed');
  }

  async trackDiscoverItemInteraction(
    item: DiscoverFeedItem,
    options: {
      action: 'click' | 'dismiss';
      surface: 'mobile' | 'web';
      variant?: string;
      requestId?: string | null;
    },
  ): Promise<void> {
    const userId = await this.getCurrentUserId();
    const timestamp = new Date().toISOString();
    const variant = options.variant || 'control';
    const requestId = options.requestId || null;

    const event: DiscoverItemInteractionEvent = {
      type: 'discover_item_interaction',
      action: options.action,
      item_id: item.id,
      surface: options.surface,
      timestamp,
      user_id: userId,
      user_agent: this.getUserAgent(),
      variant,
      request_id: requestId,
      rank_score: item.rank_score,
      reason: item.reason,
    };

    await this.recordEvent(event, `Discover item ${options.action}`);

    try {
      await apiService.recordDiscoverInteraction({
        post_id: item.id,
        action: options.action,
        surface: options.surface,
        variant,
        request_id: requestId,
        rank_score: item.rank_score,
        reason: item.reason,
      });
    } catch (error) {
      console.warn('[MOBILE_ANALYTICS] Failed to forward discover interaction', {
        post_id: item.id,
        action: options.action,
        error,
      });
    }
  }

  private async recordEvent(event: AnalyticsEvent, description: string): Promise<void> {
    try {
      // Store in local cache
      this.events.push(event);

      // Keep only recent events
      if (this.events.length > this.maxStoredEvents) {
        this.events = this.events.slice(-this.maxStoredEvents);
      }

      // Log to console for development
      const surfaceLabel = 'surface' in event
        ? event.surface
        : `${event.surface_from}→${event.surface_to}`;

      console.log('[MOBILE_ANALYTICS]', {
        description,
        type: event.type,
        surface: surfaceLabel,
        user_id: event.user_id,
        timestamp: event.timestamp,
      });

      // Could send to backend analytics endpoint if needed
      // await this.sendToBackend(event);

    } catch (error) {
      console.error('[MOBILE_ANALYTICS_ERROR] Failed to record event:', error);
    }
  }

  private async getCurrentUserId(): Promise<string> {
    try {
      const tokens = await authService.getStoredTokens();
      if (tokens?.access_token) {
        const userInfo = await authService.getCurrentUser(tokens.access_token);
        return userInfo?.id || 'anonymous';
      }
    } catch (error) {
      console.debug('Could not get user ID for analytics:', error);
    }
    return 'anonymous';
  }

  private getUserAgent(): string {
    return `Mobile-App/${require('../package.json').version || '1.0.0'}`;
  }

  private async sendToBackend(event: AnalyticsEvent): Promise<void> {
    // Optional: Send events to backend for centralized collection
    // This would call /analytics/mobile/discover endpoint if implemented
    /*
    try {
      await apiService.post('/analytics/mobile/discover', event);
    } catch (error) {
      console.warn('Failed to send analytics to backend:', error);
      // Continue locally if backend fails
    }
    */
  }

  // Admin/utility methods
  getRecentEvents(limit = 50): AnalyticsEvent[] {
    return this.events.slice(-limit);
  }

  getEventSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    this.events.forEach(event => {
      const surfaceLabel = 'surface' in event
        ? event.surface
        : `${event.surface_from}_${event.surface_to}`;
      const key = `${event.type}_${surfaceLabel || 'unknown'}`;
      summary[key] = (summary[key] || 0) + 1;
    });
    return summary;
  }

  clearEvents(): void {
    this.events = [];
  }
}

// Event type definitions
interface BaseAnalyticsEvent {
  type: string;
  timestamp: string;
  user_id: string;
  user_agent: string;
}

interface DiscoverViewEvent extends BaseAnalyticsEvent {
  type: 'discover_view';
  surface: 'mobile' | 'web';
  items_count: number;
}

interface DiscoverLoadMoreEvent extends BaseAnalyticsEvent {
  type: 'discover_load_more';
  surface: 'mobile' | 'web';
  items_count: number;
  cursor: string | null;
}

interface DiscoverSurfaceSwitchEvent extends BaseAnalyticsEvent {
  type: 'discover_surface_switch';
  surface_from: 'mobile' | 'web';
  surface_to: 'mobile' | 'web';
}

interface DiscoverItemInteractionEvent extends BaseAnalyticsEvent {
  type: 'discover_item_interaction';
  action: 'click' | 'dismiss';
  item_id: string;
  surface: 'mobile' | 'web';
  variant: string;
  request_id: string | null;
  rank_score: number;
  reason: string;
}

type AnalyticsEvent = DiscoverViewEvent | DiscoverLoadMoreEvent | DiscoverSurfaceSwitchEvent | DiscoverItemInteractionEvent;

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
