const express = require('express');
const router = express.Router();
const dietIntelAPI = require('../utils/api');
const { requireAuth } = require('../middleware/auth');

const FOLLOWING_DEFAULT_LIMIT = 20;
const FOLLOWING_MAX_LIMIT = 100;
const DISCOVER_DEFAULT_LIMIT = 20;
const DISCOVER_MAX_LIMIT = 50;

const sanitizeLimit = (rawValue, fallback, max) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
};

const sanitizeCursor = (rawValue) => {
  if (typeof rawValue !== 'string') {
    return undefined;
  }
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeSurface = (rawValue) => (rawValue === 'mobile' ? 'mobile' : 'web');

const buildPagination = (limit, cursor, nextCursor) => ({
  limit,
  cursor: cursor ?? null,
  hasMore: Boolean(nextCursor),
});

router.get('/feed', requireAuth, async (req, res) => {
  const token = req.cookies.access_token;
  const limit = sanitizeLimit(req.query.limit, FOLLOWING_DEFAULT_LIMIT, FOLLOWING_MAX_LIMIT);
  const cursor = sanitizeCursor(req.query.cursor);

  try {
    const feedData = await dietIntelAPI.getFeed(token, { limit, cursor });

    res.render('feed/index', {
      title: 'Social Activity',
      feed: feedData,
      user: res.locals.currentUser,
      activeFeedTab: 'following',
      pagination: buildPagination(limit, cursor, feedData.next_cursor),
      surface: 'web',
      error: null,
    });
  } catch (error) {
    console.error('Feed route error:', error);

    res.render('feed/index', {
      title: 'Social Activity',
      feed: { items: [], next_cursor: null },
      user: res.locals.currentUser,
      activeFeedTab: 'following',
      pagination: buildPagination(FOLLOWING_DEFAULT_LIMIT, undefined, null),
      surface: 'web',
      error: 'Unable to load feed. Please try again later.',
    });
  }
});

router.get('/feed/discover', requireAuth, async (req, res) => {
  const token = req.cookies.access_token;
  const limit = sanitizeLimit(req.query.limit, DISCOVER_DEFAULT_LIMIT, DISCOVER_MAX_LIMIT);
  const cursor = sanitizeCursor(req.query.cursor);
  const surface = sanitizeSurface(req.query.surface);

  try {
    const feedData = await dietIntelAPI.getDiscoverFeed(token, {
      limit,
      cursor,
      surface,
    });

    res.render('feed/discover', {
      title: 'Discover Feed',
      feed: feedData,
      user: res.locals.currentUser,
      activeFeedTab: 'discover',
      pagination: buildPagination(limit, cursor, feedData.next_cursor),
      surface,
      error: null,
    });
  } catch (error) {
    console.error('Discover feed route error:', error);

    res.render('feed/discover', {
      title: 'Discover Feed',
      feed: { items: [], next_cursor: null },
      user: res.locals.currentUser,
      activeFeedTab: 'discover',
      pagination: buildPagination(DISCOVER_DEFAULT_LIMIT, undefined, null),
      surface,
      error: 'Unable to load discover feed. Please try again later.',
    });
  }
});

module.exports = router;
