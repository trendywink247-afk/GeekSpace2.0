// ============================================================
// Contact Router Service
// Routes contact requests to user's channels (Telegram/WhatsApp)
// Handles Accept/Decline callbacks
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

export type ContactChannel = 'telegram' | 'whatsapp' | 'none';

export interface ContactRequest {
  id: string;
  fromUserId: string | null;
  fromName: string;
  fromPhone: string | null;
  fromEmail: string | null;
  toUserId: string;
  source: 'explore' | 'portfolio' | 'agent_referral';
  intention: string | null;
  initialMessage: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'timed_out' | 'cancelled';
  channelNotified: ContactChannel;
  createdAt: string;
  expiresAt: string;
}

export interface UserChannelStatus {
  telegram: boolean;
  whatsapp: boolean;
  preferred: ContactChannel;
}

/**
 * Detect which channels a user has active
 */
export async function getUserChannelStatus(userId: string): Promise<UserChannelStatus> {
  const links = db.prepare(
    "SELECT channel FROM channel_links WHERE user_id = ? AND is_verified = 1"
  ).all(userId) as Array<{ channel: string }>;

  const channels = links.map(l => l.channel);
  const telegram = channels.includes('telegram');
  const whatsapp = channels.includes('whatsapp');

  // Preferred is the one most recently active (could be smarter)
  const preferred: ContactChannel = telegram ? 'telegram' : whatsapp ? 'whatsapp' : 'none';

  return { telegram, whatsapp, preferred };
}

/**
 * Send contact request notification to user via their active channel
 */
export async function notifyUserOfContactRequest(
  request: ContactRequest
): Promise<{ success: boolean; channel: ContactChannel; error?: string }> {
  const channels = await getUserChannelStatus(request.toUserId);
  
  if (channels.telegram) {
    return notifyViaTelegram(request);
  } else if (channels.whatsapp) {
    return notifyViaWhatsApp(request);
  }

  // No channel available - will show in Weebo tab only
  return { success: false, channel: 'none', error: 'No active channels' };
}

/**
 * Send Telegram notification with Accept/Decline buttons
 */
async function notifyViaTelegram(
  request: ContactRequest
): Promise<{ success: boolean; channel: ContactChannel; error?: string }> {
  try {
    // Get user's Telegram chat ID
    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
    ).get(request.toUserId) as { external_id: string } | undefined;

    if (!link) {
      return { success: false, channel: 'none', error: 'Telegram not linked' };
    }

    const chatId = link.external_id;
    const fromName = request.fromName || 'Someone';
    const intention = request.intention || 'wants to connect';
    
    // Build message
    let message = `📩 *New Contact Request*\n\n`;
    message += `*${fromName}* ${intention}\n\n`;
    
    if (request.initialMessage) {
      message += `💬 *Message:* ${request.initialMessage.slice(0, 200)}\n\n`;
    }
    
    message += `Source: ${request.source}\n`;
    message += `Expires in 24 hours\n\n`;
    message += `Do you want to accept this request?`;

    // Send via Telegram bot API
    const botToken = config.telegramBotToken;
    if (!botToken) {
      logger.warn('Telegram bot token not configured');
      return { success: false, channel: 'none', error: 'Bot not configured' };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Accept', callback_data: `contact_accept:${request.id}` },
              { text: '❌ Decline', callback_data: `contact_decline:${request.id}` }
            ],
            [
              { text: '💬 View in GeekSpace', url: `${config.publicUrl}/dashboard/weebo?request=${request.id}` }
            ]
          ]
        }
      })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Telegram API error: ${error}`);
    }

    // Update request with channel notified
    db.prepare(
      "UPDATE contact_requests SET channel_notified = 'telegram', updated_at = datetime('now') WHERE id = ?"
    ).run(request.id);

    // Log audit
    logContactAudit(request.id, 'channel_notified', 'system', null, { channel: 'telegram' });

    return { success: true, channel: 'telegram' };
  } catch (err) {
    logger.error({ err, requestId: request.id }, 'Failed to send Telegram notification');
    return { success: false, channel: 'none', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Send WhatsApp notification
 * Note: WhatsApp Business API interactive buttons are limited
 */
async function notifyViaWhatsApp(
  request: ContactRequest
): Promise<{ success: boolean; channel: ContactChannel; error?: string }> {
  try {
    // Get user's WhatsApp number
    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp' AND is_verified = 1"
    ).get(request.toUserId) as { external_id: string } | undefined;

    if (!link) {
      return { success: false, channel: 'none', error: 'WhatsApp not linked' };
    }

    const phone = link.external_id;
    const fromName = request.fromName || 'Someone';
    const intention = request.intention || 'wants to connect';

    // Build message (WhatsApp has limited formatting)
    let message = `📩 New Contact Request from GeekSpace\n\n`;
    message += `${fromName} ${intention}\n\n`;
    
    if (request.initialMessage) {
      message += `Message: "${request.initialMessage.slice(0, 150)}"\n\n`;
    }

    message += `To respond, open GeekSpace:\n`;
    message += `${config.publicUrl}/dashboard/weebo?request=${request.id}\n\n`;
    message += `Or reply:\n`;
    message += `ACCEPT ${request.id} - to accept\n`;
    message += `DECLINE ${request.id} - to decline`;

    // Send via WhatsApp Business API
    const success = await sendWhatsAppMessage(phone, message);
    
    if (!success) {
      return { success: false, channel: 'none', error: 'WhatsApp send failed' };
    }

    // Update request
    db.prepare(
      "UPDATE contact_requests SET channel_notified = 'whatsapp', updated_at = datetime('now') WHERE id = ?"
    ).run(request.id);

    logContactAudit(request.id, 'channel_notified', 'system', null, { channel: 'whatsapp' });

    return { success: true, channel: 'whatsapp' };
  } catch (err) {
    logger.error({ err, requestId: request.id }, 'Failed to send WhatsApp notification');
    return { success: false, channel: 'none', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Send WhatsApp message (placeholder - implement with your WhatsApp service)
 */
async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  // TODO: Integrate with your WhatsApp service
  // For now, log and return true for testing
  logger.info({ to, message: message.slice(0, 50) }, 'Would send WhatsApp message');
  return true;
}

/**
 * Handle Accept callback from channel
 */
export async function handleAcceptRequest(
  requestId: string,
  userId: string,
  responseMessage?: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    // Verify request exists and belongs to user
    const request = db.prepare(
      "SELECT * FROM contact_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'"
    ).get(requestId, userId) as ContactRequest | undefined;

    if (!request) {
      return { success: false, error: 'Request not found or already processed' };
    }

    // Update request status
    db.prepare(
      `UPDATE contact_requests 
       SET status = 'accepted', decided_at = datetime('now'), y_response_message = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(responseMessage || null, requestId);

    // Create conversation
    const conversationId = uuid();
    db.prepare(
      `INSERT INTO conversations (id, user_id, agent_mode, title, summary, created_at, updated_at)
       VALUES (?, ?, 'human_to_human', ?, ?, datetime('now'), datetime('now'))`
    ).run(conversationId, userId, `Chat with ${request.fromName}`, `Contact request from ${request.source}`);

    // Add initial message if present
    if (request.initialMessage) {
      db.prepare(
        `INSERT INTO conversation_messages (id, conversation_id, role, content, created_at)
         VALUES (?, ?, 'user', ?, datetime('now'))`
      ).run(uuid(), conversationId, `[${request.fromName}] ${request.initialMessage}`);
    }

    // Log audit
    logContactAudit(requestId, 'accepted', 'y_user', userId, { conversation_id: conversationId });

    // Notify X that request was accepted
    await notifyRequesterOfDecision(request, 'accepted', conversationId);

    return { success: true, conversationId };
  } catch (err) {
    logger.error({ err, requestId }, 'Failed to accept contact request');
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Handle Decline callback from channel
 */
export async function handleDeclineRequest(
  requestId: string,
  userId: string,
  responseMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const request = db.prepare(
      "SELECT * FROM contact_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'"
    ).get(requestId, userId) as ContactRequest | undefined;

    if (!request) {
      return { success: false, error: 'Request not found or already processed' };
    }

    db.prepare(
      `UPDATE contact_requests 
       SET status = 'declined', decided_at = datetime('now'), y_response_message = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(responseMessage || null, requestId);

    logContactAudit(requestId, 'declined', 'y_user', userId, {});

    // Notify X that request was declined
    await notifyRequesterOfDecision(request, 'declined');

    return { success: true };
  } catch (err) {
    logger.error({ err, requestId }, 'Failed to decline contact request');
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Notify requester (X) of Y's decision
 */
async function notifyRequesterOfDecision(
  request: ContactRequest,
  decision: 'accepted' | 'declined',
  conversationId?: string
): Promise<void> {
  // If X is a logged-in user, send in-app notification
  if (request.fromUserId) {
    // Create notification in your notification system
    logger.info({ requestId: request.id, decision, conversationId }, 'Would notify requester');
  }
  // For guest users, we don't have a way to notify them besides the status page polling
}

/**
 * Log contact audit event
 */
function logContactAudit(
  requestId: string,
  action: string,
  actorType: string,
  actorId: string | null,
  metadata: Record<string, unknown>
): void {
  try {
    db.prepare(
      `INSERT INTO contact_request_audit (id, request_id, action, actor_type, actor_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(uuid(), requestId, action, actorType, actorId, JSON.stringify(metadata));
  } catch (err) {
    logger.error({ err, requestId, action }, 'Failed to log contact audit');
  }
}

/**
 * Check if user is in quiet hours
 */
export function isInQuietHours(userId: string): boolean {
  const prefs = db.prepare(
    "SELECT quiet_hours_start, quiet_hours_end FROM user_contact_preferences WHERE user_id = ?"
  ).get(userId) as { quiet_hours_start: number | null; quiet_hours_end: number | null } | undefined;

  if (!prefs || prefs.quiet_hours_start === null || prefs.quiet_hours_end === null) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();

  if (prefs.quiet_hours_start < prefs.quiet_hours_end) {
    // Normal range (e.g., 22-08)
    return currentHour >= prefs.quiet_hours_start && currentHour < prefs.quiet_hours_end;
  } else {
    // Wrapping range (e.g., 22-06)
    return currentHour >= prefs.quiet_hours_start || currentHour < prefs.quiet_hours_end;
  }
}

/**
 * Get availability response for when Y is unavailable
 */
export async function getAvailabilityResponse(userId: string): Promise<string> {
  const prefs = db.prepare(
    "SELECT availability_mode, share_availability_level, default_response_template, working_hours_start, working_hours_end FROM user_contact_preferences WHERE user_id = ?"
  ).get(userId) as {
    availability_mode: string;
    share_availability_level: string;
    default_response_template: string;
    working_hours_start: number;
    working_hours_end: number;
  } | undefined;

  if (!prefs || prefs.availability_mode === 'auto_reply_off') {
    return "I'm currently unavailable. I'll respond when I can.";
  }

  const level = prefs.share_availability_level;
  
  if (level === 'none') {
    return prefs.default_response_template;
  }

  if (level === 'coarse') {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (currentHour < prefs.working_hours_start) {
      return `I'm not available yet. I'm usually online around ${prefs.working_hours_start}:00.`;
    } else if (currentHour >= prefs.working_hours_end) {
      return `I've finished for today. I'll be back tomorrow around ${prefs.working_hours_start}:00.`;
    } else {
      return "I'm busy right now but I'll respond when I can.";
    }
  }

  return prefs.default_response_template;
}
