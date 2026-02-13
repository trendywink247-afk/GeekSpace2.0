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
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
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
`);

// ── Seed demo data ──────────────────────────────────────────

function seedDemoData() {
  const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get('demo-1');
  if (existingUser) return;

  const passwordHash = bcrypt.hashSync('demo123', 10);

  // Demo users
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, username, password_hash, name, avatar, bio, location, website, role, company, tags, plan, credits, onboarding_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

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

  // Agent configs
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

  // Integrations for demo-1
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

  // Portfolios
  const insertPortfolio = db.prepare(`
    INSERT INTO portfolios (user_id, username, headline, about, avatar, location, role, company, skills, projects, milestones, social, layout, agent_enabled, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPortfolio.run('demo-1', 'alex', 'Full-stack Developer & AI Enthusiast',
    "Building tools that make life easier. I love coding, automation, and helping others learn. My agent can answer questions about my work, schedule, or just chat!",
    'AC', 'San Francisco, CA', 'Senior Developer', 'TechCorp',
    '["React","TypeScript","Node.js","Python","AI/ML","OpenClaw"]',
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
  db.prepare(`
    INSERT INTO features (user_id, social_discovery, portfolio_chat, automation_builder, website_builder, n8n_integration, manychat_integration)
    VALUES (?, 1, 1, 1, 0, 1, 0)
  `).run('demo-1');

  // Seed some usage events
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

  // Seed activity log
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

  console.log('Demo data seeded successfully');
}

// Only seed demo data when enabled (non-production by default)
const shouldSeed = process.env.NODE_ENV !== 'production' && (process.env.SEED_DEMO_DATA ?? 'true') === 'true';
if (shouldSeed) {
  seedDemoData();
}

export { db };
