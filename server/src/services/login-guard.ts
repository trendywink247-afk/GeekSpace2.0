interface AttemptRecord { count: number; windowStart: number; }
const attempts = new Map<string, AttemptRecord>();
export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export function isLoginBlocked(ip: string): { blocked: boolean; retryAfterMs: number } {
  const now = Date.now(); const record = attempts.get(ip);
  if (!record || now - record.windowStart > WINDOW_MS) return { blocked: false, retryAfterMs: 0 };
  if (record.count >= MAX_ATTEMPTS) return { blocked: true, retryAfterMs: Math.max(0, WINDOW_MS - (now - record.windowStart)) };
  return { blocked: false, retryAfterMs: 0 };
}
export function recordFailedLogin(ip: string): { blocked: boolean; retryAfterMs: number } {
  const now = Date.now(); const record = attempts.get(ip);
  if (!record || now - record.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now }); return { blocked: false, retryAfterMs: 0 };
  }
  record.count++;
  if (record.count >= MAX_ATTEMPTS) return { blocked: true, retryAfterMs: Math.max(0, WINDOW_MS - (now - record.windowStart)) };
  return { blocked: false, retryAfterMs: 0 };
}
export function clearLoginAttempts(ip: string): void { attempts.delete(ip); }
export function _resetForTesting(): void { attempts.clear(); }
