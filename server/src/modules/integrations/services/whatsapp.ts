// ============================================================
// WhatsApp Service — consolidated (Business API + QR session)
// ============================================================

import { logger } from '../../../logger.js';
import { config } from '../../../config.js';
import crypto from 'crypto';
import { db } from '../../../db/index.js';

// QR Code session management (in-process; clears on worker restart)
interface WhatsAppSession {
  userId: string;
  chatId: string;
  qrCode?: string;
  state: 'pending' | 'connected' | 'failed';
  createdAt: number;
}

const pendingSessions: Map<string, WhatsAppSession> = new Map();

// ── Business API send ────────────────────────────────────────

/**
 * Send a WhatsApp message via Business Cloud API.
 * Returns void for compatibility with message-router callers.
 * No-op (with warning) when credentials are not configured.
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  _replyToMessageId?: string
): Promise<void> {
  if (!config.whatsappToken || !config.whatsappBusinessId) {
    logger.warn({ to }, 'WhatsApp message not sent: WHATSAPP_TOKEN/WHATSAPP_BUSINESS_ID not configured');
    return;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${config.whatsappBusinessId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\D/g, ''),
        type: 'text',
        text: { body: text },
      }),
    });
    if (!res.ok) {
      const error = await res.text();
      logger.error({ error, to }, 'WhatsApp send failed');
    } else {
      logger.info({ to }, 'WhatsApp message sent');
    }
  } catch (err) {
    logger.error({ err, to }, 'WhatsApp send error');
  }
}

/**
 * Send an image to a WhatsApp recipient via Business Cloud API.
 *
 * Uses the `image` message type with a public URL. The WhatsApp API will
 * fetch and deliver the image inline in the conversation.
 *
 * @param to       - Recipient phone number (digits only — non-digits are stripped)
 * @param imageUrl - Publicly accessible URL of the image to send
 * @param caption  - Optional caption shown below the image (max 1024 chars)
 * @returns `true` on success, `false` when not configured or on send failure
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<boolean> {
  if (!config.whatsappToken || !config.whatsappBusinessId) {
    logger.warn({ to }, 'WhatsApp image not sent: WHATSAPP_TOKEN/WHATSAPP_BUSINESS_ID not configured');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${config.whatsappBusinessId}/messages`;
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'image',
      image: {
        link: imageUrl,
        ...(caption ? { caption: caption.slice(0, 1024) } : {}),
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => '');
      logger.error({ error, to, imageUrl }, 'WhatsApp image send failed');
      return false;
    }

    logger.info({ to }, 'WhatsApp image sent');
    return true;
  } catch (err) {
    logger.error({ err, to }, 'WhatsApp image send error');
    return false;
  }
}

// ── Webhook verification ─────────────────────────────────────

export function verifyWhatsAppWebhook(signature: string, body: string): boolean {
  if (!config.whatsappVerifyToken) {
    if (config.env === 'production') {
      logger.error('WhatsApp webhook verification skipped: WHATSAPP_VERIFY_TOKEN not set in production');
      return false;
    }
    logger.warn('WhatsApp webhook verification skipped (dev mode)');
    return true;
  }

  const expected = crypto
    .createHmac('sha256', config.whatsappVerifyToken)
    .update(body)
    .digest('hex');

  // 92.7: Guard against null/undefined signature and length mismatch (prevents crash)
  if (signature == null || typeof signature !== 'string') return false;
  try {
    const sigBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch { return false; }
}

// ── Link token (legacy wa.me flow) ──────────────────────────

export async function generateWhatsAppLinkToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO link_codes (code, user_id, channel, expires_at)
    VALUES (?, ?, 'whatsapp', datetime('now', '+1 hour'))
  `).run(token, userId);
  return token;
}

// ── QR session flow ──────────────────────────────────────────

export async function generateWhatsAppQRSession(userId: string, chatId: string): Promise<{
  success: boolean;
  sessionId: string;
  qrCodeDataUrl?: string;
  error?: string;
}> {
  try {
    const sessionId = crypto.randomBytes(16).toString('hex');

    pendingSessions.set(sessionId, {
      userId,
      chatId,
      state: 'pending',
      createdAt: Date.now(),
    });

    const qrData = `https://api.whatsapp.com/send?phone=${config.whatsappBusinessNumber || '0000000000'}&text=LINK:${sessionId}`;
    const qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

    logger.info({ sessionId, userId }, 'WhatsApp QR session created');
    return { success: true, sessionId, qrCodeDataUrl };
  } catch (err) {
    logger.error({ err, userId }, 'Failed to create WhatsApp QR session');
    return { success: false, sessionId: '', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function checkWhatsAppSession(sessionId: string): Promise<{
  linked: boolean;
  phoneNumber?: string;
  error?: string;
}> {
  const session = pendingSessions.get(sessionId);
  if (!session) return { linked: false, error: 'Session not found' };

  if (Date.now() - session.createdAt > 10 * 60 * 1000) {
    pendingSessions.delete(sessionId);
    return { linked: false, error: 'Session expired' };
  }

  const link = db.prepare(
    'SELECT external_id FROM channel_links WHERE user_id = ? AND channel = ? AND is_verified = 1'
  ).get(session.userId, 'whatsapp') as { external_id: string } | undefined;

  if (link) {
    session.state = 'connected';
    pendingSessions.delete(sessionId);
    return { linked: true, phoneNumber: link.external_id };
  }

  return { linked: false };
}

export async function handleWhatsAppWebhook(
  from: string,
  text: string,
  _messageId: string
): Promise<void> {
  logger.info({ from, text: text.slice(0, 50) }, 'WhatsApp message received');

  if (text.startsWith('LINK:')) {
    const sessionId = text.replace('LINK:', '').trim();
    const session = pendingSessions.get(sessionId);

    if (session) {
      db.prepare(
        `INSERT INTO channel_links (id, user_id, channel, external_id, is_verified, created_at)
         VALUES (?, ?, 'whatsapp', ?, 1, datetime('now'))
         ON CONFLICT(user_id, channel) DO UPDATE SET
         external_id = excluded.external_id,
         is_verified = 1,
         updated_at = datetime('now')`
      ).run(crypto.randomUUID(), session.userId, from);

      session.state = 'connected';
      pendingSessions.delete(sessionId);
      await sendWhatsAppMessage(from, '✅ WhatsApp connected successfully!');
      logger.info({ userId: session.userId, phone: from }, 'WhatsApp linked via QR');
    }
  }
}

// ── Connection management ────────────────────────────────────

export async function unlinkWhatsApp(userId: string): Promise<boolean> {
  try {
    db.prepare('DELETE FROM channel_links WHERE user_id = ? AND channel = ?').run(userId, 'whatsapp');
    logger.info({ userId }, 'WhatsApp unlinked');
    return true;
  } catch (err) {
    logger.error({ err, userId }, 'Failed to unlink WhatsApp');
    return false;
  }
}

export function getWhatsAppStatus(userId: string): {
  connected: boolean;
  phoneNumber?: string;
  connectedAt?: string;
} {
  const link = db.prepare(
    'SELECT external_id, created_at FROM channel_links WHERE user_id = ? AND channel = ? AND is_verified = 1'
  ).get(userId, 'whatsapp') as { external_id: string; created_at: string } | undefined;

  return link
    ? { connected: true, phoneNumber: link.external_id, connectedAt: link.created_at }
    : { connected: false };
}
