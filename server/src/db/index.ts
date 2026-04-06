/**
 * @module db
 *
 * SQLite database layer using `better-sqlite3` (synchronous, single-file).
 *
 * **Initialization sequence (runs at import time):**
 * 1. Ensures the data directory exists (`fs.mkdirSync`).
 * 2. Opens (or creates) the SQLite file at `DB_PATH`.
 * 3. Applies performance pragmas:
 *    - `journal_mode = WAL` -- concurrent reads with a single writer.
 *    - `synchronous = NORMAL` -- safe with WAL; avoids fsync on every write.
 *    - `cache_size = -32000` -- 32 MB page cache.
 *    - `temp_store = MEMORY` -- temp tables in RAM.
 *    - `mmap_size = 268435456` -- 256 MB memory-mapped I/O.
 *    - `busy_timeout = 5000` -- wait 5 s instead of instant SQLITE_BUSY.
 *    - `foreign_keys = ON` -- enforce FK constraints.
 * 4. Runs `ANALYZE` to refresh query-planner statistics.
 * 5. Creates all tables with `CREATE TABLE IF NOT EXISTS` (inline schema).
 * 6. Applies incremental `ALTER TABLE` migrations wrapped in try/catch so
 *    they are idempotent across restarts.
 * 7. Optionally seeds demo data when `config.seedDemoData` is true (dev only).
 *
 * **Exported:** the `db` instance (a `better-sqlite3.Database`) and the
 * `seedDemoData()` helper.
 */

// ============================================================
// GeekSpace Database -- SQLite via better-sqlite3
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/geekspace.db');

// Ensure data directory exists
import fs from 'fs';
import { logger } from '../logger.js';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');       // WAL: concurrent reads + single writer
db.pragma('synchronous = NORMAL');     // Safe with WAL; skips fsync on every write
db.pragma('cache_size = -32000');      // 32MB page cache
db.pragma('temp_store = MEMORY');      // Temp tables in RAM not disk
db.pragma('mmap_size = 268435456');    // 256MB memory-mapped I/O
db.pragma('busy_timeout = 5000');      // 5s wait instead of instant SQLITE_BUSY fail
db.pragma('foreign_keys = ON');

// 49.8: Run ANALYZE on startup to keep query plans fresh.
// ANALYZE scans table/index statistics so SQLite can choose optimal query plans.
// It is a read-only table scan (no writes to user tables) and completes in <100ms for typical DBs.
db.exec('ANALYZE');

// ── Schema ──────────────────────────────────────────────────

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

  -- Channel links: map Telegram/WhatsApp external IDs to GeekSpace users
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

// ── Migrations (safe to run on existing DBs) ────────────────
try {
  db.exec(`ALTER TABLE users ADD COLUMN last_active TEXT DEFAULT (datetime('now'))`);
} catch { /* column already exists — ignore */ }

try {
  db.exec(`ALTER TABLE agent_configs ADD COLUMN personality TEXT DEFAULT 'jarvis'`);
} catch { /* column already exists — ignore */ }

try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN billing_interval_days INTEGER DEFAULT 30`);
} catch { /* column already exists — ignore */ }

try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN price_inr REAL DEFAULT 0`);
} catch { /* column already exists — ignore */ }

try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN currency TEXT DEFAULT 'USD'`);
} catch { /* column already exists — ignore */ }

try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_premium_sessions_user ON premium_sessions(user_id);
  `);
} catch { /* table already exists — ignore */ }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS briefings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT DEFAULT 'daily',
      content TEXT NOT NULL,
      channels_sent TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_briefings_user ON briefings(user_id, created_at);
  `);
} catch { /* table already exists — ignore */ }

try {
  db.exec(`ALTER TABLE agent_configs ADD COLUMN briefing_time TEXT DEFAULT '08:00'`);
} catch { /* column already exists — ignore */ }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS installed_recipes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      installed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, recipe_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
} catch { /* table already exists — ignore */ }

try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_artifacts_user ON generated_artifacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_expires ON generated_artifacts(expires_at);
  `);
} catch { /* table already exists — ignore */ }

// Migration: Add expires_at to generated_artifacts
try {
  db.exec(`ALTER TABLE generated_artifacts ADD COLUMN expires_at TEXT`);
} catch { /* column already exists */ }

try {
  db.exec(`ALTER TABLE agent_configs ADD COLUMN notification_email_address TEXT DEFAULT NULL`);
} catch { /* column already exists — ignore */ }

try {
  db.exec(`ALTER TABLE automations ADD COLUMN description TEXT NOT NULL DEFAULT ''`);
} catch { /* column already exists */ }

// Rename legacy "Pico-1" default agent name to "Weebo"
try {
  db.exec("UPDATE pico_agents SET name = 'Weebo' WHERE name = 'Pico-1' AND slot = 1");
} catch { /* ignore */ }

try {
  db.exec(`ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 0`);
} catch { /* column already exists */ }

try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_installed_recipes_user ON installed_recipes(user_id)`);
} catch { /* index already exists */ }

try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations(trigger_type, enabled)`);
} catch { /* index already exists */ }

// Day passes for free users — $1 for 24hr PicoClaw access
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_passes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      credits_granted INTEGER DEFAULT 2000,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_day_passes_user ON day_passes(user_id);
    CREATE INDEX IF NOT EXISTS idx_day_passes_expires ON day_passes(expires_at);
  `);
} catch { /* table already exists — ignore */ }

// Add model_preference to agent_configs if not present
try {
  db.exec("ALTER TABLE agent_configs ADD COLUMN model_preference TEXT DEFAULT 'auto'");
} catch { /* already exists */ }

try {
  db.exec("ALTER TABLE agent_configs ADD COLUMN preferred_free_model TEXT DEFAULT 'auto'");
} catch { /* already exists */ }

// Personality slider columns for agent customization (Phase 105)
try { db.exec("ALTER TABLE agent_configs ADD COLUMN creativity INTEGER DEFAULT 50"); } catch { /* exists */ }
try { db.exec("ALTER TABLE agent_configs ADD COLUMN formality INTEGER DEFAULT 50"); } catch { /* exists */ }
try { db.exec("ALTER TABLE agent_configs ADD COLUMN verbosity INTEGER DEFAULT 50"); } catch { /* exists */ }
try { db.exec("ALTER TABLE agent_configs ADD COLUMN humor INTEGER DEFAULT 50"); } catch { /* exists */ }
try { db.exec("ALTER TABLE agent_configs ADD COLUMN empathy INTEGER DEFAULT 50"); } catch { /* exists */ }
try { db.exec("ALTER TABLE agent_configs ADD COLUMN custom_prompt TEXT DEFAULT ''"); } catch { /* exists */ }

// Agent status tracking - for active/inactive status on portfolio
try {
  db.exec(`ALTER TABLE agent_configs ADD COLUMN last_active INTEGER`);
} catch { /* column already exists */ }

// Portfolio connection counter (Task 13)
try { db.exec(`ALTER TABLE portfolios ADD COLUMN connection_count INTEGER DEFAULT 0`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE portfolios ADD COLUMN last_connected_at TEXT`); } catch { /* column already exists */ }

// AI-generated background gradient per user (Task 14)
try { db.exec(`ALTER TABLE users ADD COLUMN theme_background TEXT`); } catch { /* column already exists */ }

// Task 15: recipe scheduling columns
try { db.exec(`ALTER TABLE installed_recipes ADD COLUMN last_run_at TEXT`); } catch { /* column already exists */ }

// Task 17: link Pico-created reminders to pico_tasks
try { db.exec(`ALTER TABLE reminders ADD COLUMN pico_task_id TEXT`); } catch { /* column already exists */ }

// Agent chat feature - enable users to receive messages from other agents
try { db.exec(`ALTER TABLE users ADD COLUMN agent_chat_enabled INTEGER DEFAULT 1`); } catch { /* column already exists */ }

// User connections table (for agent chat and networking)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_connections (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connected_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_interaction TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, connected_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_connections ON user_connections(user_id, last_interaction);
  `);
} catch { /* table already exists */ }

// Security event logging
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_security_events_event ON security_events(event);
    CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
  `);
} catch { /* table already exists — ignore */ }

// Token budget system (Task 3: Weebo Ecosystem)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      tokens_budget INTEGER DEFAULT 0,
      warnings_sent TEXT DEFAULT '[]',
      UNIQUE(user_id, month)
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_user_month ON token_usage(user_id, month);
  `);
} catch { /* table already exists — ignore */ }

try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN tokens_budget INTEGER DEFAULT 0`);
} catch { /* column already exists */ }

try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN tokens_used_this_cycle INTEGER DEFAULT 0`);
} catch { /* column already exists */ }

// Reminder scheduling tracking - for drift monitoring and accuracy
try {
  db.exec(`ALTER TABLE reminders ADD COLUMN scheduled_for INTEGER`);
} catch { /* column already exists */ }

try {
  db.exec(`ALTER TABLE reminders ADD COLUMN delivered_at INTEGER`);
} catch { /* column already exists */ }

try {
  db.exec(`ALTER TABLE reminders ADD COLUMN drift_ms INTEGER`);
} catch { /* column already exists */ }

// Templates for code artifacts (official + community)
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
    CREATE INDEX IF NOT EXISTS idx_templates_official ON templates(is_official);
  `);
} catch { /* table already exists */ }

// Custom domains/subdomains for artifacts
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifact_domains (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL REFERENCES generated_artifacts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subdomain TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(subdomain)
    );
    CREATE INDEX IF NOT EXISTS idx_artifact_domains_user ON artifact_domains(user_id);
    CREATE INDEX IF NOT EXISTS idx_artifact_domains_artifact ON artifact_domains(artifact_id);
    CREATE INDEX IF NOT EXISTS idx_artifact_domains_subdomain ON artifact_domains(subdomain);
  `);
} catch { /* table already exists */ }

// External deployments (Netlify, Vercel, etc.)
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_artifact_deployments_user ON artifact_deployments(user_id);
    CREATE INDEX IF NOT EXISTS idx_artifact_deployments_artifact ON artifact_deployments(artifact_id);
  `);
} catch { /* table already exists */ }

// Telegram bot onboarding state
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_tg_onboarding_user ON telegram_onboarding(user_id);
    CREATE INDEX IF NOT EXISTS idx_tg_onboarding_chat ON telegram_onboarding(telegram_chat_id);
  `);
} catch { /* table already exists */ }

// Generated outputs (PDFs, docs, plans from conversations)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_outputs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      format TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_outputs_user ON generated_outputs(user_id);
    CREATE INDEX IF NOT EXISTS idx_outputs_created ON generated_outputs(created_at);
  `);
} catch { /* table already exists */ }

// Add FK constraint to automation_logs
try {
  db.exec(`
    DELETE FROM automation_logs WHERE user_id NOT IN (SELECT id FROM users);
    CREATE TABLE automation_logs_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      automation_id TEXT,
      event TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO automation_logs_new SELECT * FROM automation_logs;
    DROP TABLE automation_logs;
    ALTER TABLE automation_logs_new RENAME TO automation_logs;
  `);
} catch { /* table may not exist or already has FK — ignore */ }

// Agent chat messages table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(from_user_id, to_user_id);
  `);
} catch { /* table already exists */ }

// DevClaw Bridge — audit log for admin dev actions
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_dev_audit_log_action ON dev_audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_dev_audit_log_started ON dev_audit_log(started_at);
  `);
} catch { /* table already exists */ }

// Password reset tables
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

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
    CREATE INDEX IF NOT EXISTS idx_reset_rate_limit_identifier ON password_reset_rate_limits(identifier);

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
    CREATE INDEX IF NOT EXISTS idx_reset_audit_user ON password_reset_audit(user_id);
    CREATE INDEX IF NOT EXISTS idx_reset_audit_action ON password_reset_audit(action);
  `);
} catch { /* tables already exist */ }

// User-generated images (Image Generator)
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_user_images_user ON user_images(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_images_expires ON user_images(expires_at);
  `);
} catch { /* table already exists */ }

// User-generated videos (Video Generator)
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_user_videos_user ON user_videos(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_videos_expires ON user_videos(expires_at);
  `);
} catch { /* table already exists */ }

// 55.13: Director Mode multi-clip video jobs
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_video_jobs_user ON video_jobs(user_id, created_at);
  `);
} catch { /* table already exists */ }

// 56.2: Add stitched_url column to video_jobs for existing deployments
try { db.exec('ALTER TABLE video_jobs ADD COLUMN stitched_url TEXT DEFAULT NULL'); } catch { /* already exists */ }

// Message reactions (for agent message reactions)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);
  `);
} catch { /* table already exists */ }

// Phase 10: Auth session tracking table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      last_seen TEXT DEFAULT (datetime('now')),
      user_agent TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active);
  `);
} catch { /* table already exists */ }

// Phase 10: preferred_model column on users table (for model picker)
try { db.exec(`ALTER TABLE users ADD COLUMN preferred_model TEXT DEFAULT 'auto'`); } catch { /* column already exists */ }

// Phase 11: Portfolio visit analytics table
db.exec(`
  CREATE TABLE IF NOT EXISTS portfolio_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    visited_at TEXT DEFAULT (datetime('now')),
    visitor_ip TEXT
  )
`);

// Phase 11: Telegram notification preference columns on agent_configs
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN notif_reminders INTEGER DEFAULT 1`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN notif_escalations INTEGER DEFAULT 1`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN notif_agents INTEGER DEFAULT 1`); } catch { /* column already exists */ }

// Phase 31: Per-type notification toggles (connections + weekly digest)
try { db.exec(`ALTER TABLE users ADD COLUMN notification_connections INTEGER DEFAULT 1`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN notification_digest INTEGER DEFAULT 1`); } catch { /* column already exists */ }

// Phase 31: Reminder recurrence column (daily/weekly/monthly)
try { db.exec(`ALTER TABLE reminders ADD COLUMN recurrence TEXT`); } catch { /* column already exists */ }

// Phase 34.3: Portfolio view_count column
try { db.exec(`ALTER TABLE portfolios ADD COLUMN view_count INTEGER DEFAULT 0`); } catch { /* column already exists */ }

// Phase 35.1: completed_at timestamp for streak tracking
try { db.exec(`ALTER TABLE reminders ADD COLUMN completed_at INTEGER`); } catch { /* column already exists */ }

// Phase 12: Index for portfolio_visits queries (user_id + date range scans)
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_portfolio_visits_user_date ON portfolio_visits(user_id, visited_at)`); } catch { /* index already exists */ }
// Phase 65.10: Add referer_host tracking column (additive migration)
try { db.exec(`ALTER TABLE portfolio_visits ADD COLUMN referer_host TEXT DEFAULT NULL`); } catch { /* already exists */ }

// Phase 36.1: Snooze event log
db.exec(`
  CREATE TABLE IF NOT EXISTS snooze_log (
    id TEXT PRIMARY KEY,
    reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    snoozed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    preset TEXT NOT NULL,
    new_datetime TEXT NOT NULL
  )
`);
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_snooze_log_reminder ON snooze_log(reminder_id, snoozed_at DESC)`); } catch { /* already exists */ }

// Phase 37.1: Portfolio contact messages
db.exec(`
  CREATE TABLE IF NOT EXISTS portfolio_contacts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    user_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Phase 37.3: Daily briefing Telegram opt-in/out
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN notif_daily_briefing INTEGER DEFAULT 1`); } catch { /* column already exists */ }

// Phase 37.4: Webhook dead-letter log
db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_dead_letters (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    error TEXT NOT NULL,
    payload TEXT,
    failed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )
`);

// Phase 57.10: Add retry_count + last_error to webhook_dead_letters
try { db.exec(`ALTER TABLE webhook_dead_letters ADD COLUMN retry_count INTEGER DEFAULT 0`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE webhook_dead_letters ADD COLUMN last_error TEXT DEFAULT NULL`); } catch { /* already exists */ }

// Phase 78.7: Reminder dead-letter log — captures failed Telegram reminder deliveries
db.exec(`
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
  CREATE INDEX IF NOT EXISTS idx_reminder_dead_letters_user ON reminder_dead_letters(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_reminder_dead_letters_reminder ON reminder_dead_letters(reminder_id);
`);

// Phase 59.9: SEO meta description for portfolio
try { db.exec(`ALTER TABLE portfolios ADD COLUMN meta_description TEXT DEFAULT ''`); } catch { /* already exists */ }

// Phase 60.2: Star/pin chat messages
try { db.exec(`ALTER TABLE conversation_log ADD COLUMN starred INTEGER DEFAULT 0`); } catch { /* already exists */ }

// Phase 37.5: Connection alert opt-in/out
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN notif_connections INTEGER DEFAULT 1`); } catch { /* column already exists */ }

// Phase 89: Stripe billing columns on users
try { db.exec(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT NULL`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'free'`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive'`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN subscription_expires_at INTEGER DEFAULT NULL`); } catch { /* column already exists */ }

// Phase 90: Proactive AI messages log
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proactive_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_proactive_messages_user ON proactive_messages(user_id, sent_at DESC);
  `);
} catch { /* table already exists */ }

// Phase 90: Proactive messages enabled toggle per user
try { db.exec(`ALTER TABLE users ADD COLUMN proactive_enabled INTEGER DEFAULT 1`); } catch { /* column already exists */ }

// Phase 92: JWT token blocklist --- for logout invalidation
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_blocklist (
      jti TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires ON token_blocklist(expires_at);
  `);
} catch { /* table already exists */ }

// Phase 92: Cleanup expired blocklist entries on startup
try {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM token_blocklist WHERE expires_at < ?').run(now);
} catch { /* non-fatal */ }

// Phase 103: Training examples — log successful AI conversations for fine-tuning
try {
  db.exec(`
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
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_training_examples_user ON training_examples(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_training_examples_provider ON training_examples(provider, model);
  `);
} catch { /* table already exists */ }

// Phase 94: User memories — per-user key-value fact store for long-term agent memory
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      confidence REAL DEFAULT 1.0,
      last_used INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memories_key ON user_memories(user_id, key);
    CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id, last_used DESC);
  `);
} catch { /* table already exists */ }

// Persona button system: store Telegram message_ids for card editing
db.prepare(`
  CREATE TABLE IF NOT EXISTS telegram_messages (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    chat_id      TEXT NOT NULL,
    message_id   INTEGER NOT NULL,
    entity_type  TEXT NOT NULL,
    entity_id    TEXT NOT NULL,
    card_state   TEXT NOT NULL DEFAULT 'active',
    created_at   INTEGER NOT NULL
  )
`).run();

try { db.prepare('CREATE INDEX IF NOT EXISTS idx_tgmsg_entity ON telegram_messages(entity_type, entity_id)').run(); } catch { /* exists */ }
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_tgmsg_user ON telegram_messages(user_id, chat_id)').run(); } catch { /* exists */ }


// ── GeekOS user agents ──────────────────────────────────────
db.exec(`
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
  )
`);
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_user_agents_user ON user_agents(user_id)').run(); } catch { /* exists */ }

// ── Planner blocks (GAP-1) ──────────────────────────────────
try {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_planner_user_date ON planner_blocks(user_id, date);
  `);
} catch { /* table already exists */ }

// ── Plan definitions ────────────────────────────────────────

export interface PlanDefinition {
  credits: number;
  tokensBudget: number;       // monthly token budget
  priceUsd: number;
  priceInr: number;
  originalPriceInr?: number;  // shown as slashed price in UI
  intervalDays: number;
  intervalLabel: string;
  description: string;
  badge?: string;
  picoSlots: number;          // max Pico agents for this plan
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  free: {
    credits: 5000, tokensBudget: 50000, priceUsd: 0, priceInr: 0,
    intervalDays: 30, intervalLabel: 'month',
    description: 'Local Engine only — try PicoClaw for $1/day',
    picoSlots: 0,
  },
  pilot: {
    credits: 100000, tokensBudget: 300000, priceUsd: 4, priceInr: 299,
    intervalDays: 30, intervalLabel: 'month',
    description: 'Dual PicoClaw agents + all engines',
    badge: 'New',
    picoSlots: 2,
  },
  intro: {
    credits: 100000, tokensBudget: 300000, priceUsd: 12, priceInr: 999, originalPriceInr: 1999,
    intervalDays: 60, intervalLabel: '2 months',
    description: 'All engines + personalities — best to start',
    badge: 'Best to start',
    picoSlots: 2,
  },
  halfyear: {
    credits: 700000, tokensBudget: 750000, priceUsd: 35, priceInr: 2999, originalPriceInr: 3999,
    intervalDays: 180, intervalLabel: '6 months',
    description: 'Everything + priority support',
    badge: 'Most popular',
    picoSlots: 3,
  },
  yearly: {
    credits: 1500000, tokensBudget: 1000000, priceUsd: 60, priceInr: 4999, originalPriceInr: 5999,
    intervalDays: 365, intervalLabel: 'year',
    description: 'Everything + Kimi reasoning included',
    badge: 'Best value',
    picoSlots: 3,
  },
};
// Alias: 'monthly' maps to 'pilot' for existing users
PLAN_DEFINITIONS['monthly'] = { ...PLAN_DEFINITIONS['pilot'], badge: undefined };

// ── Seed demo data ──────────────────────────────────────────

/** Default integrations created for every user (matches auth.ts signup) */
const DEFAULT_INTEGRATIONS: [string, string, string, string][] = [
  ['telegram', 'Telegram', 'Send messages, reminders, and receive notifications via Telegram bot', '["Send messages","Receive reminders","Bot commands"]'],
  ['google-calendar', 'Google Calendar', 'Sync events, schedule reminders, and check availability', '["Event sync","Reminders","Availability check"]'],
  ['location', 'Location Services', 'Share location for contextual reminders', '["Location queries","Geofenced reminders"]'],
  ['github', 'GitHub', 'Sync repositories, track issues, and showcase projects', '["Repo sync","Issue tracking","Portfolio showcase"]'],
  ['twitter', 'Twitter/X', 'Share updates and connect your social presence', '["Auto-share","Social sync","Profile link"]'],
  ['linkedin', 'LinkedIn', 'Professional profile sync and networking', '["Profile sync","Network updates"]'],
  ['n8n', 'n8n', 'Workflow automation engine for advanced integrations', '["Custom workflows","Triggers","Webhooks"]'],
  ['whatsapp', 'WhatsApp', 'Chat with your AI agent via WhatsApp', '["Messages","Voice notes","Media"]'],
];

function seedDefaultIntegrations(userId: string) {
  const insInt = db.prepare('INSERT INTO integrations (id, user_id, type, name, description, status, health, requests_today, last_sync, features, permissions) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)');
  for (const [type, name, desc, feats] of DEFAULT_INTEGRATIONS) {
    insInt.run(uuid(), userId, type, name, desc, 'disconnected', '', feats, '[]');
  }
}

function seedDemoData() {
  // Guard: in production (non-test), never seed if real users exist
  const isTestMode = process.env.TEST_MODE === 'true' || process.env.TEST_MODE === '1';
  if (!isTestMode) {
    const realUserCount = (db.prepare(
      "SELECT count(*) as cnt FROM users WHERE id NOT LIKE 'demo-%'"
    ).get() as { cnt: number }).cnt;
    if (realUserCount > 0) {
      logger.info({ realUserCount }, 'seedDemoData: Real users detected, skipping seed to protect production data');
      return;
    }
  }

  const hasOriginal = db.prepare('SELECT id FROM users WHERE id = ?').get('demo-1');
  const hasNew = db.prepare('SELECT id FROM users WHERE id = ?').get('demo-9');

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, username, password_hash, name, avatar, bio, location, website, role, company, tags, plan, credits, onboarding_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // ── Original demo users (demo-1 through demo-8) ────────────
  if (!hasOriginal) {
    const passwordHash = bcrypt.hashSync('demo123', 10);

    insertUser.run('demo-1', 'alex@example.com', 'alex', passwordHash, 'Alex Chen', 'AC',
      'Full-stack developer and AI enthusiast. Building tools that make life easier.',
      'San Francisco, CA', 'alexchen.dev', 'Senior Developer', 'TechCorp',
      '["AI Engineer","Full-stack","Open Source"]', 'pro', 12450, 1);

    insertUser.run('demo-2', 'sarah@example.com', 'sarah', bcrypt.hashSync('demo123', 10), 'Sarah Kim', 'SK',
      'Designing experiences that delight.',
      'New York, NY', '', 'Lead Designer', 'DesignStudio',
      '["Designer","Creative Tech","UX"]', 'pro', 10000, 1);

    insertUser.run('demo-3', 'marcus@example.com', 'marcus', bcrypt.hashSync('demo123', 10), 'Marcus Wright', 'MW',
      'Helping founders build the future. 10+ years in tech, 3 exits.',
      'Austin, TX', 'marcuswright.co', 'Founder', 'ConsultX',
      '["Founder","Advisor","Strategy"]', 'pro', 8000, 1);

    insertUser.run('demo-4', 'jordan@example.com', 'jordan', bcrypt.hashSync('demo123', 10), 'Jordan Lee', 'JL',
      'ML Engineer turning data into insights.',
      'Seattle, WA', '', 'ML Engineer', 'DataLabs',
      '["ML","Data Science","Python"]', 'free', 15000, 1);

    insertUser.run('demo-5', 'taylor@example.com', 'taylor', bcrypt.hashSync('demo123', 10), 'Taylor Brooks', 'TB',
      'Cloud infrastructure at scale.',
      'Denver, CO', '', 'Cloud Architect', 'CloudOps',
      '["DevOps","Cloud","Infrastructure"]', 'free', 15000, 1);

    insertUser.run('demo-6', 'casey@example.com', 'casey', bcrypt.hashSync('demo123', 10), 'Casey Rivera', 'CR',
      'Automating everything with no-code tools.',
      'Miami, FL', '', 'Automation Expert', 'GrowthLab',
      '["No-Code","Automation","Marketing"]', 'free', 15000, 1);

    insertUser.run('demo-7', 'morgan@example.com', 'morgan', bcrypt.hashSync('demo123', 10), 'Morgan Patel', 'MP',
      'AI storyteller and content creator.',
      'London, UK', '', 'Content Creator', 'StoryAI',
      '["Content","AI Writing","Storytelling"]', 'free', 15000, 1);

    insertUser.run('demo-8', 'riley@example.com', 'riley', bcrypt.hashSync('demo123', 10), 'Riley Zhang', 'RZ',
      'Building the decentralized future.',
      'Singapore', '', 'Web3 Developer', 'ChainDev',
      '["Web3","Blockchain","Solidity"]', 'free', 15000, 1);

    // Agent configs for original demo users
    const insertAgent = db.prepare(`
      INSERT INTO agent_configs (id, user_id, name, display_name, mode, voice, system_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAgent.run('agent-1', 'demo-1', 'Geek', "Alex's AI", 'builder', 'friendly', "You are Alex's personal AI assistant. You help with coding, scheduling, and general tasks.");
    insertAgent.run('agent-2', 'demo-2', 'Muse', "Sarah's AI", 'minimal', 'professional', "You are Sarah's design assistant.");
    insertAgent.run('agent-3', 'demo-3', 'Atlas', "Marcus's AI", 'operator', 'witty', "You are Marcus's business advisor assistant.");

    // Reminders for demo-1
    const insertReminder = db.prepare(`
      INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, completed, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertReminder.run('rem-1', 'demo-1', 'Call mom', '2026-02-12T09:00', 'telegram', 'personal', '', 0, 'user');
    insertReminder.run('rem-2', 'demo-1', 'Submit project report', '2026-02-12T17:00', 'email', 'work', 'weekly', 0, 'user');
    insertReminder.run('rem-3', 'demo-1', 'Team standup', '2026-02-12T10:00', 'push', 'work', 'daily', 1, 'agent');
    insertReminder.run('rem-4', 'demo-1', 'Pay rent', '2026-02-15T09:00', 'telegram', 'personal', 'monthly', 0, 'user');
    insertReminder.run('rem-5', 'demo-1', 'Gym workout', '2026-02-12T07:00', 'push', 'health', '', 0, 'automation');
    insertReminder.run('rem-6', 'demo-1', 'Review pull requests', '2026-02-12T14:00', 'email', 'work', '', 0, 'user');

    // Integrations for demo-1 (rich demo data with connected services)
    const insertIntegration = db.prepare(`
      INSERT INTO integrations (id, user_id, type, name, description, status, health, requests_today, last_sync, features, permissions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertIntegration.run('int-1', 'demo-1', 'telegram', 'Telegram', 'Send messages, reminders, and receive notifications via Telegram bot', 'connected', 98, 124, '2 minutes ago', '["Send messages","Receive reminders","Bot commands"]', '["send","receive"]');
    insertIntegration.run('int-2', 'demo-1', 'google-calendar', 'Google Calendar', 'Sync events, schedule reminders, and check availability', 'connected', 100, 56, '15 minutes ago', '["Event sync","Schedule queries","Availability check"]', '["read","write"]');
    insertIntegration.run('int-3', 'demo-1', 'location', 'Location Services', 'Share location for contextual reminders', 'paused', 0, 0, '2 hours ago', '["Location queries","Geofenced reminders"]', '[]');
    insertIntegration.run('int-4', 'demo-1', 'github', 'GitHub', 'Sync repositories, track issues, and showcase projects', 'disconnected', 0, 0, '1 day ago', '["Repo sync","Issue tracking","Portfolio showcase"]', '[]');
    insertIntegration.run('int-5', 'demo-1', 'twitter', 'Twitter/X', 'Share updates and connect your social presence', 'disconnected', 0, 0, '', '["Auto-share","Social sync","Profile link"]', '[]');
    insertIntegration.run('int-6', 'demo-1', 'linkedin', 'LinkedIn', 'Professional profile sync and networking', 'disconnected', 0, 0, '', '["Profile sync","Network updates"]', '[]');
    insertIntegration.run('int-7', 'demo-1', 'n8n', 'n8n', 'Workflow automation engine for advanced integrations', 'disconnected', 0, 0, '', '["Custom workflows","Triggers","Webhooks"]', '[]');
    insertIntegration.run('int-8', 'demo-1', 'manychat', 'ManyChat', 'Chatbot and marketing automation platform', 'disconnected', 0, 0, '', '["Broadcast","Tag users","Flows"]', '[]');
    insertIntegration.run('int-9', 'demo-1', 'email', 'Email', 'Receive reminders, daily briefings, and agent summaries via email', 'disconnected', 0, 0, '', '["Reminders","Daily briefing","Agent summaries"]', '[]');

    // Portfolios for demo-1/2/3
    const insertPortfolio = db.prepare(`
      INSERT INTO portfolios (user_id, username, headline, about, avatar, location, role, company, skills, projects, milestones, social, layout, agent_enabled, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPortfolio.run('demo-1', 'alex', 'Full-stack Developer & AI Enthusiast',
      "Building tools that make life easier. I love coding, automation, and helping others learn. My agent can answer questions about my work, schedule, or just chat!",
      'AC', 'San Francisco, CA', 'Senior Developer', 'TechCorp',
      '["React","TypeScript","Node.js","Python","AI/ML","Docker"]',
      JSON.stringify([
        { name: 'AutoTask', description: 'AI-powered task automation', url: '#', tags: ['AI', 'Automation'], aiGenerated: false },
        { name: 'CodeSync', description: 'Real-time code collaboration', url: '#', tags: ['Collaboration', 'WebRTC'], aiGenerated: false },
        { name: 'NeuralChat', description: 'Conversational AI interface', url: '#', tags: ['AI', 'Chat'], aiGenerated: true },
      ]),
      JSON.stringify([
        { date: '2026-01-15', title: 'Joined GeekSpace', description: 'Started the AI OS journey', autoGenerated: true },
        { date: '2026-01-20', title: 'Connected Telegram', description: 'First integration active', autoGenerated: true },
        { date: '2026-02-01', title: 'First Automation', description: 'Created portfolio update automation', autoGenerated: true },
      ]),
      JSON.stringify({ github: 'github.com/alexchen', twitter: 'twitter.com/alexchen', linkedin: 'linkedin.com/in/alexchen', website: 'alexchen.dev', email: 'alex@example.com' }),
      'classic', 1, '{"showInDirectory":true,"showAvatar":true,"showLocation":true,"showProjects":true,"showActivity":true}'
    );

    insertPortfolio.run('demo-2', 'sarah', 'Product Designer & Creative Technologist',
      'Designing experiences that delight.', 'SK', 'New York, NY', 'Lead Designer', 'DesignStudio',
      '["UI/UX","Figma","Design Systems","React","Motion Design"]',
      JSON.stringify([
        { name: 'DesignKit', description: 'Component library for startups', url: '#' },
        { name: 'FlowMap', description: 'User journey visualization tool', url: '#' },
      ]),
      '[]',
      JSON.stringify({ github: 'github.com/sarahkim', twitter: 'twitter.com/sarahkim', linkedin: 'linkedin.com/in/sarahkim', email: 'sarah@example.com' }),
      'classic', 1, '{"showInDirectory":true,"showAvatar":true,"showLocation":true,"showProjects":true,"showActivity":false}'
    );

    insertPortfolio.run('demo-3', 'marcus', 'Founder & Startup Advisor',
      'Helping founders build the future. 10+ years in tech, 3 exits.', 'MW', 'Austin, TX', 'Founder', 'ConsultX',
      '["Strategy","Fundraising","Product","Leadership","Growth"]',
      JSON.stringify([
        { name: 'StartupOS', description: 'Founder operating system', url: '#' },
        { name: 'VentureMap', description: 'Investor relationship tracker', url: '#' },
      ]),
      '[]',
      JSON.stringify({ twitter: 'twitter.com/marcuswright', linkedin: 'linkedin.com/in/marcuswright', website: 'marcuswright.co', email: 'marcus@example.com' }),
      'timeline', 1, '{"showInDirectory":true,"showAvatar":true,"showLocation":true,"showProjects":true,"showActivity":true}'
    );

    // Features for demo-1
    db.prepare(`INSERT INTO features (user_id, social_discovery, portfolio_chat, automation_builder, website_builder, n8n_integration, manychat_integration) VALUES (?, 1, 1, 1, 0, 1, 0)`).run('demo-1');

    // Subscriptions for demo-1 through demo-8
    const insertSub = db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan, monthly_credits, credits_remaining, credits_used_this_cycle, billing_interval_days, price_usd, price_inr, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertSub.run(uuid(), 'demo-1', 'yearly',   1500000, 1420000, 80000, 365, 50, 4999, 'INR');
    insertSub.run(uuid(), 'demo-2', 'monthly',   100000,  98200,  1800,  30,  10, 999,  'USD');
    insertSub.run(uuid(), 'demo-3', 'halfyear',  700000,  685000, 15000, 180, 30, 2999, 'USD');
    for (let i = 4; i <= 8; i++) {
      insertSub.run(uuid(), `demo-${i}`, 'free', 5000, 5000, 0, 30, 0, 0, 'USD');
    }

    // Seed some usage events for demo-1
    const insertEvent = db.prepare(`
      INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const channels = ['web', 'telegram', 'terminal', 'portfolio-chat'];
    const providers = ['openai', 'qwen', 'anthropic'];
    const tools = ['ai.chat', 'reminders.create', 'portfolio.update', 'usage.summary', 'schedule.get'];
    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const tokIn = Math.floor(Math.random() * 2000) + 100;
      const tokOut = Math.floor(Math.random() * 800) + 50;
      const provider = providers[Math.floor(Math.random() * providers.length)];
      const cost = provider === 'openai' ? 0.04 : provider === 'anthropic' ? 0.03 : 0.01;
      insertEvent.run(
        uuid(), 'demo-1', provider, `${provider}-default`, tokIn, tokOut,
        +(cost * (tokIn + tokOut) / 1000).toFixed(4),
        channels[Math.floor(Math.random() * channels.length)],
        tools[Math.floor(Math.random() * tools.length)],
        date.toISOString()
      );
    }

    // Seed activity log for demo-1
    const insertActivity = db.prepare(`
      INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const activities = [
      { action: 'Chatted with agent', details: 'Asked about schedule', icon: 'message-square', mins: 5 },
      { action: 'Created reminder', details: 'Call mom — Feb 12', icon: 'bell', mins: 32 },
      { action: 'Updated portfolio', details: 'Added NeuralChat project', icon: 'layout', mins: 120 },
      { action: 'Connected Telegram', details: 'Integration active', icon: 'link', mins: 240 },
      { action: 'Ran automation', details: 'Portfolio update sync', icon: 'zap', mins: 360 },
      { action: 'Changed agent voice', details: 'Set to friendly', icon: 'mic', mins: 480 },
    ];
    for (const act of activities) {
      const d = new Date();
      d.setMinutes(d.getMinutes() - act.mins);
      insertActivity.run(uuid(), 'demo-1', act.action, act.details, act.icon, d.toISOString());
    }

    logger.info('Original demo data (demo-1 through demo-8) seeded');
  }

  // ── New demo users (demo-9 through demo-11) ────────────────
  if (!hasNew) {
    const newPass = bcrypt.hashSync('P@ssw0rd2026', 10);

    insertUser.run('demo-9', 'srikar@geekspace.demo', 'srikar', newPass, 'Srikar', 'SK',
      'Exploring the future of AI-powered productivity.',
      'Hyderabad, IN', '', 'Developer', 'GeekSpace',
      '["AI","Productivity","Full-stack"]', 'monthly', 95000, 1);

    insertUser.run('demo-10', 'abhi@geekspace.demo', 'abhi', newPass, 'Abhi', 'AB',
      'Building smarter systems one line at a time.',
      'Bangalore, IN', '', 'Engineer', 'GeekSpace',
      '["Backend","Cloud","Python"]', 'monthly', 92000, 1);

    insertUser.run('demo-11', 'guest@geekspace.demo', 'guest', newPass, 'Guest', 'GU',
      'Exploring GeekSpace as a guest.',
      '', '', 'Guest', '',
      '[]', 'free', 5000, 1);

    // Agent configs for new demo users
    const insertAgent = db.prepare(`
      INSERT INTO agent_configs (id, user_id, name, display_name, mode, voice, system_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAgent.run('agent-9', 'demo-9', 'Nexus', "Srikar's AI", 'builder', 'friendly', "You are Srikar's personal AI assistant. You help with coding, productivity, and general tasks.");
    insertAgent.run('agent-10', 'demo-10', 'Pulse', "Abhi's AI", 'builder', 'friendly', "You are Abhi's personal AI assistant. You help with engineering, cloud, and general tasks.");
    insertAgent.run('agent-11', 'demo-11', 'Scout', 'Guest AI', 'minimal', 'friendly', "You are a helpful AI assistant for a GeekSpace guest user.");

    // Features for new demo users
    const insertFeature = db.prepare(`
      INSERT INTO features (user_id, social_discovery, portfolio_chat, automation_builder, website_builder, n8n_integration, manychat_integration)
      VALUES (?, 1, 1, 1, 0, 1, 0)
    `);
    insertFeature.run('demo-9');
    insertFeature.run('demo-10');
    insertFeature.run('demo-11');

    // Subscriptions for new demo users
    const insertSub = db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan, monthly_credits, credits_remaining, credits_used_this_cycle, billing_interval_days, price_usd, price_inr, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertSub.run(uuid(), 'demo-9',  'monthly', 100000, 95000, 5000, 30, 10, 999, 'INR');
    insertSub.run(uuid(), 'demo-10', 'monthly', 100000, 92000, 8000, 30, 10, 999, 'INR');
    insertSub.run(uuid(), 'demo-11', 'free', 5000, 5000, 0, 30, 0, 0, 'USD');

    // Portfolios for new demo users
    const insertPortfolio = db.prepare(`
      INSERT INTO portfolios (user_id, username, headline, about, avatar, location, role, company, skills, projects, milestones, social, layout, agent_enabled, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const defaultVisibility = '{"showInDirectory":true,"showAvatar":true,"showLocation":true,"showProjects":true,"showActivity":true}';

    insertPortfolio.run('demo-9', 'srikar', 'AI & Productivity Developer',
      'Exploring the future of AI-powered productivity.',
      'SK', 'Hyderabad, IN', 'Developer', 'GeekSpace',
      '["AI","Productivity","Full-stack","TypeScript","React"]',
      '[]', '[]', '{}', 'classic', 1, defaultVisibility
    );

    insertPortfolio.run('demo-10', 'abhi', 'Backend & Cloud Engineer',
      'Building smarter systems one line at a time.',
      'AB', 'Bangalore, IN', 'Engineer', 'GeekSpace',
      '["Backend","Cloud","Python","Node.js","Docker"]',
      '[]', '[]', '{}', 'classic', 1, defaultVisibility
    );

    insertPortfolio.run('demo-11', 'guest', 'GeekSpace Explorer',
      'Exploring GeekSpace as a guest.',
      'GU', '', 'Guest', '',
      '[]', '[]', '[]', '{}', 'classic', 1, defaultVisibility
    );

    // Default integrations for new demo users
    seedDefaultIntegrations('demo-9');
    seedDefaultIntegrations('demo-10');
    seedDefaultIntegrations('demo-11');

    logger.info('New demo data (demo-9 through demo-11) seeded');
  }

  // Phase 94: Seed user_memories for demo users (only if empty)
  const memCount = (db.prepare('SELECT count(*) as cnt FROM user_memories WHERE user_id = ?').get('demo-1') as { cnt: number }).cnt;
  if (memCount === 0) {
    const insertMem = db.prepare(`
      INSERT OR IGNORE INTO user_memories (user_id, key, value, source, confidence, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    // Alex
    insertMem.run('demo-1', 'preferred_name', 'Alex', 'manual', 1.0, now, now);
    insertMem.run('demo-1', 'timezone', 'PST', 'manual', 1.0, now, now);
    insertMem.run('demo-1', 'location', 'San Francisco, CA', 'extracted', 0.9, now, now);
    insertMem.run('demo-1', 'main_project', 'GeekSpace AI OS', 'manual', 1.0, now, now);
    insertMem.run('demo-1', 'role', 'Senior Developer at TechCorp', 'extracted', 0.85, now, now);
    // Sarah
    insertMem.run('demo-2', 'preferred_name', 'Sarah', 'manual', 1.0, now, now);
    insertMem.run('demo-2', 'timezone', 'EST', 'manual', 1.0, now, now);
    insertMem.run('demo-2', 'main_project', 'DesignKit component library', 'manual', 1.0, now, now);
    // Marcus
    insertMem.run('demo-3', 'preferred_name', 'Marcus', 'manual', 1.0, now, now);
    insertMem.run('demo-3', 'timezone', 'CST', 'manual', 1.0, now, now);
    insertMem.run('demo-3', 'main_project', 'StartupOS founder operating system', 'manual', 1.0, now, now);
    logger.info('Phase 94: user_memories seeded for demo users');
  }
}

// Only seed demo data when explicitly enabled in non-production environments
const shouldSeed = process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA === 'true';
if (shouldSeed) {
  seedDemoData();
}

export { db, seedDemoData };

// Phase 13: snooze_until column for reminder snooze expiry cleanup
try { db.exec(`ALTER TABLE reminders ADD COLUMN snooze_until INTEGER`); } catch { /* column already exists */ }

// Phase 16: Performance indexes for hot-path queries
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON activity_log(user_id, created_at)`); } catch { /* index already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_scheduler ON reminders(user_id, completed, remind_at)`); } catch { /* index already exists */ }

// Phase 25.1: Custom greeting message for agent persona
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN greeting TEXT DEFAULT ''`); } catch { /* column already exists */ }

// Phase 25.3: JWT invalidation on password change — track when password was last changed
try { db.exec(`ALTER TABLE users ADD COLUMN password_changed_at INTEGER DEFAULT 0`); } catch { /* column already exists */ }

// Phase 26.2: Reminder priority levels
try { db.exec(`ALTER TABLE reminders ADD COLUMN priority TEXT DEFAULT 'normal'`); } catch { /* column already exists */ }

// Phase 27.3: Connection invite links
db.exec(`
  CREATE TABLE IF NOT EXISTS connection_invites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    email TEXT,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )
`);

// Phase 30.3: DB index for reminders ordered by datetime (covers the /reminders GET sort)
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_datetime ON reminders(user_id, datetime)`); } catch { /* index already exists */ }

// Phase 30.4: Track how many times each reminder has been snoozed
try { db.exec(`ALTER TABLE reminders ADD COLUMN snooze_count INTEGER DEFAULT 0`); } catch { /* column already exists */ }

// Phase 36.1: Snooze event log — per-event history for each reminder snooze
db.exec(`
  CREATE TABLE IF NOT EXISTS snooze_log (
    id TEXT PRIMARY KEY,
    reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    snoozed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    preset TEXT NOT NULL,
    new_datetime TEXT NOT NULL
  )
`);
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_snooze_log_reminder ON snooze_log(reminder_id, snoozed_at DESC)`); } catch { /* already exists */ }

// Phase 40.6: Track when the 5-min early Telegram alert was sent for each reminder
try { db.exec(`ALTER TABLE reminders ADD COLUMN remind_before_sent_at INTEGER`); } catch { /* column already exists */ }

// Phase 41.6: Custom snooze presets for agent config
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN snooze_presets TEXT DEFAULT '[]'`); } catch { /* column already exists */ }

// Phase 45.2: Drop duplicate reminders index (idx_reminders_datetime from Phase 30 covers the same cols)
try { db.exec(`DROP INDEX IF EXISTS idx_reminders_user_due`); } catch { /* ignore */ }

// Phase 43.9: Performance indexes for hot-path compound queries
// activity_log: user + created_at DESC for sorted activity feeds
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON activity_log(user_id, created_at DESC)`); } catch { /* already exists */ }
// snooze_log: reminder + snoozed_at DESC (may already exist from Phase 36; IF NOT EXISTS is safe)
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_snooze_log_reminder ON snooze_log(reminder_id, snoozed_at DESC)`); } catch { /* already exists */ }
// generated_outputs: user + created_at DESC (conversations table does not exist; closest equivalent)
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON generated_outputs(user_id, created_at DESC)`); } catch { /* already exists */ }
// automations: user + enabled flag compound lookup (column is "enabled", not "is_active")
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_automations_user_active ON automations(user_id, enabled)`); } catch { /* already exists */ }

// Phase 61.2: Overdue escalation tracking — prevents duplicate Telegram alerts
try { db.exec(`ALTER TABLE reminders ADD COLUMN overdue_escalated_at TEXT DEFAULT NULL`); } catch { /* column already exists */ }

// ── Phase 67: Suggestion Intelligence + Suggest & Earn ────────────────────────
// All tables are additive (CREATE TABLE IF NOT EXISTS) — safe for existing prod DBs.

try { db.exec(`
  CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`); } catch { /* already exists */ }

try { db.exec(`
  CREATE TABLE IF NOT EXISTS suggestion_clusters (
    id TEXT PRIMARY KEY,
    canonical_summary TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    suggestion_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`); } catch { /* already exists */ }

try { db.exec(`
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
  )
`); } catch { /* already exists */ }

try { db.exec(`
  CREATE TABLE IF NOT EXISTS suggestion_rewards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggestion_id TEXT,
    cluster_id TEXT,
    event_type TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    unique_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`); } catch { /* already exists */ }

// Indexes for suggestion queries
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_user ON suggestions(user_id, created_at DESC)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status, created_at DESC)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestion_rewards_user ON suggestion_rewards(user_id, created_at DESC)`); } catch { /* already exists */ }

// ── Phase 68.1: Fix CI — ensure agent_memory + conversation_log always exist ──
// These tables were created only by initMemoryTables() (in memory.ts), which is
// called by index.ts (prod) but NOT by app.ts (tests). Moving them here ensures
// they're always created when db/index.ts is imported (which tests do directly).
try { db.exec(`
  CREATE TABLE IF NOT EXISTS agent_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'observed',
    access_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, category, key)
  )
`); } catch { /* already exists */ }

try { db.exec(`
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
  )
`); } catch { /* already exists */ }

try { db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(user_id, category)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_conversation_log_user ON conversation_log(user_id, created_at)`); } catch { /* already exists */ }

// ── Context Threading: FTS5 full-text search over conversation history ────────
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5(
      content,
      user_id UNINDEXED,
      created_at UNINDEXED,
      content='conversation_log',
      content_rowid='rowid'
    )
  `);
  // Populate existing rows (idempotent: CREATE IF NOT EXISTS prevents double-table)
  db.exec(`
    INSERT INTO conversation_fts(rowid, content, user_id, created_at)
    SELECT rowid, content, user_id, created_at FROM conversation_log
  `);
} catch { /* FTS5 already exists or SQLite build lacks FTS5 — non-fatal */ }

// Keep FTS index in sync with new conversation_log inserts
try {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS conv_fts_insert AFTER INSERT ON conversation_log BEGIN
      INSERT INTO conversation_fts(rowid, content, user_id, created_at)
      VALUES (new.rowid, new.content, new.user_id, new.created_at);
    END
  `);
} catch { /* already exists */ }

// ── Phase 68.1: Suggestion status history ────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS suggestion_events (
    id TEXT PRIMARY KEY,
    suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestion_events_suggestion ON suggestion_events(suggestion_id, created_at DESC)`); } catch { /* already exists */ }

// ── Phase 68.4: Suggestion votes ─────────────────────────────────────────────
try { db.exec(`
  CREATE TABLE IF NOT EXISTS suggestion_votes (
    id TEXT PRIMARY KEY,
    suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(suggestion_id, user_id)
  )
`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion ON suggestion_votes(suggestion_id)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestion_votes_user ON suggestion_votes(user_id)`); } catch { /* already exists */ }

// Phase 69.1: Compound index for vote lookup by suggestion+user (covers INSERT OR REPLACE uniqueness check)
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestion_votes_user_suggestion ON suggestion_votes(suggestion_id, user_id)`); } catch { /* already exists */ }

// Phase 69.14: Cluster name column (human-readable label for admin UI)
try { db.exec(`ALTER TABLE suggestion_clusters ADD COLUMN name TEXT`); } catch { /* already exists */ }

// Phase 70.4: Composite index on activity_log for per-user sorted queries (additive — IF NOT EXISTS is safe)
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON activity_log(user_id, created_at DESC)`); } catch { /* already exists */ }

// Phase 73.6: Index on activity_log(action) for action-based queries
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action)`); } catch { /* already exists */ }

// Phase 73.9: Compound index on suggestions(user_id, deleted_at) for filtered user queries
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_suggestions_user_deleted ON suggestions(user_id, deleted_at)`); } catch { /* already exists */ }

// Phase 70.11: Soft-delete support for suggestions
try { db.exec(`ALTER TABLE suggestions ADD COLUMN deleted_at TEXT DEFAULT NULL`); } catch { /* already exists */ }

// Phase 70.14: Trending flag on suggestions (vote velocity > threshold in last 24h)
try { db.exec(`ALTER TABLE suggestions ADD COLUMN trending INTEGER DEFAULT 0`); } catch { /* already exists */ }

// ── Phase 82: Store Safety tables ────────────────────────────────────────────

// 82.2: AI response reports — users can flag harmful/inaccurate/inappropriate responses
try { db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT 'other',
    additional_info TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  )
`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id, created_at DESC)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)`); } catch { /* already exists */ }

// 82.3: User blocking infrastructure (for future user-to-user messaging)
try { db.exec(`
  CREATE TABLE IF NOT EXISTS blocked_users (
    id TEXT PRIMARY KEY,
    blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(blocker_id, blocked_id)
  )
`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id)`); } catch { /* already exists */ }

// 82.6: Content moderation log — flagged messages (still sent but logged)
try { db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    flags TEXT NOT NULL DEFAULT '[]',
    action TEXT NOT NULL DEFAULT 'allowed',
    created_at TEXT DEFAULT (datetime('now'))
  )
`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_moderation_log_user ON moderation_log(user_id, created_at DESC)`); } catch { /* already exists */ }

// 83.4: Invite codes — for invite-gated beta registration
try { db.exec(`
  CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    email TEXT,
    note TEXT DEFAULT '',
    created_by TEXT DEFAULT 'admin',
    used_at TEXT DEFAULT NULL,
    used_by TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_invite_codes_used ON invite_codes(used_at)`); } catch { /* already exists */ }

// Phase 96: User-defined multi-agent workflow builder
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      steps TEXT NOT NULL DEFAULT '[]',
      trigger TEXT DEFAULT 'manual',
      enabled INTEGER DEFAULT 1,
      last_run INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_user_workflows_user ON user_workflows(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES user_workflows(id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT DEFAULT 'running',
      context TEXT DEFAULT '{}',
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_workflow_runs_wf ON user_workflow_runs(workflow_id, started_at DESC);
  `);
} catch { /* tables already exist */ }

// Phase 97: AI Inbox -- unified message feed from Telegram, WhatsApp, and system events
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inbox_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      sender TEXT,
      content TEXT NOT NULL,
      summary TEXT,
      priority TEXT DEFAULT 'normal',
      read INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      suggested_reply TEXT,
      related_reminder_id INTEGER REFERENCES reminders(id),
      received_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_messages(user_id, read, received_at DESC);
  `);
} catch { /* table already exists */ }

// Phase 100: Gmail integration -- token column + gmail_messages tracking table
try { db.exec(`ALTER TABLE users ADD COLUMN google_gmail_token TEXT DEFAULT NULL`); } catch { /* column already exists */ }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gmail_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gmail_message_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      sender TEXT NOT NULL,
      snippet TEXT,
      inbox_id INTEGER REFERENCES inbox_messages(id) ON DELETE SET NULL,
      synced_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_messages_gid ON gmail_messages(user_id, gmail_message_id);
    CREATE INDEX IF NOT EXISTS idx_gmail_messages_user ON gmail_messages(user_id, synced_at DESC);
  `);
} catch { /* table already exists */ }

// Phase 102: Tables for analytics + Phase 101: Focus Mode + Habits (additive)
// Phase 101: deferred flag for inbox messages (deferred during focus mode)
try { db.exec(`ALTER TABLE inbox_messages ADD COLUMN deferred INTEGER DEFAULT 0`); } catch { /* already exists */ }

try { db.exec(`
  CREATE TABLE IF NOT EXISTS user_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    confidence REAL DEFAULT 1.0,
    last_used INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memories_key ON user_memories(user_id, key);
  CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id, last_used DESC);

  CREATE TABLE IF NOT EXISTS user_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    steps TEXT NOT NULL DEFAULT '[]',
    trigger TEXT DEFAULT 'manual',
    enabled INTEGER DEFAULT 1,
    last_run INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_user_workflows_user ON user_workflows(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS user_workflow_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL REFERENCES user_workflows(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    status TEXT DEFAULT 'running',
    context TEXT DEFAULT '{}',
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_user_workflow_runs_wf ON user_workflow_runs(workflow_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    summary TEXT,
    linked_reminder_id INTEGER REFERENCES reminders(id) ON DELETE SET NULL,
    pinned INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, archived, updated_at DESC);

  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT DEFAULT 'daily',
    target_time TEXT,
    icon TEXT DEFAULT 'star',
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);

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
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    duration_min INTEGER,
    goal TEXT,
    completed INTEGER DEFAULT 0,
    pomodoro_count INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS notification_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    focus_mode_active INTEGER DEFAULT 0,
    dnd_start TEXT DEFAULT '22:00',
    dnd_end TEXT DEFAULT '08:00',
    urgent_bypass INTEGER DEFAULT 1,
    batch_interval_min INTEGER DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT (date('now')),
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id, date DESC);

  CREATE TABLE IF NOT EXISTS budget_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'total',
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    UNIQUE(user_id, category, period)
  );
`); } catch { /* tables already exist */ }

// Task 2: preferred media model columns for agent_configs
try { db.exec("ALTER TABLE agent_configs ADD COLUMN preferred_image_model TEXT DEFAULT 'auto'"); } catch { /* column already exists */ }
try { db.exec("ALTER TABLE agent_configs ADD COLUMN preferred_video_model TEXT DEFAULT 'auto'"); } catch { /* column already exists */ }
// -- Phase 95: Google Calendar integration ------------------------------------
// Store Google Calendar OAuth tokens per user (JSON: access_token, refresh_token, expiry_date, email)
try { db.exec(`ALTER TABLE users ADD COLUMN google_calendar_token TEXT DEFAULT NULL`); } catch { /* column already exists */ }

// Track which calendar events have been imported
try { db.exec(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gcal_event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    reminder_id TEXT REFERENCES reminders(id) ON DELETE SET NULL,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  )
`); } catch { /* already exists */ }
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_gcal ON calendar_events(user_id, gcal_event_id)`); } catch { /* already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id, start_time)`); } catch { /* already exists */ }
// Phase 95: auto-reminder toggle per user
try { db.exec(`ALTER TABLE users ADD COLUMN calendar_auto_reminders INTEGER DEFAULT 1`); } catch { /* column already exists */ }

// Phase 106: use_case for onboarding wizard
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN use_case TEXT DEFAULT NULL`); } catch { /* column already exists */ }

// Phase 108: Gate API keys for external developer access
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gate_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT 'My API Key',
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT,
      is_active INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_gate_api_keys_user ON gate_api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_gate_api_keys_hash ON gate_api_keys(key_hash);
  `);
} catch { /* table already exists */ }

// Phase 109: Quality score for conversation rating
try { db.exec(`ALTER TABLE conversation_log ADD COLUMN quality_score INTEGER DEFAULT NULL`); } catch { /* column already exists */ }

// Phase 110: User timezone for timezone-aware reminder parsing and display
try { db.exec(`ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'Asia/Kolkata'`); } catch { /* column already exists */ }

// Google/GitHub OAuth identity columns
try { db.exec(`ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT NULL`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN github_id TEXT DEFAULT NULL`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN github_username TEXT DEFAULT NULL`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT NULL`); } catch { /* column already exists */ }

// Phase 4: 30-min reminder preview tracking column
try { db.exec(`ALTER TABLE reminders ADD COLUMN preview_sent INTEGER`); } catch { /* column already exists */ }

// Habit Coach Mode: per-habit reminder time + skip_until for snooze-this-week
try { db.exec(`ALTER TABLE habits ADD COLUMN reminder_time TEXT DEFAULT '09:00'`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN skip_until INTEGER DEFAULT 0`); } catch { /* already exists */ }

// Phase P1: per-type proactive notification preferences
try {
  db.prepare("ALTER TABLE agent_configs ADD COLUMN proactive_preferences TEXT DEFAULT '{}'").run();
} catch { /* column exists */ }

// Page monitor system: watch URLs for changes
db.prepare(`
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
  )
`).run();
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_pagemon_user ON page_monitors(user_id)').run(); } catch { /* exists */ }

// Graph memory: entity relationship tracking
db.prepare(`
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
  )
`).run();
try { db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_user_name ON memory_entities(user_id, lower(name))').run(); } catch { /* exists */ }

db.prepare(`
  CREATE TABLE IF NOT EXISTS memory_relations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_entity_id TEXT NOT NULL,
    to_entity_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    strength REAL DEFAULT 0.5,
    last_reinforced_at INTEGER NOT NULL
  )
`).run();
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_relation_from ON memory_relations(from_entity_id)').run(); } catch { /* exists */ }

// ── Agentin Docs ────────────────────────────────────────────
db.exec(`
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
`);
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id)').run(); } catch { /* exists */ }
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id)').run(); } catch { /* exists */ }
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_documents_slug ON documents(public_slug)').run(); } catch { /* exists */ }
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_doc_folders_user ON doc_folders(user_id)').run(); } catch { /* exists */ }
try { db.prepare('CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id)').run(); } catch { /* exists */ }

// ── Auth Hardening: Refresh tokens table for JWT rotation ─────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      family TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
  `);
} catch { /* table/indexes already exist */ }

// Auth Hardening: Cleanup expired refresh tokens on startup
try {
  const nowSec = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(nowSec);
} catch { /* non-fatal */ }

// Phase 106b: Uploaded files for chat file attachments
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id, created_at DESC);
  `);
} catch { /* table already exists */ }

// Personality sliders: add verbosity, humor, empathy to agent_configs
// (creativity and formality already exist in the base schema)
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN verbosity INTEGER DEFAULT 50`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN humor INTEGER DEFAULT 50`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN empathy INTEGER DEFAULT 50`); } catch { /* column already exists */ }

// GAP-10: Proactive settings persistence columns
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN autonomy_level TEXT DEFAULT 'proactive'`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN quiet_start TEXT DEFAULT '22:00'`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN quiet_end TEXT DEFAULT '07:00'`); } catch { /* column already exists */ }

// Performance indexes for hot-path queries (additive — IF NOT EXISTS is safe)
// reminders: user + scheduled_for for durable-scheduler lookups
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_user_scheduled ON reminders(user_id, scheduled_for)`); } catch { /* already exists */ }
// user_memories: user + created_at DESC for memory feed (idx_user_memories_user covers last_used; this covers created_at)
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id, created_at DESC)`); } catch { /* already exists */ }

// GAP-7: Per-step progress tracking for workflow live output
try { db.exec(`ALTER TABLE user_workflow_runs ADD COLUMN steps_json TEXT DEFAULT '[]'`); } catch { /* column already exists */ }

// ── Phase 2a-2d: Autonomous Agent Architecture ─────────────────────────────

// 1. Per-agent memory namespace (add column to existing tables)
try { db.exec(`ALTER TABLE agent_memory ADD COLUMN agent_namespace TEXT DEFAULT 'shared'`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE user_memories ADD COLUMN agent_namespace TEXT DEFAULT 'shared'`); } catch { /* column already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_memory_namespace ON agent_memory(user_id, agent_namespace)`); } catch { /* index already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_user_memories_namespace ON user_memories(user_id, agent_namespace)`); } catch { /* index already exists */ }

// 2. Per-agent config (add agent_id to agent_configs for multi-agent rows)
try { db.exec(`ALTER TABLE agent_configs ADD COLUMN agent_id TEXT DEFAULT 'default'`); } catch { /* column already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_configs_agent ON agent_configs(user_id, agent_id)`); } catch { /* index already exists */ }

// 3. Agent task queue
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id, agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status, priority DESC);
  `);
} catch { /* table/indexes already exist */ }

// 4. Inter-agent communication
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_comms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      message TEXT NOT NULL,
      message_type TEXT DEFAULT 'info',
      related_task_id TEXT,
      acknowledged INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_comms_user ON agent_comms(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_comms_to ON agent_comms(user_id, to_agent, acknowledged);
  `);
} catch { /* table/indexes already exist */ }

// 5. Smart recommendations cache
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS smart_recommendations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feature TEXT NOT NULL,
      reason TEXT NOT NULL,
      cta TEXT NOT NULL,
      score REAL DEFAULT 0.5,
      dismissed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      UNIQUE(user_id, feature)
    );
    CREATE INDEX IF NOT EXISTS idx_smart_recs_user ON smart_recommendations(user_id, dismissed, score DESC);
  `);
} catch { /* table/indexes already exist */ }

// Delegation tracking — per-user daily delegation counts for tier enforcement
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS delegation_counts (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_delegation_counts_date ON delegation_counts(user_id, date);
  `);
} catch { /* table already exists */ }

// ============================================================
// Agentic Experience — Goal System & Planning Engine
// ============================================================

// Goals — user-defined objectives that agents pursue autonomously
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      priority INTEGER DEFAULT 5,
      category TEXT DEFAULT 'general',
      assigned_agent TEXT DEFAULT 'cal',
      target_date TEXT,
      progress INTEGER DEFAULT 0,
      outcome TEXT,
      parent_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_goals_agent ON goals(user_id, assigned_agent);
    CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
  `);
} catch { /* table already exists */ }

// Goal steps — decomposed actionable steps within a goal
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_steps (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_goal_steps_goal ON goal_steps(goal_id, step_order);
    CREATE INDEX IF NOT EXISTS idx_goal_steps_status ON goal_steps(user_id, status);
  `);
} catch { /* table already exists */ }

// Goal events — audit log of everything that happens on a goal
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_events (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      agent_id TEXT,
      step_id TEXT REFERENCES goal_steps(id) ON DELETE SET NULL,
      message TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_goal_events_goal ON goal_events(goal_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_goal_events_user ON goal_events(user_id, created_at DESC);
  `);
} catch { /* table already exists */ }

// Workspace artifacts — shared scratchpad for inter-agent collaboration
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_artifacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      artifact_type TEXT DEFAULT 'note',
      created_by_agent TEXT,
      tags TEXT DEFAULT '[]',
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_user ON workspace_artifacts(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workspace_goal ON workspace_artifacts(goal_id);
  `);
} catch { /* table already exists */ }

// Agent delegation log — detailed tracking of agent-to-agent handoffs
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS delegation_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
      step_id TEXT REFERENCES goal_steps(id) ON DELETE SET NULL,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      task_description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      result TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_delegation_log_user ON delegation_log(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_delegation_log_status ON delegation_log(user_id, status);
  `);
} catch { /* table already exists */ }

// Phase: Multi-agent transparent delegation — track which personality generated each message
try { db.exec(`ALTER TABLE conversation_log ADD COLUMN agent_id TEXT DEFAULT NULL`); } catch { /* column already exists */ }

// ── Phase: Conversation Threading ────────────────────────────
try { db.exec(`ALTER TABLE conversation_log ADD COLUMN conversation_id TEXT DEFAULT NULL`); } catch { /* column already exists */ }
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_conversation_log_thread ON conversation_log(user_id, conversation_id, created_at)`); } catch { /* already exists */ }

// Conversations table — tracks chat sessions/threads
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'New conversation',
      last_message_preview TEXT DEFAULT '',
      message_count INTEGER DEFAULT 0,
      channel TEXT DEFAULT 'web',
      agent_id TEXT DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations(user_id, is_active, updated_at DESC);
  `);
} catch { /* table already exists */ }

// Pending confirmations — human-in-the-loop for dangerous tool actions
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_confirmations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_pending_confirm_user ON pending_confirmations(user_id, status);
  `);
} catch { /* table already exists */ }

// Message feedback — thumbs up/down on agent responses
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL,
      rating TEXT NOT NULL,
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_message_feedback_user ON message_feedback(user_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_feedback_unique ON message_feedback(user_id, message_id);
  `);
} catch { /* table already exists */ }

// ── Phase: Meta-learning — nightly reflections + learned patterns ──────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_reflections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_meta_reflections_user ON meta_reflections(user_id, reflection_date);
  `);
} catch { /* exists */ }

// ── Phase: Inferred goals — patterns the agent detects but user hasn't explicitly stated ────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inferred_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      reasoning TEXT NOT NULL DEFAULT '',
      confidence REAL DEFAULT 0.5,
      evidence TEXT DEFAULT '[]',
      status TEXT DEFAULT 'suggested',
      suggested_at TEXT DEFAULT (datetime('now')),
      user_response TEXT DEFAULT NULL,
      converted_goal_id TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inferred_goals_user ON inferred_goals(user_id, status);
  `);
} catch { /* exists */ }

// Retroactive conversation threading — group old messages by 30-min time gaps
try {
  const hasConversations = (db.prepare('SELECT COUNT(*) as cnt FROM conversations').get() as { cnt: number }).cnt;
  if (hasConversations === 0) {
    const rows = db.prepare(`
      SELECT id, user_id, created_at FROM conversation_log
      ORDER BY user_id, created_at ASC
    `).all() as Array<{ id: string; user_id: string; created_at: string }>;

    if (rows.length > 0) {
      const { v4: uuid } = await import('uuid');
      let currentUserId = '';
      let currentConvId = '';
      let lastTime = 0;
      const GAP_MS = 30 * 60 * 1000; // 30 minutes

      const updateStmt = db.prepare('UPDATE conversation_log SET conversation_id = ? WHERE id = ?');
      const insertConv = db.prepare('INSERT INTO conversations (id, user_id, title, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');

      const txn = db.transaction(() => {
        for (const row of rows) {
          const msgTime = new Date(row.created_at).getTime();
          if (row.user_id !== currentUserId || (msgTime - lastTime) > GAP_MS) {
            currentUserId = row.user_id;
            currentConvId = uuid();
            insertConv.run(currentConvId, row.user_id, 'Imported conversation', 'web', row.created_at, row.created_at);
          }
          updateStmt.run(currentConvId, row.id);
          lastTime = msgTime;
        }
      });
      txn();
      logger.info({ conversations: hasConversations, messages: rows.length }, 'Retroactive conversation threading complete');
    }
  }
} catch (err) {
  logger.debug({ err }, 'Retroactive conversation threading skipped (non-fatal)');
}

// ── Phase: Autonomy gradient — learned trust per tool per context ───────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_trust (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tool TEXT NOT NULL,
      context_hash TEXT NOT NULL,
      trust_score REAL DEFAULT 0.5,
      approval_count INTEGER DEFAULT 0,
      edit_count INTEGER DEFAULT 0,
      reject_count INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, tool, context_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_tool_trust_user ON tool_trust(user_id, tool);
  `);
} catch { /* exists */ }

// ── Phase: Tool composition learning — remember successful tool chains ───────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_chains (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pattern TEXT NOT NULL,
      pattern_hash TEXT NOT NULL,
      tool_sequence TEXT NOT NULL DEFAULT '[]',
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_used TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tool_chains_user ON tool_chains(user_id, last_used DESC);
    CREATE INDEX IF NOT EXISTS idx_tool_chains_hash ON tool_chains(user_id, pattern_hash);
  `);
} catch { /* exists */ }
