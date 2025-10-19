let sqliteAvailable = true;

try {
  require.resolve('sqlite3');
} catch (error) {
  sqliteAvailable = false;
}

if (!sqliteAvailable) {
  describe.skip('AnalyticsRepository (EPIC_B.B6)', () => {
    test('skipped because sqlite3 native bindings are unavailable in this environment', () => {});
  });
} else {
  const { AnalyticsRepository } = require('../../data/analyticsRepository');

  describe('AnalyticsRepository (EPIC_B.B6)', () => {
    let repository;

    const updateCreatedAt = (db, id, offsetExpression) => new Promise((resolve, reject) => {
      db.run(
        `UPDATE discover_web_events SET created_at = datetime('now', ?) WHERE id = ?`,
        [offsetExpression, id],
        function updateCallback(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });

    beforeEach(async () => {
      repository = new AnalyticsRepository({ databasePath: ':memory:' });
      await repository.ready;
    });

    afterEach(async () => {
      await repository.close();
    });

    test('persists discover events and aggregates stats with correct totals', async () => {
      const eventId = await repository.insertEvent('user-123', 'view', 'web', {
        request_id: 'req-1',
        items_count: 3
      });

      expect(typeof eventId).toBe('number');

      const recentEvents = await repository.getRecentEvents(10);
      expect(recentEvents.length).toBe(1);
      expect(recentEvents[0]).toMatchObject({
        id: eventId,
        user_id: 'user-123',
        event_type: 'view',
        surface: 'web'
      });
      expect(recentEvents[0].payload).toEqual(
        expect.objectContaining({ request_id: 'req-1', items_count: 3 })
      );
      const first = await repository.insertEvent('user-1', 'view', 'web', { cursor: null });
      const second = await repository.insertEvent('user-1', 'click', 'web', { post_id: 'p-1' });
      const third = await repository.insertEvent('user-2', 'view', 'mobile', { cursor: 'xyz' });

      // Age the third event 48 hours so it should be excluded from 24h stats
      await updateCreatedAt(repository.db, third, '-48 hours');

      const stats24h = await repository.getEventStats(24);
      expect(stats24h.total_events).toBe(3);
      expect(stats24h.unique_users).toBe(2);
      expect(stats24h.by_event_type.view.total).toBe(2);
      expect(stats24h.by_event_type.click.total).toBe(1);
      expect(stats24h.by_surface.web.total).toBe(3);

      const stats72h = await repository.getEventStats(72);
      expect(stats72h.total_events).toBe(4);
      expect(stats72h.unique_users).toBe(3);
      expect(stats72h.by_surface.mobile.total).toBe(1);
      expect(stats72h.event_type_breakdown.length).toBeGreaterThan(0);
    });

  });
}
