// ============================================================
// Escalation Service
//
// Handles matching and answering visitor escalation replies
// from the owner via Telegram.
// ============================================================

import { db } from '../db/index.js';
import { cacheGet, cacheSet, cacheDel } from './cache.js';
import { sendTelegramMessage } from './telegram.js';
import { logger } from '../logger.js';

// ---- Types ----

export interface EscalationData {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
  visitorName: string;
  question: string;
  context: string;
  status: string;
  createdAt: string;
  notifMessageId?: number;
  ownerResponse?: string;
  answeredAt?: string;
}

// ---- Core Functions ----

/**
 * Match and handle an owner's Telegram reply to a pending escalation.
 *
 * Returns true if the message was matched to an escalation and handled,
 * false if the caller should continue with normal chat routing.
 *
 * Tier 1 — native Telegram reply_to_message: exact, zero false positives.
 * Tier 2 — keyword/context score: medium confidence, short messages only.
 * Tier 3 — no match → falls through to normal chat.
 */
export async function handleEscalationReply(
  telegramChatId: string,
  text: string,
  replyToMessageId?: number,
): Promise<boolean> {
  try {
    // Find user by Telegram chat ID
    const link = db.prepare(
      "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
    ).get(telegramChatId) as { user_id: string } | undefined;

    if (!link) return false;

    // Check for pending escalations for this owner
    const pendingKey = `escalations:owner:${link.user_id}`;
    const pendingRaw = await cacheGet(pendingKey);
    if (!pendingRaw) return false;

    const ids: string[] = JSON.parse(pendingRaw);
    if (!ids.length) return false;

    const escalations: Array<{ raw: string; data: EscalationData; idx: number }> = [];
    for (let i = 0; i < ids.length; i++) {
      const escRaw = await cacheGet(`escalation:${ids[i]}`);
      if (!escRaw) continue;
      const data = JSON.parse(escRaw) as EscalationData;
      if (data.status !== 'pending') continue;
      escalations.push({ raw: escRaw, data, idx: i });
    }

    if (!escalations.length) return false;

    // ── TIER 1: Native Telegram reply (exact, zero false positives) ──────────
    if (replyToMessageId) {
      const matched = escalations.find(e => e.data.notifMessageId === replyToMessageId);
      if (matched) {
        await markEscalationAnswered(matched.data, ids, matched.idx, link.user_id, pendingKey, telegramChatId, text);
        return true;
      }
      // Replied to a non-escalation bot message → fall through to normal chat
      return false;
    }

    // ── TIER 2: Keyword/context match (medium confidence) ────────────────────
    // Only runs if no native reply. Short directional replies are candidates.
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount <= 50) {
      const lowerText = text.toLowerCase();
      let bestMatch: typeof escalations[0] | null = null;
      let bestScore = 0;

      for (const esc of escalations) {
        let score = 0;

        // Score by visitor name tokens
        const nameTokens = esc.data.visitorName.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        for (const token of nameTokens) {
          if (lowerText.includes(token)) score++;
        }

        // Score by key question nouns (3+ char words, excluding stop words)
        const stopWords = new Set(['the', 'and', 'for', 'are', 'you', 'was', 'can', 'will', 'with', 'this', 'that', 'have', 'from', 'they', 'what', 'when', 'your']);
        const questionTokens = esc.data.question
          .toLowerCase()
          .split(/\W+/)
          .filter(t => t.length > 3 && !stopWords.has(t));

        for (const token of questionTokens) {
          if (lowerText.includes(token)) score++;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = esc;
        }
      }

      if (bestMatch && bestScore >= 1) {
        await markEscalationAnswered(bestMatch.data, ids, bestMatch.idx, link.user_id, pendingKey, telegramChatId, text);
        return true;
      }
    }

    // ── TIER 3: No match → normal chat ────────────────────────────────────────
    return false;
  } catch (err) {
    logger.warn({ err }, 'handleEscalationReply error');
    return false;
  }
}

/**
 * Mark an escalation as answered, update the cache, and confirm to the owner.
 */
export async function markEscalationAnswered(
  escalation: EscalationData,
  ids: string[],
  idx: number,
  ownerUserId: string,
  pendingKey: string,
  telegramChatId: string,
  ownerResponse: string,
): Promise<void> {
  const updated: EscalationData = {
    ...escalation,
    status: 'answered',
    ownerResponse,
    answeredAt: new Date().toISOString(),
  };
  await cacheSet(`escalation:${escalation.id}`, JSON.stringify(updated), 86400);

  // Remove this ID from the pending list
  const updatedIds = ids.filter((_, i) => i !== idx);
  if (updatedIds.length === 0) {
    await cacheDel(pendingKey);
  } else {
    await cacheSet(pendingKey, JSON.stringify(updatedIds), 86400);
  }

  logger.info({ escalationId: escalation.id, ownerUserId }, 'Escalation answered');

  // Confirm to owner with context
  const snippet = ownerResponse.length > 80 ? ownerResponse.slice(0, 80) + '…' : ownerResponse;
  await sendTelegramMessage(
    Number(telegramChatId),
    `Got it! I'll tell ${escalation.visitorName}: "${snippet}"`
  );
}
