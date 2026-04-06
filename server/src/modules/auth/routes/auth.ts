import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwtPkg from 'jsonwebtoken';
import { signToken, requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { db, seedDemoData } from '../../../db/index.js';
import { config } from '../../../config.js';
import { validateBody, signupSchema, loginSchema, onboardingSchema } from '../../../middleware/validate.js';
import { cacheGet, cacheSet, cacheDel } from '../../../services/cache.js';
import { logSecurityEvent } from '../../../services/security-log.js';
import { encrypt } from '../../../utils/encryption.js';
import { requestPasswordReset, verifyResetOTP, resetPassword } from '../services/password-reset.js';
import { logger } from '../../../logger.js';
import { isLoginBlocked, recordFailedLogin, clearLoginAttempts } from '../services/login-guard.js';
import { issueRefreshToken, rotateRefreshToken } from '../services/refresh-token.js';

export const authRouter = Router();

function safeJsonArray(val: unknown): unknown[] {
  try { return JSON.parse(val as string || '[]') as unknown[]; } catch { return []; }
}

/** Parse user-agent into a human-readable device description */
function parseDevice(ua: string): string {
  if (!ua) return 'Unknown device';
  // Mobile detection
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'Android Phone';
  if (/Android/i.test(ua)) return 'Android Tablet';
  // Desktop browsers
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'Chrome Desktop';
  if (/Firefox/i.test(ua)) return 'Firefox Desktop';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari Desktop';
  if (/Edg/i.test(ua)) return 'Edge Desktop';
  return 'Unknown device';
}

/** Mask an IP address for privacy (last octet hidden for IPv4, last 80 bits for IPv6) */
function maskIp(ip: string): string {
  if (!ip) return '*.*.*.***';
  if (ip.includes('.')) {
    // IPv4: show first 3 octets
    const parts = ip.split('.');
    if (parts.length >= 4) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    return ip;
  }
  // IPv6: show first 4 groups
  const parts = ip.split(':');
  if (parts.length > 4) return parts.slice(0, 4).join(':') + ':***';
  return ip;
}

authRouter.post('/signup', validateBody(signupSchema), async (req, res) => {
  const { email, password, username, name, invite_code } = req.body as {
    email: string; password: string; username: string; name?: string; invite_code?: string;
  };

  // 83.5: Invite-gated registration — check if INVITE_REQUIRED=true
  if (config.inviteRequired) {
    if (!invite_code || typeof invite_code !== 'string') {
      res.status(403).json({ error: 'An invite code is required to register. Request access at ai.agentin.chat.' });
      return;
    }
    const invite = db.prepare('SELECT id, used_at FROM invite_codes WHERE code = ?').get(invite_code.trim().toUpperCase()) as
      { id: string; used_at: string | null } | undefined;
    if (!invite) {
      res.status(403).json({ error: 'Invalid invite code. Check your invite link or request one from the team.' });
      return;
    }
    if (invite.used_at) {
      res.status(409).json({ error: 'This invite code has already been used.' });
      return;
    }
  }

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
      logger.warn({ err: e }, 'pico_agents insert skipped during signup');
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
    logger.info({ event: 'auth_signup', userId: id, username, ip: req.ip }, 'New user signup');
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

  // 83.5: Mark invite code as used (non-fatal — user is already created)
  if (config.inviteRequired && invite_code) {
    try {
      db.prepare('UPDATE invite_codes SET used_at = datetime(\'now\'), used_by = ? WHERE code = ?')
        .run(id, invite_code.trim().toUpperCase());
    } catch (err) {
      logger.warn({ err, invite_code }, 'Failed to mark invite code as used');
    }
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

  // 92.2: Brute-force protection — per-IP rate limit (5 attempts / 15min)
  const ip = req.ip || '0.0.0.0';
  const blockStatus = isLoginBlocked(ip);
  if (blockStatus.blocked) {
    logSecurityEvent('login_blocked', ip, { email });
    const retryAfterSec = Math.ceil(blockStatus.retryAfterMs / 1000);
    const minutes = Math.floor(retryAfterSec / 60);
    const seconds = retryAfterSec % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    res.status(429)
      .set('Retry-After', String(retryAfterSec))
      .json({ error: `Too many attempts. Try again in ${timeStr}.` });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
    recordFailedLogin(ip);
    logSecurityEvent('login_failure', req.ip || '', { email });
    logger.warn({ event: 'auth_login_failed', email, ip: req.ip, reason: 'invalid_credentials' }, 'Login failed');
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id as string);
  const { refreshToken } = issueRefreshToken(user.id as string);
  clearLoginAttempts(ip); // 92.2: clear on success

  // Log activity
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Logged in', 'Session started', 'log-in')`).run(uuid(), user.id);
  logSecurityEvent('login_success', req.ip || '', { email: user.email as string, userId: user.id as string });
  logger.info({ event: 'auth_login_success', userId: user.id as string, ip: req.ip }, 'Login success');

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
      tags: safeJsonArray(user.tags),
      theme: { mode: user.theme_mode, accentColor: user.theme_accent },
      plan: user.plan,
      credits: user.credits,
      onboardingCompleted: !!user.onboarding_completed,
      onboardingStep: (user.onboarding_step as number) ?? 0,
      createdAt: user.created_at,
    },
    token,
    refreshToken,
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
      tags: safeJsonArray(user.tags),
      theme: { mode: user.theme_mode, accentColor: user.theme_accent },
      plan: user.plan,
      credits: user.credits,
      createdAt: user.created_at,
    },
    token,
  });
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  // 54.5: Redis cache per-user (30s TTL)
  const cacheKey = `users:me:${req.userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT').json(JSON.parse(cached));
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const payload = {
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
  };
  await cacheSet(cacheKey, JSON.stringify(payload), 30);
  res.set('X-Cache', 'MISS').json(payload);
});

authRouter.post('/onboarding', requireAuth, validateBody(onboardingSchema), (req: AuthRequest, res) => {
  const { profile, agentMode } = req.body;

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
      const { personality, agentMode, apiKey } = data as { personality?: string; agentMode?: string; apiKey?: string };
      if (personality) db.prepare('UPDATE agent_configs SET personality = ? WHERE user_id = ?').run(personality, req.userId);
      if (agentMode) db.prepare('UPDATE agent_configs SET mode = ? WHERE user_id = ?').run(agentMode, req.userId);
      if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
        const key = apiKey.trim();
        const maskedKey = key.slice(0, 3) + '...' + key.slice(-4);
        const encryptedKey = encrypt(key);
        const existingKey = db.prepare('SELECT id FROM api_keys WHERE user_id = ? AND provider = ?').get(req.userId, 'openrouter');
        if (!existingKey) {
          db.prepare('INSERT INTO api_keys (id, user_id, provider, label, key_encrypted, masked_key, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            uuid(), req.userId, 'openrouter', 'OpenRouter (onboarding)', encryptedKey, maskedKey, 1
          );
        }
      }
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

  // Phase 69.7: Constant-time response to prevent user enumeration via timing attacks.
  // We always wait at least 200ms before responding, regardless of whether the email exists.
  const minDelayMs = 200;
  const startTime = Date.now();

  try {
    await requestPasswordReset(
      email,
      channel || 'auto',
      req.ip || '0.0.0.0'
    );
  } catch { /* intentionally swallowed — caller should never learn if email exists */ }

  const elapsed = Date.now() - startTime;
  if (elapsed < minDelayMs) {
    await new Promise(resolve => setTimeout(resolve, minDelayMs - elapsed));
  }

  res.json({ success: true, message: "If that email is registered, you'll receive a reset link.", channel: 'email' });
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

// ── Token Refresh — single-use rotation ─────────────────────────────────────
// Accepts a refresh token, verifies it, revokes it, and issues a new pair
// (access token + refresh token). Reuse detection: if a revoked refresh token
// is presented, the entire token family is revoked (potential theft).
authRouter.post('/refresh', (req, res) => {
  const { refreshToken: incomingRefreshToken } = req.body as { refreshToken?: string };

  if (!incomingRefreshToken || typeof incomingRefreshToken !== 'string') {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  const rotationResult = rotateRefreshToken(incomingRefreshToken);

  if (!rotationResult) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const newAccessToken = signToken(rotationResult.userId);
  logger.info({ event: 'auth_token_refresh', userId: rotationResult.userId, ip: req.ip }, 'Token rotated');

  res.json({
    token: newAccessToken,
    refreshToken: rotationResult.refreshToken,
  });
});

// ── Session Management ──────────────────────────────────────
// NOTE: JWT is stateless — revoking a session only marks the DB record inactive.
// Existing tokens remain valid until they expire. A token blacklist would be
// required for immediate invalidation but is out of scope here.

authRouter.get('/sessions', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rawSessions = db.prepare(`
    SELECT id, created_at, last_seen, user_agent, ip, is_active
    FROM user_sessions
    WHERE user_id = ? AND is_active = 1
    ORDER BY last_seen DESC
    LIMIT 20
  `).all(userId) as Array<{
    id: string; created_at: string; last_seen: string;
    user_agent: string; ip: string; is_active: number;
  }>;

  const sessions = rawSessions.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    last_seen: s.last_seen,
    user_agent: s.user_agent,
    device: parseDevice(s.user_agent),
    ip_masked: maskIp(s.ip),
    is_active: s.is_active,
  }));

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


// ── Logout (92.6: JWT blocklist) ──────────────────────────────────────────
authRouter.post('/logout', requireAuth, (req: AuthRequest, res) => {
  const header = req.headers.authorization || '';
  const rawToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (rawToken) {
    try {
      const decoded = jwtPkg.decode(rawToken) as { jti?: string; exp?: number } | null;
      if (decoded?.jti && decoded?.exp) {
        db.prepare('INSERT OR IGNORE INTO token_blocklist (jti, user_id, expires_at) VALUES (?, ?, ?)')
          .run(decoded.jti, req.userId!, decoded.exp);
      }
    } catch { /* ignore --- non-fatal */ }
  }
  logSecurityEvent('logout', req.ip || '', { userId: req.userId });
  logger.info({ event: 'auth_logout', userId: req.userId, ip: req.ip }, 'User logged out');
  res.json({ success: true });
});

// ── 82.8: Account Deletion ────────────────────────────────────────────────────
// Permanently deletes all user data in a single transaction.
// Requires password confirmation for security.

authRouter.post('/delete-account', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(400).json({ error: 'Password confirmation is required' });
    return;
  }

  // Verify password before destroying anything
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE id = ?').get(userId) as {
    id: string; email: string; password_hash: string;
  } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(403).json({ error: 'Incorrect password' });
    return;
  }

  // Delete all user data in a single transaction.
  // Tables with ON DELETE CASCADE are handled automatically when the users row is deleted,
  // but we delete explicitly for clarity and to handle tables without CASCADE.
  const deleteAll = db.transaction(() => {
    // Explicit deletes for tables that may not have CASCADE
    const tables = [
      'conversation_log', 'agent_memory', 'reminders', 'automations', 'automation_logs',
      'integrations', 'usage_events', 'activity_log', 'api_keys', 'agent_configs',
      'agent_messages', 'premium_sessions', 'subscriptions', 'briefings', 'installed_recipes',
      'generated_artifacts', 'user_images', 'user_videos', 'video_jobs',
      'reports', 'moderation_log', 'blocked_users', 'suggestion_votes', 'suggestions',
      'portfolios', 'portfolio_visits', 'security_events', 'user_sessions', 'channel_links',
      'link_codes', 'password_reset_tokens', 'password_reset_rate_limits', 'password_reset_audit',
      'refresh_tokens', 'token_blocklist',
    ];

    for (const table of tables) {
      try {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      } catch {
        // Table may not exist or may not have user_id column — skip silently
      }
    }

    // Delete the user row last (cascades any remaining FK relations)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  deleteAll();

  logger.info({ userId, email: user.email }, 'Account deleted by user request');

  res.json({
    success: true,
    message: 'Your account and all associated data have been permanently deleted.',
  });
});
