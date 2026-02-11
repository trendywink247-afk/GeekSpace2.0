import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

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

usersRouter.patch('/me', requireAuth, (req: AuthRequest, res) => {
  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  const directFields: Record<string, string> = {
    name: 'name', username: 'username', bio: 'bio', avatar: 'avatar',
    location: 'location', website: 'website', role: 'role', company: 'company',
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

  if (fields.length) { values.push(req.userId); db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values); }

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
