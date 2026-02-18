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
  type TelegramUpdate,
} from '../services/telegram.js';
import { handleIncomingMessage, sendChannelResponse } from '../services/message-router.js';
import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';

export const webhooksRouter = Router();

// ================================================================
// TELEGRAM WEBHOOK
// ================================================================

webhooksRouter.post('/telegram', async (req, res) => {
  // Verify secret token — reject if secret not configured (secure by default)
  if (!config.telegramWebhookSecret) {
    logger.warn('Telegram webhook: no secret configured, rejecting');
    res.sendStatus(401);
    return;
  }
  const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string;
  if (!verifyTelegramWebhook(secretToken)) {
    logger.warn('Telegram webhook: invalid secret token');
    res.sendStatus(403);
    return;
  }

  // Respond immediately — Telegram requires fast 200
  res.sendStatus(200);

  const update = req.body as TelegramUpdate;

  try {
    // Handle bot commands first
    const command = extractBotCommand(update);
    if (command) {
      await handleTelegramCommand(command, update);
      return;
    }

    // Handle regular text messages
    const normalized = parseTelegramUpdate(update);
    if (normalized) {
      await handleIncomingMessage(normalized);
    }
  } catch (err) {
    logger.error({ err, updateId: update.update_id }, 'Telegram webhook processing error');
  }
});

// ---- Telegram Bot Command Handler ----

async function handleTelegramCommand(
  cmd: { command: string; args: string },
  update: TelegramUpdate,
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
          `Hi! I'm your GeekSpace AI assistant.\n\n` +
          `To get started, link your account:\n` +
          `1. Go to your GeekSpace dashboard → Connections\n` +
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
        '1. Go to your GeekSpace dashboard → Connections\n' +
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

      await sendTelegramMessage(chatId, 'Account unlinked. To re-link, go to your GeekSpace dashboard → Connections → Telegram.');
      break;
    }

    case '/credits': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Link your account first — go to your GeekSpace dashboard → Connections → Telegram.');
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
        `GeekSpace Bot Commands:\n\n` +
        `/start — Get started\n` +
        `/link — Link your GeekSpace account\n` +
        `/unlink — Unlink your account\n` +
        `/credits — Check credit balance\n` +
        `/status — Connection status\n` +
        `/help — Show this message\n\n` +
        `Or just type a message to chat with your AI agent!`
      );
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
    await sendTelegramMessage(chatId, 'This Telegram account is already linked to a GeekSpace account.');
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
  // Verify n8n webhook secret if configured
  if (config.n8nWebhookSecret) {
    const secret = req.headers['x-n8n-secret'] as string;
    if (secret !== config.n8nWebhookSecret) {
      logger.warn('n8n webhook: invalid or missing secret');
      res.sendStatus(401);
      return;
    }
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
