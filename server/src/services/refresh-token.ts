// ============================================================
// Refresh Token Service — single-use rotation with family tracking
// ============================================================

import { v4 as uuid } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

/**
 * Hash a refresh token for storage (never store raw tokens)
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a new refresh token for a user.
 * Creates a new token family (used to detect reuse attacks).
 */
export function issueRefreshToken(userId: string, family?: string): {
  refreshToken: string;
  expiresAt: number;
} {
  const rawToken = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const tokenFamily = family || uuid();
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
  const id = uuid();

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, family, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, tokenHash, tokenFamily, expiresAt);

  return { refreshToken: rawToken, expiresAt };
}

/**
 * Rotate a refresh token: verify the old one, revoke it, issue a new one.
 * Implements single-use rotation with reuse detection.
 *
 * If a revoked token is reused, the entire family is revoked (reuse detection).
 */
export function rotateRefreshToken(rawToken: string): {
  userId: string;
  refreshToken: string;
  expiresAt: number;
} | null {
  const tokenHash = hashToken(rawToken);
  const nowSec = Math.floor(Date.now() / 1000);

  const existing = db.prepare(`
    SELECT id, user_id, family, expires_at, revoked_at
    FROM refresh_tokens
    WHERE token_hash = ?
  `).get(tokenHash) as {
    id: string;
    user_id: string;
    family: string;
    expires_at: number;
    revoked_at: string | null;
  } | undefined;

  if (!existing) {
    return null; // Token not found
  }

  // Reuse detection: if this token was already revoked, revoke the entire family
  if (existing.revoked_at) {
    logger.warn(
      { userId: existing.user_id, family: existing.family },
      'Refresh token reuse detected — revoking entire family'
    );
    db.prepare(`
      UPDATE refresh_tokens SET revoked_at = datetime('now')
      WHERE family = ? AND revoked_at IS NULL
    `).run(existing.family);
    return null;
  }

  // Check expiry
  if (existing.expires_at < nowSec) {
    return null;
  }

  // Revoke the old token
  db.prepare(`
    UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?
  `).run(existing.id);

  // Issue a new token in the same family
  const result = issueRefreshToken(existing.user_id, existing.family);

  return {
    userId: existing.user_id,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
  };
}

/**
 * Revoke all refresh tokens for a user (e.g., on password change or "sign out everywhere").
 */
export function revokeAllRefreshTokens(userId: string): number {
  const result = db.prepare(`
    UPDATE refresh_tokens SET revoked_at = datetime('now')
    WHERE user_id = ? AND revoked_at IS NULL
  `).run(userId);
  return result.changes;
}

/**
 * Revoke a specific refresh token by raw value.
 */
export function revokeRefreshToken(rawToken: string): boolean {
  const tokenHash = hashToken(rawToken);
  const result = db.prepare(`
    UPDATE refresh_tokens SET revoked_at = datetime('now')
    WHERE token_hash = ? AND revoked_at IS NULL
  `).run(tokenHash);
  return result.changes > 0;
}

/**
 * Clean up expired refresh tokens.
 */
export function cleanupExpiredRefreshTokens(): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const result = db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(nowSec);
  return result.changes;
}
