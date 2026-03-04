// ============================================================
// Content Filter
//
// Lightweight pre-LLM safety check for user messages.
// Uses a curated keyword list + pattern matching (no ML model).
//
// Two tiers:
//   BLOCK  — message is rejected immediately; LLM is never called.
//   LOG    — message is allowed but recorded for review.
//
// Flagged messages (both tiers) are logged to moderation_log.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';

export interface ContentFilterResult {
  flagged: boolean;
  blocked: boolean;
  flags: string[];
  action: 'allowed' | 'logged' | 'blocked';
}

// ---- BLOCK list — sexual violence, drugging, serious harm instructions ----
// These are rejected without reaching the LLM.
const BLOCK_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  // Sexual violence / rape
  { pattern: /\b(rape|raping|raped)\b/i, flag: 'sexual-violence:explicit' },
  { pattern: /\b(how\s+to\s+rape|tips?\s+(?:for|on)\s+raping?|get\s+away\s+with\s+rape)\b/i, flag: 'sexual-violence:instructions' },
  { pattern: /\b(sexual\s+assault(?:ing|ed)?|molest(?:ing|ed)?)\b/i, flag: 'sexual-violence:assault' },
  // Drugging someone
  { pattern: /\b(drug(?:ging|ged)\s+(?:a\s+)?(?:someone|her|him|them|a\s+(?:girl|woman|man|person)))\b/i, flag: 'drugging:victim' },
  { pattern: /\b(slip\s+(?:a\s+)?(?:drug|rohypnol|roofie|ghb|rophynol))\b/i, flag: 'drugging:instructions' },
  { pattern: /\b(roofie|rohypnol)\b/i, flag: 'drugging:substance' },
  // Explicit harm incitement
  { pattern: /\b(hurtful\s+statement\s+about\s+(?:drugging|raping|assault))\b/i, flag: 'harm-incitement' },
  // CSAM
  { pattern: /\b(child\s+(porn|pornography|sex)|csam|loli(con)?)\b/i, flag: 'csam:explicit' },
  // Weapon making
  { pattern: /\b(how\s+to\s+make\s+(a\s+)?(bomb|explosive|weapon))\b/i, flag: 'violence:weapon-instructions' },
  // Self-harm instructions
  { pattern: /\b(how\s+to\s+kill\s+(my)?self|suicide\s+(method|how|way)s?)\b/i, flag: 'self-harm:instructions' },
];

// ---- LOG list — suspicious but not always harmful; allow + record ----
const LOG_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\b(how\s+to\s+(hack|phish|ddos|dos)\s+(a\s+)?(bank|government|school))\b/i, flag: 'cybercrime:instructions' },
];

// ---- Standard refusal message sent back to user when blocked ----
export const SAFETY_REFUSAL =
  "I'm not able to help with that. If you're in distress or need support, please contact a crisis helpline.";

// ---- Main export used by message-router ----

export function checkContentSafety(message: string, userId: string): ContentFilterResult {
  const flags: string[] = [];
  let blocked = false;

  // Check BLOCK patterns first
  for (const { pattern, flag } of BLOCK_PATTERNS) {
    if (pattern.test(message)) {
      flags.push(flag);
      blocked = true;
    }
  }

  // Check LOG-only patterns (only if not already blocked)
  if (!blocked) {
    for (const { pattern, flag } of LOG_PATTERNS) {
      if (pattern.test(message)) {
        flags.push(flag);
      }
    }
  }

  if (flags.length === 0) {
    return { flagged: false, blocked: false, flags: [], action: 'allowed' };
  }

  const action = blocked ? 'blocked' : 'logged';

  // Write to moderation_log (non-fatal — never throws)
  try {
    db.prepare(`
      INSERT INTO moderation_log (id, user_id, message, flags, action, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(uuid(), userId, message.slice(0, 1000), JSON.stringify(flags), action);

    logger.warn({ userId, flags, action }, 'content-filter: message flagged');
  } catch (err) {
    logger.error({ err, userId }, 'content-filter: failed to write moderation_log');
  }

  return { flagged: true, blocked, flags, action };
}

// Legacy export kept so existing callers (if any) don't break.
export function checkContent(message: string, userId: string): { flagged: boolean; flags: string[]; action: 'allowed' | 'logged' } {
  const result = checkContentSafety(message, userId);
  return {
    flagged: result.flagged,
    flags: result.flags,
    action: result.blocked ? 'logged' : result.action as 'allowed' | 'logged',
  };
}
