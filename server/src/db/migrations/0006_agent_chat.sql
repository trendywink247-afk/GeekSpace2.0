-- ============================================================
-- Agent Chat Schema
-- Direct messages between users via agent relay
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(from_user_id, to_user_id);
