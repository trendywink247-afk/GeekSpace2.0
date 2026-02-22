// ============================================================
// WhatsApp Service with QR Code Support (like OpenClaw)
// Uses Baileys or similar library for QR-based authentication
// ============================================================

import { logger } from '../logger.js';
import { config } from '../config.js';
import crypto from 'crypto';
import { db } from '../db/index.js';

// QR Code session management
interface WhatsAppSession {
  userId: string;
  chatId: string;
  qrCode?: string;
  state: 'pending' | 'connected' | 'failed';
  createdAt: number;
}

const pendingSessions: Map<string, WhatsAppSession> = new Map();

/**
 * Generate a new WhatsApp linking session with QR code
 * This mimics OpenClaw's QR-based WhatsApp setup
 */
export async function generateWhatsAppQRSession(userId: string, chatId: string): Promise<{
  success: boolean;
  sessionId: string;
  qrCodeDataUrl?: string;
  error?: string;
}> {
  try {
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Generate a QR code that encodes the session ID
    // In production, this would use a real WhatsApp library like Baileys
    // For now, we simulate with a QR code that points to our webhook
    
    // Store the pending session
    pendingSessions.set(sessionId, {
      userId,
      chatId,
      state: 'pending',
      createdAt: Date.now()
    });

    // Generate QR code data (this would be replaced with actual WhatsApp Web QR)
    const qrData = `https://api.whatsapp.com/send?phone=${config.whatsappBusinessNumber || '0000000000'}&text=LINK:${sessionId}`;
    
    // Create a simple QR code URL using a free service
    // In production, generate this server-side
    const qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

    logger.info({ sessionId, userId }, 'WhatsApp QR session created');

    return {
      success: true,
      sessionId,
      qrCodeDataUrl
    };
  } catch (err) {
    logger.error({ err, userId }, 'Failed to create WhatsApp QR session');
    return {
      success: false,
      sessionId: '',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Check if a WhatsApp session has been linked
 */
export async function checkWhatsAppSession(sessionId: string): Promise<{
  linked: boolean;
  phoneNumber?: string;
  error?: string;
}> {
  const session = pendingSessions.get(sessionId);
  
  if (!session) {
    return { linked: false, error: 'Session not found' };
  }

  // Check if session expired (10 minutes)
  if (Date.now() - session.createdAt > 10 * 60 * 1000) {
    pendingSessions.delete(sessionId);
    return { linked: false, error: 'Session expired' };
  }

  // Check database for completed link
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

/**
 * Handle incoming WhatsApp message webhook
 */
export async function handleWhatsAppWebhook(
  from: string,
  text: string,
  messageId: string
): Promise<void> {
  logger.info({ from, text: text.slice(0, 50) }, 'WhatsApp message received');

  // Check for linking command
  if (text.startsWith('LINK:')) {
    const sessionId = text.replace('LINK:', '').trim();
    const session = pendingSessions.get(sessionId);

    if (session) {
      // Complete the link
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

      // Send confirmation
      await sendWhatsAppMessage(from, '✅ WhatsApp connected successfully! You can now chat with your agent here.');
      logger.info({ userId: session.userId, phone: from }, 'WhatsApp linked via QR');
      return;
    }
  }

  // Regular message handling would go here (routed to message-router)
}

/**
 * Send a message via WhatsApp Business API
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  _replyToMessageId?: string
): Promise<boolean> {
  if (!config.whatsappToken || !config.whatsappBusinessId) {
    logger.warn('WhatsApp Business API not configured');
    return false;
  }

  try {
    // WhatsApp Business API endpoint
    const url = `https://graph.facebook.com/v18.0/${config.whatsappBusinessId}/messages`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\D/g, ''), // Remove non-digits
        type: 'text',
        text: { body: text }
      })
    });

    if (!res.ok) {
      const error = await res.text();
      logger.error({ error, to }, 'WhatsApp send failed');
      return false;
    }

    logger.info({ to }, 'WhatsApp message sent');
    return true;
  } catch (err) {
    logger.error({ err, to }, 'WhatsApp send error');
    return false;
  }
}

/**
 * Send a WhatsApp message with buttons (if supported by API)
 */
export async function sendWhatsAppButtons(
  to: string,
  text: string,
  buttons: Array<{ title: string; id: string }>
): Promise<boolean> {
  if (!config.whatsappToken || !config.whatsappBusinessId) {
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${config.whatsappBusinessId}/messages`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\D/g, ''),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.slice(0, 20) }
            }))
          }
        }
      })
    });

    return res.ok;
  } catch (err) {
    logger.error({ err, to }, 'WhatsApp buttons send error');
    return false;
  }
}

/**
 * Verify WhatsApp webhook signature
 */
export function verifyWhatsAppWebhook(
  signature: string,
  body: string
): boolean {
  if (!config.whatsappVerifyToken) return true;

  const expected = crypto
    .createHmac('sha256', config.whatsappVerifyToken)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Unlink WhatsApp for a user
 */
export async function unlinkWhatsApp(userId: string): Promise<boolean> {
  try {
    db.prepare(
      'DELETE FROM channel_links WHERE user_id = ? AND channel = ?'
    ).run(userId, 'whatsapp');
    
    logger.info({ userId }, 'WhatsApp unlinked');
    return true;
  } catch (err) {
    logger.error({ err, userId }, 'Failed to unlink WhatsApp');
    return false;
  }
}

/**
 * Get WhatsApp connection status for a user
 */
export function getWhatsAppStatus(userId: string): {
  connected: boolean;
  phoneNumber?: string;
  connectedAt?: string;
} {
  const link = db.prepare(
    'SELECT external_id, created_at FROM channel_links WHERE user_id = ? AND channel = ? AND is_verified = 1'
  ).get(userId, 'whatsapp') as { external_id: string; created_at: string } | undefined;

  if (link) {
    return {
      connected: true,
      phoneNumber: link.external_id,
      connectedAt: link.created_at
    };
  }

  return { connected: false };
}
