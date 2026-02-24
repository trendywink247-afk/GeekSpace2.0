import { logger } from '../logger.js';
import { config } from '../config.js';
import crypto from 'crypto';

export async function sendWhatsAppMessage(
  to: string,
  _text: string,
  _replyToMessageId?: string
): Promise<void> {
  if (!config.whatsappToken || !config.whatsappBusinessId) {
    // WhatsApp Business API not configured — message silently dropped.
    // To enable: set WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ID in .env
    logger.warn({ to }, 'WhatsApp message not sent: WHATSAPP_TOKEN/WHATSAPP_BUSINESS_ID not configured');
    return;
  }

  // TODO: Implement WhatsApp Business Cloud API send
  // POST https://graph.facebook.com/v18.0/{businessId}/messages
  // headers: { Authorization: `Bearer ${config.whatsappToken}` }
  // body: { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
  logger.warn({ to }, 'WhatsApp sending not yet implemented — message dropped');
}

export function verifyWhatsAppWebhook(
  signature: string,
  body: string
): boolean {
  if (!config.whatsappVerifyToken) {
    // In production, missing verify token should be a hard failure.
    // In dev/test, we allow it through with a warning.
    if (config.env === 'production') {
      logger.error('WhatsApp webhook verification skipped: WHATSAPP_VERIFY_TOKEN not set in production');
      return false; // Reject unverified requests in production
    }
    logger.warn('WhatsApp webhook verification skipped (dev mode — set WHATSAPP_VERIFY_TOKEN to enable)');
    return true;
  }

  const expected = crypto
    .createHmac('sha256', config.whatsappVerifyToken)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function generateWhatsAppLinkToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(16).toString('hex');

  // Store token with expiration (1 hour)
  const { db } = await import('../db/index.js');
  db.prepare(`
    INSERT INTO link_codes (code, user_id, channel, expires_at)
    VALUES (?, ?, 'whatsapp', datetime('now', '+1 hour'))
  `).run(token, userId);

  return token;
}
