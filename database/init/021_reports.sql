-- EPIC_A.A5: Content reports table
-- Migration: database/init/021_reports.sql

CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'abuse', 'nsfw', 'misinformation', 'other')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_at TIMESTAMP NULL,
    reviewed_by TEXT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_status_created_at ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_target ON content_reports(target_type, target_id);
