-- ============================================================
-- Social Media Module Schema
-- social_accounts, content_plans, content_plan_items
-- ============================================================

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('instagram', 'facebook')),
  account_name TEXT NOT NULL DEFAULT '',
  posting_method TEXT NOT NULL CHECK(posting_method IN ('webhook', 'api')),
  webhook_url TEXT DEFAULT '',
  page_id TEXT DEFAULT '',
  access_token_encrypted TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  posts_count INTEGER DEFAULT 0,
  last_post_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);

CREATE TABLE IF NOT EXISTS content_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  niche TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  social_account_id TEXT,
  start_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_plans_user ON content_plans(user_id);

CREATE TABLE IF NOT EXISTS content_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  slot INTEGER NOT NULL CHECK(slot >= 1 AND slot <= 2),
  caption TEXT NOT NULL DEFAULT '',
  media_id TEXT DEFAULT '',
  media_type TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  enabled INTEGER DEFAULT 1,
  posted_at TEXT,
  error_message TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(plan_id, day_number, slot)
);

CREATE INDEX IF NOT EXISTS idx_content_plan_items_plan ON content_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_content_plan_items_scheduled ON content_plan_items(scheduled_at);
