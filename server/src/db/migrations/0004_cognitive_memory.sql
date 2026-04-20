-- ============================================================
-- Cognitive Memory Schema
-- session_summaries for cross-session continuity
-- ============================================================

CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  summary TEXT NOT NULL,
  accomplished TEXT,
  pending_items TEXT,
  new_facts TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_user ON session_summaries(user_id, created_at);
