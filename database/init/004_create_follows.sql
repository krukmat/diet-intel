-- user_follows: relación A (follower) → B (followee)
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','blocked')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON user_follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);

-- follow_activity_log: rate limit por usuario/día/acción
CREATE TABLE IF NOT EXISTS follow_activity_log (
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('follow')),
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, date)
);

-- event_outbox: publicación de eventos (FollowCreated/FollowRemoved)
CREATE TABLE IF NOT EXISTS event_outbox (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
