// ============================================================
// Custom Telegram Bot — Connect your own bot token
//
// Lets users bring their own Telegram bot instead of using
// the shared @agentinchatbot. Stores encrypted token, registers
// a per-user webhook, and routes incoming updates through the
// same message pipeline.
// ============================================================

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { db } from '../../../db/index.js';
import { config } from '../../../config.js';
import { logger } from '../../../logger.js';
import { encrypt, decrypt } from '../../../utils/encryption.js';
import {
  parseTelegramUpdate,
  type TelegramUpdate,
} from '../services/telegram.js';
import {
  handleIncomingMessage,
  type NormalizedMessage,
} from '../../../services/message-router.js';

export const customBotRouter = Router();

// ---- Helpers ----

/** Call a Telegram Bot API method using the given token. */
async function callTelegramApi(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; result?: Record<string, unknown>; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const options: RequestInit = { signal: AbortSignal.timeout(15000) };
  if (body) {
    options.method = 'POST';
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  return (await res.json()) as { ok: boolean; result?: Record<string, unknown>; description?: string };
}

/** Send a plain-text message via a custom bot token. */
async function sendViaCustomBot(
  botToken: string,
  chatId: string | number,
  text: string,
  replyToMessageId?: number,
): Promise<{ messageId: number; success: boolean }> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn({ chatId, status: res.status, error: errText, attempt }, 'Custom bot sendMessage failed');
        if (res.status === 400 && body.reply_to_message_id && errText.includes('message to be replied not found')) {
          delete body.reply_to_message_id;
          continue;
        }
        if (res.status >= 400 && res.status < 500) return { messageId: 0, success: false };
        continue;
      }
      const data = (await res.json()) as { result?: { message_id: number } };
      return { messageId: data.result?.message_id || 0, success: true };
    } catch (err) {
      logger.warn({ err, chatId, attempt }, 'Custom bot sendMessage attempt failed');
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { messageId: 0, success: false };
}

/** Build the per-user webhook URL for a custom bot. */
function webhookUrl(userId: string): string {
  return `${config.apiUrl}/api/integrations/telegram/custom/webhook/${userId}`;
}

// ================================================================
// 1. POST /connect — validate token, store encrypted, register webhook
// ================================================================

customBotRouter.post('/connect', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { botToken } = req.body as { botToken?: unknown };

  // ---- Input validation ----
  if (!botToken || typeof botToken !== 'string') {
    res.status(400).json({ error: 'botToken is required and must be a string.' });
    return;
  }

  // Telegram bot tokens look like  123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(botToken)) {
    res.status(400).json({ error: 'Invalid bot token format.' });
    return;
  }

  try {
    // ---- Validate token by calling getMe ----
    const meRes = await callTelegramApi(botToken, 'getMe');
    if (!meRes.ok || !meRes.result) {
      res.status(400).json({ error: 'Invalid bot token — Telegram rejected it.', details: meRes.description });
      return;
    }

    const botName = String(meRes.result.first_name || '');
    const botUsername = String(meRes.result.username || '');

    // ---- Register webhook ----
    const whUrl = webhookUrl(userId);
    const webhookRes = await callTelegramApi(botToken, 'setWebhook', {
      url: whUrl,
      allowed_updates: ['message', 'callback_query'],
      max_connections: 20,
    });

    if (!webhookRes.ok) {
      logger.warn({ userId, error: webhookRes.description }, 'Custom bot webhook registration failed');
      res.status(502).json({ error: 'Failed to register webhook with Telegram.', details: webhookRes.description });
      return;
    }

    // ---- Store encrypted token ----
    const tokenEncrypted = encrypt(botToken);

    const existing = db.prepare('SELECT id FROM custom_bot_tokens WHERE user_id = ?').get(userId) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        `UPDATE custom_bot_tokens
         SET token_encrypted = ?, bot_name = ?, bot_username = ?, updated_at = datetime('now')
         WHERE user_id = ?`
      ).run(tokenEncrypted, botName, botUsername, userId);
    } else {
      db.prepare(
        `INSERT INTO custom_bot_tokens (id, user_id, token_encrypted, bot_name, bot_username)
         VALUES (?, ?, ?, ?, ?)`
      ).run(uuid(), userId, tokenEncrypted, botName, botUsername);
    }

    // Also mark the telegram integration as connected (if row exists)
    db.prepare(
      "UPDATE integrations SET status = 'connected', health = 100, last_sync = datetime('now') WHERE user_id = ? AND type = 'telegram'"
    ).run(userId);

    // Log activity
    db.prepare(
      "INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Connected custom Telegram bot', ?, 'bot')"
    ).run(uuid(), userId, `@${botUsername}`);

    logger.info({ userId, botUsername }, 'Custom Telegram bot connected');

    res.json({ botName, botUsername, connected: true });
  } catch (err) {
    logger.error({ err, userId }, 'Custom bot connect failed');
    res.status(500).json({ error: 'Internal server error while connecting custom bot.' });
  }
});

// ================================================================
// 2. POST /webhook/:userId — receives Telegram updates (no auth)
// ================================================================

customBotRouter.post('/webhook/:userId', async (req, res) => {
  const { userId } = req.params;

  // Respond immediately — Telegram requires fast 200
  res.sendStatus(200);

  // Look up stored custom bot for this user
  const row = db.prepare(
    'SELECT token_encrypted, bot_username FROM custom_bot_tokens WHERE user_id = ?'
  ).get(userId) as { token_encrypted: string; bot_username: string } | undefined;

  if (!row) {
    logger.warn({ userId }, 'Custom bot webhook hit but no token stored — ignoring');
    return;
  }

  let botToken: string;
  try {
    botToken = decrypt(row.token_encrypted);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to decrypt custom bot token');
    return;
  }

  const update = req.body as TelegramUpdate;
  const requestId = uuid();

  logger.info({ requestId, userId, updateId: update.update_id }, 'Custom bot webhook received');

  // Skip bot messages to prevent loops
  if (update.message?.from?.is_bot === true) {
    logger.debug({ requestId }, 'Custom bot: skipping bot message');
    return;
  }

  // Skip oversized text
  if (update.message?.text && update.message.text.length > 8000) {
    logger.warn({ requestId, length: update.message.text.length }, 'Custom bot: skipping oversized message');
    return;
  }

  // Increment messages_handled counter
  db.prepare(
    "UPDATE custom_bot_tokens SET messages_handled = messages_handled + 1, updated_at = datetime('now') WHERE user_id = ?"
  ).run(userId);

  try {
    // Parse the update into a NormalizedMessage
    const parsed = parseTelegramUpdate(update);
    if (!parsed) {
      logger.debug({ requestId }, 'Custom bot: update has no parseable text message');
      return;
    }

    // Ensure the user has a channel_link for this chat so the message router
    // can resolve the user. Create/upsert one if needed.
    const chatId = String(update.message!.chat.id);
    const senderUsername = update.message!.from?.username || '';
    const existingLink = db.prepare(
      "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
    ).get(userId) as { id: string } | undefined;

    if (!existingLink) {
      db.prepare(
        `INSERT INTO channel_links (id, user_id, channel, external_id, external_username, is_verified)
         VALUES (?, ?, 'telegram', ?, ?, 1)`
      ).run(uuid(), userId, chatId, senderUsername);
    } else {
      // Update external_id in case the user is chatting from a different chat
      db.prepare(
        "UPDATE channel_links SET external_id = ?, last_message_at = datetime('now') WHERE user_id = ? AND channel = 'telegram'"
      ).run(chatId, userId);
    }

    // Build the normalized message with requestId for tracing
    const msg: NormalizedMessage = {
      channel: 'telegram',
      externalId: chatId,
      text: parsed.text,
      messageId: parsed.messageId,
      senderName: parsed.senderName,
      timestamp: parsed.timestamp,
      requestId,
    };

    // Send typing indicator via custom bot
    callTelegramApi(botToken, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

    // Route through the standard message pipeline.
    // The message router calls sendChannelResponse which uses the global bot.
    // We intercept by handling the message ourselves and sending the reply
    // via the custom bot token.
    //
    // Strategy: We use handleIncomingMessage which will process the message
    // and send the response via the main bot's sendTelegramMessage. For custom
    // bots we need to override this behavior. Since the message router is tightly
    // coupled to the global bot, we replicate the core flow here but route the
    // response through the user's custom bot token.
    //
    // For now, we use handleIncomingMessage directly. The response will go through
    // the standard Telegram channel (global bot). This is the simplest integration
    // that still routes through the full AI pipeline. A future enhancement can
    // intercept the response and send it via the custom bot instead.
    //
    // NOTE: The response goes out via the user's custom bot because the
    // channel_link.external_id points to the chat opened with the custom bot.
    // When sendChannelResponse calls sendTelegramMessage with that chat_id,
    // it uses the GLOBAL bot token. To truly send via the custom bot, we need
    // to intercept. We do this with a post-processing hook pattern:
    // We capture the conversation log after handleIncomingMessage completes
    // and send the latest assistant reply via the custom bot.

    // Save current latest assistant message count
    const beforeCount = (db.prepare(
      "SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'assistant'"
    ).get(userId) as { c: number }).c;

    await handleIncomingMessage(msg);

    // Check if a new assistant message was logged
    const latestAssistant = db.prepare(
      "SELECT content FROM conversation_log WHERE user_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
    ).get(userId) as { content: string } | undefined;

    const afterCount = (db.prepare(
      "SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'assistant'"
    ).get(userId) as { c: number }).c;

    // If a new assistant message was generated, also send it via the custom bot
    if (latestAssistant && afterCount > beforeCount) {
      await sendViaCustomBot(
        botToken,
        chatId,
        latestAssistant.content,
        update.message?.message_id,
      );
    }
  } catch (err) {
    logger.error({ err, requestId, userId }, 'Custom bot webhook processing failed');
  }
});

// ================================================================
// 3. GET /status — connection status for the current user
// ================================================================

customBotRouter.get('/status', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const row = db.prepare(
    'SELECT bot_name, bot_username, messages_handled, created_at, updated_at FROM custom_bot_tokens WHERE user_id = ?'
  ).get(userId) as { bot_name: string; bot_username: string; messages_handled: number; created_at: string; updated_at: string } | undefined;

  if (!row) {
    res.json({ connected: false, botName: null, botUsername: null, messagesHandled: 0 });
    return;
  }

  res.json({
    connected: true,
    botName: row.bot_name,
    botUsername: row.bot_username,
    messagesHandled: row.messages_handled,
    connectedAt: row.created_at,
    lastActivity: row.updated_at,
  });
});

// ================================================================
// 4. DELETE /disconnect — remove webhook, clear stored token
// ================================================================

customBotRouter.delete('/disconnect', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const row = db.prepare(
    'SELECT id, token_encrypted, bot_username FROM custom_bot_tokens WHERE user_id = ?'
  ).get(userId) as { id: string; token_encrypted: string; bot_username: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'No custom bot connected.' });
    return;
  }

  try {
    // Decrypt token to remove webhook
    const botToken = decrypt(row.token_encrypted);

    // Remove webhook from Telegram
    const delRes = await callTelegramApi(botToken, 'deleteWebhook', { drop_pending_updates: true });
    if (!delRes.ok) {
      logger.warn({ userId, error: delRes.description }, 'Failed to delete custom bot webhook (proceeding with disconnect)');
    }
  } catch (err) {
    // Even if decryption/webhook removal fails, still clean up local state
    logger.warn({ err, userId }, 'Error during custom bot webhook removal (proceeding with disconnect)');
  }

  // Remove stored token in a transaction
  const doDisconnect = db.transaction(() => {
    db.prepare('DELETE FROM custom_bot_tokens WHERE user_id = ?').run(userId);
    db.prepare(
      "INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Disconnected custom Telegram bot', ?, 'bot')"
    ).run(uuid(), userId, `@${row.bot_username}`);
  });
  doDisconnect();

  logger.info({ userId, botUsername: row.bot_username }, 'Custom Telegram bot disconnected');

  res.json({ disconnected: true });
});
