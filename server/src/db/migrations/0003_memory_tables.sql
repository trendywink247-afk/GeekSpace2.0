-- ============================================================
-- Memory Module Schema
-- agent_memory (structured facts) + conversation_log (episodic)
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'observed',
  access_count INTEGER DEFAULT 0,
  last_accessed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(user_id, category);

CREATE TABLE IF NOT EXISTS conversation_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider TEXT DEFAULT '',
  model TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  request_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_log_user ON conversation_log(user_id, created_at);
