-- ============================================================
-- Custom Telegram Bot Schema
-- Stores per-user encrypted bot tokens for custom bot relay
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_bot_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_encrypted TEXT NOT NULL,
  bot_name TEXT NOT NULL DEFAULT '',
  bot_username TEXT NOT NULL DEFAULT '',
  messages_handled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_custom_bot_user ON custom_bot_tokens(user_id);
