-- Migration 003: Daily message count tracking for per-tier rate limiting
-- Added in feat/llm-hybrid-routing-guardrails

CREATE TABLE IF NOT EXISTS daily_message_counts (
  user_id TEXT NOT NULL,
  date    TEXT NOT NULL,          -- ISO date string YYYY-MM-DD (UTC)
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_message_counts_date ON daily_message_counts (date);
