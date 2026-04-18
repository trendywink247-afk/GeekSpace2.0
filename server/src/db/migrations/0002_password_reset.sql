-- ============================================================
-- Password Reset OTP Schema
-- Secure password reset with OTP via email/Telegram
-- ============================================================

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  otp_hash TEXT NOT NULL, -- bcrypt hash of OTP
  channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TEXT NOT NULL,
  used_at TEXT, -- NULL until used
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Rate limiting for password reset
CREATE TABLE IF NOT EXISTS password_reset_rate_limits (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL, -- email or user_id
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip', 'user_id')),
  request_count INTEGER DEFAULT 0,
  window_start TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reset_rate_limit_identifier ON password_reset_rate_limits(identifier);

-- Audit log for password reset events
CREATE TABLE IF NOT EXISTS password_reset_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('requested', 'otp_sent', 'otp_verified', 'reset_success', 'reset_failed', 'expired', 'too_many_attempts')),
  channel TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER, -- boolean
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reset_audit_user ON password_reset_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_audit_action ON password_reset_audit(action);
