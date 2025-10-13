const express = require('express');
const router = express.Router();
const dietIntelAPI = require('../utils/api');
const { requireAuth } = require('../middleware/auth');

/**
 * EPIC_A.A4: Feed routes for social activity feed
 */

// GET /feed - Main feed page (requires authentication)
router.get('/feed', requireAuth, async (req, res) => {
  try {
    // Get pagination parameters
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor || null;

    const token = req.cookies.access_token;

    // Call backend API with authentication
    const feedData = await dietIntelAPI.getFeed(token, {
      limit: limit,
      cursor: cursor
    });

    // Render feed template
    res.render('feed/index', {
      title: 'Social Activity',
      feed: feedData,
      user: res.locals.currentUser,
      pagination: {
        limit: limit,
        cursor: cursor,
        hasMore: !!feedData.next_cursor
      }
    });

  } catch (error) {
    console.error('Feed route error:', error);
    res.render('feed/index', {
      title: 'Social Activity',
      feed: { items: [], next_cursor: null },
      user: res.locals.currentUser,
      error: 'Unable to load feed. Please try again later.',
      pagination: { limit: 20, cursor: null, hasMore: false }
    });
  }
});

module.exports = router;
