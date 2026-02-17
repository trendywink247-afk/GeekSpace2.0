import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db, seedDemoData } from '../db/index.js';
import { validateBody, signupSchema, loginSchema, onboardingSchema } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post('/signup', validateBody(signupSchema), async (req, res) => {
  const { email, password, username, name } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    res.status(409).json({ error: 'Email or username taken' });
    return;
  }

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, name, plan, credits)
    VALUES (?, ?, ?, ?, ?, 'free', 15000)
  `).run(id, email, username, passwordHash, name || username);

  // Create default agent config
  db.prepare(`
    INSERT INTO agent_configs (id, user_id, name, display_name, mode, voice, system_prompt)
    VALUES (?, ?, 'Geek', ?, 'builder', 'friendly', 'You are a helpful personal AI assistant.')
  `).run(uuid(), id, `${name || username}'s AI`);

  // Create default features
  db.prepare(`
    INSERT INTO features (user_id) VALUES (?)
  `).run(id);

  // Create default subscription (free plan)
  db.prepare(`
    INSERT INTO subscriptions (id, user_id) VALUES (?, ?)
  `).run(uuid(), id);

  // Create default portfolio
  db.prepare(`
    INSERT INTO portfolios (user_id, username) VALUES (?, ?)
  `).run(id, username);

  // Create default Pico agent (slot 1)
  db.prepare('INSERT INTO pico_agents (id, user_id, slot, name) VALUES (?, ?, 1, ?)').run(uuid(), id, 'Pico-1');

  // Create default integrations
  const insInt = db.prepare('INSERT INTO integrations (id, user_id, type, name, description, status, health, requests_today, last_sync, features, permissions) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)');
  const defaultIntegrations: [string, string, string, string][] = [
    ['telegram', 'Telegram', 'Send messages, reminders, and receive notifications via Telegram bot', '["Send messages","Receive reminders","Bot commands"]'],
    ['google-calendar', 'Google Calendar', 'Sync events, schedule reminders, and check availability', '["Event sync","Reminders","Availability check"]'],
    ['location', 'Location Services', 'Share location for contextual reminders', '["Location queries","Geofenced reminders"]'],
    ['github', 'GitHub', 'Sync repositories, track issues, and showcase projects', '["Repo sync","Issue tracking","Portfolio showcase"]'],
    ['twitter', 'Twitter/X', 'Share updates and connect your social presence', '["Auto-share","Social sync","Profile link"]'],
    ['linkedin', 'LinkedIn', 'Professional profile sync and networking', '["Profile sync","Network updates"]'],
    ['n8n', 'n8n', 'Workflow automation engine for advanced integrations', '["Custom workflows","Triggers","Webhooks"]'],
    ['whatsapp', 'WhatsApp', 'Chat with your AI agent via WhatsApp', '["Messages","Voice notes","Media"]'],
  ];
  for (const [type, name2, desc, feats] of defaultIntegrations) {
    insInt.run(uuid(), id, type, name2, desc, 'disconnected', '', feats, '[]');
  }

  // Log activity
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Signed up', 'Welcome to GeekSpace!', 'user-plus')`).run(uuid(), id);

  const token = signToken(id);

  res.json({
    user: {
      id, email, username, name: name || username,
      bio: '', tags: [],
      theme: { mode: 'dark', accentColor: '#7B61FF' },
      plan: 'free',
      createdAt: new Date().toISOString(),
    },
    token,
  });
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id as string);

  // Log activity
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Logged in', 'Session started', 'log-in')`).run(uuid(), user.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      website: user.website,
      role: user.role,
      company: user.company,
      tags: JSON.parse(user.tags as string || '[]'),
      theme: { mode: user.theme_mode, accentColor: user.theme_accent },
      plan: user.plan,
      credits: user.credits,
      createdAt: user.created_at,
    },
    token,
  });
});

authRouter.post('/demo', (req, res) => {
  // Ensure demo data exists regardless of SEED_DEMO_DATA env
  seedDemoData();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('demo-1') as Record<string, unknown> | undefined;
  if (!user) {
    res.status(500).json({ error: 'Failed to create demo account' });
    return;
  }

  const token = signToken(user.id as string);

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Demo login', 'Demo session started', 'log-in')`).run(uuid(), user.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      website: user.website,
      role: user.role,
      company: user.company,
      tags: JSON.parse(user.tags as string || '[]'),
      theme: { mode: user.theme_mode, accentColor: user.theme_accent },
      plan: user.plan,
      credits: user.credits,
      createdAt: user.created_at,
    },
    token,
  });
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    location: user.location,
    website: user.website,
    role: user.role,
    company: user.company,
    tags: JSON.parse(user.tags as string || '[]'),
    theme: { mode: user.theme_mode, accentColor: user.theme_accent },
    plan: user.plan,
    credits: user.credits,
    onboardingCompleted: !!user.onboarding_completed,
    createdAt: user.created_at,
  });
});

authRouter.post('/onboarding', requireAuth, validateBody(onboardingSchema), (req: AuthRequest, res) => {
  const { profile, agentMode, integrations: integrationsToConnect } = req.body;

  // Update user profile from onboarding
  if (profile) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (profile.name) { fields.push('name = ?'); values.push(profile.name); }
    if (profile.username) { fields.push('username = ?'); values.push(profile.username); }
    if (profile.bio) { fields.push('bio = ?'); values.push(profile.bio); }
    if (profile.avatar) { fields.push('avatar = ?'); values.push(profile.avatar); }
    if (fields.length) {
      values.push(req.userId);
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  // Update agent mode
  if (agentMode) {
    db.prepare('UPDATE agent_configs SET mode = ? WHERE user_id = ?').run(agentMode, req.userId);
  }

  // Mark onboarding complete
  db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(req.userId);

  // Log activity
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Completed onboarding', 'Profile set up', 'check-circle')`).run(uuid(), req.userId);

  res.json({ success: true });
});
