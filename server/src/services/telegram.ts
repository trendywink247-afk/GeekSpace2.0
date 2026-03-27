/**
 * Telegram Bot API Service
 *
 * Low-level adapter for the Telegram Bot API. Handles sending and
 * receiving messages, photos, videos, typing indicators, inline
 * button keyboards, and callback query answers. All communication
 * is webhook-based (no long-polling).
 *
 * **Outbound messages** are sanitised to strip LLM tool-call artifacts,
 * markdown formatting, and XML-like tags before sending as plain text.
 * Messages exceeding Telegram's 4096-character limit are automatically
 * split into multiple chunks.
 *
 * **Inbound updates** are parsed into {@link NormalizedMessage} objects
 * by {@link parseTelegramUpdate} for consumption by the message router.
 *
 * The webhook is registered on startup via {@link registerTelegramWebhook}
 * and verified using an optional `TELEGRAM_WEBHOOK_SECRET` header.
 *
 * @module services/telegram
 */

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
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    entities?: Array<{ type: string; offset: number; length: number }>;
    reply_to_message?: {
      message_id: number;
      text?: string;
    };
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    document?: {
      file_id: string;
      file_unique_id: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
    };
    caption?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; is_bot: boolean; first_name: string; username?: string };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
    };
    data?: string;
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

// ---- Text Sanitization for Telegram ----

/** Strip action blocks, markdown formatting, and other LLM artifacts for plain-text Telegram */
function sanitizeForTelegram(text: string): string {
  return text
    // Strip XML tool call blocks that LLMs sometimes emit
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .replace(/<function[^>]*>[\s\S]*?<\/function>/g, '')
    .replace(/<tool_response>[\s\S]*?<\/tool_response>/g, '')
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
    .replace(/<(?!(?:br|b|i|em|strong|p)\b)[a-zA-Z][^>]*>[\s\S]*?<\/[a-zA-Z][^>]*>/g, '')
    // Strip well-formed action blocks: <<<ACTION {...} ACTION>>>
    .replace(/<<<ACTION[\s\S]*?ACTION>>>/g, '')
    // Strip malformed action-like tags: <<word or <<<word
    .replace(/<<<?\w[\s\S]*?>>>?/g, '')
    // Strip markdown bold/italic: **text** or __text__ → text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Strip single emphasis: *text* or _text_ → text (but not mid-word underscores)
    .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    // Strip markdown headers: ## Header → Header
    .replace(/^#{1,6}\s+/gm, '')
    // Strip markdown horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Convert markdown bullet lists to plain dashes (keep structure readable)
    .replace(/^\*\s+/gm, '- ')
    // Clean up extra whitespace left by stripping
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---- Send Message ----

/**
 * Send a text message to a Telegram chat.
 *
 * Sanitises the text by stripping LLM artifacts (action blocks, markdown,
 * XML tool-call tags), splits it into chunks if it exceeds 4096 characters,
 * and sends each chunk as a separate message. Retries up to 3 times per
 * chunk on transient server errors (5xx). Returns the ID of the last
 * successfully sent message.
 *
 * @param chatId           - Telegram chat/user ID to send to
 * @param text             - Raw message text (will be sanitised)
 * @param replyToMessageId - Optional message ID to reply to (threaded reply)
 * @returns `{ messageId, success }` -- messageId is 0 on failure
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyToMessageId?: number,
): Promise<{ messageId: number; success: boolean }> {
  // Sanitize LLM output before sending
  const cleanText = sanitizeForTelegram(text) || 'Done.';

  // Telegram has a 4096 char limit per message — split if needed
  const chunks = splitMessage(cleanText, 4096);

  let lastMessageId = 0;
  for (const chunk of chunks) {
    const sent = await sendSingleChunk(chatId, chunk, replyToMessageId && chunk === chunks[0] ? replyToMessageId : undefined);
    if (!sent.success) {
      return { messageId: 0, success: false };
    }
    lastMessageId = sent.messageId;
  }

  return { messageId: lastMessageId, success: true };
}

/** Send a single message chunk — tries plain text (safe), no HTML parsing issues */
async function sendSingleChunk(
  chatId: string | number,
  text: string,
  replyToMessageId?: number,
): Promise<{ messageId: number; success: boolean }> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    // Use plain text — LLM output is not safe HTML
  };
  if (replyToMessageId) {
    body.reply_to_message_id = replyToMessageId;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
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
        // If reply_to caused a 400, retry without it
        if (res.status === 400 && body.reply_to_message_id && errText.includes('message to be replied not found')) {
          delete body.reply_to_message_id;
          continue;
        }
        // Other client errors (4xx) — don't retry
        if (res.status >= 400 && res.status < 500) {
          return { messageId: 0, success: false };
        }
        continue;
      }

      const data = await res.json() as { result?: { message_id: number } };
      return { messageId: data.result?.message_id || 0, success: true };
    } catch (err) {
      logger.warn({ err, chatId, attempt }, 'Telegram sendMessage attempt failed');
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  logger.error({ chatId }, 'Telegram sendMessage failed after 3 attempts');
  return { messageId: 0, success: false };
}

// ---- Edit Message ----

export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
): Promise<boolean> {
  if (!text?.trim()) return false;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // "message is not modified" is not a real error — text was the same
      if (errText.includes('message is not modified')) return true;
      logger.warn({ chatId, messageId, status: res.status, error: errText }, 'Telegram editMessageText failed');
      return false;
    }

    return true;
  } catch (err) {
    logger.warn({ err, chatId, messageId }, 'Telegram editMessageText failed');
    return false;
  }
}

// ---- Typing Indicator ----

export async function sendTelegramTyping(chatId: string | number): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best effort — don't log, don't throw
  }
}

// ---- Send Message with Inline Buttons ----

export async function sendTelegramButtons(
  chatId: string | number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
): Promise<{ messageId: number; success: boolean }> {
  const body = {
    chat_id: chatId,
    text: sanitizeForTelegram(text) || 'Choose an option:',
    reply_markup: {
      inline_keyboard: buttons,
    },
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Telegram sendButtons failed');
        if (res.status >= 400 && res.status < 500) {
          return { messageId: 0, success: false };
        }
        continue;
      }

      const data = await res.json() as { result?: { message_id: number } };
      return { messageId: data.result?.message_id || 0, success: true };
    } catch (err) {
      logger.warn({ err, chatId, attempt }, 'Telegram sendButtons attempt failed');
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  logger.error({ chatId }, 'Telegram sendButtons failed after 3 attempts');
  return { messageId: 0, success: false };
}

// ---- Answer Callback Query ----

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<boolean> {
  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  };
  if (text) body.text = text;

  try {
    const res = await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch (err) {
    logger.warn({ err, callbackQueryId }, 'Failed to answer callback query');
    return false;
  }
}

// ---- Get Telegram File URL ----

/**
 * Resolves a Telegram file_id to a public download URL.
 * Returns null if the file can't be resolved.
 */
export async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${encodeURIComponent(fileId)}`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as { ok: boolean; result?: { file_path: string } };
    if (!data.ok || !data.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${config.telegramBotToken}/${data.result.file_path}`;
  } catch {
    return null;
  }
}

/**
 * Downloads a Telegram file as a Buffer.
 */
export async function downloadTelegramFile(fileId: string): Promise<Buffer | null> {
  const url = await getTelegramFileUrl(fileId);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ---- Register Webhook ----

/**
 * Register the Telegram webhook URL with the Bot API.
 *
 * Calls the `setWebhook` endpoint with the provided URL, allowed
 * update types (`message`, `callback_query`), and the optional
 * `secret_token` for signature verification. Returns `false` if
 * the bot token is not configured or the API call fails.
 *
 * @param webhookUrl - Fully-qualified HTTPS URL for the webhook endpoint
 * @returns `true` if Telegram accepted the webhook, `false` otherwise
 */
export async function registerTelegramWebhook(webhookUrl: string): Promise<boolean> {
  if (!config.telegramBotToken) return false;

  try {
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
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

  // Register bot commands with Telegram (shown in command menu)
  await registerBotCommands();
}

// ---- Register Bot Commands ----

async function registerBotCommands(): Promise<void> {
  const commands = [
    { command: 'remind', description: 'Set a reminder — /remind call dentist Friday 3pm' },
    { command: 'note', description: 'Save a note — /note idea: new product feature' },
    { command: 'focus', description: 'Start focus session — /focus 45' },
    { command: 'habit', description: 'Log a habit — /habit morning-workout' },
    { command: 'brief', description: 'Get your daily briefing' },
    { command: 'search', description: 'Search everything — /search python' },
    { command: 'memory', description: 'Save a fact — /memory I prefer dark mode' },
    { command: 'help', description: 'Show all commands' },
    { command: 'credits', description: 'Check credit balance' },
    { command: 'status', description: 'Connection status' },
    { command: 'model', description: 'View or switch AI models' },
    { command: 'habits', description: 'View all habits with streaks' },
    { command: 'notes', description: 'View recent notes' },
    { command: 'expenses', description: 'Monthly expense report' },
  ];

  try {
    const res = await fetch(`${TELEGRAM_API}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ count: commands.length }, 'Telegram bot commands registered');
    } else {
      logger.warn({ error: data.description }, 'Failed to register Telegram bot commands');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to register Telegram bot commands');
  }
}

// ---- HTML Notification (for system-generated messages, NOT LLM output) ----

/** Escape user-provided strings for safe Telegram HTML */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Send a pre-formatted HTML notification. Caller must ensure safe HTML. */
export async function sendTelegramNotification(
  chatId: string | number,
  html: string,
): Promise<{ messageId: number; success: boolean }> {
  const chunks = splitMessage(html, 4096);
  let lastMessageId = 0;

  for (const chunk of chunks) {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
      parse_mode: 'HTML',
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Telegram notification failed');
          if (res.status >= 400 && res.status < 500) {
            return { messageId: 0, success: false };
          }
          continue;
        }

        const data = await res.json() as { result?: { message_id: number } };
        lastMessageId = data.result?.message_id || 0;
        break;
      } catch (err) {
        logger.warn({ err, chatId, attempt }, 'Telegram notification attempt failed');
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  return { messageId: lastMessageId, success: lastMessageId > 0 };
}

// ---- Send Photo ----

/**
 * Send an image to a Telegram chat by URL.
 * Telegram will fetch and display the image inline.
 */
export async function sendTelegramPhoto(
  chatId: string | number,
  photoUrl: string,
  caption?: string,
): Promise<{ messageId: number; success: boolean }> {
  // If photoUrl is a data: URI (base64 binary), use multipart upload
  if (photoUrl.startsWith('data:')) {
    const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      const [, mimeType, b64] = match;
      const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
      const buf = Buffer.from(b64, 'base64');
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('photo', new Blob([buf], { type: mimeType }), `screenshot.${ext}`);
      if (caption) form.append('caption', caption.slice(0, 1024));
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
            method: 'POST',
            body: form as unknown as BodyInit,
            signal: AbortSignal.timeout(60000),
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Telegram sendPhoto (multipart) failed');
            if (res.status >= 400 && res.status < 500) return { messageId: 0, success: false };
            continue;
          }
          const data = await res.json() as { result?: { message_id: number } };
          return { messageId: data.result?.message_id || 0, success: true };
        } catch (err) {
          logger.warn({ err, chatId, attempt }, 'Telegram sendPhoto (multipart) attempt failed');
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      return { messageId: 0, success: false };
    }
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
  };
  if (caption) body.caption = caption.slice(0, 1024); // Telegram caption max 1024 chars

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Telegram sendPhoto failed');
        if (res.status >= 400 && res.status < 500) {
          return { messageId: 0, success: false };
        }
        continue;
      }

      const data = await res.json() as { result?: { message_id: number } };
      return { messageId: data.result?.message_id || 0, success: true };
    } catch (err) {
      logger.warn({ err, chatId, attempt }, 'Telegram sendPhoto attempt failed');
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  logger.error({ chatId }, 'Telegram sendPhoto failed after 3 attempts');
  return { messageId: 0, success: false };
}

// ---- Send Video ----

/**
 * Send a video to a Telegram chat by URL.
 * Telegram will fetch and display the video inline.
 */
export async function sendTelegramVideo(
  chatId: string | number,
  videoUrl: string,
  caption?: string,
): Promise<{ messageId: number; success: boolean }> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    video: videoUrl,
  };
  if (caption) body.caption = caption.slice(0, 1024);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000), // videos can be slow
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Telegram sendVideo failed');
        if (res.status >= 400 && res.status < 500) {
          return { messageId: 0, success: false };
        }
        continue;
      }

      const data = await res.json() as { result?: { message_id: number } };
      return { messageId: data.result?.message_id || 0, success: true };
    } catch (err) {
      logger.warn({ err, chatId, attempt }, 'Telegram sendVideo attempt failed');
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  logger.error({ chatId }, 'Telegram sendVideo failed after 3 attempts');
  return { messageId: 0, success: false };
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
