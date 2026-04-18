/**
 * Core database schema — CREATE TABLE IF NOT EXISTS statements.
 *
 * These are the foundational tables created on first run.
 * Called from index.ts after DB open + pragmas.
 */

import type Database from 'better-sqlite3';

export function applySchema(db: Database.Database): void {
  db.exec(`
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
    notification_email INTEGER DEFAULT 1,
    notification_push INTEGER DEFAULT 1,
    notification_agent INTEGER DEFAULT 1,
    notification_reminders INTEGER DEFAULT 1,
    notification_weekly INTEGER DEFAULT 0,
    privacy_show_profile INTEGER DEFAULT 1,
    privacy_show_activity INTEGER DEFAULT 1,
    privacy_allow_chat INTEGER DEFAULT 1,
    privacy_show_location INTEGER DEFAULT 1,
    last_active TEXT DEFAULT (datetime('now')),
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
    response_speed TEXT DEFAULT 'balanced',
    monthly_budget_usd REAL DEFAULT 5.0,
    avatar_emoji TEXT DEFAULT '🤖',
    accent_color TEXT DEFAULT '#7B61FF',
    bubble_style TEXT DEFAULT 'modern',
    status TEXT DEFAULT 'online',
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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT DEFAULT 'manual',
    trigger_config TEXT DEFAULT '{}',
    action_type TEXT DEFAULT '',
    action_config TEXT DEFAULT '{}',
    enabled INTEGER DEFAULT 1,
    run_count INTEGER DEFAULT 0,
    last_run TEXT DEFAULT '',
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
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_premium_sessions_user ON premium_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
  CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_events_date ON usage_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_portfolios_username ON portfolios(username);

  -- Additional indices for production performance
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
  CREATE INDEX IF NOT EXISTS idx_agent_configs_user ON agent_configs(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_events_user_date ON usage_events(user_id, created_at);

  -- Channel links: map Telegram/WhatsApp external IDs to Agentin users
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
  CREATE INDEX IF NOT EXISTS idx_channel_links_user ON channel_links(user_id);
  CREATE INDEX IF NOT EXISTS idx_channel_links_ext ON channel_links(channel, external_id);

  -- Link codes: temporary codes for account linking via bots
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

  CREATE INDEX IF NOT EXISTS idx_free_models_status ON free_models(status);
  CREATE INDEX IF NOT EXISTS idx_model_changelog_timestamp ON model_changelog(timestamp);
`);
}
