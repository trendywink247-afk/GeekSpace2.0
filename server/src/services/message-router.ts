// ============================================================
// Unified Message Router
//
// Normalizes incoming messages from any channel (Telegram, WhatsApp,
// etc.) and routes them through the existing LLM pipeline.
//
// Flow: incoming message → resolve user → check credits →
//       build system prompt → routeChat() → send response back
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { routeChat, classifyIntent, deductSubscriptionCredits, type ChatMessage } from './llm.js';
import { buildMemoryContext, logConversation, extractMemories, getConversationContext } from './memory.js';
import { checkKeywordTriggers } from './automations-engine.js';
import { sendTelegramMessage } from './telegram.js';
import { getPersonalityPrompt, getPersonality } from '../prompts/personalities.js';
import { OPENCLAW_IDENTITY_COMPACT } from '../prompts/openclaw-system.js';

// ---- Types ----

interface NormalizedMessage {
  channel: 'telegram' | 'whatsapp';
  externalId: string;
  text: string;
  messageId?: string;
  senderName?: string;
  timestamp: string;
}

interface ChannelResponse {
  channel: string;
  externalId: string;
  text: string;
  replyToMessageId?: string;
}

interface ResolvedUser {
  userId: string;
  agentConfig: Record<string, unknown> | undefined;
  user: Record<string, unknown>;
  subscription: { credits_remaining: number; billing_cycle_end: string } | null;
}

// ---- User Resolution ----

function resolveUserFromChannel(channel: string, externalId: string): ResolvedUser | null {
  const link = db.prepare(
    'SELECT user_id FROM channel_links WHERE channel = ? AND external_id = ? AND is_verified = 1'
  ).get(channel, externalId) as { user_id: string } | undefined;

  if (!link) return null;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(link.user_id) as Record<string, unknown> | undefined;
  if (!user) return null;

  const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?')
    .get(link.user_id) as Record<string, unknown> | undefined;
  const subscription = db.prepare('SELECT credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?')
    .get(link.user_id) as { credits_remaining: number; billing_cycle_end: string } | null;

  return { userId: link.user_id, agentConfig, user, subscription };
}

// ---- Channel-Aware System Prompt ----

function buildChannelSystemPrompt(
  agentConfig: Record<string, unknown> | undefined,
  user: Record<string, unknown>,
  userId: string,
  channel: string,
  userMessage?: string,
): string {
  const personalityId = (agentConfig?.personality as string) || 'jarvis';
  const personalityPrompt = getPersonalityPrompt(personalityId);
  const agentName = (agentConfig?.name as string) || getPersonality(personalityId).name;
  const voice = (agentConfig?.voice as string) || 'friendly';
  const mode = (agentConfig?.mode as string) || 'builder';
  const userName = (user?.name as string) || 'there';
  const memoryBlock = buildMemoryContext(userId, userMessage);

  return `${OPENCLAW_IDENTITY_COMPACT}

--- PERSONALITY ---
${personalityPrompt}

--- USER SESSION ---
Agent name: ${agentName}. User: ${userName}. Voice: ${voice}. Mode: ${mode}.
Channel: ${channel}. This is a messaging app — keep responses SHORT and mobile-friendly.${memoryBlock}

IMPORTANT: Max 2-3 sentences for simple questions. No markdown formatting (no **, no ##, no bullet lists). Plain text only. Be concise.`;
}

// ---- Main Handler ----

export async function handleIncomingMessage(msg: NormalizedMessage): Promise<void> {
  const startTime = Date.now();

  // 1. Resolve user
  const resolved = resolveUserFromChannel(msg.channel, msg.externalId);

  if (!resolved) {
    await sendUnlinkedResponse(msg);
    return;
  }

  const { userId, agentConfig, user, subscription } = resolved;

  // 2. Check credits
  if (subscription && subscription.credits_remaining <= 0) {
    await sendChannelResponse({
      channel: msg.channel,
      externalId: msg.externalId,
      text: `You've used all your credits for this cycle. They reset on ${subscription.billing_cycle_end.split('T')[0]}.`,
      replyToMessageId: msg.messageId,
    });
    return;
  }

  // 3. Update last_message_at
  db.prepare('UPDATE channel_links SET last_message_at = ? WHERE channel = ? AND external_id = ?')
    .run(new Date().toISOString(), msg.channel, msg.externalId);

  // 4. Log user message + extract memories
  logConversation(userId, 'user', msg.text);
  extractMemories(userId, msg.text);

  // 5. Fire keyword automation triggers (non-blocking)
  checkKeywordTriggers(userId, msg.text).catch(() => {});

  // 6. Build messages for LLM
  const systemPrompt = buildChannelSystemPrompt(agentConfig, user, userId, msg.channel, msg.text);
  const history = getConversationContext(userId);
  const messages: ChatMessage[] = [...history, { role: 'user', content: msg.text }];
  const userCredits = (user?.credits as number) || 0;

  // 7. Route through LLM (same pipeline as web chat)
  const result = await routeChat(messages, {
    systemPrompt,
    agentName: (agentConfig?.name as string) || 'Geek',
    userCredits,
  });

  // 8. Log usage with correct channel
  db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai.chat')`).run(
    uuid(), userId, result.provider, result.model,
    result.tokensIn, result.tokensOut, result.creditCost, msg.channel,
  );

  // 9. Deduct credits
  if (result.creditCost > 0) {
    db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
  }
  deductSubscriptionCredits(userId, result.creditCost);

  // 10. Log assistant response
  logConversation(userId, 'assistant', result.reply, result.provider, result.model);

  // 11. Send response back through originating channel
  await sendChannelResponse({
    channel: msg.channel,
    externalId: msg.externalId,
    text: result.reply,
    replyToMessageId: msg.messageId,
  });

  logger.info({
    channel: msg.channel,
    userId,
    intent: result.intent,
    provider: result.provider,
    latencyMs: Date.now() - startTime,
    creditCost: result.creditCost,
  }, 'Channel message processed');
}

// ---- Channel Dispatchers ----

export async function sendChannelResponse(response: ChannelResponse): Promise<void> {
  switch (response.channel) {
    case 'telegram':
      await sendTelegramMessage(
        response.externalId,
        response.text,
        response.replyToMessageId ? parseInt(response.replyToMessageId, 10) : undefined,
      );
      break;
    // WhatsApp: to be added in future phase
    // case 'whatsapp':
    //   await sendWhatsAppMessage(response.externalId, response.text, response.replyToMessageId);
    //   break;
    default:
      logger.warn({ channel: response.channel }, 'Unknown channel for response dispatch');
  }
}

async function sendUnlinkedResponse(msg: NormalizedMessage): Promise<void> {
  const linkMessage = msg.channel === 'telegram'
    ? 'Hi! To use me, link your GeekSpace account first.\n\nUse /link <your-email> or go to your GeekSpace dashboard → Connections → Telegram.'
    : 'Hi! To use me, please link your account at your GeekSpace dashboard (Connections page).';

  await sendChannelResponse({
    channel: msg.channel,
    externalId: msg.externalId,
    text: linkMessage,
  });
}
