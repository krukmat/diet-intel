const { test, expect } = require('@playwright/test');
const http = require('http');
const { URL } = require('url');

const PORT = 8000;

const createDiscoverFeedResponse = () => ({
  items: [
    {
      id: 'post-1',
      author_id: 'author-1',
      author_handle: 'healthy_chef',
      text: 'Protein-rich breakfast ideas!',
      rank_score: 0.87,
      reason: 'popular',
      created_at: new Date().toISOString(),
      media: [],
      metadata: {
        likes_count: 12,
        comments_count: 4,
      },
    },
  ],
  next_cursor: null,
  variant: 'experiment-a',
  request_id: 'req-analytics-test',
});

test.describe('Discover Feed Analytics', () => {
  let apiServer;
  const recordedInteractions = [];

  const startStubServer = () =>
    new Promise((resolve) => {
      apiServer = http.createServer(async (req, res) => {
        const parsed = new URL(req.url, `http://localhost:${PORT}`);

        if (req.method === 'GET' && parsed.pathname === '/auth/me') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'test-user',
              full_name: 'Test User',
              email: 'test@example.com',
            }),
          );
          return;
        }

        if (req.method === 'GET' && parsed.pathname === '/feed/discover') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(createDiscoverFeedResponse()));
          return;
        }

        if (req.method === 'POST' && parsed.pathname === '/feed/discover/interactions') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body || '{}');
              recordedInteractions.push(payload);
            } catch (err) {
              recordedInteractions.push({ error: err.message });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
          return;
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      apiServer.listen(PORT, resolve);
    });

  const stopStubServer = () =>
    new Promise((resolve, reject) => {
      if (!apiServer) {
        resolve();
        return;
      }
      apiServer.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

  test.beforeAll(async () => {
    await startStubServer();
  });

  test.afterAll(async () => {
    await stopStubServer();
  });

  test.beforeEach(async ({ context }) => {
    recordedInteractions.length = 0;
    await context.addCookies([
      {
        name: 'access_token',
        value: 'stub-token',
        url: 'http://localhost:3000',
        httpOnly: false,
      },
    ]);
  });

  const analyticsEventPredicate = (type) => (request) => {
    if (!request.url().endsWith('/analytics/discover') || request.method() !== 'POST') {
      return false;
    }
    try {
      const data = request.postDataJSON();
      return data && data.type === type;
    } catch (err) {
      return false;
    }
  };

  test('emits view, click, and dismiss analytics events with metadata', async ({ page }) => {
    const viewEventPromise = page.waitForRequest(analyticsEventPredicate('view'));

    await page.goto('/feed/discover');

    const viewRequest = await viewEventPromise;
    const viewPayload = viewRequest.postDataJSON();
    expect(viewPayload).toMatchObject({
      type: 'view',
      surface: 'web',
      variant: 'experiment-a',
      items_count: 1,
    });
    expect(Array.isArray(viewPayload.items)).toBe(true);
    expect(viewPayload.items[0]).toMatchObject({
      id: 'post-1',
      reason: 'popular',
    });

    const clickEventPromise = page.waitForRequest(analyticsEventPredicate('click'));
    await page.locator('[data-discover-item]').first().click();
    const clickRequest = await clickEventPromise;
    const clickPayload = clickRequest.postDataJSON();
    expect(clickPayload).toMatchObject({
      type: 'click',
      post_id: 'post-1',
      surface: 'web',
      variant: 'experiment-a',
      reason: 'popular',
    });

    const dismissEventPromise = page.waitForRequest(analyticsEventPredicate('dismiss'));
    await page.locator('[data-discover-dismiss]').first().click();
    const dismissRequest = await dismissEventPromise;
    const dismissPayload = dismissRequest.postDataJSON();
    expect(dismissPayload).toMatchObject({
      type: 'dismiss',
      post_id: 'post-1',
      surface: 'web',
      variant: 'experiment-a',
      reason: 'popular',
    });

    await expect(page.locator('[data-discover-item]')).toHaveCount(0);

    const actions = recordedInteractions.map((payload) => payload.action).sort();
    expect(actions).toEqual(['click', 'dismiss']);
  });
});
