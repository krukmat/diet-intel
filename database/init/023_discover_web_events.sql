-- EPIC_B.B6: Persistent storage for discover analytics events (PostgreSQL)

CREATE TABLE IF NOT EXISTS discover_web_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    surface TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discover_web_events_user_type
    ON discover_web_events (user_id, event_type);

CREATE INDEX IF NOT EXISTS idx_discover_web_events_created_at
    ON discover_web_events (created_at DESC);
