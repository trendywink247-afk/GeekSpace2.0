// ============================================================
// Webhook Routes — Telegram Bot + n8n Callbacks
//
// These are UNAUTHENTICATED endpoints called by external services.
// Each has its own verification mechanism.
// ============================================================

import { Router } from 'express';
import { config } from '../config.js';
import { logger } from '../logger.js';
import {
  verifyTelegramWebhook,
  parseTelegramUpdate,
  extractBotCommand,
  sendTelegramMessage,
  getBotUsername,
  answerCallbackQuery,
  type TelegramUpdate,
} from '../services/telegram.js';
import { handleIncomingMessage, sendChannelResponse } from '../services/message-router.js';
import {
  getOrCreateOnboarding,
  handleOnboardingCallback,
  startOnboarding,
} from '../services/onboarding.js';
import { v4 as uuid } from 'uuid';
import {
  isVoiceEnabled,
  downloadTelegramVoice,
  transcribeVoice,
  textToSpeech,
  sendTelegramVoice,
  voiceCreditCost,
} from '../services/voice.js';
import { db } from '../db/index.js';
import { cacheGet, cacheSet } from '../services/cache.js';
import { handleEscalationReply } from '../services/escalation.js';

// Extend Express Request to include requestId for pipeline tracing
interface RequestWithId {
  requestId: string;
}

export const webhooksRouter = Router();

// ================================================================
// TELEGRAM WEBHOOK
// ================================================================

webhooksRouter.post('/telegram', async (req, res) => {
  // Generate request-id for tracing this message through the pipeline
  const requestId = uuid();
  (req as RequestWithId).requestId = requestId;

  // Verify secret token — reject if secret not configured (secure by default)
  if (!config.telegramWebhookSecret) {
    logger.warn({ requestId }, 'Telegram webhook: no secret configured, rejecting');
    res.sendStatus(401);
    return;
  }
  const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string;
  if (!verifyTelegramWebhook(secretToken)) {
    logger.warn({ requestId }, 'Telegram webhook: invalid secret token');
    res.sendStatus(403);
    return;
  }

  // Respond immediately — Telegram requires fast 200
  res.sendStatus(200);

  const update = req.body as TelegramUpdate;

  // Per-chat rate limiting — max 20 requests / 60s per chat_id
  // Must happen after 200 response (Telegram needs instant ACK)
  const rlChatId = String(
    update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? 'unknown'
  );
  try {
    const rlKey = `telegram:ratelimit:${rlChatId}`;
    const rlCount = Number(await cacheGet(rlKey) || 0) + 1;
    await cacheSet(rlKey, String(rlCount), 60);
    if (rlCount > 20) {
      logger.warn({ requestId, chatId: rlChatId, count: rlCount }, 'Telegram rate limit exceeded — dropping update');
      return;
    }
  } catch {
    // Redis unavailable — allow request through, do not block
  }

  logger.info({ requestId, updateId: update.update_id }, 'Telegram webhook received');

  // ── Bot-message filter (7.2) ─────────────────────────────────────────────
  // Skip messages from bots to prevent feedback loops and spam
  if (update.message?.from?.is_bot === true) {
    logger.info({ requestId, updateId: update.update_id }, 'Telegram webhook: skipping bot message');
    return;
  }

  // Skip oversized text to prevent abuse / prompt injection via huge payloads
  if (update.message?.text && update.message.text.length > 8000) {
    logger.warn({ requestId, updateId: update.update_id, length: update.message.text.length }, 'Telegram webhook: skipping oversized message');
    return;
  }

  try {
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;

    // Handle callback queries (button clicks) first
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const callbackChatId = String(update.callback_query.message?.chat?.id);
      const callbackQueryId = update.callback_query.id;

      if (callbackData && callbackChatId) {
        // Answer the callback query immediately
        await answerCallbackQuery(callbackQueryId);

        // Try to handle as onboarding callback
        const handled = await handleOnboardingCallback(callbackChatId, callbackData);
        if (handled) {
          return; // Onboarding handled it
        }

        // Otherwise, it's a regular action chip - handle accordingly
        logger.info({ callbackData, chatId: callbackChatId }, 'Unhandled callback query');
      }
      return;
    }

    // Handle bot commands first
    const command = extractBotCommand(update);
    if (command) {
      // Special handling for /start command - begin onboarding
      if (command.command === 'start') {
        await startOnboarding(String(chatId));
        return;
      }
      await handleTelegramCommand(command, update, requestId);
      return;
    }

    // Check if user is in onboarding mode
    if (chatId) {
      const session = getOrCreateOnboarding(String(chatId));
      if (session.state !== 'complete' && session.state !== 'welcome') {
        // User is in onboarding but sent a text message instead of clicking buttons
        await sendTelegramMessage(chatId,
          "Please use the buttons above to continue setup, or type /start to restart."
        );
        return;
      }
    }

    // Handle voice messages
    if (update.message?.voice) {
      await handleVoiceMessage(update, requestId);
      return;
    }

    // Handle regular text messages
    // Extract native reply context BEFORE parsing normalized message
    const replyToMessageId = update.message?.reply_to_message?.message_id;
    const normalized = parseTelegramUpdate(update);
    if (normalized) {
      // Check if this is a reply to an escalation before normal routing
      const escalationHandled = await handleEscalationReply(normalized.externalId, normalized.text, replyToMessageId);
      if (escalationHandled) return;

      await handleIncomingMessage({ ...normalized, requestId });

      // After handling, send action chips for agentic feel
      // This happens asynchronously after the main response
      setTimeout(async () => {
        try {
          const { sendActionChips } = await import('../services/onboarding.js');
          await sendActionChips(normalized.externalId);
        } catch {
          // Non-fatal
        }
      }, 2000);
    }
  } catch (err) {
    logger.error({ err, updateId: update.update_id, requestId }, 'Telegram webhook processing error');
  }
});

// ---- Telegram Voice Message Handler ----

async function handleVoiceMessage(update: TelegramUpdate, requestId: string): Promise<void> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const voice = msg.voice!;

  // Check if voice is enabled
  if (!isVoiceEnabled()) {
    await sendTelegramMessage(chatId, 'Voice notes are not enabled yet. Please send a text message instead.');
    return;
  }

  // Reject voice notes longer than 5 minutes (cost/abuse guard)
  if (voice.duration > 300) {
    await sendTelegramMessage(chatId, 'Voice note too long (max 5 minutes). Please send a shorter message.');
    return;
  }

  // Check if user is linked
  const link = db.prepare(
    "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
  ).get(String(chatId)) as { user_id: string } | undefined;

  if (!link) {
    await sendTelegramMessage(chatId,
      'Link your account first to use voice notes. Go to your Agentin dashboard → Connections → Telegram.');
    return;
  }

  // Check credits (voice costs extra)
  const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?')
    .get(link.user_id) as { credits_remaining: number } | undefined;

  if (sub && sub.credits_remaining < 10) {
    await sendTelegramMessage(chatId, 'Not enough credits for voice processing. Voice notes require extra credits for transcription.');
    return;
  }

  // Voice transcription is coming soon — return early with helpful message
  await sendTelegramMessage(chatId, 'Voice notes are coming soon. For now, please type your message. 🎙️');
  return;

  try {
    // 1. Download voice file from Telegram
    logger.info({ chatId, duration: voice.duration, fileId: voice.file_id }, 'Processing voice message');
    const audioBuffer = await downloadTelegramVoice(voice.file_id);

    // 2. Transcribe with Whisper
    const transcribedText = await transcribeVoice(audioBuffer, voice.mime_type || 'audio/ogg');

    if (!transcribedText || transcribedText.trim().length === 0) {
      await sendTelegramMessage(chatId, "I couldn't understand that voice note. Could you try again or type your message?");
      return;
    }

    logger.info({ chatId, duration: voice.duration, textLength: transcribedText.length }, 'Voice transcribed');

    // 3. Route transcribed text through normal message handler (captures the reply)
    // We need the reply text to convert to voice, so we intercept the flow
    const normalized = {
      channel: 'telegram' as const,
      externalId: String(chatId),
      text: transcribedText,
      messageId: String(msg.message_id),
      senderName: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '),
      timestamp: new Date(msg.date * 1000).toISOString(),
      requestId,
    };

    // Use handleIncomingMessage which sends the text reply automatically
    await handleIncomingMessage(normalized);

    // 4. Get the agent's reply from conversation log to generate voice
    const lastReply = db.prepare(
      "SELECT content FROM conversations WHERE user_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
    ).get(link.user_id) as { content: string } | undefined;

    if (lastReply?.content) {
      try {
        // 5. Convert reply to speech and send as voice note
        const speechBuffer = await textToSpeech(lastReply.content);
        await sendTelegramVoice(chatId, speechBuffer, msg.message_id);

        // 6. Deduct extra voice credits
        const extraCredits = voiceCreditCost(voice.duration, lastReply.content.length);
        db.prepare('UPDATE subscriptions SET credits_remaining = MAX(0, credits_remaining - ?) WHERE user_id = ?')
          .run(extraCredits, link.user_id);

        logger.info({ chatId, extraCredits, duration: voice.duration }, 'Voice reply sent');
      } catch (ttsErr) {
        // TTS failed — text reply was already sent, just log
        logger.warn({ err: (ttsErr as Error).message }, 'TTS failed, text reply already sent');
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err: errMsg, chatId }, 'Voice message processing failed');
    await sendTelegramMessage(chatId, "Sorry, I couldn't process that voice note. Please try again or send a text message.");
  }
}

// ---- Telegram Bot Command Handler ----

async function handleTelegramCommand(
  cmd: { command: string; args: string },
  update: TelegramUpdate,
  requestId: string,
): Promise<void> {
  const chatId = update.message!.chat.id;
  const fromId = update.message!.from.id;
  const fromUsername = update.message!.from.username || '';

  switch (cmd.command) {
    case '/start': {
      // Deep link: /start link_XXXXXX
      if (cmd.args.startsWith('link_')) {
        const code = cmd.args.slice(5).toUpperCase();
        await handleLinkCode(chatId, String(fromId), fromUsername, code);
        return;
      }

      // Regular start
      const linked = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (linked) {
        const user = db.prepare('SELECT name FROM users WHERE id = ?').get(linked.user_id) as { name: string } | undefined;
        await sendTelegramMessage(chatId,
          `Welcome back, ${user?.name || 'there'}! Just type a message to chat with your AI agent.\n\n` +
          `Commands:\n/help — Show available commands\n/credits — Check credit balance\n/status — Connection status`
        );
      } else {
        await sendTelegramMessage(chatId,
          `Hi! I'm your Agentin AI assistant.\n\n` +
          `To get started, link your account:\n` +
          `1. Go to your Agentin dashboard → Connections\n` +
          `2. Click "Connect" on Telegram\n` +
          `3. Follow the instructions\n\n` +
          `Or use /link for instructions.`
        );
      }
      break;
    }

    case '/link': {
      // Direct email linking removed for security — use link code flow instead
      await sendTelegramMessage(chatId,
        'To link your account:\n' +
        '1. Go to your Agentin dashboard → Connections\n' +
        '2. Click "Connect" on Telegram\n' +
        '3. Click the link code to open this bot\n\n' +
        'This generates a secure one-time code that expires in 10 minutes.'
      );
      break;
    }

    case '/unlink': {
      const link = db.prepare(
        "SELECT id, user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { id: string; user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'No linked account found.');
        return;
      }

      db.prepare('DELETE FROM channel_links WHERE id = ?').run(link.id);
      db.prepare(
        "UPDATE integrations SET status = 'disconnected', health = 0 WHERE user_id = ? AND type = 'telegram'"
      ).run(link.user_id);

      await sendTelegramMessage(chatId, 'Account unlinked. To re-link, go to your Agentin dashboard → Connections → Telegram.');
      break;
    }

    case '/credits': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Link your account first — go to your Agentin dashboard → Connections → Telegram.');
        return;
      }

      const sub = db.prepare(
        'SELECT plan, credits_remaining, credits_used_this_cycle, billing_cycle_end FROM subscriptions WHERE user_id = ?'
      ).get(link.user_id) as { plan: string; credits_remaining: number; credits_used_this_cycle: number; billing_cycle_end: string } | undefined;

      if (sub) {
        await sendTelegramMessage(chatId,
          `Plan: ${sub.plan}\nCredits remaining: ${sub.credits_remaining.toLocaleString()}\nUsed this cycle: ${sub.credits_used_this_cycle.toLocaleString()}\nResets: ${sub.billing_cycle_end.split('T')[0]}`
        );
      } else {
        const user = db.prepare('SELECT credits, plan FROM users WHERE id = ?').get(link.user_id) as { credits: number; plan: string };
        await sendTelegramMessage(chatId, `Plan: ${user.plan}\nCredits: ${user.credits.toLocaleString()}`);
      }
      break;
    }

    case '/status': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Not linked. Use /link <email> to connect.');
        return;
      }

      const user = db.prepare('SELECT name, username FROM users WHERE id = ?').get(link.user_id) as { name: string; username: string };
      const agentConfig = db.prepare('SELECT name, personality, mode FROM agent_configs WHERE user_id = ?').get(link.user_id) as { name: string; personality: string; mode: string } | undefined;

      await sendTelegramMessage(chatId,
        `Connected as: ${user.name} (@${user.username})\nAgent: ${agentConfig?.name || 'Geek'}\nPersonality: ${agentConfig?.personality || 'jarvis'}\nMode: ${agentConfig?.mode || 'builder'}`
      );
      break;
    }

    case '/help': {
      await sendTelegramMessage(chatId,
        `Agentin Bot Commands:\n\n` +
        `/start — Get started\n` +
        `/link — Link your Agentin account\n` +
        `/unlink — Unlink your account\n` +
        `/credits — Check credit balance\n` +
        `/model — View and switch AI models\n` +
        `/status — Connection status\n` +
        `/tasks — View recent tasks\n` +
        `/agents — List your agents\n` +
        `/cancel — Cancel a queued task\n` +
        `/remind <text> — Set a quick reminder\n` +
        `/deploy — Deploy your portfolio\n` +
        `/help — Show this message\n\n` +
        `Or just type a message to chat with your AI agent!`
      );
      break;
    }

    case '/tasks': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      const tasks = db.prepare(`
        SELECT task_type, description, status, completed_at, created_at
        FROM pico_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
      `).all(link.user_id) as Array<{ task_type: string; description: string; status: string; completed_at: string | null; created_at: string }>;

      if (tasks.length === 0) {
        await sendTelegramMessage(chatId, 'No tasks yet. Send a message like "remind me to check email at 5pm" to create one.');
        return;
      }

      const statusEmoji: Record<string, string> = { completed: '✅', running: '⏳', queued: '🔵', failed: '❌', cancelled: '⛔' };
      const lines = tasks.map((t, i) => {
        const emoji = statusEmoji[t.status] || '⚪';
        const desc = t.description.length > 50 ? t.description.slice(0, 50) + '...' : t.description;
        return `${i + 1}. ${emoji} ${desc}`;
      });
      await sendTelegramMessage(chatId, `Recent tasks:\n\n${lines.join('\n')}`);
      break;
    }

    case '/agents': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      const agents = db.prepare(
        'SELECT slot, name, personality, status, tasks_completed, tasks_failed FROM pico_agents WHERE user_id = ? ORDER BY slot'
      ).all(link.user_id) as Array<{ slot: number; name: string; personality: string; status: string; tasks_completed: number; tasks_failed: number }>;

      if (agents.length === 0) {
        await sendTelegramMessage(chatId, 'No agents deployed yet.');
        return;
      }

      const personalityEmoji: Record<string, string> = { edith: '⚡', jarvis: '🎩', weebo: '🤖' };
      const lines = agents.map(a => {
        const emoji = personalityEmoji[a.personality] || '🤖';
        return `${emoji} Slot ${a.slot}: ${a.name} (${a.personality}) — ${a.status}\n   ✅ ${a.tasks_completed} done, ❌ ${a.tasks_failed} failed`;
      });
      await sendTelegramMessage(chatId, `Your agents:\n\n${lines.join('\n\n')}`);
      break;
    }

    case '/cancel': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      const queued = db.prepare(
        "SELECT id, description FROM pico_tasks WHERE user_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1"
      ).get(link.user_id) as { id: string; description: string } | undefined;

      if (!queued) {
        await sendTelegramMessage(chatId, 'No queued tasks to cancel.');
        return;
      }

      db.prepare("UPDATE pico_tasks SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(queued.id);
      await sendTelegramMessage(chatId, `Cancelled: ${queued.description.slice(0, 80)}`);
      break;
    }

    case '/remind': {
      if (!cmd.args.trim()) {
        await sendTelegramMessage(chatId, 'Usage: /remind <text>\nExample: /remind check email in 30 minutes');
        return;
      }

      // Treat as a regular message so it goes through task auto-detection
      const normalized = parseTelegramUpdate(update);
      if (normalized) {
        // Override the text to prepend "remind me" if not already there
        if (!normalized.text.toLowerCase().startsWith('remind')) {
          normalized.text = `remind me ${cmd.args}`;
        } else {
          normalized.text = cmd.args;
        }
        await handleIncomingMessage({ ...normalized, requestId });
      }
      break;
    }

    case '/deploy': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      // Deploy portfolio
      db.prepare('UPDATE portfolios SET is_public = 1 WHERE user_id = ?').run(link.user_id);
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(link.user_id) as { username: string } | undefined;
      const url = user ? `https://ai.agentin.chat/${user.username}` : 'your dashboard';
      await sendTelegramMessage(chatId, `Portfolio deployed! View it at ${url}`);
      break;
    }

    case '/model': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.');
        return;
      }

      // Get available models
      const models = db.prepare(`
        SELECT id, display_name, summary, status FROM free_models
        WHERE status IN ('active', 'new') ORDER BY curated DESC, context_length DESC
      `).all() as Array<{ id: string; display_name: string; summary: string; status: string }>;

      if (models.length === 0) {
        await sendTelegramMessage(chatId, 'No free models available right now. Check back later.');
        return;
      }

      // Get user's current preference
      const agentCfg = db.prepare('SELECT preferred_free_model FROM agent_configs WHERE user_id = ?')
        .get(link.user_id) as { preferred_free_model: string | null } | undefined;
      const currentPref = agentCfg?.preferred_free_model || 'auto';

      if (!cmd.args.trim()) {
        // List all models
        const lines = models.map((m, i) => {
          const check = m.id === currentPref ? ' ✅' : '';
          const badge = m.status === 'new' ? ' 🆕' : '';
          return `${i + 1}. ${m.display_name}${badge}${check}\n   ${m.summary}`;
        });

        const autoCheck = currentPref === 'auto' ? ' ✅' : '';
        await sendTelegramMessage(chatId,
          `🤖 Available Free Models:\n\n` +
          `0. Auto-select${autoCheck}\n   Let the system pick the best model\n\n` +
          `${lines.join('\n\n')}\n\n` +
          `Reply /model <number> to switch, or /model auto`
        );
        return;
      }

      // Handle /model auto
      if (cmd.args.trim().toLowerCase() === 'auto') {
        db.prepare("UPDATE agent_configs SET preferred_free_model = 'auto' WHERE user_id = ?").run(link.user_id);
        await sendTelegramMessage(chatId, '✅ Switched to auto-select. The system will pick the best available model.');
        return;
      }

      // Handle /model <number>
      const num = parseInt(cmd.args.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= models.length) {
        const chosen = models[num - 1];
        db.prepare('UPDATE agent_configs SET preferred_free_model = ? WHERE user_id = ?').run(chosen.id, link.user_id);
        await sendTelegramMessage(chatId, `✅ Switched to ${chosen.display_name}.\n${chosen.summary}`);
        return;
      }

      // Handle /model <partial name>
      const search = cmd.args.trim().toLowerCase();
      const match = models.find(m =>
        m.display_name.toLowerCase().includes(search) ||
        m.id.toLowerCase().includes(search)
      );

      if (match) {
        db.prepare('UPDATE agent_configs SET preferred_free_model = ? WHERE user_id = ?').run(match.id, link.user_id);
        await sendTelegramMessage(chatId, `✅ Switched to ${match.display_name}.\n${match.summary}`);
      } else {
        await sendTelegramMessage(chatId, `Model not found: "${cmd.args.trim()}"\nUse /model to see available models.`);
      }
      break;
    }

    default: {
      // Unknown command — treat as regular message
      const normalized = parseTelegramUpdate(update);
      if (normalized) {
        await handleIncomingMessage(normalized);
      }
      break;
    }
  }
}


// ---- Link Code Handler ----

async function handleLinkCode(
  chatId: number,
  telegramId: string,
  telegramUsername: string,
  code: string,
): Promise<void> {
  // Look up the code
  const linkCode = db.prepare(
    "SELECT user_id, channel FROM link_codes WHERE code = ? AND channel = 'telegram' AND expires_at > datetime('now')"
  ).get(code) as { user_id: string; channel: string } | undefined;

  if (!linkCode) {
    await sendTelegramMessage(chatId, 'Invalid or expired link code. Please generate a new one from your dashboard.');
    return;
  }

  // Check if already linked
  const existing = db.prepare(
    "SELECT id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
  ).get(telegramId);

  if (existing) {
    await sendTelegramMessage(chatId, 'This Telegram account is already linked to an Agentin account.');
    // Clean up the code
    db.prepare('DELETE FROM link_codes WHERE code = ?').run(code);
    return;
  }

  // Create the link
  db.prepare(
    'INSERT INTO channel_links (id, user_id, channel, external_id, external_username) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), linkCode.user_id, 'telegram', telegramId, telegramUsername);

  // Update integrations table
  db.prepare(
    "UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE user_id = ? AND type = 'telegram'"
  ).run(new Date().toISOString(), linkCode.user_id);

  // Delete the used code
  db.prepare('DELETE FROM link_codes WHERE code = ?').run(code);

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(linkCode.user_id) as { name: string };

  await sendTelegramMessage(chatId,
    `Account linked successfully! Welcome, ${user.name}.\n\nYou can now chat with your AI agent right here. Just type a message!`
  );
}

// ================================================================
// N8N CALLBACK WEBHOOK
// ================================================================

webhooksRouter.post('/n8n/callback', async (req, res) => {
  // Require n8n webhook secret — reject if not configured or mismatch
  if (!config.n8nWebhookSecret) {
    logger.warn('n8n webhook: N8N_WEBHOOK_SECRET not configured — rejecting request');
    res.status(503).json({ error: 'n8n webhook not configured' });
    return;
  }
  const secret = req.headers['x-n8n-secret'] as string;
  if (secret !== config.n8nWebhookSecret) {
    logger.warn('n8n webhook: invalid or missing secret');
    res.sendStatus(401);
    return;
  }

  const { userId, channel, externalId, message } = req.body;

  if (!userId || !channel || !externalId || !message) {
    res.status(400).json({ error: 'Missing required fields: userId, channel, externalId, message' });
    return;
  }

  try {
    await sendChannelResponse({
      channel,
      externalId,
      text: message,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId, channel }, 'n8n callback relay failed');
    res.status(500).json({ error: 'Failed to relay message' });
  }
});

// ================================================================
// WHATSAPP WEBHOOK
// ================================================================

webhooksRouter.post('/whatsapp', async (req, res) => {
  // Verify webhook signature if configured
  const signature = req.headers['x-whatsapp-signature'] as string;
  const body = JSON.stringify(req.body);

  const { verifyWhatsAppWebhook } = await import('../services/whatsapp.js');
  if (!verifyWhatsAppWebhook(signature, body)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  try {
    const { entry } = req.body;

    // Process incoming WhatsApp messages
    if (entry && entry.length > 0) {
      for (const e of entry) {
        if (e.changes) {
          for (const change of e.changes) {
            if (change.value?.messages) {
              for (const message of change.value.messages) {
                // Handle LINK command for account linking
                if (message.text?.body?.startsWith('LINK ')) {
                  const code = message.text.body.slice(5).trim();
                  await handleWhatsAppLinkCode(
                    message.from,
                    change.value.contacts?.[0]?.profile?.name || '',
                    code
                  );
                } else {
                  // Regular message - route through message router
                  const normalized = {
                    channel: 'whatsapp' as const,
                    externalId: message.from,
                    text: message.text?.body || '',
                    messageId: message.id,
                    senderName: change.value.contacts?.[0]?.profile?.name || '',
                    timestamp: new Date(message.timestamp * 1000).toISOString(),
                  };
                  await handleIncomingMessage(normalized);
                }
              }
            }
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'WhatsApp webhook processing error');
    res.status(500).json({ error: 'Processing failed' });
  }
});

async function handleWhatsAppLinkCode(
  phoneNumber: string,
  name: string,
  code: string,
): Promise<void> {
  // Look up the code
  const linkCode = db.prepare(
    "SELECT user_id FROM link_codes WHERE code = ? AND channel = 'whatsapp' AND expires_at > datetime('now')"
  ).get(code) as { user_id: string } | undefined;

  if (!linkCode) {
    // Send error message via WhatsApp (would need actual API integration)
    logger.warn({ phoneNumber, code }, 'Invalid or expired WhatsApp link code');
    return;
  }

  // Check if already linked
  const existing = db.prepare(
    "SELECT id FROM channel_links WHERE channel = 'whatsapp' AND external_id = ?"
  ).get(phoneNumber);

  if (existing) {
    logger.info({ phoneNumber }, 'WhatsApp account already linked');
    return;
  }

  // Create the link
  db.prepare(
    'INSERT INTO channel_links (id, user_id, channel, external_id, external_username) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), linkCode.user_id, 'whatsapp', phoneNumber, name);

  // Update integrations table
  db.prepare(
    "UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE user_id = ? AND type = 'whatsapp'"
  ).run(new Date().toISOString(), linkCode.user_id);

  // Delete the used code
  db.prepare('DELETE FROM link_codes WHERE code = ?').run(code);

  logger.info({ userId: linkCode.user_id, phoneNumber }, 'WhatsApp account linked');
}
