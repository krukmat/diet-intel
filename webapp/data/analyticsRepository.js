/**
 * Analytics Repository - Persist discover feed events to database
 * EPIC_B.B6: Analytics persistencia duradera
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path - adjust for your setup
const DEFAULT_DB_PATH =
    process.env.DATABASE_URL || path.join(__dirname, '../../database/dietintel.db');

class AnalyticsRepository {
    constructor(options = {}) {
        const { databasePath = DEFAULT_DB_PATH } = options;
        this.databasePath = databasePath;
        this.ready = new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(databasePath, (err) => {
                if (err) {
                    console.error('Error opening analytics database:', err.message);
                    reject(err);
                    return;
                }
                this.initTable().then(resolve).catch(reject);
            });
        });
    }

    /**
     * Initialize discover_web_events table
     */
    initTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS discover_web_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                surface TEXT NOT NULL,
                payload TEXT NOT NULL, -- JSON string
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`;

        const indexUserTypeSQL = `
            CREATE INDEX IF NOT EXISTS idx_discover_web_events_user_type
            ON discover_web_events(user_id, event_type)`;

        const indexCreatedSQL = `
            CREATE INDEX IF NOT EXISTS idx_discover_web_events_created_at
            ON discover_web_events(created_at)`;

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(createTableSQL, (err) => {
                    if (err) {
                        console.error('Error creating discover_web_events table:', err.message);
                        reject(err);
                        return;
                    }

                    this.db.run(indexUserTypeSQL, (indexErr) => {
                        if (indexErr) {
                            console.error(
                                'Error creating discover_web_events_user_type index:',
                                indexErr.message
                            );
                            reject(indexErr);
                            return;
                        }

                        this.db.run(indexCreatedSQL, (createdIndexErr) => {
                            if (createdIndexErr) {
                                console.error(
                                    'Error creating discover_web_events_created_at index:',
                                    createdIndexErr.message
                                );
                                reject(createdIndexErr);
                                return;
                            }
                            resolve();
                        });
                    });
                });
            });
        });
    }

    /**
     * Insert a new discover feed event
     * @param {string} userId - User ID
     * @param {string} eventType - Event type (view|load_more|surface_switch|click|dismiss)
     * @param {string} surface - Surface (web|mobile)
     * @param {Object} payload - Event data as JSON
     * @returns {Promise<number>} Event ID
     */
    async insertEvent(userId, eventType, surface, payload) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO discover_web_events (user_id, event_type, surface, payload)
                VALUES (?, ?, ?, ?)
            `;

            const payloadJson = JSON.stringify(payload);

            this.db.run(sql, [userId, eventType, surface, payloadJson], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Get recent events (for admin endpoint)
     * @param {number} limit - Max events to return
     * @returns {Promise<Array>} Event array
     */
    async getRecentEvents(limit = 50) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, user_id, event_type, surface, payload, created_at,
                       ROW_NUMBER() OVER (PARTITION BY user_id, event_type ORDER BY created_at DESC) as rn
                FROM discover_web_events
                ORDER BY created_at DESC
                LIMIT ?
            `;

            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const safeParse = (raw) => {
                        if (!raw) return {};
                        try {
                            return JSON.parse(raw);
                        } catch (parseErr) {
                            console.warn('Failed to parse analytics payload JSON:', parseErr.message);
                            return {};
                        }
                    };

                    // Parse JSON payloads and format response
                    const events = rows.map(row => ({
                        id: row.id,
                        user_id: row.user_id,
                        event_type: row.event_type,
                        surface: row.surface,
                        payload: safeParse(row.payload),
                        created_at: row.created_at,
                        sequence: row.rn
                    }));
                    resolve(events);
                }
            });
        });
    }

    /**
     * Get event summary statistics
     * @param {number} hoursAgo - Hours to look back
     * @returns {Promise<Object>} Stats object
     */
    async getEventStats(hoursAgo = 24) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const parsedHours = Number(hoursAgo);
            const lookback = Number.isFinite(parsedHours) && parsedHours > 0
                ? Math.floor(parsedHours)
                : 24;
            const intervalParam = `-${lookback} hours`;

            const breakdownSql = `
                SELECT
                    event_type,
                    surface,
                    COUNT(*) AS count,
                    COUNT(DISTINCT user_id) AS unique_users
                FROM discover_web_events
                WHERE created_at >= datetime('now', ?)
                GROUP BY event_type, surface
                ORDER BY event_type, surface
            `;

            const uniqueSql = `
                SELECT COUNT(DISTINCT user_id) AS unique_users
                FROM discover_web_events
                WHERE created_at >= datetime('now', ?)
            `;

            this.db.all(breakdownSql, [intervalParam], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.db.get(uniqueSql, [intervalParam], (uniqueErr, uniqueRow) => {
                    if (uniqueErr) {
                        reject(uniqueErr);
                        return;
                    }

                    const stats = {
                        total_events: rows.reduce((sum, row) => sum + row.count, 0),
                        unique_users: uniqueRow ? uniqueRow.unique_users : 0,
                        by_event_type: {},
                        by_surface: {},
                        event_type_breakdown: rows
                    };

                    rows.forEach(row => {
                        if (!stats.by_event_type[row.event_type]) {
                            stats.by_event_type[row.event_type] = { total: 0, by_surface: {} };
                        }
                        stats.by_event_type[row.event_type].total += row.count;
                        stats.by_event_type[row.event_type].by_surface[row.surface] = {
                            count: row.count,
                            unique_users: row.unique_users
                        };
                    });

                    rows.forEach(row => {
                        if (!stats.by_surface[row.surface]) {
                            stats.by_surface[row.surface] = { total: 0, by_event_type: {} };
                        }
                        stats.by_surface[row.surface].total += row.count;
                        stats.by_surface[row.surface].by_event_type[row.event_type] = {
                            count: row.count,
                            unique_users: row.unique_users
                        };
                    });

                    resolve(stats);
                });
            });
        });
    }

    /**
     * Clean up old events (retention policy)
     * @param {number} daysOld - Delete events older than this
     * @returns {Promise<number>} Number of deleted rows
     */
    async cleanupOldEvents(daysOld = 30) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const parsedDays = Number(daysOld);
            const lookbackDays = Number.isFinite(parsedDays) && parsedDays > 0
                ? Math.floor(parsedDays)
                : 30;
            const intervalParam = `-${lookbackDays} days`;
            const sql = `DELETE FROM discover_web_events WHERE created_at < datetime('now', ?)`;

            this.db.run(sql, [intervalParam], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Close database connection
     */
    async close() {
        if (!this.db) {
            return;
        }
        try {
            await this.ready;
        } catch (err) {
            // If init failed, proceed with close attempt anyway
        }

        await new Promise((resolve, reject) => {
            this.db.close((closeErr) => {
                if (closeErr) {
                    console.error('Error closing analytics database:', closeErr.message);
                    reject(closeErr);
                } else {
                    resolve();
                }
            });
        });
        this.db = null;
    }
}

// Singleton instance
const analyticsRepository = new AnalyticsRepository();

// Graceful shutdown
process.on('SIGINT', () => analyticsRepository.close());
process.on('SIGTERM', () => analyticsRepository.close());

module.exports = analyticsRepository;
module.exports.AnalyticsRepository = AnalyticsRepository;
