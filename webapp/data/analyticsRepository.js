/**
 * Analytics Repository - Persist discover feed events to database
 * EPIC_B.B6: Analytics persistencia duradera
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Pool } = require('pg');

const resolveDatabaseUrl = () => {
    if (process.env.ANALYTICS_DATABASE_URL) {
        return process.env.ANALYTICS_DATABASE_URL;
    }
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }
    return null;
};

const RAW_DATABASE_URL = resolveDatabaseUrl();

const isPostgresUrl = (url) => url && /^postgres(?:ql)?:\/\//i.test(url);

// Database path - adjust for your setup
const DEFAULT_SQLITE_PATH = path.join(__dirname, '../../database/dietintel.db');

const parseJsonPayload = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (err) {
        console.warn('Failed to parse analytics payload JSON:', err.message);
        return {};
    }
};

class AnalyticsRepository {
    constructor(options = {}) {
        const { databasePath, connectionString, forcePostgres } = options;

        this.isPostgres = Boolean(
            typeof forcePostgres === 'boolean'
                ? forcePostgres
                : isPostgresUrl(connectionString || RAW_DATABASE_URL)
        );

        if (this.isPostgres) {
            const connString = connectionString || RAW_DATABASE_URL;
            if (!connString) {
                throw new Error('Postgres analytics repository requires a connection string');
            }

            this.pool = new Pool({
                connectionString: connString,
                max: Number(process.env.ANALYTICS_DB_POOL_SIZE || 5),
                ssl:
                    process.env.NODE_ENV === 'production'
                        ? { rejectUnauthorized: false }
                        : undefined,
            });

            this.ready = this.initTable();
        } else {
            const sqlitePath = databasePath || (RAW_DATABASE_URL && !isPostgresUrl(RAW_DATABASE_URL)
                ? RAW_DATABASE_URL
                : DEFAULT_SQLITE_PATH);
            this.databasePath = sqlitePath;
            this.ready = new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(sqlitePath, (err) => {
                    if (err) {
                        console.error('Error opening analytics database:', err.message);
                        reject(err);
                        return;
                    }
                    this.initTable().then(resolve).catch(reject);
                });
            });
        }
    }

    /**
     * Initialize discover_web_events table
     */
    initTable() {
        if (this.isPostgres) {
            return this.initPostgresTable();
        }
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

    async initPostgresTable() {
        const client = await this.pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS discover_web_events (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    surface TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_discover_web_events_user_type
                ON discover_web_events (user_id, event_type);
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_discover_web_events_created_at
                ON discover_web_events (created_at DESC);
            `);
        } finally {
            client.release();
        }
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
        if (this.isPostgres) {
            const result = await this.pool.query(
                `
                INSERT INTO discover_web_events (user_id, event_type, surface, payload)
                VALUES ($1, $2, $3, $4)
                RETURNING id
                `,
                [userId, eventType, surface, JSON.stringify(payload)]
            );
            return result.rows[0].id;
        }
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
        if (this.isPostgres) {
            const result = await this.pool.query(
                `
                SELECT id,
                       user_id,
                       event_type,
                       surface,
                       payload,
                       created_at,
                       ROW_NUMBER() OVER (PARTITION BY user_id, event_type ORDER BY created_at DESC) AS rn
                FROM discover_web_events
                ORDER BY created_at DESC
                LIMIT $1
                `,
                [limit]
            );

            return result.rows.map((row) => ({
                id: row.id,
                user_id: row.user_id,
                event_type: row.event_type,
                surface: row.surface,
                payload: parseJsonPayload(row.payload),
                created_at: row.created_at,
                sequence: Number(row.rn),
            }));
        }
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
                    // Parse JSON payloads and format response
                    const events = rows.map(row => ({
                        id: row.id,
                        user_id: row.user_id,
                        event_type: row.event_type,
                        surface: row.surface,
                        payload: parseJsonPayload(row.payload),
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
        if (this.isPostgres) {
            const parsedHours = Number(hoursAgo);
            const lookback = Number.isFinite(parsedHours) && parsedHours > 0 ? Math.floor(parsedHours) : 24;

            const client = await this.pool.connect();
            try {
                const breakdown = await client.query(
                    `
                    SELECT event_type,
                           surface,
                           COUNT(*) AS count,
                           COUNT(DISTINCT user_id) AS unique_users
                    FROM discover_web_events
                    WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
                    GROUP BY event_type, surface
                    ORDER BY event_type, surface
                    `,
                    [lookback]
                );

                const uniqueUsersResult = await client.query(
                    `
                    SELECT COUNT(DISTINCT user_id) AS unique_users
                    FROM discover_web_events
                    WHERE created_at >= NOW() - ($1 || ' hours')::INTERVAL
                    `,
                    [lookback]
                );

                const rows = breakdown.rows;
                const stats = {
                    total_events: rows.reduce((sum, row) => sum + Number(row.count), 0),
                    unique_users: Number(uniqueUsersResult.rows[0]?.unique_users || 0),
                    by_event_type: {},
                    by_surface: {},
                    event_type_breakdown: rows.map((row) => ({
                        event_type: row.event_type,
                        surface: row.surface,
                        count: Number(row.count),
                        unique_users: Number(row.unique_users),
                    })),
                };

                rows.forEach((row) => {
                    if (!stats.by_event_type[row.event_type]) {
                        stats.by_event_type[row.event_type] = { total: 0, by_surface: {} };
                    }
                    stats.by_event_type[row.event_type].total += Number(row.count);
                    stats.by_event_type[row.event_type].by_surface[row.surface] = {
                        count: Number(row.count),
                        unique_users: Number(row.unique_users),
                    };
                });

                rows.forEach((row) => {
                    if (!stats.by_surface[row.surface]) {
                        stats.by_surface[row.surface] = { total: 0, by_event_type: {} };
                    }
                    stats.by_surface[row.surface].total += Number(row.count);
                    stats.by_surface[row.surface].by_event_type[row.event_type] = {
                        count: Number(row.count),
                        unique_users: Number(row.unique_users),
                    };
                });

                return stats;
            } finally {
                client.release();
            }
        }
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
        if (this.isPostgres) {
            const parsedDays = Number(daysOld);
            const lookbackDays = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.floor(parsedDays) : 30;
            const result = await this.pool.query(
                `
                DELETE FROM discover_web_events
                WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
                `,
                [lookbackDays]
            );
            return result.rowCount || 0;
        }
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
        if (this.isPostgres) {
            if (this.pool) {
                await this.pool.end();
                this.pool = null;
            }
            return;
        }

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
