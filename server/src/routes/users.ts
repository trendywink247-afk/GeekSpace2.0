import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, userUpdateSchema, notificationEmailSchema, changePasswordSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { cacheDel } from '../services/cache.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  res.json({
    id: user.id, email: user.email, username: user.username, name: user.name,
    avatar: user.avatar, bio: user.bio, location: user.location, website: user.website,
    role: user.role, company: user.company,
    tags: JSON.parse(user.tags as string || '[]'),
    theme: { mode: user.theme_mode, accentColor: user.theme_accent },
    plan: user.plan, credits: user.credits,
    notifications: {
      email: !!user.notification_email, push: !!user.notification_push,
      agentUpdates: !!user.notification_agent, reminders: !!user.notification_reminders,
      weeklyDigest: !!user.notification_weekly,
    },
    privacy: {
      showProfile: !!user.privacy_show_profile, showActivity: !!user.privacy_show_activity,
      allowAgentChat: !!user.privacy_allow_chat, showLocation: !!user.privacy_show_location,
    },
    createdAt: user.created_at,
  });
});

usersRouter.patch('/me', requireAuth, validateBody(userUpdateSchema), async (req: AuthRequest, res) => {
  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  const directFields: Record<string, string> = {
    name: 'name', username: 'username', bio: 'bio', avatar: 'avatar',
    location: 'location', website: 'website', role: 'role', company: 'company',
    theme_background: 'theme_background',
  };
  for (const [key, col] of Object.entries(directFields)) {
    if (updates[key] !== undefined) { fields.push(`${col} = ?`); values.push(updates[key]); }
  }
  if (updates.tags) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
  if (updates.theme) {
    if (updates.theme.mode) { fields.push('theme_mode = ?'); values.push(updates.theme.mode); }
    if (updates.theme.accentColor) { fields.push('theme_accent = ?'); values.push(updates.theme.accentColor); }
  }
  if (updates.notifications) {
    const m: Record<string, string> = { email: 'notification_email', push: 'notification_push', agentUpdates: 'notification_agent', reminders: 'notification_reminders', weeklyDigest: 'notification_weekly' };
    for (const [k, c] of Object.entries(m)) { if (updates.notifications[k] !== undefined) { fields.push(`${c} = ?`); values.push(updates.notifications[k] ? 1 : 0); } }
  }
  if (updates.privacy) {
    const m: Record<string, string> = { showProfile: 'privacy_show_profile', showActivity: 'privacy_show_activity', allowAgentChat: 'privacy_allow_chat', showLocation: 'privacy_show_location' };
    for (const [k, c] of Object.entries(m)) { if (updates.privacy[k] !== undefined) { fields.push(`${c} = ?`); values.push(updates.privacy[k] ? 1 : 0); } }
  }

  let oldUsername: string | undefined;
  if (updates.username) {
    // Validate format: 3-30 chars, letters/numbers/underscores only
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(updates.username)) {
      res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, underscores only' });
      return;
    }
    // Check uniqueness
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(updates.username, req.userId);
    if (taken) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    // Capture old username before update so we can bust the old cache key
    const oldUser = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId!) as { username: string } | undefined;
    oldUsername = oldUser?.username;
  }

  const updateUser = db.transaction(() => {
    if (fields.length) {
      values.push(req.userId);
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    if (updates.username) {
      db.prepare('UPDATE portfolios SET username = ? WHERE user_id = ?')
        .run(updates.username, req.userId);
    }
  });
  try {
    updateUser();
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    throw err;
  }

  if (oldUsername && oldUsername !== updates.username) {
    await cacheDel(`portfolio:${oldUsername}`);
  }

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Updated profile', 'Settings changed', 'user')`).run(uuid(), req.userId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown>;
  res.json({
    id: user.id, email: user.email, username: user.username, name: user.name,
    avatar: user.avatar, bio: user.bio, location: user.location, website: user.website,
    role: user.role, company: user.company,
    tags: JSON.parse(user.tags as string || '[]'),
    theme: { mode: user.theme_mode, accentColor: user.theme_accent },
    plan: user.plan, credits: user.credits, createdAt: user.created_at,
  });
});

usersRouter.patch('/notification-email', requireAuth, validateBody(notificationEmailSchema), (req: AuthRequest, res) => {
  const { enabled, address } = req.body as { enabled?: boolean; address?: string };

  if (enabled !== undefined) {
    db.prepare('UPDATE users SET notification_email = ? WHERE id = ?')
      .run(enabled ? 1 : 0, req.userId);
  }

  if (address !== undefined) {
    const trimmed = typeof address === 'string' ? address.trim() : null;
    db.prepare('UPDATE agent_configs SET notification_email_address = ? WHERE user_id = ?')
      .run(trimmed || null, req.userId);
  }

  const user = db.prepare('SELECT notification_email FROM users WHERE id = ?').get(req.userId!) as { notification_email: number };
  const cfg = db.prepare('SELECT notification_email_address FROM agent_configs WHERE user_id = ?').get(req.userId!) as { notification_email_address: string | null } | undefined;

  res.json({
    enabled: !!user.notification_email,
    address: cfg?.notification_email_address ?? null,
  });
});

usersRouter.get('/:username/public', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username) as Record<string, unknown> | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({
    id: user.id, username: user.username, name: user.name, avatar: user.avatar,
    bio: user.bio, location: user.privacy_show_location ? user.location : '',
    tags: JSON.parse(user.tags as string || '[]'),
    theme: { mode: user.theme_mode, accentColor: user.theme_accent },
    plan: user.plan, createdAt: user.created_at,
  });
});

// ── Model Preference ─────────────────────────────────────────
// Maps UI values (users.preferred_model) → ModelPreference values (agent_configs.model_preference)
const UI_TO_AGENT_MODEL: Record<string, string> = {
  auto: 'auto',
  local: 'local',
  cloud: 'cloud',
  premium: 'premium',
};
const AGENT_TO_UI_MODEL: Record<string, string> = {
  auto: 'auto',
  local: 'local',
  cloud: 'cloud',
  premium: 'premium',
};

usersRouter.put('/me/model', requireAuth, (req: AuthRequest, res) => {
  const allowed = Object.keys(UI_TO_AGENT_MODEL);
  const model: string = req.body.model ?? 'auto';
  if (!allowed.includes(model)) {
    res.status(400).json({ error: `Invalid model. Allowed: ${allowed.join(', ')}` });
    return;
  }
  const agentModel = UI_TO_AGENT_MODEL[model] ?? 'auto';
  try {
    db.prepare('UPDATE users SET preferred_model = ? WHERE id = ?').run(model, req.userId);
  } catch {
    // Column may not exist on older deployments — non-fatal
  }
  try {
    db.prepare('UPDATE agent_configs SET model_preference = ? WHERE user_id = ?').run(agentModel, req.userId);
  } catch {
    // Non-fatal if column not present
  }
  res.json({ preferredModel: model });
});

usersRouter.get('/me/model', requireAuth, (req: AuthRequest, res) => {
  // Read from agent_configs.model_preference (source of truth for routing),
  // but fall back to users.preferred_model for backward compatibility.
  const agentCfg = db.prepare('SELECT model_preference FROM agent_configs WHERE user_id = ?').get(req.userId!) as { model_preference: string | null } | undefined;
  const agentModel = agentCfg?.model_preference ?? 'auto';
  const preferredModel = AGENT_TO_UI_MODEL[agentModel] ?? agentModel;
  res.json({ preferredModel });
});

// ── Change Password (25.3 — JWT rotation on password change) ────────────────
usersRouter.post('/me/change-password', requireAuth, validateBody(changePasswordSchema), async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.userId!) as { id: string; password_hash: string } | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return; }

  const newHash = await bcrypt.hash(newPassword, 12);
  const now = Math.floor(Date.now() / 1000); // Unix seconds — matches JWT iat precision

  db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?').run(newHash, now, req.userId);

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Changed password', 'Password updated, all sessions invalidated', 'shield')`).run(uuid(), req.userId);

  res.json({ success: true, message: 'Password changed. Please log in again.' });
});
