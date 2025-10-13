-- EPIC_A.A5: Rate limiting table for posts
-- Migration: database/init/022_post_activity_log.sql

CREATE TABLE IF NOT EXISTS post_activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('post_create', 'comment_create', 'reaction')),
    activity_date DATE NOT NULL DEFAULT (date('now')),
    count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_type, activity_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_user_type_date ON post_activity_log(user_id, activity_type, activity_date DESC);
