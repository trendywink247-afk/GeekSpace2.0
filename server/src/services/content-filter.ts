// ============================================================
// Content Filter — Phase 82
//
// Lightweight pre-send safety check for user messages.
// Uses a curated word-list + pattern matching (no ML model).
//
// Design: NEVER block the message — tag it and log it.
// This satisfies App Store "content moderation" requirements
// without risking false positives that break user experience.
//
// Flagged messages are logged to moderation_log.
// The message still proceeds to the AI normally.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';

export interface ContentFilterResult {
  flagged: boolean;
  flags: string[];
  action: 'allowed' | 'logged';
}

// ---- Minimal word-list (severe harm / CSAM-adjacent keywords only) ----------
// Intentionally kept short — false positives break UX more than they help.
// Pattern: whole-word match, case-insensitive.
const FLAGGED_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\b(how\s+to\s+make\s+(a\s+)?(bomb|explosive|weapon))\b/i, flag: 'violence:weapon-instructions' },
  { pattern: /\b(suicide\s+(method|how|way)s?|how\s+to\s+kill\s+(my)?self)\b/i, flag: 'self-harm:instructions' },
  { pattern: /\b(child\s+(porn|pornography|sex)|csam|loli(con)?)\b/i, flag: 'csam:explicit' },
  { pattern: /\b(how\s+to\s+(hack|phish|ddos|dos)\s+(a\s+)?(bank|government|school))\b/i, flag: 'cybercrime:instructions' },
];

// ---- Main export ----

export function checkContent(message: string, userId: string): ContentFilterResult {
  const flags: string[] = [];

  for (const { pattern, flag } of FLAGGED_PATTERNS) {
    if (pattern.test(message)) {
      flags.push(flag);
    }
  }

  if (flags.length === 0) {
    return { flagged: false, flags: [], action: 'allowed' };
  }

  // Log to moderation_log (non-fatal — never throws)
  try {
    db.prepare(`
      INSERT INTO moderation_log (id, user_id, message, flags, action, created_at)
      VALUES (?, ?, ?, ?, 'allowed', datetime('now'))
    `).run(uuid(), userId, message.slice(0, 1000), JSON.stringify(flags));

    logger.warn({ userId, flags }, 'content-filter: message flagged (allowed but logged)');
  } catch (err) {
    logger.error({ err, userId }, 'content-filter: failed to write moderation_log');
  }

  return { flagged: true, flags, action: 'allowed' };
}
