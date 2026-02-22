// ============================================================
// GeekSpace Database — SQLite via better-sqlite3
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
db.pragma('cache_size = -32000');      // 32MB page cache (was 8MB default)
db.pragma('temp_store = MEMORY');      // Temp tables in RAM not disk
db.pragma('mmap_size = 134217728');    // 128MB memory-mapped I/O
db.pragma('foreign_keys = ON');

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
  // Guard: never seed if real (non-demo) users already exist in the database
  const realUserCount = (db.prepare(
    "SELECT count(*) as cnt FROM users WHERE id NOT LIKE 'demo-%'"
  ).get() as { cnt: number }).cnt;
  if (realUserCount > 0) {
    logger.info({ realUserCount }, 'seedDemoData: Real users detected, skipping seed to protect production data');
    return;
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
}

// Only seed demo data when explicitly enabled in non-production environments
const shouldSeed = process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA === 'true';
if (shouldSeed) {
  seedDemoData();
}

export { db, seedDemoData };
