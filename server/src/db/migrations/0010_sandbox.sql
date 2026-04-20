-- ============================================================
-- Sandbox Module Schema
-- sandbox_sessions (per-container lifecycle) + sandbox_usage (daily aggregates)
-- ============================================================

CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  container_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  memory_limit_mb INTEGER,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  total_exec_count INTEGER DEFAULT 0,
  total_exec_time_ms INTEGER DEFAULT 0,
  peak_memory_mb REAL DEFAULT 0,
  destroyed_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_user ON sandbox_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_active ON sandbox_sessions(ended_at) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS sandbox_usage (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  session_count INTEGER DEFAULT 0,
  total_exec_count INTEGER DEFAULT 0,
  total_exec_time_ms INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
