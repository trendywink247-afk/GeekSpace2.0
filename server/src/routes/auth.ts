import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db, seedDemoData } from '../db/index.js';
import { config } from '../config.js';
import { validateBody, signupSchema, loginSchema, onboardingSchema } from '../middleware/validate.js';
import { cacheDel } from '../services/cache.js';
import { logSecurityEvent } from '../services/security-log.js';
import { requestPasswordReset, verifyResetOTP, resetPassword } from '../services/passwordReset.js';

export const authRouter = Router();

authRouter.post('/signup', validateBody(signupSchema), async (req, res) => {
  const { email, password, username, name } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    res.status(409).json({ error: 'Email or username already taken' });
    return;
  }

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 12);

  const doSignup = db.transaction(() => {
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

    // Create default Pico agent (slot 1) — non-fatal if it fails
    try {
      db.prepare('INSERT INTO pico_agents (id, user_id, slot, name) VALUES (?, ?, 1, ?)').run(uuid(), id, 'Weebo');
    } catch (e) {
      console.warn('[signup] pico_agents insert skipped:', (e as Error).message);
    }

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
    logSecurityEvent('signup', req.ip || '', { email, username });
  });

  try {
    doSignup();
  } catch (err: unknown) {
    if ((err as Error).message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Email or username already taken' });
      return;
    }
    throw err;
  }

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
    logSecurityEvent('login_failure', req.ip || '', { email });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id as string);

  // Log activity
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Logged in', 'Session started', 'log-in')`).run(uuid(), user.id);
  logSecurityEvent('login_success', req.ip || '', { email: user.email as string, userId: user.id as string });

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
      onboardingCompleted: !!user.onboarding_completed,
      onboardingStep: (user.onboarding_step as number) ?? 0,
      createdAt: user.created_at,
    },
    token,
  });
});

authRouter.post('/demo', (req, res) => {
  // Seed demo data only in non-production or test mode (seedDemoData has its own real-user guard)
  if (!config.isProduction || config.isTestMode) {
    seedDemoData();
  }

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
    onboardingStep: (user.onboarding_step as number) ?? 0,
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

// Per-step onboarding save
authRouter.patch('/onboarding/:step', requireAuth, async (req: AuthRequest, res) => {
  const step = parseInt(req.params.step, 10);
  if (isNaN(step) || step < 1 || step > 6) {
    res.status(400).json({ error: 'Invalid step (1-6)' });
    return;
  }

  const data = req.body;

  switch (step) {
    case 1: { // Profile
      const { name, username } = data;
      if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId);
      if (username) {
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.userId);
        if (existing) { res.status(409).json({ error: 'Username taken' }); return; }
        // Capture old username before update so we can bust the old cache key
        const oldUserRow = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId!) as { username: string } | undefined;
        const oldUsername = oldUserRow?.username;
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.userId);
        db.prepare('UPDATE portfolios SET username = ? WHERE user_id = ?').run(username, req.userId);
        // Invalidate old portfolio cache
        if (oldUsername && oldUsername !== username) {
          await cacheDel(`portfolio:${oldUsername}`);
        }
      }
      break;
    }
    case 2: { // Bio, Headline & Tags
      const { bio, headline, tags } = data;
      if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.userId);
      if (headline !== undefined) db.prepare('UPDATE portfolios SET headline = ? WHERE user_id = ?').run(headline, req.userId);
      if (tags !== undefined) db.prepare('UPDATE users SET tags = ? WHERE id = ?').run(JSON.stringify(tags), req.userId);
      break;
    }
    case 3: { // Agent Preferences
      const { personality, agentMode } = data;
      if (personality) db.prepare('UPDATE agent_configs SET personality = ? WHERE user_id = ?').run(personality, req.userId);
      if (agentMode) db.prepare('UPDATE agent_configs SET mode = ? WHERE user_id = ?').run(agentMode, req.userId);
      break;
    }
    case 4: { // Portfolio Setup
      const { skills, headline: portfolioHeadline, about } = data;
      if (skills) db.prepare('UPDATE portfolios SET skills = ? WHERE user_id = ?').run(JSON.stringify(skills), req.userId);
      if (portfolioHeadline) db.prepare('UPDATE portfolios SET headline = ? WHERE user_id = ?').run(portfolioHeadline, req.userId);
      if (about) db.prepare('UPDATE portfolios SET about = ? WHERE user_id = ?').run(about, req.userId);
      break;
    }
    case 5: // Integrations — connected via separate API
    case 6: // Review — no data
      break;
  }

  db.prepare('UPDATE users SET onboarding_step = ? WHERE id = ?').run(step, req.userId);
  res.json({ success: true, step });
});

// Complete onboarding
authRouter.post('/onboarding/complete', requireAuth, (req: AuthRequest, res) => {
  db.prepare('UPDATE users SET onboarding_completed = 1, onboarding_step = 6 WHERE id = ?').run(req.userId);
  const logActivity = db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)');
  logActivity.run(uuid(), req.userId, 'Completed onboarding', 'Profile set up', 'rocket');
  res.json({ success: true });
});

// ── Password Reset ──────────────────────────────────────────

authRouter.post('/forgot-password', async (req, res) => {
  const { email, channel } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const result = await requestPasswordReset(
    email,
    channel || 'auto',
    req.ip || '0.0.0.0'
  );

  res.json(result);
});

authRouter.post('/verify-reset-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400).json({ error: 'Email and OTP are required' });
    return;
  }

  const result = await verifyResetOTP(email, otp, req.ip || '0.0.0.0');

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

authRouter.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    res.status(400).json({ error: 'Reset token and new password are required' });
    return;
  }

  const result = await resetPassword(resetToken, newPassword, req.ip || '0.0.0.0');

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json({ success: true, message: 'Password reset successfully' });
});

// ── Session Management ──────────────────────────────────────
// NOTE: JWT is stateless — revoking a session only marks the DB record inactive.
// Existing tokens remain valid until they expire. A token blacklist would be
// required for immediate invalidation but is out of scope here.

authRouter.get('/sessions', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const sessions = db.prepare(`
    SELECT id, created_at, last_seen, user_agent, ip, is_active
    FROM user_sessions
    WHERE user_id = ? AND is_active = 1
    ORDER BY last_seen DESC
    LIMIT 20
  `).all(userId);
  res.json({ sessions });
});

authRouter.delete('/sessions/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const sessionId = req.params.id;
  db.prepare(`
    UPDATE user_sessions SET is_active = 0 WHERE id = ? AND user_id = ?
  `).run(sessionId, userId);
  res.json({ success: true });
});

authRouter.delete('/sessions', requireAuth, (req: AuthRequest, res) => {
  // Revoke all sessions for this user (used for "sign out everywhere")
  const userId = req.userId!;
  db.prepare(`
    UPDATE user_sessions SET is_active = 0 WHERE user_id = ?
  `).run(userId);
  res.json({ success: true });
});
