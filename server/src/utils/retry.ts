// ============================================================
// Retry Utility — exponential backoff with jitter
// ============================================================

import { logger } from '../logger.js';

/**
 * Retry a function with exponential backoff.
 *
 * @param fn          - The async function to retry.
 * @param maxAttempts - Maximum number of attempts (1 = no retry).
 * @param baseDelayMs - Base delay in ms; doubles each attempt.
 * @param label       - Optional label for log messages.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number,
  label = 'operation',
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(
        { label, attempt, maxAttempts, delayMs: delay, err: (err as Error).message },
        `${label} failed on attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error(
    { label, maxAttempts, err: (lastError as Error).message },
    `${label} failed after ${maxAttempts} attempt(s)`,
  );
  throw lastError;
}
