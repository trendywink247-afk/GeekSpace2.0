import { logger } from '../logger.js';
import { config } from '../config.js';
import crypto from 'crypto';

export async function sendWhatsAppMessage(
  to: string,
  _text: string,
  _replyToMessageId?: string
): Promise<void> {
  if (!config.whatsappToken || !config.whatsappBusinessId) {
    logger.warn('WhatsApp not configured');
    return;
  }

  // WhatsApp Business API integration stub
  // Actual implementation would call WhatsApp Business API
  logger.info({ to }, 'WhatsApp message would be sent');
}

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
