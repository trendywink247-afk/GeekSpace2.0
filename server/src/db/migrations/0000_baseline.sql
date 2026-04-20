-- ============================================================
-- Migration 0000: Complete baseline schema snapshot
--
-- Represents the full post-boot schema state after all prior
-- schema.ts + migrations.ts definitions, consolidated into a
-- single idempotent file for fresh DB bootstrapping.
--
-- All statements use IF NOT EXISTS so re-running is safe.
-- Column sets reflect the final state including all ALTER TABLE
-- ADD COLUMN additions from the migrations.ts monolith.
-- ============================================================

-- ── Core tables (originally from schema.ts) ────────────────

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  location TEXT DEFAULT '',
  website TEXT DEFAULT '',
  role TEXT DEFAULT '',
  company TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  theme_mode TEXT DEFAULT 'dark',
  theme_accent TEXT DEFAULT '#7B61FF',
  plan TEXT DEFAULT 'free',
  credits INTEGER DEFAULT 15000,
  onboarding_completed INTEGER DEFAULT 0,
  onboarding_step INTEGER DEFAULT 0,
  notification_email INTEGER DEFAULT 1,
  notification_push INTEGER DEFAULT 1,
  notification_agent INTEGER DEFAULT 1,
  notification_reminders INTEGER DEFAULT 1,
  notification_weekly INTEGER DEFAULT 0,
  notification_connections INTEGER DEFAULT 1,
  notification_digest INTEGER DEFAULT 1,
  privacy_show_profile INTEGER DEFAULT 1,
  privacy_show_activity INTEGER DEFAULT 1,
  privacy_allow_chat INTEGER DEFAULT 1,
  privacy_show_location INTEGER DEFAULT 1,
  last_active TEXT DEFAULT (datetime('now')),
  theme_background TEXT,
  agent_chat_enabled INTEGER DEFAULT 1,
  preferred_model TEXT DEFAULT 'auto',
  proactive_enabled INTEGER DEFAULT 1,
  stripe_customer_id TEXT DEFAULT NULL,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'inactive',
  subscription_expires_at INTEGER DEFAULT NULL,
  password_changed_at INTEGER DEFAULT 0,
  google_gmail_token TEXT DEFAULT NULL,
  google_calendar_token TEXT DEFAULT NULL,
  calendar_auto_reminders INTEGER DEFAULT 1,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  google_id TEXT DEFAULT NULL,
  github_id TEXT DEFAULT NULL,
  github_username TEXT DEFAULT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Geek',
  display_name TEXT DEFAULT '',
  mode TEXT DEFAULT 'builder',
  voice TEXT DEFAULT 'friendly',
  system_prompt TEXT DEFAULT 'You are a helpful personal AI assistant.',
  primary_model TEXT DEFAULT 'geekspace-default',
  fallback_model TEXT DEFAULT 'ollama-qwen2.5',
  creativity INTEGER DEFAULT 70,
  formality INTEGER DEFAULT 50,
  verbosity INTEGER DEFAULT 50,
  humor INTEGER DEFAULT 50,
  empathy INTEGER DEFAULT 50,
  custom_prompt TEXT DEFAULT '',
  response_speed TEXT DEFAULT 'balanced',
  monthly_budget_usd REAL DEFAULT 5.0,
  avatar_emoji TEXT DEFAULT '🤖',
  accent_color TEXT DEFAULT '#7B61FF',
  bubble_style TEXT DEFAULT 'modern',
  status TEXT DEFAULT 'online',
  personality TEXT DEFAULT 'jarvis',
  briefing_time TEXT DEFAULT '08:00',
  notification_email_address TEXT DEFAULT NULL,
  model_preference TEXT DEFAULT 'auto',
  preferred_free_model TEXT DEFAULT 'auto',
  last_active INTEGER,
  notif_reminders INTEGER DEFAULT 1,
  notif_escalations INTEGER DEFAULT 1,
  notif_agents INTEGER DEFAULT 1,
  notif_daily_briefing INTEGER DEFAULT 1,
  notif_connections INTEGER DEFAULT 1,
  greeting TEXT DEFAULT '',
  snooze_presets TEXT DEFAULT '[]',
  preferred_image_model TEXT DEFAULT 'auto',
  preferred_video_model TEXT DEFAULT 'auto',
  autonomy_level TEXT DEFAULT 'suggest',
  quiet_start TEXT DEFAULT NULL,
  quiet_end TEXT DEFAULT NULL,
  agent_namespace TEXT DEFAULT NULL,
  agent_id TEXT DEFAULT NULL,
  use_case TEXT DEFAULT NULL,
  proactive_preferences TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT DEFAULT '',
  key_encrypted TEXT NOT NULL,
  masked_key TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  datetime TEXT,
  channel TEXT DEFAULT 'push',
  category TEXT DEFAULT 'general',
  recurring TEXT DEFAULT '',
  completed INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'user',
  pico_task_id TEXT,
  scheduled_for INTEGER,
  delivered_at INTEGER,
  drift_ms INTEGER,
  snooze_until INTEGER,
  recurrence TEXT,
  completed_at INTEGER,
  priority TEXT DEFAULT 'normal',
  snooze_count INTEGER DEFAULT 0,
  remind_before_sent_at INTEGER,
  overdue_escalated_at TEXT DEFAULT NULL,
  preview_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'disconnected',
  health INTEGER DEFAULT 0,
  requests_today INTEGER DEFAULT 0,
  last_sync TEXT DEFAULT '',
  config TEXT DEFAULT '{}',
  features TEXT DEFAULT '[]',
  permissions TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolios (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  headline TEXT DEFAULT '',
  about TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  location TEXT DEFAULT '',
  role TEXT DEFAULT '',
  company TEXT DEFAULT '',
  skills TEXT DEFAULT '[]',
  projects TEXT DEFAULT '[]',
  milestones TEXT DEFAULT '[]',
  social TEXT DEFAULT '{}',
  layout TEXT DEFAULT 'classic',
  agent_enabled INTEGER DEFAULT 1,
  visibility TEXT DEFAULT '{"showInDirectory":true,"showAvatar":true,"showLocation":true,"showProjects":true,"showActivity":true}',
  is_public INTEGER DEFAULT 1,
  connection_count INTEGER DEFAULT 0,
  last_connected_at TEXT,
  view_count INTEGER DEFAULT 0,
  meta_description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT DEFAULT 'manual',
  trigger_config TEXT DEFAULT '{}',
  action_type TEXT DEFAULT '',
  action_config TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  run_count INTEGER DEFAULT 0,
  last_run TEXT DEFAULT '',
  last_status TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT DEFAULT '',
  model TEXT DEFAULT '',
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  channel TEXT DEFAULT 'web',
  tool TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS features (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  social_discovery INTEGER DEFAULT 1,
  portfolio_chat INTEGER DEFAULT 1,
  automation_builder INTEGER DEFAULT 1,
  website_builder INTEGER DEFAULT 0,
  n8n_integration INTEGER DEFAULT 1,
  manychat_integration INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  icon TEXT DEFAULT 'activity',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS premium_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_codename TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  credits_used INTEGER DEFAULT 0,
  messages_count INTEGER DEFAULT 0,
  model_used TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  monthly_credits INTEGER DEFAULT 5000,
  credits_remaining INTEGER DEFAULT 5000,
  credits_used_this_cycle INTEGER DEFAULT 0,
  billing_interval_days INTEGER DEFAULT 30,
  billing_cycle_start TEXT DEFAULT (datetime('now')),
  billing_cycle_end TEXT DEFAULT (datetime('now', '+30 days')),
  price_usd REAL DEFAULT 0,
  price_inr REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  tokens_budget INTEGER DEFAULT 0,
  tokens_used_this_cycle INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channel_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_username TEXT DEFAULT '',
  linked_at TEXT DEFAULT (datetime('now')),
  last_message_at TEXT,
  is_verified INTEGER DEFAULT 1,
  metadata TEXT DEFAULT '{}',
  UNIQUE(channel, external_id)
);

CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS free_models (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  summary TEXT NOT NULL,
  context_length INTEGER DEFAULT 0,
  parameters TEXT,
  status TEXT DEFAULT 'active',
  curated INTEGER DEFAULT 0,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_checked TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,
  event TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  notified INTEGER DEFAULT 0
);

-- ── Tables added via migrations.ts ─────────────────────────

CREATE TABLE IF NOT EXISTS briefings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT DEFAULT 'daily',
  content TEXT NOT NULL,
  channels_sent TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS installed_recipes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  installed_at TEXT DEFAULT (datetime('now')),
  last_run_at TEXT,
  UNIQUE(user_id, recipe_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'code',
  title TEXT NOT NULL,
  html TEXT DEFAULT '',
  css TEXT DEFAULT '',
  js TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS day_passes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  credits_granted INTEGER DEFAULT 2000,
  stripe_checkout_session_id TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_connections (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_interaction TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, connected_user_id)
);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS token_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  tokens_budget INTEGER DEFAULT 0,
  warnings_sent TEXT DEFAULT '[]',
  UNIQUE(user_id, month)
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  thumbnail TEXT DEFAULT '',
  html TEXT DEFAULT '',
  css TEXT DEFAULT '',
  js TEXT DEFAULT '',
  is_official INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  clone_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artifact_domains (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES generated_artifacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subdomain TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subdomain)
);

CREATE TABLE IF NOT EXISTS artifact_deployments (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES generated_artifacts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_url TEXT NOT NULL,
  external_id TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telegram_onboarding (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'welcome',
  path TEXT DEFAULT NULL,
  step INTEGER DEFAULT 0,
  data TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generated_outputs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  output TEXT DEFAULT '',
  duration_ms INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user ON automation_logs(user_id, created_at);

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dev_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  params TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'started',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  output_summary TEXT,
  pr_url TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_rate_limits (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip', 'user_id')),
  request_count INTEGER DEFAULT 0,
  window_start TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(identifier, identifier_type)
);

CREATE TABLE IF NOT EXISTS password_reset_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('requested', 'otp_sent', 'otp_verified', 'reset_success', 'reset_failed', 'expired', 'too_many_attempts')),
  channel TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'pollinations',
  image_url TEXT DEFAULT '',
  width INTEGER DEFAULT 1024,
  height INTEGER DEFAULT 1024,
  source TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'pollinations',
  video_url TEXT DEFAULT '',
  width INTEGER DEFAULT 1280,
  height INTEGER DEFAULT 720,
  duration INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'processing',
  source TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS video_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  packet TEXT DEFAULT NULL,
  stitched_url TEXT DEFAULT NULL,
  clips TEXT DEFAULT '[]',
  error TEXT DEFAULT NULL,
  credits_used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  user_agent TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS portfolio_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  visited_at TEXT DEFAULT (datetime('now')),
  visitor_ip TEXT,
  referer_host TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS snooze_log (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  snoozed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  preset TEXT NOT NULL,
  new_datetime TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_contacts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_dead_letters (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  error TEXT NOT NULL,
  payload TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT DEFAULT NULL,
  failed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS reminder_dead_letters (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'telegram',
  error TEXT DEFAULT 'send_failed',
  attempts INTEGER DEFAULT 1,
  last_attempt_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proactive_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  message TEXT
);

CREATE TABLE IF NOT EXISTS token_blocklist (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS training_examples (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  system_prompt TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  channel TEXT DEFAULT 'web',
  quality_score REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  confidence REAL DEFAULT 1.0,
  last_used INTEGER,
  agent_namespace TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS telegram_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  card_state TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  eliza_agent_id TEXT,
  name TEXT NOT NULL,
  personality_base TEXT DEFAULT 'weebo',
  character_json TEXT NOT NULL,
  plugins TEXT DEFAULT '[]',
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS planner_blocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  duration INTEGER DEFAULT 30,
  color TEXT DEFAULT '#00F0FF',
  category TEXT DEFAULT 'work',
  completed INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual',
  source_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS connection_invites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new',
  deleted_at TEXT DEFAULT NULL,
  trending INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestion_clusters (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  canonical_summary TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  suggestion_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestion_scores (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL UNIQUE REFERENCES suggestion_clusters(id) ON DELETE CASCADE,
  demand_score INTEGER NOT NULL DEFAULT 0,
  impact_score INTEGER NOT NULL DEFAULT 0,
  effort_score INTEGER NOT NULL DEFAULT 0,
  risk_score INTEGER NOT NULL DEFAULT 0,
  overall_score INTEGER NOT NULL DEFAULT 0,
  rationale TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestion_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggestion_id TEXT,
  cluster_id TEXT,
  event_type TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  unique_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestion_events (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestion_votes (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(suggestion_id, user_id)
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'observed',
  access_count INTEGER DEFAULT 0,
  agent_namespace TEXT DEFAULT 'shared',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, category, key)
);

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
  starred INTEGER DEFAULT 0,
  agent_id TEXT DEFAULT NULL,
  conversation_id TEXT DEFAULT NULL,
  quality_score REAL DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5(
  content,
  user_id UNINDEXED,
  created_at UNINDEXED,
  content='conversation_log',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS conversation_log_ai AFTER INSERT ON conversation_log BEGIN
  INSERT INTO conversation_fts(rowid, content, user_id, created_at)
  VALUES (new.rowid, new.content, new.user_id, new.created_at);
END;

CREATE TRIGGER IF NOT EXISTS conversation_log_ad AFTER DELETE ON conversation_log BEGIN
  INSERT INTO conversation_fts(conversation_fts, rowid, content, user_id, created_at)
  VALUES ('delete', old.rowid, old.content, old.user_id, old.created_at);
END;

CREATE TRIGGER IF NOT EXISTS conversation_log_au AFTER UPDATE ON conversation_log BEGIN
  INSERT INTO conversation_fts(conversation_fts, rowid, content, user_id, created_at)
  VALUES ('delete', old.rowid, old.content, old.user_id, old.created_at);
  INSERT INTO conversation_fts(rowid, content, user_id, created_at)
  VALUES (new.rowid, new.content, new.user_id, new.created_at);
END;

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  message_content TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT 'other',
  additional_info TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocked_users (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS moderation_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  flags TEXT NOT NULL DEFAULT '[]',
  action TEXT NOT NULL DEFAULT 'allowed',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  note TEXT DEFAULT '',
  created_by TEXT DEFAULT 'admin',
  used_at TEXT DEFAULT NULL,
  used_by TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]',
  trigger TEXT DEFAULT 'manual',
  enabled INTEGER DEFAULT 1,
  last_run INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS user_workflow_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT DEFAULT 'running',
  context TEXT DEFAULT '{}',
  steps_json TEXT DEFAULT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  sender TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  priority TEXT DEFAULT 'normal',
  read INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  deferred INTEGER DEFAULT 0,
  suggested_reply TEXT,
  related_reminder_id INTEGER,
  received_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS gmail_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  sender TEXT NOT NULL,
  snippet TEXT,
  inbox_id INTEGER,
  synced_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  summary TEXT,
  linked_reminder_id INTEGER,
  pinned INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT DEFAULT 'daily',
  target_time TEXT,
  icon TEXT DEFAULT 'star',
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  reminder_time TEXT DEFAULT NULL,
  skip_until INTEGER DEFAULT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  logged_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_log_day ON habit_logs(habit_id, date(logged_at/1000, 'unixepoch'));
CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON habit_logs(user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_min INTEGER,
  goal TEXT,
  completed INTEGER DEFAULT 0,
  pomodoro_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id TEXT PRIMARY KEY,
  focus_mode_active INTEGER DEFAULT 0,
  dnd_start TEXT DEFAULT '22:00',
  dnd_end TEXT DEFAULT '08:00',
  urgent_bypass INTEGER DEFAULT 1,
  batch_interval_min INTEGER DEFAULT 30
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT (date('now')),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS budget_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'total',
  amount REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  UNIQUE(user_id, category, period)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  gcal_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  reminder_id TEXT,
  synced_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS gate_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'My API Key',
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS page_monitors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  check_for TEXT,
  last_content_hash TEXT,
  last_checked_at INTEGER,
  frequency_hours INTEGER DEFAULT 24,
  alert_count INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  properties TEXT DEFAULT '{}',
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  mention_count INTEGER DEFAULT 1,
  importance_score REAL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS memory_relations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_entity_id TEXT NOT NULL,
  to_entity_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  strength REAL DEFAULT 0.5,
  last_reinforced_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '[]',
  content_text TEXT NOT NULL DEFAULT '',
  icon TEXT,
  cover_url TEXT,
  folder_id TEXT,
  parent_id TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  public_slug TEXT UNIQUE,
  word_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'web',
  tags TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doc_folders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  family TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  extracted_text TEXT,
  conversation_id TEXT,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL DEFAULT 'weebo',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  created_by TEXT DEFAULT 'user',
  assigned_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  result TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_comms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'info',
  related_task_id TEXT,
  acknowledged INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS smart_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  reason TEXT NOT NULL,
  cta TEXT NOT NULL,
  score REAL DEFAULT 0.5,
  dismissed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  UNIQUE(user_id, feature)
);

CREATE TABLE IF NOT EXISTS delegation_counts (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  priority INTEGER DEFAULT 5,
  category TEXT DEFAULT 'general',
  assigned_agent TEXT DEFAULT 'cal',
  target_date TEXT,
  progress INTEGER DEFAULT 0,
  outcome TEXT,
  parent_goal_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goal_steps (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  assigned_agent TEXT DEFAULT 'cal',
  step_order INTEGER DEFAULT 0,
  depends_on TEXT DEFAULT '[]',
  effort TEXT DEFAULT 'medium',
  result TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goal_events (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  agent_id TEXT,
  step_id TEXT,
  message TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace_artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  artifact_type TEXT DEFAULT 'note',
  created_by_agent TEXT,
  tags TEXT DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delegation_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_id TEXT,
  step_id TEXT,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  task_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New conversation',
  last_message_preview TEXT DEFAULT '',
  message_count INTEGER DEFAULT 0,
  channel TEXT DEFAULT 'web',
  agent_id TEXT DEFAULT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_confirmations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  tool TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  edited_params TEXT DEFAULT NULL,
  reject_reason TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT DEFAULT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS message_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  rating TEXT NOT NULL,
  comment TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta_reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reflection_date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  what_worked TEXT DEFAULT '[]',
  what_failed TEXT DEFAULT '[]',
  learned_rules TEXT DEFAULT '[]',
  messages_analyzed INTEGER DEFAULT 0,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inferred_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  confidence REAL DEFAULT 0.5,
  evidence TEXT DEFAULT '[]',
  status TEXT DEFAULT 'suggested',
  suggested_at TEXT DEFAULT (datetime('now')),
  user_response TEXT DEFAULT NULL,
  converted_goal_id TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS tool_trust (
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  context_hash TEXT NOT NULL,
  trust_score REAL DEFAULT 0.5,
  approval_count INTEGER DEFAULT 0,
  edit_count INTEGER DEFAULT 0,
  reject_count INTEGER DEFAULT 0,
  last_updated TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tool, context_hash)
);

CREATE TABLE IF NOT EXISTS tool_chains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pattern TEXT NOT NULL,
  pattern_hash TEXT NOT NULL,
  tool_sequence TEXT NOT NULL DEFAULT '[]',
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_used TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS world_models (
  user_id TEXT PRIMARY KEY,
  roles TEXT DEFAULT '[]',
  expertise TEXT DEFAULT '[]',
  active_goals TEXT DEFAULT '[]',
  blockers TEXT DEFAULT '[]',
  energy_level INTEGER DEFAULT 50,
  mood TEXT DEFAULT 'neutral',
  productive_hours TEXT DEFAULT '[]',
  decision_style TEXT DEFAULT 'unknown',
  communication_pref TEXT DEFAULT 'balanced',
  important_people TEXT DEFAULT '[]',
  daily_routines TEXT DEFAULT '[]',
  weekly_routines TEXT DEFAULT '[]',
  learned_preferences TEXT DEFAULT '[]',
  confidence_score REAL DEFAULT 0.0,
  last_full_reflection TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS temporal_anchors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  message_id TEXT,
  type TEXT NOT NULL,
  trigger_at TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  original_message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  surfaced_at TEXT DEFAULT NULL,
  resolved_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Contact requests (from 0001_contact_requests.sql) ──────

CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT,
  from_name TEXT NOT NULL,
  from_phone TEXT,
  from_email TEXT,
  to_user_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('explore', 'portfolio', 'agent_referral')),
  intention TEXT,
  initial_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'timed_out', 'cancelled')),
  decided_at TEXT,
  expires_at TEXT NOT NULL,
  channel_notified TEXT CHECK (channel_notified IN ('telegram', 'whatsapp', 'none')),
  y_response_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_contact_preferences (
  user_id TEXT PRIMARY KEY,
  availability_mode TEXT DEFAULT 'auto_reply_on' CHECK (availability_mode IN ('auto_reply_on', 'auto_reply_off')),
  share_availability_level TEXT DEFAULT 'preferences_only' CHECK (share_availability_level IN ('none', 'coarse', 'preferences_only')),
  default_response_template TEXT DEFAULT 'I''m currently unavailable. I''ll respond when I can.',
  quiet_hours_start INTEGER,
  quiet_hours_end INTEGER,
  working_hours_start INTEGER DEFAULT 9,
  working_hours_end INTEGER DEFAULT 18,
  allow_guest_contacts INTEGER DEFAULT 1,
  require_mutual_connection INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_request_audit (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'channel_notified', 'viewed_by_y', 'accepted', 'declined', 'timed_out', 'cancelled', 'message_sent')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'x_user', 'y_user', 'agent')),
  actor_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES contact_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('user', 'ip', 'session')),
  request_count INTEGER DEFAULT 0,
  window_start TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(identifier, identifier_type)
);

-- ── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_premium_sessions_user ON premium_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_date ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_username ON portfolios(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_configs_user ON agent_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_date ON usage_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_channel_links_user ON channel_links(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_links_ext ON channel_links(channel, external_id);
CREATE INDEX IF NOT EXISTS idx_free_models_status ON free_models(status);
CREATE INDEX IF NOT EXISTS idx_model_changelog_timestamp ON model_changelog(timestamp);
CREATE INDEX IF NOT EXISTS idx_briefings_user ON briefings(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_installed_recipes_user ON installed_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_user ON generated_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_expires ON generated_artifacts(expires_at);
CREATE INDEX IF NOT EXISTS idx_day_passes_user ON day_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_day_passes_expires ON day_passes(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_passes_stripe_session ON day_passes(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_connections ON user_connections(user_id, last_interaction);
CREATE INDEX IF NOT EXISTS idx_security_events_event ON security_events(event);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_month ON token_usage(user_id, month);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_official ON templates(is_official);
CREATE INDEX IF NOT EXISTS idx_artifact_domains_user ON artifact_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_artifact_domains_artifact ON artifact_domains(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_domains_subdomain ON artifact_domains(subdomain);
CREATE INDEX IF NOT EXISTS idx_artifact_deployments_user ON artifact_deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_artifact_deployments_artifact ON artifact_deployments(artifact_id);
CREATE INDEX IF NOT EXISTS idx_tg_onboarding_user ON telegram_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_onboarding_chat ON telegram_onboarding(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_outputs_user ON generated_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_outputs_created ON generated_outputs(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_dev_audit_log_action ON dev_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_dev_audit_log_started ON dev_audit_log(started_at);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_reset_rate_limit_identifier ON password_reset_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_reset_audit_user ON password_reset_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_audit_action ON password_reset_audit(action);
CREATE INDEX IF NOT EXISTS idx_user_images_user ON user_images(user_id);
CREATE INDEX IF NOT EXISTS idx_user_images_expires ON user_images(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_videos_user ON user_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_videos_expires ON user_videos(expires_at);
CREATE INDEX IF NOT EXISTS idx_video_jobs_user ON video_jobs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_portfolio_visits_user_date ON portfolio_visits(user_id, visited_at);
CREATE INDEX IF NOT EXISTS idx_snooze_log_reminder ON snooze_log(reminder_id, snoozed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_dead_letters_user ON reminder_dead_letters(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reminder_dead_letters_reminder ON reminder_dead_letters(reminder_id);
CREATE INDEX IF NOT EXISTS idx_proactive_messages_user ON proactive_messages(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires ON token_blocklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_training_examples_user ON training_examples(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_training_examples_provider ON training_examples(provider, model);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memories_key ON user_memories(user_id, key);
CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id, last_used DESC);
CREATE INDEX IF NOT EXISTS idx_tgmsg_entity ON telegram_messages(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tgmsg_user ON telegram_messages(user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_user_agents_user ON user_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_user_date ON planner_blocks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON activity_log(user_id, created_at);
-- idx_reminders_scheduler omitted: column remind_at does not exist in this schema
CREATE INDEX IF NOT EXISTS idx_reminders_datetime ON reminders(user_id, datetime);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_automations_user_active ON automations(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations(trigger_type, enabled);
CREATE INDEX IF NOT EXISTS idx_contact_requests_to_user ON contact_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_expires ON contact_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_contact_audit_request ON contact_request_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON contact_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_deleted ON suggestions(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_messages(user_id, read, received_at DESC);
