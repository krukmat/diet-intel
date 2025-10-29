-- EPIC_A.A5: Gamification core tables
-- Migration: database/init/019_gamification_core.sql

CREATE TABLE IF NOT EXISTS points_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_levels (
    user_id TEXT PRIMARY KEY,
    level INTEGER DEFAULT 1,
    points_total INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_badges (
    user_id TEXT NOT NULL,
    badge_code TEXT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_points_user_timestamp ON points_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_source ON points_ledger(source);
