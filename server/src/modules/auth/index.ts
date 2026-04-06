/**
 * Auth Domain — Barrel Export + AppModule registration
 *
 * Re-exports for authentication, authorization, JWT, OAuth, sessions,
 * password reset, and brute-force protection.
 *
 * @module auth
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 2 extraction candidate
 */

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

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
export { authRouter } from './routes/auth.js';
export { oauthRouter } from './routes/oauth.js';

// ── Services ────────────────────────────────────────────────────────
export {
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  cleanupExpiredRefreshTokens,
} from './services/refresh-token.js';

export {
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  getUserResetChannels,
} from './services/password-reset.js';
export type { ResetChannel, ResetRequestResult, VerifyOTPResult } from './services/password-reset.js';

export {
  isLoginBlocked,
  recordFailedLogin,
  clearLoginAttempts,
  MAX_ATTEMPTS,
  WINDOW_MS,
} from './services/login-guard.js';

// ── Types ──────────────────────────────────────────────────────────
export type { LoginRequest, SignupRequest, AuthResponse, OAuthProvider, PasswordResetRequest } from './types.js';

// ── Module Registration ─────────────────────────────────────────────
import { authRouter } from './routes/auth.js';
import { oauthRouter } from './routes/oauth.js';

export const authModule: AppModule = {
  name: 'auth',

  registerRoutes(app: Application) {
    app.use('/api/auth', authRouter);
    app.use('/api/oauth', oauthRouter);
  },
};
