const express = require('express');
const router = express.Router();
const analyticsRepository = require('../data/analyticsRepository');

/**
 * POST /analytics/discover
 * Web client sends discovery-related events for analytics
 * EPIC_B.B6: Persist events to database instead of memory
 *
 * Expected body:
 * {
 *   type: 'view' | 'load_more' | 'surface_switch' | 'click' | 'dismiss',
 *   surface: 'web',
 *   post_id?: string,  // For click/dismiss events
 *   rank_score?: number,  // For click/dismiss events
 *   reason?: string,  // For click/dismiss events
 *   request_id?: string,  // For context tracking
 *   variant?: string,  // Experiment variant
 *   items?: Array<{id, rank_score, author_id}>,
 *   surface_from?: 'web' | 'mobile',
 *   surface_to?: 'web' | 'mobile',
 *   cursor?: string
 * }
 */
router.post('/discover', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id || 'anonymous';
    const eventType = req.body.type;
    const surface = req.body.surface || 'web';

    // Validate required fields
    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'Event type is required'
      });
    }

    // Build event payload
    const payload = {
      type: eventType,
      surface: surface,
      user_id: userId,
      timestamp: new Date().toISOString(),
      user_agent: req.headers['user-agent'],
      // Context-specific data
      ...(req.body.request_id && { request_id: req.body.request_id }),
      ...(req.body.variant && { variant: req.body.variant }),
      // Event-specific data
      ...(eventType === 'load_more' && { cursor: req.body.cursor }),
      ...(eventType === 'surface_switch' && {
        surface_from: req.body.surface_from,
        surface_to: req.body.surface_to
      }),
      ...(req.body.items && { items_count: req.body.items.length }),
      ...(req.body.items && { items: req.body.items }),
      // Interaction events
      ...(req.body.post_id && { post_id: req.body.post_id }),
      ...(req.body.rank_score !== undefined && { rank_score: req.body.rank_score }),
      ...(req.body.reason && { reason: req.body.reason }),
    };

    // Persist to database
    const eventId = await analyticsRepository.insertEvent(userId, eventType, surface, payload);

    console.log('[WEB_ANALYTICS_DB] Discover event persisted:', {
      id: eventId,
      type: eventType,
      surface: surface,
      user_id: userId,
      timestamp: payload.timestamp,
    });

    res.json({
      success: true,
      event_id: eventId,
    });

  } catch (error) {
    console.error('[WEB_ANALYTICS_DB_ERROR] Failed to persist discover event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record analytics event'
    });
  }
});

/**
 * GET /analytics/discover/events
 * Admin endpoint to view and analyze recent discovery events
 * EPIC_B.B6: Return database-persisted events with stats
 */
router.get('/discover/events', async (req, res) => {
  try {
    // Get recent events from database
    const recentEvents = await analyticsRepository.getRecentEvents(50);

    // Get statistics for last 24 hours
    const stats24h = await analyticsRepository.getEventStats(24);

    // Get statistics for last 7 days
    const stats7d = await analyticsRepository.getEventStats(168); // 7*24 hours

    res.json({
      total_logged: recentEvents.length,
      recent_events: recentEvents.slice(0, 20), // Last 20 for display
      summary_24h: {
        total_events: stats24h.total_events,
        unique_users: stats24h.unique_users,
        event_types: Object.keys(stats24h.by_event_type),
        surfaces: Object.keys(stats24h.by_surface),
        top_event_type: Object.entries(stats24h.by_event_type)
          .sort(([,a], [,b]) => b.total - a.total)[0]?.[0] || 'none',
        top_surface: Object.entries(stats24h.by_surface)
          .sort(([,a], [,b]) => b.total - a.total)[0]?.[0] || 'none'
      },
      summary_7d: {
        total_events: stats7d.total_events,
        unique_users: stats7d.unique_users,
        retention: stats7d.unique_users > 0 ?
          Math.round((stats24h.unique_users / stats7d.unique_users) * 100) : 0
      },
      // Include full breakdown for analytics
      detailed_stats: {
        last_24h: stats24h.event_type_breakdown,
        last_7d: stats7d.event_type_breakdown
      }
    });

  } catch (error) {
    console.error('[WEB_ANALYTICS_DB_ERROR] Failed to retrieve events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics data',
      details: error.message
    });
  }
});

/**
 * GET /analytics/discover/stats
 * Analytics endpoint for charts and reporting
 */
router.get('/discover/stats', async (req, res) => {
  try {
    const hoursAgo = parseInt(req.query.hours) || 24;
    const stats = await analyticsRepository.getEventStats(hoursAgo);

    res.json({
      period_hours: hoursAgo,
      generated_at: new Date().toISOString(),
      stats: stats
    });

  } catch (error) {
    console.error('[WEB_ANALYTICS_DB_ERROR] Failed to retrieve stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

/**
 * POST /analytics/discover/cleanup
 * Admin endpoint to cleanup old events
 */
router.post('/discover/cleanup', async (req, res) => {
  try {
    const daysOld = parseInt(req.body.days_old) || 30;
    const deletedCount = await analyticsRepository.cleanupOldEvents(daysOld);

    res.json({
      success: true,
      deleted_count: deletedCount,
      retention_days: daysOld,
      message: `Cleaned up ${deletedCount} events older than ${daysOld} days`
    });

  } catch (error) {
    console.error('[WEB_ANALYTICS_DB_ERROR] Failed to cleanup events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup events'
    });
  }
});

module.exports = router;
