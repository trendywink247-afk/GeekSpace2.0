// ============================================================
// Message Dispatcher — abstracts sending across channels
// Routes messages to Telegram, WhatsApp, or Email based on
// the user's preferred (verified) channel link.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

export type MessageChannel = 'telegram' | 'whatsapp' | 'email';

interface SendOptions {
  parseMode?: 'Markdown' | 'HTML';
  buttons?: Array<Array<{ text: string; callback_data: string }>>;
}

// ── Main dispatcher ──────────────────────────────────────────

export async function sendMessage(
  userId: string,
  text: string,
  options?: SendOptions
): Promise<{ success: boolean; channel: MessageChannel }> {
  const channel = getUserPreferredChannel(userId);

  switch (channel) {
    case 'telegram':
      return sendViaTelegram(userId, text, options);
    case 'whatsapp':
      return sendViaWhatsApp(userId, text, options);
    case 'email':
      return sendViaEmail(userId, text);
    default:
      return sendViaTelegram(userId, text, options);
  }
}

export async function sendPhoto(
  userId: string,
  photoUrl: string,
  caption?: string
): Promise<{ success: boolean; channel: MessageChannel }> {
  const channel = getUserPreferredChannel(userId);

  if (channel === 'telegram') {
    try {
      const { sendTelegramPhoto } = await import('./telegram.js');
      const link = getTelegramLink(userId);
      if (link) {
        await sendTelegramPhoto(link, photoUrl, caption);
        return { success: true, channel: 'telegram' };
      }
    } catch { /* fall through */ }
  }

  // Fallback: send as text with note about image
  return sendMessage(userId, caption || 'Image attached');
}

// ── Channel resolvers ────────────────────────────────────────

function getUserPreferredChannel(userId: string): MessageChannel {
  try {
    // Check if user has a telegram link (most common)
    const tgLink = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
    ).get(userId) as { external_id: string } | undefined;
    if (tgLink) return 'telegram';

    // Check WhatsApp
    const waLink = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp' AND is_verified = 1 LIMIT 1"
    ).get(userId) as { external_id: string } | undefined;
    if (waLink) return 'whatsapp';

    // Fallback to email
    return 'email';
  } catch {
    return 'telegram';
  }
}

function getTelegramLink(userId: string): string | null {
  const link = db.prepare(
    "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
  ).get(userId) as { external_id: string } | undefined;
  return link?.external_id || null;
}

// ── Telegram sender ──────────────────────────────────────────

async function sendViaTelegram(
  userId: string,
  text: string,
  options?: SendOptions
): Promise<{ success: boolean; channel: MessageChannel }> {
  try {
    const chatId = getTelegramLink(userId);
    if (!chatId) return { success: false, channel: 'telegram' };

    if (options?.buttons && options.buttons.length > 0) {
      const { sendTelegramButtons } = await import('./telegram.js');
      await sendTelegramButtons(chatId, text, options.buttons);
    } else {
      const { sendTelegramMessage } = await import('./telegram.js');
      await sendTelegramMessage(chatId, text);
    }
    return { success: true, channel: 'telegram' };
  } catch {
    return { success: false, channel: 'telegram' };
  }
}

// ── WhatsApp sender (STUB -- logs only until Meta approval) ──

async function sendViaWhatsApp(
  userId: string,
  text: string,
  _options?: SendOptions
): Promise<{ success: boolean; channel: MessageChannel }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    logger.debug({ userId }, 'WhatsApp not configured -- message not sent');
    // Fallback to Telegram
    return sendViaTelegram(userId, text, _options);
  }

  try {
    const waLink = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp' AND is_verified = 1 LIMIT 1"
    ).get(userId) as { external_id: string } | undefined;

    if (!waLink) return sendViaTelegram(userId, text, _options);

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: waLink.external_id,
          type: 'text',
          text: { body: text },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    return { success: res.ok, channel: 'whatsapp' };
  } catch (err) {
    logger.warn({ err, userId }, 'WhatsApp send failed, falling back to Telegram');
    return sendViaTelegram(userId, text, _options);
  }
}

// ── Email sender ─────────────────────────────────────────────

async function sendViaEmail(
  userId: string,
  text: string
): Promise<{ success: boolean; channel: MessageChannel }> {
  try {
    const { sendAgentEmail } = await import('./email.js');
    const sent = await sendAgentEmail(userId, 'Agentin Update', text);
    return { success: sent, channel: 'email' };
  } catch {
    return { success: false, channel: 'email' };
  }
}
