// ============================================================
// Telegram Bot API Service
//
// Sends/receives messages via Telegram Bot API.
// Webhook-based (no polling). Registered on startup.
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;

// ---- Types ----

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; is_bot: boolean; first_name: string; last_name?: string; username?: string };
    chat: { id: number; type: string; title?: string };
    date: number;
    text?: string;
    entities?: Array<{ type: string; offset: number; length: number }>;
  };
}

export interface NormalizedMessage {
  channel: 'telegram';
  externalId: string;
  text: string;
  messageId?: string;
  senderName?: string;
  timestamp: string;
}

// ---- Webhook Verification ----

export function verifyTelegramWebhook(secretToken: string): boolean {
  if (!config.telegramWebhookSecret) return true; // no secret configured = skip
  return secretToken === config.telegramWebhookSecret;
}

// ---- Parse Update ----

export function parseTelegramUpdate(update: TelegramUpdate): NormalizedMessage | null {
  const msg = update.message;
  if (!msg || !msg.text) return null;

  return {
    channel: 'telegram',
    externalId: String(msg.chat.id),
    text: msg.text,
    messageId: String(msg.message_id),
    senderName: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '),
    timestamp: new Date(msg.date * 1000).toISOString(),
  };
}

// ---- Extract Bot Commands ----

export function extractBotCommand(update: TelegramUpdate): { command: string; args: string } | null {
  const msg = update.message;
  if (!msg?.text || !msg.entities) return null;

  const botCmdEntity = msg.entities.find(e => e.type === 'bot_command' && e.offset === 0);
  if (!botCmdEntity) return null;

  const command = msg.text.slice(0, botCmdEntity.length).split('@')[0]; // strip @botname
  const args = msg.text.slice(botCmdEntity.length).trim();
  return { command, args };
}

// ---- Send Message ----

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyToMessageId?: number,
): Promise<{ messageId: number; success: boolean }> {
  // Telegram has a 4096 char limit per message — split if needed
  const chunks = splitMessage(text, 4096);

  let lastMessageId = 0;
  for (const chunk of chunks) {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
      parse_mode: 'HTML',
    };
    if (replyToMessageId && chunk === chunks[0]) {
      body.reply_to_message_id = replyToMessageId;
    }

    let sent = false;
    for (let attempt = 0; attempt < 3 && !sent; attempt++) {
      try {
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Telegram sendMessage failed');
          return { messageId: 0, success: false };
        }

        const data = await res.json() as { result?: { message_id: number } };
        lastMessageId = data.result?.message_id || 0;
        sent = true;
      } catch (err) {
        logger.warn({ err, chatId, attempt }, 'Telegram sendMessage attempt failed');
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    if (!sent) {
      logger.error({ chatId }, 'Telegram sendMessage failed after 3 attempts');
      return { messageId: 0, success: false };
    }
  }

  return { messageId: lastMessageId, success: true };
}

// ---- Register Webhook ----

export async function registerTelegramWebhook(webhookUrl: string): Promise<boolean> {
  if (!config.telegramBotToken) return false;

  try {
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message'],
      max_connections: 40,
    };
    if (config.telegramWebhookSecret) {
      body.secret_token = config.telegramWebhookSecret;
    }

    const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ webhookUrl }, 'Telegram webhook registered');
    } else {
      logger.warn({ webhookUrl, error: data.description }, 'Telegram webhook registration failed');
    }
    return data.ok;
  } catch (err) {
    logger.error({ err }, 'Failed to register Telegram webhook');
    return false;
  }
}

// ---- Delete Webhook (for dev) ----

export async function deleteTelegramWebhook(): Promise<boolean> {
  if (!config.telegramBotToken) return false;

  try {
    const res = await fetch(`${TELEGRAM_API}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

// ---- Get Bot Info ----

export async function getTelegramBotInfo(): Promise<{ username: string; firstName: string } | null> {
  if (!config.telegramBotToken) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as { ok: boolean; result?: { username: string; first_name: string } };
    if (data.ok && data.result) {
      return { username: data.result.username, firstName: data.result.first_name };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Init (called on startup) ----

let botUsername = '';

export function getBotUsername(): string {
  return botUsername;
}

export async function initTelegramBot(): Promise<void> {
  if (!config.telegramBotToken) {
    logger.info('Telegram bot token not configured, skipping');
    return;
  }

  // Get bot info
  const info = await getTelegramBotInfo();
  if (info) {
    botUsername = info.username;
    logger.info({ username: info.username, name: info.firstName }, 'Telegram bot identified');
  }

  // Register webhook
  const webhookUrl = `${config.apiUrl}/api/webhooks/telegram`;
  await registerTelegramWebhook(webhookUrl);
}

// ---- Helpers ----

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to break at a newline
    let breakAt = remaining.lastIndexOf('\n', maxLen);
    if (breakAt < maxLen / 2) breakAt = maxLen; // no good newline, hard break
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt);
  }
  return chunks;
}
