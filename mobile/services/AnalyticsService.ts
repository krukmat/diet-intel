import { apiService } from './ApiService';
import { authService } from './AuthService';

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

  async trackDiscoverItemInteraction(itemId: string, action: 'view' | 'share' | 'save', surface: 'mobile' | 'web'): Promise<void> {
    const event: DiscoverItemInteractionEvent = {
      type: 'discover_item_interaction',
      action,
      item_id: itemId,
      surface,
      timestamp: new Date().toISOString(),
      user_id: await this.getCurrentUserId(),
      user_agent: this.getUserAgent(),
    };

    await this.recordEvent(event, `Item ${action} interaction`);
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
      console.log('[MOBILE_ANALYTICS]', {
        description,
        type: event.type,
        surface: event.surface || event.surface_from + '→' + event.surface_to,
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
        const userInfo = await authService.validateToken(tokens.access_token);
        return userInfo?.id || 'anonymous';
      }
    } catch (error) {
      console.debug('Could not get user ID for analytics:', error);
    }
    return 'anonymous';
  }

  private getUserAgent(): string {
    return `Mobile-App/${require('../../package.json').version || '1.0.0'}`;
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
      const key = `${event.type}_${event.surface || 'unknown'}`;
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
  action: 'view' | 'share' | 'save';
  item_id: string;
  surface: 'mobile' | 'web';
}

type AnalyticsEvent = DiscoverViewEvent | DiscoverLoadMoreEvent | DiscoverSurfaceSwitchEvent | DiscoverItemInteractionEvent;

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
