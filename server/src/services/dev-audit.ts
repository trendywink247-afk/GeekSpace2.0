// ============================================================
// DevClaw Bridge — Audit log for admin dev actions
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  params: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  output_summary: string | null;
  pr_url: string | null;
}

/**
 * Log the start of a dev action. Returns the audit entry ID.
 */
export function logDevAction(
  action: string,
  params: Record<string, unknown> = {},
  actor = 'admin',
): string {
  const id = uuid();
  db.prepare(
    `INSERT INTO dev_audit_log (id, action, actor, params, status, started_at)
     VALUES (?, ?, ?, ?, 'started', datetime('now'))`,
  ).run(id, action, actor, JSON.stringify(params));
  return id;
}

/**
 * Mark a dev action as completed (success or failed).
 */
export function completeDevAction(
  id: string,
  status: 'success' | 'failed',
  outputSummary?: string,
  prUrl?: string,
): void {
  db.prepare(
    `UPDATE dev_audit_log
     SET status = ?, finished_at = datetime('now'), output_summary = ?, pr_url = ?
     WHERE id = ?`,
  ).run(status, outputSummary ?? null, prUrl ?? null, id);
}

/**
 * Get recent audit log entries.
 */
export function getDevAuditLog(limit = 50): AuditEntry[] {
  return db
    .prepare(
      `SELECT id, action, actor, params, status, started_at, finished_at, output_summary, pr_url
       FROM dev_audit_log
       ORDER BY started_at DESC
       LIMIT ?`,
    )
    .all(limit) as AuditEntry[];
}
