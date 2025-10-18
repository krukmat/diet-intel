const express = require('express');
const router = express.Router();

// EPIC_B.B5: Web Analytics for Discover Feed
const analyticsEvents = []; // In-memory storage for demo purposes

/**
 * POST /analytics/discover
 * Web client sends discovery-related events for analytics
 *
 * Expected body:
 * {
 *   type: 'view' | 'load_more' | 'surface_switch',
 *   surface: 'web',
 *   items?: Array<{id, rank_score, author_id}>,
 *   surface_from?: 'web' | 'mobile',
 *   surface_to?: 'web' | 'mobile'
 * }
 */
router.post('/discover', (req, res) => {
  try {
    const event = {
      type: req.body.type,
      surface: req.body.surface,
      user_id: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
      user_agent: req.headers['user-agent'],
      items_count: req.body.items?.length || 0,
      // Store event details based on type
      ...(req.body.type === 'load_more' && { cursor: req.body.cursor }),
      ...(req.body.type === 'surface_switch' && {
        surface_from: req.body.surface_from,
        surface_to: req.body.surface_to
      }),
      ...(req.body.items && { items: req.body.items }),
    };

    // Store event (would be sent to analytics platform)
    analyticsEvents.push(event);

    console.log('[WEB_ANALYTICS] Discover event recorded:', {
      type: event.type,
      surface: event.surface,
      user_id: event.user_id,
      items_count: event.items_count,
      timestamp: event.timestamp,
    });

    res.json({
      success: true,
      event_id: event.timestamp,  // pretend ID
    });

  } catch (error) {
    console.error('[WEB_ANALYTICS_ERROR] Failed to record discover event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record analytics event'
    });
  }
});

/**
 * GET /analytics/discover/events
 * Admin endpoint to view recent discovery events
 */
router.get('/discover/events', (req, res) => {
  // Basic auth check (simplified)
  const recentEvents = analyticsEvents.slice(-50); // Last 50 events

  res.json({
    total_logged: analyticsEvents.length,
    recent_events: recentEvents,
    summary: {
      view_events: recentEvents.filter(e => e.type === 'view').length,
      load_more_events: recentEvents.filter(e => e.type === 'load_more').length,
      surface_switch_events: recentEvents.filter(e => e.type === 'surface_switch').length,
    }
  });
});

module.exports = router;
