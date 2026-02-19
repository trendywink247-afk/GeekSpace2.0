import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, permissionsUpdateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { getBotUsername } from '../services/telegram.js';
import { config } from '../config.js';

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
  const rows = db.prepare('SELECT * FROM integrations WHERE user_id = ?').all(req.userId!) as Record<string, unknown>[];
  res.json(rows.map(parseIntegration));
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
    "SELECT id, external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
  ).get(userId) as { id: string; external_id: string } | undefined;

  if (existing) {
    res.json({
      linked: true,
      externalId: existing.external_id,
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

  if (link) {
    res.json({
      linked: true,
      externalId: link.external_id,
      username: link.external_username,
      linkedAt: link.linked_at,
      lastMessageAt: link.last_message_at,
    });
  } else {
    res.json({ linked: false });
  }
});

// Unlink Telegram
integrationsRouter.delete('/telegram/link', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const link = db.prepare(
    "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
  ).get(userId) as { id: string } | undefined;

  if (!link) {
    res.status(404).json({ error: 'No Telegram link found.' });
    return;
  }

  db.prepare('DELETE FROM channel_links WHERE id = ?').run(link.id);
  db.prepare(
    "UPDATE integrations SET status = 'disconnected', health = 0 WHERE user_id = ? AND type = 'telegram'"
  ).run(userId);

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Unlinked Telegram', 'Telegram bot disconnected', 'unlink')`)
    .run(uuid(), userId);

  res.json({ success: true });
});

// ================================================================
// WhatsApp Account Linking
// ================================================================

// Generate a link code and return a WhatsApp wa.me link
integrationsRouter.post('/whatsapp/link', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  if (!config.whatsappBusinessNumber) {
    res.status(503).json({ error: 'WhatsApp is not configured on this server.' });
    return;
  }

  // Check if already linked
  const existing = db.prepare(
    "SELECT id, external_id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
  ).get(userId) as { id: string; external_id: string } | undefined;

  if (existing) {
    res.json({
      linked: true,
      externalId: existing.external_id,
      message: 'WhatsApp is already linked.',
    });
    return;
  }

  // Generate link token
  const { generateWhatsAppLinkToken } = await import('../services/whatsapp.js');
  const token = await generateWhatsAppLinkToken(userId);

  // Generate wa.me link with pre-filled message
  const waMeUrl = `https://wa.me/${config.whatsappBusinessNumber}?text=LINK%20${token}`;

  res.json({
    linked: false,
    token,
    qrUrl: waMeUrl,
    expiresIn: 3600,
    message: 'Scan the QR code or click the link to open WhatsApp and send the connect message.',
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
