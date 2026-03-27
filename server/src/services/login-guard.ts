// ── Shim: canonical source moved to modules/auth/services/login-guard.ts ──
export {
  isLoginBlocked,
  recordFailedLogin,
  clearLoginAttempts,
  _resetForTesting,
  MAX_ATTEMPTS,
  WINDOW_MS,
} from '../modules/auth/services/login-guard.js';
