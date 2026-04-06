/**
 * Trust Gradient Service — Learned per-tool-per-context autonomy
 *
 * Instead of binary "confirm or auto-execute", maintains a learned
 * trust score (0-1) per tool per context. Updated based on whether
 * the user approved, edited, or rejected past confirmations.
 */

import { createHash } from 'crypto';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';

export interface ToolTrust {
  user_id: string;
  tool: string;
  context_hash: string;
  trust_score: number;
  approval_count: number;
  edit_count: number;
  reject_count: number;
  last_updated: string;
}

export type TrustAction = 'approved' | 'edited' | 'rejected';

/**
 * Generate a context hash from action params.
 * E.g., send_email + recipient domain = different trust per recipient type.
 */
export function getContextHash(tool: string, params: Record<string, unknown>): string {
  let contextKey = '';

  switch (tool) {
    case 'send_email': {
      const to = String(params.to || '').toLowerCase();
      // Group by recipient: self vs known vs external
      if (to === 'self' || to.includes('me') || to === '') contextKey = 'self';
      else if (to.endsWith('@gmail.com') || to.endsWith('@yahoo.com')) contextKey = 'personal';
      else contextKey = 'external';
      break;
    }
    case 'send_telegram':
      contextKey = 'all';
      break;
    case 'create_calendar_event': {
      const attendees = (params.attendees as string[]) || [];
      contextKey = attendees.length > 0 ? 'with_attendees' : 'self_only';
      break;
    }
    case 'github_pr':
      contextKey = 'all';
      break;
    case 'create_automation':
      contextKey = String(params.trigger_type || 'unknown');
      break;
    case 'generate_social_post':
      contextKey = String(params.platform || 'unknown');
      break;
    case 'delete_reminder':
      contextKey = params.deleteAll ? 'delete_all' : 'delete_one';
      break;
    default:
      contextKey = 'default';
  }

  return createHash('md5').update(`${tool}:${contextKey}`).digest('hex').slice(0, 12);
}

/**
 * Get the trust score for a tool+context combination.
 * Returns 0.5 (neutral) if no history.
 */
export function getTrustScore(userId: string, tool: string, params: Record<string, unknown>): number {
  try {
    const contextHash = getContextHash(tool, params);
    const row = db.prepare(`
      SELECT trust_score FROM tool_trust
      WHERE user_id = ? AND tool = ? AND context_hash = ?
    `).get(userId, tool, contextHash) as { trust_score: number } | undefined;
    return row?.trust_score ?? 0.5;
  } catch {
    return 0.5;
  }
}

/**
 * Determine if a tool should auto-execute, ask for confirmation, or warn.
 * Considers both the static dangerous-tools list AND the learned trust score.
 */
export function getAutonomyLevel(
  userId: string,
  tool: string,
  params: Record<string, unknown>,
): 'auto' | 'confirm' | 'warn' {
  // Always-confirm tools (override learned trust)
  const alwaysConfirm = new Set(['send_email', 'github_pr', 'create_automation', 'generate_social_post']);
  if (alwaysConfirm.has(tool)) {
    const trust = getTrustScore(userId, tool, params);
    if (trust >= 0.85) return 'auto'; // User has approved this exact context many times — grant trust
    if (trust < 0.3) return 'warn';  // User has rejected this context — extra warning
    return 'confirm';
  }

  // delete_reminder with deleteAll: confirm
  if (tool === 'delete_reminder' && params.deleteAll) {
    return 'confirm';
  }

  // Other tools: trust-based
  const trust = getTrustScore(userId, tool, params);
  if (trust < 0.3) return 'warn';
  return 'auto';
}

/**
 * Update trust based on user action.
 * approved: +0.1 trust (capped at 1.0)
 * edited:   +0.02 trust (small positive — user kept the action but tweaked)
 * rejected: -0.15 trust (capped at 0.0)
 */
export function recordTrustEvent(
  userId: string,
  tool: string,
  params: Record<string, unknown>,
  action: TrustAction,
): void {
  try {
    const contextHash = getContextHash(tool, params);

    // Get or create row
    let row = db.prepare(`
      SELECT * FROM tool_trust WHERE user_id = ? AND tool = ? AND context_hash = ?
    `).get(userId, tool, contextHash) as ToolTrust | undefined;

    if (!row) {
      db.prepare(`
        INSERT INTO tool_trust (user_id, tool, context_hash, trust_score)
        VALUES (?, ?, ?, 0.5)
      `).run(userId, tool, contextHash);
      row = { user_id: userId, tool, context_hash: contextHash, trust_score: 0.5, approval_count: 0, edit_count: 0, reject_count: 0, last_updated: '' };
    }

    let newScore = row.trust_score;
    let approvalDelta = 0, editDelta = 0, rejectDelta = 0;

    switch (action) {
      case 'approved':
        newScore = Math.min(1.0, newScore + 0.1);
        approvalDelta = 1;
        break;
      case 'edited':
        newScore = Math.min(1.0, newScore + 0.02);
        editDelta = 1;
        break;
      case 'rejected':
        newScore = Math.max(0.0, newScore - 0.15);
        rejectDelta = 1;
        break;
    }

    db.prepare(`
      UPDATE tool_trust SET
        trust_score = ?,
        approval_count = approval_count + ?,
        edit_count = edit_count + ?,
        reject_count = reject_count + ?,
        last_updated = datetime('now')
      WHERE user_id = ? AND tool = ? AND context_hash = ?
    `).run(newScore, approvalDelta, editDelta, rejectDelta, userId, tool, contextHash);

    logger.debug({ userId, tool, action, newScore }, 'trust-gradient: updated');
  } catch (err) {
    logger.debug({ err }, 'trust-gradient: update failed');
  }
}

/**
 * Get the user's trust profile across all tools (for analytics/transparency).
 */
export function getUserTrustProfile(userId: string): ToolTrust[] {
  return db.prepare(`
    SELECT * FROM tool_trust
    WHERE user_id = ?
    ORDER BY trust_score DESC, last_updated DESC
    LIMIT 50
  `).all(userId) as ToolTrust[];
}
