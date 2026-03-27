/**
 * Auth Domain — Barrel Export
 *
 * Re-exports for authentication, authorization, JWT, OAuth, sessions,
 * password reset, and brute-force protection.
 *
 * @module auth
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 2 extraction candidate
 */

// ── Middleware ───────────────────────────────────────────────────────
export {
  requireAuth,
  optionalAuth,
  signToken,
  generateToken,
  signGuestToken,
  requireAdminToken,
  requireAdmin,
} from '../../middleware/auth.js';
export type { AuthRequest } from '../../middleware/auth.js';

// ── Routes ──────────────────────────────────────────────────────────
export { authRouter } from '../../routes/auth.js';
export { oauthRouter } from '../../routes/oauth.js';

// ── Services ────────────────────────────────────────────────────────
export {
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  cleanupExpiredRefreshTokens,
} from '../../services/refresh-token.js';

export {
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  getUserResetChannels,
} from '../../services/passwordReset.js';
export type { ResetChannel, ResetRequestResult, VerifyOTPResult } from '../../services/passwordReset.js';

export {
  isLoginBlocked,
  recordFailedLogin,
  clearLoginAttempts,
  MAX_ATTEMPTS,
  WINDOW_MS,
} from '../../services/login-guard.js';
