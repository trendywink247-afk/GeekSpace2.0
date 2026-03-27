// ── Shim: canonical source moved to modules/auth/services/passwordReset.ts ──
export {
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  getUserResetChannels,
} from '../modules/auth/services/passwordReset.js';
export type { ResetChannel, ResetRequestResult, VerifyOTPResult } from '../modules/auth/services/passwordReset.js';
