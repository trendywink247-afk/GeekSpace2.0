/**
 * Confirm Action — Human-in-the-loop for dangerous tool actions
 *
 * High-risk tools require user confirmation before execution.
 * The ReAct loop pauses, sends a confirmation request via SSE,
 * and waits for the user to approve/reject/edit.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';

// ── Dangerous tools that require confirmation ────────────────

export const CONFIRM_REQUIRED = new Set([
  'send_email',
  'github_pr',
  'create_automation',
  'create_calendar_event',
  'generate_social_post',
]);

// delete_reminder with deleteAll:true also requires confirmation
// (checked at call site)

// ── Types ────────────────────────────────────────────────────

export interface PendingConfirmation {
  id: string;
  user_id: string;
  conversation_id: string | null;
  tool: string;
  params: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  edited_params: string | null;
  reject_reason: string | null;
  created_at: string;
  resolved_at: string | null;
  expires_at: string;
}

// ── CRUD ─────────────────────────────────────────────────────

export function createPendingConfirmation(
  userId: string,
  tool: string,
  params: Record<string, unknown>,
  conversationId?: string,
): string {
  const id = uuid();
  const now = new Date();
  const expires = new Date(now.getTime() + 2 * 60 * 1000); // 2 min expiry

  db.prepare(`
    INSERT INTO pending_confirmations (id, user_id, conversation_id, tool, params, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, conversationId || null, tool, JSON.stringify(params), expires.toISOString());

  logger.info({ userId, tool, confirmId: id }, 'confirm:created');
  return id;
}

export function getPendingConfirmation(confirmId: string, userId: string): PendingConfirmation | null {
  const row = db.prepare(
    'SELECT * FROM pending_confirmations WHERE id = ? AND user_id = ?'
  ).get(confirmId, userId) as PendingConfirmation | undefined;

  if (!row) return null;

  // Check expiry
  if (row.status === 'pending' && new Date(row.expires_at) < new Date()) {
    db.prepare(
      'UPDATE pending_confirmations SET status = ?, resolved_at = datetime("now") WHERE id = ?'
    ).run('expired', confirmId);
    return { ...row, status: 'expired', resolved_at: new Date().toISOString() };
  }

  return row;
}

export function resolveConfirmation(
  confirmId: string,
  userId: string,
  approved: boolean,
  editedParams?: Record<string, unknown>,
  rejectReason?: string,
): PendingConfirmation | null {
  const existing = getPendingConfirmation(confirmId, userId);
  if (!existing || existing.status !== 'pending') return existing;

  const status = approved ? 'approved' : 'rejected';

  db.prepare(`
    UPDATE pending_confirmations
    SET status = ?, resolved_at = datetime('now'),
        edited_params = ?, reject_reason = ?
    WHERE id = ? AND user_id = ?
  `).run(
    status,
    editedParams ? JSON.stringify(editedParams) : null,
    rejectReason || null,
    confirmId,
    userId,
  );

  logger.info({ userId, confirmId, status, tool: existing.tool }, 'confirm:resolved');
  return getPendingConfirmation(confirmId, userId);
}

export function listPendingConfirmations(userId: string): PendingConfirmation[] {
  // Clean up expired ones first
  db.prepare(`
    UPDATE pending_confirmations
    SET status = 'expired', resolved_at = datetime('now')
    WHERE user_id = ? AND status = 'pending' AND expires_at < datetime('now')
  `).run(userId);

  return db.prepare(`
    SELECT * FROM pending_confirmations
    WHERE user_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).all(userId) as PendingConfirmation[];
}

/**
 * Check if a tool+params combination needs confirmation.
 * Special case: delete_reminder with deleteAll needs confirmation.
 */
export function needsConfirmation(tool: string, params: Record<string, unknown>): boolean {
  if (CONFIRM_REQUIRED.has(tool)) return true;
  if (tool === 'delete_reminder' && params.deleteAll) return true;
  return false;
}

/**
 * Wait for a pending confirmation to be resolved.
 * Polls the DB every 500ms, up to timeoutMs (default 120s).
 * Returns the resolved confirmation or null if timed out.
 */
export async function waitForConfirmation(
  confirmId: string,
  userId: string,
  timeoutMs = 120_000,
): Promise<PendingConfirmation | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const conf = getPendingConfirmation(confirmId, userId);
    if (!conf || conf.status !== 'pending') return conf;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  // Expired
  return getPendingConfirmation(confirmId, userId);
}
