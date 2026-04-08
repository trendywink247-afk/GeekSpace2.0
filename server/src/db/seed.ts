/**
 * Demo data seeding — only runs in non-production when SEED_DEMO_DATA=true.
 *
 * Called from index.ts after schema + migrations are applied.
 */

import type Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { logger } from '../logger.js';

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

function seedDefaultIntegrations(db: Database.Database, userId: string) {
  const insInt = db.prepare('INSERT INTO integrations (id, user_id, type, name, description, status, health, requests_today, last_sync, features, permissions) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)');
  for (const [type, name, desc, feats] of DEFAULT_INTEGRATIONS) {
    insInt.run(uuid(), userId, type, name, desc, 'disconnected', '', feats, '[]');
  }
}

export function seedDemoData(db: Database.Database) {
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
    seedDefaultIntegrations(db, 'demo-9');
    seedDefaultIntegrations(db, 'demo-10');
    seedDefaultIntegrations(db, 'demo-11');

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

export function runSeedIfNeeded(db: Database.Database): void {
  const shouldSeed = process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA === 'true';
  if (shouldSeed) {
    seedDemoData(db);
  }
}
