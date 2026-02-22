-- ============================================================
-- Human-to-Human Contact System Schema
-- Contact requests with consent + routing
-- ============================================================

-- Contact requests table
CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT, -- NULL for unknown/guest users
  from_name TEXT NOT NULL,
  from_phone TEXT, -- encrypted/hashed
  from_email TEXT,
  to_user_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('explore', 'portfolio', 'agent_referral')),
  intention TEXT, -- what X wants to discuss
  initial_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'timed_out', 'cancelled')),
  decided_at TEXT, -- when Y accepted/declined
  expires_at TEXT NOT NULL, -- when request expires (e.g., 24h)
  channel_notified TEXT CHECK (channel_notified IN ('telegram', 'whatsapp', 'none')),
  y_response_message TEXT, -- Y's message when accepting/declining
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_requests_to_user ON contact_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_expires ON contact_requests(expires_at);

-- Extend conversations table (add linked contact request)
-- Note: This is added via migration, not here directly
-- ALTER TABLE conversations ADD COLUMN linked_contact_request_id TEXT;

-- User privacy/availability preferences
CREATE TABLE IF NOT EXISTS user_contact_preferences (
  user_id TEXT PRIMARY KEY,
  availability_mode TEXT DEFAULT 'auto_reply_on' CHECK (availability_mode IN ('auto_reply_on', 'auto_reply_off')),
  share_availability_level TEXT DEFAULT 'preferences_only' CHECK (share_availability_level IN ('none', 'coarse', 'preferences_only')),
  default_response_template TEXT DEFAULT 'I\'m currently unavailable. I\'ll respond when I can.',
  quiet_hours_start INTEGER, -- 0-23, NULL = no quiet hours
  quiet_hours_end INTEGER, -- 0-23, NULL = no quiet hours
  working_hours_start INTEGER DEFAULT 9,
  working_hours_end INTEGER DEFAULT 18,
  allow_guest_contacts INTEGER DEFAULT 1, -- boolean
  require_mutual_connection INTEGER DEFAULT 0, -- boolean
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Contact request audit log (for spam prevention & analytics)
CREATE TABLE IF NOT EXISTS contact_request_audit (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'channel_notified', 'viewed_by_y', 'accepted', 'declined', 'timed_out', 'cancelled', 'message_sent')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'x_user', 'y_user', 'agent')),
  actor_id TEXT,
  metadata TEXT, -- JSON, sanitized (no phone numbers)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (request_id) REFERENCES contact_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contact_audit_request ON contact_request_audit(request_id);

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS contact_rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- NULL for guests (tracked by IP/session)
  identifier TEXT NOT NULL, -- user_id or hashed IP
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('user', 'ip', 'session')),
  request_count INTEGER DEFAULT 0,
  window_start TEXT NOT NULL, -- timestamp of current window
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON contact_rate_limits(identifier);
