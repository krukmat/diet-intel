const express = require('express');
const request = require('supertest');

jest.mock('../data/analyticsRepository', () => ({
  insertEvent: jest.fn().mockResolvedValue(101),
  getRecentEvents: jest.fn(),
  getEventStats: jest.fn(),
  cleanupOldEvents: jest.fn(),
}));

jest.mock('../utils/api', () => ({
  recordDiscoverInteraction: jest.fn().mockResolvedValue({ ok: true }),
}));

const analyticsRepository = require('../data/analyticsRepository');
const dietIntelAPI = require('../utils/api');
const analyticsRouter = require('../routes/analytics');

const buildTestApp = (withAuth = true) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (withAuth) {
      req.cookies = { access_token: 'token-123' };
      res.locals.currentUser = { id: 'user-456' };
    } else {
      req.cookies = {};
      res.locals.currentUser = null;
    }
    next();
  });
  app.use('/analytics', analyticsRouter);
  return app;
};

describe('POST /analytics/discover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists view events without forwarding to backend', async () => {
    const app = buildTestApp();

    const response = await request(app)
      .post('/analytics/discover')
      .send({
        type: 'view',
        surface: 'web',
        request_id: 'req-1',
        variant: 'control',
        items: [{ id: 'post-1', rank_score: 0.42 }],
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.backend_forwarded).toBe(false);
    expect(analyticsRepository.insertEvent).toHaveBeenCalledWith(
      'user-456',
      'view',
      'web',
      expect.objectContaining({
        type: 'view',
        request_id: 'req-1',
        items_count: 1,
      }),
    );
    expect(dietIntelAPI.recordDiscoverInteraction).not.toHaveBeenCalled();
  });

  it('returns 400 when interaction event lacks post_id', async () => {
    const app = buildTestApp();

    const response = await request(app)
      .post('/analytics/discover')
      .send({
        type: 'click',
        surface: 'web',
        variant: 'experiment',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/post_id/i);
    expect(analyticsRepository.insertEvent).not.toHaveBeenCalled();
    expect(dietIntelAPI.recordDiscoverInteraction).not.toHaveBeenCalled();
  });

  it('forwards click interactions to backend with auth context', async () => {
    const app = buildTestApp();

    const response = await request(app)
      .post('/analytics/discover')
      .send({
        type: 'click',
        surface: 'web',
        post_id: 'post-99',
        rank_score: 0.91,
        variant: 'treatment',
        reason: 'popular',
        request_id: 'req-xyz',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.backend_forwarded).toBe(true);
    expect(dietIntelAPI.recordDiscoverInteraction).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({
        post_id: 'post-99',
        action: 'click',
        surface: 'web',
        variant: 'treatment',
        rank_score: 0.91,
        reason: 'popular',
        request_id: 'req-xyz',
      }),
    );
    expect(analyticsRepository.insertEvent).toHaveBeenCalledWith(
      'user-456',
      'click',
      'web',
      expect.objectContaining({
        type: 'click',
        post_id: 'post-99',
        rank_score: 0.91,
        reason: 'popular',
      }),
    );
  });

  it('skips backend forwarding when auth context is missing', async () => {
    const app = buildTestApp(false);

    const response = await request(app)
      .post('/analytics/discover')
      .send({
        type: 'dismiss',
        surface: 'web',
        post_id: 'post-10',
        rank_score: 0.51,
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.backend_forwarded).toBe(false);
    expect(dietIntelAPI.recordDiscoverInteraction).not.toHaveBeenCalled();
    expect(analyticsRepository.insertEvent).toHaveBeenCalledWith(
      'anonymous',
      'dismiss',
      'web',
      expect.objectContaining({
        type: 'dismiss',
        post_id: 'post-10',
        rank_score: 0.51,
      }),
    );
  });
});
