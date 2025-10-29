-- EPIC_A.A5: Create posts tables for UGC content
-- Migration: database/init/018_create_posts.sql

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    text TEXT NOT NULL,
    visibility TEXT DEFAULT 'inherit_profile',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_media (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    url TEXT NOT NULL,
    order_position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_reactions (
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    reaction_type TEXT DEFAULT 'like' CHECK (reaction_type IN ('like')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_author_created_at ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created_at ON posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_created_at ON post_comments(post_id, created_at DESC);
