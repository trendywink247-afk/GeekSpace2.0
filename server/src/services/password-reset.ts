// ── Shim: canonical source moved to modules/auth/services/password-reset.ts ──
export {
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  getUserResetChannels,
} from '../modules/auth/services/password-reset.js';
export type { ResetChannel, ResetRequestResult, VerifyOTPResult } from '../modules/auth/services/password-reset.js';
