// ============================================================
// Gmail Routes -- Phase 100
// Handles OAuth connect/callback, sync, status, reply.
// ============================================================

import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { syncUserGmail, sendGmailReply, type GmailMessageRow, type GmailTokenData } from '../services/gmail-sync.js';

export const gmailRouter = Router();

// ---- Status ----
gmailRouter.get('/status', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;

  if (!config.googleClientId || !config.googleClientSecret) {
    res.json({ available: false, connected: false });
    return;
  }

  const userRow = db.prepare('SELECT google_gmail_token FROM users WHERE id = ?')
    .get(userId) as { google_gmail_token: string | null } | undefined;

  if (!userRow?.google_gmail_token) {
    res.json({ available: true, connected: false });
    return;
  }

  let tokenData: GmailTokenData;
  try {
    tokenData = JSON.parse(userRow.google_gmail_token);
  } catch {
    res.json({ available: true, connected: false });
    return;
  }

  const lastMsg = db.prepare(
    'SELECT synced_at FROM gmail_messages WHERE user_id = ? ORDER BY synced_at DESC LIMIT 1'
  ).get(userId) as { synced_at: number } | undefined;

  const unreadCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM inbox_messages WHERE user_id = ? AND source = 'gmail' AND read = 0 AND archived = 0"
  ).get(userId) as { cnt: number };

  res.json({
    available: true,
    connected: true,
    email: tokenData.email || null,
    lastSync: lastMsg ? new Date(lastMsg.synced_at).toISOString() : null,
    unread: unreadCount.cnt,
  });
});

// ---- Auth redirect ----
gmailRouter.get('/auth', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;

  if (!config.googleClientId || !config.googleClientSecret) {
    res.status(503).json({ error: 'Gmail OAuth not configured' });
    return;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      `${config.apiUrl}/api/gmail/callback`,
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: userId,
    });

    res.redirect(url);
  } catch (err) {
    logger.error({ err }, 'Gmail auth redirect failed');
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// ---- OAuth callback ----
gmailRouter.get('/callback', async (req, res) => {
  const { code, state: userId, error } = req.query as Record<string, string>;

  if (error || !code || !userId) {
    logger.warn({ error, code: !!code, userId }, 'Gmail callback: missing params or error');
    res.redirect(`${config.publicUrl}/dashboard?tab=gmail&error=auth_failed`);
    return;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      `${config.apiUrl}/api/gmail/callback`,
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2Api.userinfo.get();
    const email = userInfo.data.email || '';

    const tokenData: GmailTokenData = {
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      expiry_date: tokens.expiry_date || 0,
      email,
    };

    db.prepare('UPDATE users SET google_gmail_token = ? WHERE id = ?')
      .run(JSON.stringify(tokenData), userId);

    logger.info({ userId, email }, 'Gmail OAuth connected');
    res.redirect(`${config.publicUrl}/dashboard?tab=gmail&connected=true`);
  } catch (err) {
    logger.error({ err, userId }, 'Gmail callback failed');
    res.redirect(`${config.publicUrl}/dashboard?tab=gmail&error=callback_failed`);
  }
});

// ---- Manual sync ----
gmailRouter.post('/sync', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId!;

  try {
    const imported = await syncUserGmail(userId);
    res.json({ success: true, imported });
  } catch (err) {
    logger.error({ err, userId }, 'Gmail manual sync failed');
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ---- List imported messages ----
gmailRouter.get('/messages', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const messages = db.prepare(`
    SELECT gm.*, im.priority, im.read, im.archived, im.suggested_reply, im.summary
    FROM gmail_messages gm
    LEFT JOIN inbox_messages im ON gm.inbox_id = im.id
    WHERE gm.user_id = ?
    ORDER BY gm.synced_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset) as (GmailMessageRow & {
    priority: string | null;
    read: number | null;
    archived: number | null;
    suggested_reply: string | null;
    summary: string | null;
  })[];

  res.json({ messages });
});

// ---- Reply to a message ----
gmailRouter.post('/reply/:id', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const gmailRowId = Number(req.params.id);
  const { body } = req.body as { body?: string };

  if (!body?.trim()) {
    res.status(400).json({ error: 'Reply body required' });
    return;
  }

  // Look up by gmail_messages.id AND user_id (auth isolation)
  const gmailMsg = db.prepare(
    'SELECT gmail_message_id, thread_id, inbox_id FROM gmail_messages WHERE id = ? AND user_id = ?'
  ).get(gmailRowId, userId) as { gmail_message_id: string; thread_id: string; inbox_id: number | null } | undefined;

  if (!gmailMsg) {
    res.status(404).json({ error: 'Gmail message not found' });
    return;
  }

  try {
    const sent = await sendGmailReply(userId, gmailMsg.gmail_message_id, gmailMsg.thread_id, body);

    if (sent) {
      if (gmailMsg.inbox_id) {
        db.prepare('UPDATE inbox_messages SET read = 1, archived = 1 WHERE id = ? AND user_id = ?')
          .run(gmailMsg.inbox_id, userId);
      }
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to send reply' });
    }
  } catch (err) {
    logger.error({ err, userId, gmailRowId }, 'Gmail reply failed');
    res.status(500).json({ error: 'Reply failed' });
  }
});

// ---- Disconnect ----
gmailRouter.post('/disconnect', requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;

  // Revoke token (fire-and-forget, non-fatal)
  const userRow = db.prepare('SELECT google_gmail_token FROM users WHERE id = ?')
    .get(userId) as { google_gmail_token: string | null } | undefined;

  if (userRow?.google_gmail_token) {
    try {
      const tokenData: GmailTokenData = JSON.parse(userRow.google_gmail_token);
      if (!config.isTestMode && config.googleClientId) {
        const oauth2Client = new google.auth.OAuth2(config.googleClientId, config.googleClientSecret);
        oauth2Client.setCredentials({ access_token: tokenData.access_token });
        oauth2Client.revokeCredentials().catch((err: unknown) => logger.warn({ err }, 'Gmail revoke failed'));
      }
    } catch { /* non-fatal */ }
  }

  // Clear token + imported messages
  db.prepare('UPDATE users SET google_gmail_token = NULL WHERE id = ?').run(userId);
  db.prepare('DELETE FROM gmail_messages WHERE user_id = ?').run(userId);

  logger.info({ userId }, 'Gmail disconnected');
  res.json({ success: true });
});
