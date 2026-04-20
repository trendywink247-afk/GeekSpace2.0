-- ============================================================
-- Agent Notifications Schema
-- Push notifications: SSE + Telegram + in-app bell
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  action_url TEXT,
  metadata TEXT DEFAULT '{}',
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_notifications_user ON agent_notifications(user_id, read, created_at DESC);
