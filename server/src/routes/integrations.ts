import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, permissionsUpdateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { getBotUsername, sendTelegramMessage } from '../services/telegram.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { generateWhatsAppLinkToken, generateWhatsAppQRSession, checkWhatsAppSession } from '../services/whatsapp.js';

export const integrationsRouter = Router();

const parseIntegration = (row: Record<string, unknown>) => ({
  ...row,
  userId: row.user_id,
  requestsToday: row.requests_today ?? 0,
  lastSync: row.last_sync ?? '',
  features: JSON.parse(row.features as string || '[]'),
  permissions: JSON.parse(row.permissions as string || '[]'),
  config: JSON.parse(row.config as string || '{}'),
});

integrationsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = db.prepare('SELECT * FROM integrations WHERE user_id = ?').all(userId) as Record<string, unknown>[];

  // Sync status from channel_links (source of truth for telegram/whatsapp)
  const linked = db.prepare(
    "SELECT channel FROM channel_links WHERE user_id = ? AND channel IN ('telegram', 'whatsapp')"
  ).all(userId) as Array<{ channel: string }>;
  const linkedSet = new Set(linked.map(l => l.channel));

  const result = rows.map(row => {
    const type = row.type as string;
    if (linkedSet.has(type) && row.status !== 'connected') {
      // Real link exists but DB is stale — fix it in place
      db.prepare(
        "UPDATE integrations SET status = 'connected', health = 100 WHERE user_id = ? AND type = ?"
      ).run(userId, type);
      return parseIntegration({ ...row, status: 'connected', health: 100 });
    }
    if (!linkedSet.has(type) && (type === 'telegram' || type === 'whatsapp') && row.status === 'connected') {
      // Was marked connected but channel_link is gone — fix stale connected status
      db.prepare(
        "UPDATE integrations SET status = 'disconnected', health = 0 WHERE user_id = ? AND type = ?"
      ).run(userId, type);
      return parseIntegration({ ...row, status: 'disconnected', health: 0 });
    }
    return parseIntegration(row);
  });

  res.json(result);
});

integrationsRouter.post('/:type/connect', requireAuth, (req: AuthRequest, res) => {
  const integration = db.prepare('SELECT * FROM integrations WHERE user_id = ? AND (type = ? OR id = ?)').get(req.userId, req.params.type, req.params.type) as Record<string, unknown> | undefined;
  if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

  db.prepare("UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE id = ?").run(new Date().toISOString(), integration.id);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Connected integration', ?, 'link')`).run(uuid(), req.userId, integration.name as string);

  const updated = db.prepare('SELECT * FROM integrations WHERE id = ?').get(integration.id) as Record<string, unknown>;
  res.json(parseIntegration(updated));
});

integrationsRouter.post('/:id/disconnect', requireAuth, (req: AuthRequest, res) => {
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

  db.prepare("UPDATE integrations SET status = 'disconnected', health = 0 WHERE id = ?").run(req.params.id);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Disconnected integration', ?, 'unlink')`).run(uuid(), req.userId, integration.name as string);

  const updated = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json(parseIntegration(updated));
});

integrationsRouter.patch('/:id/permissions', requireAuth, validateBody(permissionsUpdateSchema), (req: AuthRequest, res) => {
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

  db.prepare('UPDATE integrations SET permissions = ? WHERE id = ?').run(JSON.stringify(req.body.permissions || []), req.params.id);
  const updated = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json(parseIntegration(updated));
});

// ================================================================
// Telegram Account Linking
// ================================================================

// Generate a link code and return a Telegram deep link
integrationsRouter.post('/telegram/link', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  if (!config.telegramBotToken) {
    res.status(503).json({ error: 'Telegram bot is not configured on this server.' });
    return;
  }

  // Check if already linked
  const existing = db.prepare(
    "SELECT id, external_id, external_username FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
  ).get(userId) as { id: string; external_id: string; external_username: string } | undefined;

  if (existing) {
    // Ensure integrations table is in sync
    db.prepare(
      "UPDATE integrations SET status = 'connected', health = 100 WHERE user_id = ? AND type = 'telegram'"
    ).run(userId);
    res.json({
      linked: true,
      externalId: existing.external_id,
      username: existing.external_username,
      message: 'Telegram is already linked.',
    });
    return;
  }

  // Generate a 6-character code
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Clean up old codes for this user
  db.prepare("DELETE FROM link_codes WHERE user_id = ? AND channel = 'telegram'").run(userId);

  // Insert new code
  db.prepare('INSERT INTO link_codes (code, user_id, channel, expires_at) VALUES (?, ?, ?, ?)')
    .run(code, userId, 'telegram', expiresAt);

  const botName = getBotUsername();
  const deepLink = botName
    ? `https://t.me/${botName}?start=link_${code}`
    : null;

  res.json({
    linked: false,
    code,
    deepLink,
    botUsername: botName || null,
    expiresIn: 600, // seconds
    message: deepLink
      ? `Open the link or send "LINK ${code}" to the bot.`
      : `Send "/start link_${code}" to the Telegram bot.`,
  });
});

// Check Telegram link status
integrationsRouter.get('/telegram/status', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const link = db.prepare(
    "SELECT external_id, external_username, linked_at, last_message_at FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
  ).get(userId) as { external_id: string; external_username: string; linked_at: string; last_message_at: string | null } | undefined;

  const botConfigured = !!config.telegramBotToken;

  if (link) {
    res.json({
      linked: true,
      connected: true,
      botConfigured,
      externalId: link.external_id,
      username: link.external_username,
      linkedAt: link.linked_at,
      lastMessageAt: link.last_message_at,
      lastPing: link.last_message_at,
    });
  } else {
    res.json({ linked: false, connected: false, botConfigured });
  }
});

// Unlink Telegram — atomic transaction: remove channel link + update integration status + log
integrationsRouter.delete('/telegram/link', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const link = db.prepare(
    "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
  ).get(userId) as { id: string } | undefined;

  if (!link) {
    res.status(404).json({ error: 'No Telegram link found.' });
    return;
  }

  const unlinkId = link.id;
  const logId = uuid();

  // 78.3: Wrap all three DB ops in a transaction to prevent orphaned state
  const doUnlink = db.transaction(() => {
    db.prepare('DELETE FROM channel_links WHERE id = ?').run(unlinkId);
    db.prepare(
      "UPDATE integrations SET status = 'disconnected', health = 0 WHERE user_id = ? AND type = 'telegram'"
    ).run(userId);
    db.prepare(
      "INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Unlinked Telegram', 'Telegram bot disconnected', 'unlink')"
    ).run(logId, userId);
  });
  doUnlink();

  res.json({ success: true });
});

// ================================================================
// WhatsApp Account Linking
// ================================================================

// Deprecated: use POST /whatsapp/qr instead
integrationsRouter.post('/whatsapp/link', requireAuth, (req: AuthRequest, res) => {
  logger.warn({ userId: req.userId }, 'whatsapp/link (gone): client must use /whatsapp/qr');
  res.status(410).json({
    error: 'This endpoint has been removed. Use POST /api/integrations/whatsapp/qr to link WhatsApp.',
  });
});

// Check WhatsApp link status
integrationsRouter.get('/whatsapp/status', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const link = db.prepare(
    "SELECT external_id, linked_at FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
  ).get(userId) as { external_id: string; linked_at: string } | undefined;

  if (link) {
    res.json({
      linked: true,
      externalId: link.external_id,
      linkedAt: link.linked_at,
    });
  } else {
    res.json({ linked: false });
  }
});

// Unlink WhatsApp
integrationsRouter.delete('/whatsapp/link', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const link = db.prepare(
    "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
  ).get(userId) as { id: string } | undefined;

  if (!link) {
    res.status(404).json({ error: 'No WhatsApp link found.' });
    return;
  }

  db.prepare('DELETE FROM channel_links WHERE id = ?').run(link.id);
  db.prepare(
    "UPDATE integrations SET status = 'disconnected', health = 0 WHERE user_id = ? AND type = 'whatsapp'"
  ).run(userId);

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Unlinked WhatsApp', 'WhatsApp disconnected', 'unlink')`)
    .run(uuid(), userId);

  res.json({ success: true });
});

// ================================================================
// WhatsApp QR-Based Linking (New - Like OpenClaw)
// ================================================================

// Generate QR code for WhatsApp linking
integrationsRouter.post('/whatsapp/qr', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Check if already linked
  const existing = db.prepare(
    "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
  ).get(userId) as { id: string } | undefined;

  if (existing) {
    res.status(400).json({ success: false, error: 'WhatsApp is already linked.' });
    return;
  }

  try {
    const result = await generateWhatsAppQRSession(userId, 'dashboard');
    if (result.success) {
      res.json({ success: true, sessionId: result.sessionId, qrCodeDataUrl: result.qrCodeDataUrl });
    } else {
      res.status(500).json({ success: false, error: 'Failed to generate QR code' });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to generate WhatsApp QR code');
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// Check QR linking status
integrationsRouter.get('/whatsapp/qr/:sessionId/status', requireAuth, async (req: AuthRequest, res) => {
  const { sessionId } = req.params;

  try {
    const result = await checkWhatsAppSession(sessionId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to check WhatsApp session status');
    res.status(500).json({ linked: false, error: 'Failed to check status' });
  }
});

// ================================================================
// Integration Health Check (24.1)
// POST /integrations/:type/test — quick liveness check per type
// ================================================================

integrationsRouter.post('/:type/test', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const type = req.params.type;

  // Only check connected integrations
  const integration = db.prepare(
    "SELECT * FROM integrations WHERE user_id = ? AND type = ? AND status = 'connected'"
  ).get(userId, type) as Record<string, unknown> | undefined;

  if (!integration) {
    res.json({ healthy: false, reason: 'not_connected' });
    return;
  }

  let healthy = false;
  let reason = 'unknown';

  switch (type) {
    case 'telegram': {
      // Healthy if bot token is configured AND the user has a linked channel
      const hasToken = !!config.telegramBotToken;
      const link = db.prepare(
        "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
      ).get(userId);
      healthy = hasToken && !!link;
      reason = !hasToken ? 'bot_not_configured' : !link ? 'not_linked' : 'ok';
      break;
    }
    case 'whatsapp': {
      const link = db.prepare(
        "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
      ).get(userId);
      healthy = !!link;
      reason = link ? 'ok' : 'not_linked';
      break;
    }
    case 'email': {
      const cfg = db.prepare(
        "SELECT notification_email_enabled, notification_email_address FROM agent_configs WHERE user_id = ?"
      ).get(userId) as { notification_email_enabled?: number; notification_email_address?: string } | undefined;
      healthy = !!(cfg?.notification_email_enabled && cfg?.notification_email_address);
      reason = healthy ? 'ok' : 'no_email_set';
      break;
    }
    default: {
      // For any other integration, status=connected is enough
      healthy = true;
      reason = 'ok';
      break;
    }
  }

  // Optionally update health column in integrations table
  const healthValue = healthy ? 100 : 0;
  db.prepare('UPDATE integrations SET health = ? WHERE user_id = ? AND type = ?')
    .run(healthValue, userId, type);

  res.json({ healthy, reason, type });
});

// ── 62.7: Connections health ping with latency ───────────────────────────────
// GET /integrations/:type/ping — returns { latencyMs, healthy, reason }
integrationsRouter.get('/:type/ping', requireAuth, (req: AuthRequest, res) => {
  const startMs = Date.now();
  const userId = req.userId!;
  const type = req.params.type;

  const integration = db.prepare(
    "SELECT * FROM integrations WHERE user_id = ? AND type = ? AND status = 'connected'"
  ).get(userId, type) as Record<string, unknown> | undefined;

  if (!integration) {
    res.json({ latencyMs: Date.now() - startMs, healthy: false, reason: 'not_connected', type });
    return;
  }

  let healthy = false;
  let reason = 'unknown';

  switch (type) {
    case 'telegram': {
      const hasToken = !!config.telegramBotToken;
      const link = db.prepare("SELECT id FROM channel_links WHERE user_id = ? AND channel = 'telegram'").get(userId);
      healthy = hasToken && !!link;
      reason = !hasToken ? 'bot_not_configured' : !link ? 'not_linked' : 'ok';
      break;
    }
    case 'whatsapp': {
      const link = db.prepare("SELECT id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'").get(userId);
      healthy = !!link;
      reason = link ? 'ok' : 'not_linked';
      break;
    }
    case 'email': {
      const cfg = db.prepare(
        'SELECT notification_email_enabled, notification_email_address FROM agent_configs WHERE user_id = ?'
      ).get(userId) as { notification_email_enabled?: number; notification_email_address?: string } | undefined;
      healthy = !!(cfg?.notification_email_enabled && cfg?.notification_email_address);
      reason = healthy ? 'ok' : 'no_email_set';
      break;
    }
    default:
      healthy = true;
      reason = 'ok';
      break;
  }

  const latencyMs = Date.now() - startMs;
  db.prepare('UPDATE integrations SET health = ? WHERE user_id = ? AND type = ?')
    .run(healthy ? 100 : 0, userId, type);

  res.json({ latencyMs, healthy, reason, type });
});

// ── Phase 27.3: Connection Invite Links ──────────────────────────────────────

integrationsRouter.post('/invite', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { email } = req.body as { email?: unknown };

  // Validate email if provided
  let validatedEmail: string | null = null;
  if (email !== undefined) {
    if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'email must be a valid email address (max 255 chars)' });
      return;
    }
    validatedEmail = email.toLowerCase().trim();
  }

  const token = crypto.randomBytes(24).toString('hex');
  const id = uuid();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  db.prepare(
    'INSERT INTO connection_invites (id, user_id, token, email, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, token, validatedEmail, expiresAt);

  const inviteUrl = `https://ai.geekspace.space/connect/${token}`;
  res.json({ inviteUrl, token, expiresAt });
});

integrationsRouter.get('/invites', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const invites = db.prepare(
    'SELECT id, token, email, expires_at, used_at, created_at FROM connection_invites WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(userId) as { id: string; token: string; email: string | null; expires_at: number; used_at: number | null; created_at: number }[];

  const result = invites.map((inv) => ({
    ...inv,
    inviteUrl: `https://ai.geekspace.space/connect/${inv.token}`,
    expired: inv.expires_at < Date.now(),
    used: !!inv.used_at,
  }));

  res.json(result);
});

// ── Phase 29.1: Connection Invite Accept Flow ─────────────────────────────────

// Public endpoint — get invite info by token (no auth required)
integrationsRouter.get('/invite/:token/info', (req, res) => {
  const { token } = req.params;
  const invite = db.prepare(
    'SELECT ci.id, ci.token, ci.email, ci.expires_at, ci.used_at, u.name as owner_name, u.username as owner_username, u.avatar as owner_avatar FROM connection_invites ci JOIN users u ON u.id = ci.user_id WHERE ci.token = ?'
  ).get(token) as { id: string; token: string; email: string | null; expires_at: number; used_at: number | null; owner_name: string; owner_username: string; owner_avatar: string | null } | undefined;

  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }
  if (invite.expires_at < Date.now()) {
    res.status(410).json({ error: 'Invite expired' });
    return;
  }
  if (invite.used_at) {
    res.status(409).json({ error: 'Invite already used' });
    return;
  }

  res.json({
    token: invite.token,
    email: invite.email,
    ownerName: invite.owner_name,
    ownerUsername: invite.owner_username,
    ownerAvatar: invite.owner_avatar,
    expiresAt: invite.expires_at,
  });
});

// Public endpoint — accept invite (mark as used, optionally record acceptor email)
integrationsRouter.post('/invite/:token/accept', (req, res) => {
  const { token } = req.params;
  const { acceptorEmail, acceptorName } = req.body as { acceptorEmail?: unknown; acceptorName?: unknown };

  // Validate optional acceptor fields
  if (acceptorEmail !== undefined && (typeof acceptorEmail !== 'string' || acceptorEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acceptorEmail))) {
    res.status(400).json({ error: 'acceptorEmail must be a valid email address (max 255 chars)' });
    return;
  }
  if (acceptorName !== undefined && (typeof acceptorName !== 'string' || acceptorName.length > 100)) {
    res.status(400).json({ error: 'acceptorName must be a string of 100 characters or fewer' });
    return;
  }

  const safeEmail = typeof acceptorEmail === 'string' ? acceptorEmail.toLowerCase().trim() : undefined;
  const safeName = typeof acceptorName === 'string' ? acceptorName.trim() : undefined;

  const invite = db.prepare(
    'SELECT id, user_id, expires_at, used_at FROM connection_invites WHERE token = ?'
  ).get(token) as { id: string; user_id: string; expires_at: number; used_at: number | null } | undefined;

  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }
  if (invite.expires_at < Date.now()) {
    res.status(410).json({ error: 'Invite expired' });
    return;
  }
  if (invite.used_at) {
    res.status(409).json({ error: 'Invite already used' });
    return;
  }

  // Mark invite as used
  db.prepare('UPDATE connection_invites SET used_at = ? WHERE id = ?').run(Date.now(), invite.id);

  const acceptorDisplay = safeName || safeEmail || 'Someone';

  // Log activity for the invite owner
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Connection accepted', ?, 'user-check')`)
    .run(crypto.randomUUID(), invite.user_id, `${acceptorDisplay} accepted your connection invite`);

  // 36.2 + 37.5: Notify invite owner via Telegram if linked and opted in (notif_connections)
  const agentCfg = db.prepare('SELECT notif_connections FROM agent_configs WHERE user_id = ?').get(invite.user_id) as { notif_connections: number } | undefined;
  if (agentCfg?.notif_connections === 1) {
    const tgLink = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
    ).get(invite.user_id) as { external_id: string } | undefined;
    if (tgLink) {
      sendTelegramMessage(tgLink.external_id, `🤝 ${acceptorDisplay} accepted your connection invite!`).catch(() => {});
    }
  }

  res.json({ success: true, message: 'Connection established' });
});


// ── 65.6: Integration event log — last 50 integration-related activity entries ─
integrationsRouter.get('/events', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
  const events = db.prepare(
    `SELECT id, action, details, icon, created_at FROM activity_log
     WHERE user_id = ? AND (
       action LIKE '%integration%' OR action LIKE '%Connected%' OR action LIKE '%Disconnected%'
       OR action LIKE '%Linked%' OR action LIKE '%Unlinked%' OR action LIKE '%connection%'
     )
     ORDER BY created_at DESC LIMIT ?`
  ).all(userId, limit);
  res.json({ events });
});
