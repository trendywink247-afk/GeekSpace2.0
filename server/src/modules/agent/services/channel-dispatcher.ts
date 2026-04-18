/**
 * Channel dispatcher — resolves users from external channels and sends responses.
 *
 * Extracted from message-router.ts. Exports:
 * - resolveUserFromChannel() — look up Agentin user from channel link
 * - sendChannelResponse() — dispatch reply back to originating channel
 * - sendUnlinkedResponse() — send account linking instructions
 *
 * @module services/channel-dispatcher
 */

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { sendTelegramMessage } from '../../../services/telegram.js';

// ── Types ───────────────────────────────────────────────────

export interface ChannelResponse {
  channel: string;
  externalId: string;
  text: string;
  replyToMessageId?: string;
}

export interface ResolvedUser {
  userId: string;
  agentConfig: Record<string, unknown> | undefined;
  user: Record<string, unknown>;
  subscription: { credits_remaining: number; billing_cycle_end: string } | null;
}

// ── User Resolution ─────────────────────────────────────────

export function resolveUserFromChannel(channel: string, externalId: string): ResolvedUser | null {
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

// ── Channel Dispatchers ─────────────────────────────────────

export async function sendChannelResponse(response: ChannelResponse): Promise<void> {
  switch (response.channel) {
    case 'telegram':
      await sendTelegramMessage(
        response.externalId,
        response.text,
        response.replyToMessageId ? parseInt(response.replyToMessageId, 10) : undefined,
      );
      break;
    case 'whatsapp': {
      const { sendWhatsAppMessage } = await import('../../../services/whatsapp.js');
      await sendWhatsAppMessage(response.externalId, response.text, response.replyToMessageId);
      break;
    }
    default:
      logger.warn({ channel: response.channel }, 'Unknown channel for response dispatch');
  }
}

export async function sendUnlinkedResponse(channel: string, externalId: string): Promise<void> {
  const linkMessage = channel === 'telegram'
    ? 'Hi! To use me, link your Agentin account first.\n\nUse /link <your-email> or go to your Agentin dashboard → Connections → Telegram.'
    : 'Hi! To use me, please link your account at your Agentin dashboard (Connections page).';

  await sendChannelResponse({
    channel,
    externalId,
    text: linkMessage,
  });
}
