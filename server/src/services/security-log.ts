import { db } from '../db/index.js';
import { logger } from '../logger.js';

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'signup'
  | 'token_expired'
  | 'token_invalid'
  | 'admin_access'
  | 'admin_denied'
  | 'rate_limited';

export function logSecurityEvent(
  event: SecurityEventType,
  ip: string,
  details?: Record<string, unknown>,
): void {
  try {
    db.prepare(
      `INSERT INTO security_events (event, ip, details, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
    ).run(event, ip, details ? JSON.stringify(details) : null);
  } catch {
    logger.warn({ event, ip }, 'Failed to write security event');
  }
}
