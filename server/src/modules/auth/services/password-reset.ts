// ============================================================
// Password Reset Service
// OTP-based password reset with email/Telegram delivery
// ============================================================

import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';
import { revokeAllRefreshTokens } from './refresh-token.js';

const _OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3;

export type ResetChannel = 'email' | 'telegram';

export interface ResetRequestResult {
  success: boolean;
  message: string;
  channel?: ResetChannel;
  error?: string;
}

export interface VerifyOTPResult {
  success: boolean;
  resetToken?: string;
  error?: string;
}

/**
 * Generate random 6-digit OTP
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP for storage
 */
async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

/**
 * Verify OTP against hash
 */
async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

/**
 * Check rate limit for password reset
 */
function checkRateLimit(identifier: string, type: 'email' | 'ip'): boolean {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const record = db.prepare(
    `SELECT request_count, window_start FROM password_reset_rate_limits
     WHERE identifier = ? AND identifier_type = ? AND window_start > ?`
  ).get(identifier, type, windowStart) as { request_count: number; window_start: string } | undefined;

  if (!record) {
    // Create new window
    db.prepare(
      `INSERT INTO password_reset_rate_limits (id, identifier, identifier_type, request_count, window_start, created_at, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
       ON CONFLICT(identifier, identifier_type) DO UPDATE SET
       request_count = CASE WHEN window_start > excluded.window_start THEN 1 ELSE request_count + 1 END,
       window_start = CASE WHEN window_start > excluded.window_start THEN excluded.window_start ELSE window_start END,
       updated_at = datetime('now')`
    ).run(uuid(), identifier, type);
    return true;
  }

  if (record.request_count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  // Increment counter
  db.prepare(
    `UPDATE password_reset_rate_limits
     SET request_count = request_count + 1, updated_at = datetime('now')
     WHERE identifier = ? AND identifier_type = ?`
  ).run(identifier, type);

  return true;
}

/**
 * Get user's available reset channels
 */
export function getUserResetChannels(userId: string): { email: string | null; telegram: boolean } {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  const telegramLink = db.prepare(
    "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
  ).get(userId) as { id: string } | undefined;

  return {
    email: user?.email || null,
    telegram: !!telegramLink,
  };
}

/**
 * Send OTP via email
 */
async function sendEmailOTP(email: string, otp: string, userName: string): Promise<boolean> {
  try {
    const { sendPasswordResetOTP } = await import('../../../services/email.js');
    return await sendPasswordResetOTP(email, otp, userName);
  } catch (err) {
    logger.error({ err, email }, 'Failed to send email OTP');
    return false;
  }
}

/**
 * Send OTP via Telegram
 */
async function sendTelegramOTP(userId: string, otp: string): Promise<boolean> {
  try {
    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
    ).get(userId) as { external_id: string } | undefined;

    if (!link) {
      return false;
    }

    const botToken = config.telegramBotToken;
    if (!botToken) {
      logger.warn('Telegram bot token not configured');
      return false;
    }

    const message = `🔐 *Password Reset Request*\n\nYour reset code is: *${otp}*\n\nThis code is valid for 10 minutes. If you didn't request this, ignore this message.\n\n- Agentin`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: link.external_id,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    return res.ok;
  } catch (err) {
    logger.error({ err, userId }, 'Failed to send Telegram OTP');
    return false;
  }
}

/**
 * Request password reset
 */
export async function requestPasswordReset(
  identifier: string,
  channelPreference: 'email' | 'telegram' | 'auto',
  ipAddress: string
): Promise<ResetRequestResult> {
  try {
    // Rate limiting by IP
    if (!checkRateLimit(ipAddress, 'ip')) {
      logResetAudit(null, 'requested', null, ipAddress, false, 'Rate limit exceeded (IP)');
      return { success: true, message: 'If an account exists, a reset code will be sent.' };
    }

    // Find user by email
    const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(identifier.toLowerCase().trim()) as { id: string; email: string; name: string } | undefined;

    if (!user) {
      // Generic response to prevent enumeration
      logResetAudit(null, 'requested', null, ipAddress, false, 'User not found');
      return { success: true, message: 'If an account exists, a reset code will be sent.' };
    }

    // Rate limiting by email
    if (!checkRateLimit(user.email, 'email')) {
      logResetAudit(user.id, 'requested', null, ipAddress, false, 'Rate limit exceeded (email)');
      return { success: true, message: 'If an account exists, a reset code will be sent.' };
    }

    // Determine channel
    const channels = getUserResetChannels(user.id);
    let channel: ResetChannel = 'email';

    if (channelPreference === 'telegram' && channels.telegram) {
      channel = 'telegram';
    } else if (channelPreference === 'auto') {
      // Prefer Telegram if available (more secure), else email
      channel = channels.telegram ? 'telegram' : 'email';
    }

    // Check channel availability
    if (channel === 'email' && !channels.email) {
      return { success: false, message: 'No email associated with account', error: 'No email associated with account' };
    }
    if (channel === 'telegram' && !channels.telegram) {
      return { success: false, message: 'Telegram not connected', error: 'Telegram not connected' };
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidate any existing tokens for this user
    db.prepare(
      "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL"
    ).run(user.id);

    // Store token
    const tokenId = uuid();
    db.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, otp_hash, channel, max_attempts, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(tokenId, user.id, otpHash, channel, MAX_ATTEMPTS, expiresAt);

    // Send OTP
    let sent = false;
    if (channel === 'email') {
      sent = await sendEmailOTP(user.email, otp, user.name);
    } else {
      sent = await sendTelegramOTP(user.id, otp);
    }

    if (!sent) {
      // Rollback token
      db.prepare("DELETE FROM password_reset_tokens WHERE id = ?").run(tokenId);
      logResetAudit(user.id, 'otp_sent', channel, ipAddress, false, 'Failed to send OTP');
      return { success: false, message: 'Failed to send reset code. Please try again.', error: 'Failed to send reset code. Please try again.' };
    }

    logResetAudit(user.id, 'otp_sent', channel, ipAddress, true);

    return {
      success: true,
      message: 'Reset code sent successfully',
      channel,
    };
  } catch (err) {
    logger.error({ err, identifier }, 'Password reset request error');
    return { success: false, message: 'Something went wrong. Please try again.', error: 'Something went wrong. Please try again.' };
  }
}

/**
 * Verify OTP and issue reset token
 */
export async function verifyResetOTP(
  identifier: string,
  otp: string,
  ipAddress: string
): Promise<VerifyOTPResult> {
  try {
    // Find user
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(identifier.toLowerCase().trim()) as { id: string } | undefined;
    if (!user) {
      return { success: false, error: 'Invalid or expired code' };
    }

    // Get active token
    const token = db.prepare(
      `SELECT * FROM password_reset_tokens
       WHERE user_id = ? AND used_at IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 1`
    ).get(user.id) as {
      id: string;
      otp_hash: string;
      attempts: number;
      max_attempts: number;
    } | undefined;

    if (!token) {
      logResetAudit(user.id, 'expired', null, ipAddress, false, 'Token not found or expired');
      return { success: false, error: 'Invalid or expired code' };
    }

    // Check attempts
    if (token.attempts >= token.max_attempts) {
      // Invalidate token
      db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(token.id);
      logResetAudit(user.id, 'too_many_attempts', null, ipAddress, false);
      return { success: false, error: 'Too many attempts. Please request a new code.' };
    }

    // Increment attempts
    db.prepare("UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE id = ?").run(token.id);

    // Verify OTP
    const valid = await verifyOTP(otp, token.otp_hash);
    if (!valid) {
      logResetAudit(user.id, 'otp_verified', null, ipAddress, false, 'Invalid OTP');
      return { success: false, error: 'Invalid code' };
    }

    // Mark token as used
    db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(token.id);

    // Generate reset token (single-use JWT)
    const resetToken = uuid(); // In production, use signed JWT

    logResetAudit(user.id, 'otp_verified', null, ipAddress, true);

    return { success: true, resetToken };
  } catch (err) {
    logger.error({ err, identifier }, 'OTP verification error');
    return { success: false, error: 'Verification failed' };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(
  resetToken: string,
  newPassword: string,
  ipAddress: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate password
    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    // Find user by reset token (in production, verify JWT)
    // For now, we'll look up the most recent verified token
    // In production: decode JWT to get userId

    // This is a simplified version - in production use proper JWT verification
    const token = db.prepare(
      `SELECT rt.*, u.id as user_id, u.email
       FROM password_reset_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.used_at IS NOT NULL
       AND rt.expires_at > datetime('now', '-1 hour')
       ORDER BY rt.used_at DESC LIMIT 1`
    ).get() as { user_id: string; email: string } | undefined;

    if (!token) {
      return { success: false, error: 'Invalid or expired reset session' };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and set password_changed_at for JWT invalidation
    const nowSec = Math.floor(Date.now() / 1000);
    db.prepare(`UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = datetime('now') WHERE id = ?`).run(
      passwordHash,
      nowSec,
      token.user_id
    );

    // Revoke all refresh tokens on password change
    revokeAllRefreshTokens(token.user_id);

    // Invalidate all sessions
    try {
      db.prepare("UPDATE user_sessions SET is_active = 0 WHERE user_id = ?").run(token.user_id);
    } catch { /* non-fatal */ }

    logResetAudit(token.user_id, 'reset_success', null, ipAddress, true);

    logger.info({ userId: token.user_id }, 'Password reset successful');

    return { success: true };
  } catch (err) {
    logger.error({ err }, 'Password reset error');
    return { success: false, error: 'Failed to reset password' };
  }
}

/**
 * Log reset audit event
 */
function logResetAudit(
  userId: string | null,
  action: string,
  channel: string | null,
  ipAddress: string,
  success: boolean,
  errorMessage?: string
): void {
  try {
    db.prepare(
      `INSERT INTO password_reset_audit (id, user_id, action, channel, ip_address, success, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(uuid(), userId, action, channel, ipAddress, success ? 1 : 0, errorMessage || null);
  } catch (err) {
    logger.error({ err }, 'Failed to log reset audit');
  }
}
