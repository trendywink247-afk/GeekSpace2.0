/**
 * LLM Request Queue -- concurrency-limited async semaphore.
 * Prevents cascade failures by limiting parallel LLM calls.
 *
 * When all slots are occupied, new requests queue up (FIFO).
 * If the queue itself overflows, requests are rejected immediately (503).
 * If a request waits too long in the queue, it times out (504-like).
 *
 * Zero external dependencies -- pure Node.js.
 */

const MAX_CONCURRENT_LLM = 8;   // max parallel LLM requests (tuned for 2-core VPS)
const QUEUE_TIMEOUT_MS = 45_000; // max wait time in queue before rejecting
const MAX_QUEUE_SIZE = 50;       // reject immediately if queue exceeds this
const MAX_PER_USER = 3;          // max concurrent slots per user (prevents single-user DoS)

// ---- State ----

let inFlight = 0;
const perUserInFlight = new Map<string, number>(); // userId -> active slot count

interface QueueEntry {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  userId?: string;
}

const waiting: QueueEntry[] = [];

// ---- Public API ----

/**
 * Acquire a concurrency slot. Resolves when a slot is available.
 * Throws 'LLM_QUEUE_FULL' if the queue is saturated.
 * Throws 'LLM_QUEUE_TIMEOUT' if the request waited too long.
 * Throws 'LLM_USER_LIMIT' if the user already has MAX_PER_USER slots.
 */
export async function acquireLlmSlot(userId?: string): Promise<void> {
  // Per-user fairness: reject if this user already holds too many slots
  if (userId) {
    const userCount = perUserInFlight.get(userId) || 0;
    if (userCount >= MAX_PER_USER) {
      throw new Error('LLM_USER_LIMIT');
    }
  }

  // Fast path: slot available
  if (inFlight < MAX_CONCURRENT_LLM) {
    inFlight++;
    if (userId) perUserInFlight.set(userId, (perUserInFlight.get(userId) || 0) + 1);
    return;
  }

  // Backpressure: reject if queue is at capacity
  if (waiting.length >= MAX_QUEUE_SIZE) {
    throw new Error('LLM_QUEUE_FULL');
  }

  // Slow path: wait for a slot to free up
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = waiting.findIndex((w) => w.resolve === resolve);
      if (idx !== -1) waiting.splice(idx, 1);
      reject(new Error('LLM_QUEUE_TIMEOUT'));
    }, QUEUE_TIMEOUT_MS);

    waiting.push({ resolve, reject, timer, userId });
  });
}

/**
 * Release a concurrency slot. Must be called in a finally block
 * after every acquireLlmSlot(), even if the LLM call threw.
 */
export function releaseLlmSlot(userId?: string): void {
  inFlight = Math.max(0, inFlight - 1);

  if (userId) {
    const count = perUserInFlight.get(userId) || 0;
    if (count <= 1) perUserInFlight.delete(userId);
    else perUserInFlight.set(userId, count - 1);
  }

  if (waiting.length > 0 && inFlight < MAX_CONCURRENT_LLM) {
    const next = waiting.shift()!;
    clearTimeout(next.timer);
    inFlight++;
    if (next.userId) perUserInFlight.set(next.userId, (perUserInFlight.get(next.userId) || 0) + 1);
    next.resolve();
  }
}

/**
 * Snapshot of current queue state for health/monitoring endpoints.
 */
export function getLlmQueueStats(): {
  inFlight: number;
  queued: number;
  maxConcurrent: number;
  maxQueue: number;
} {
  return {
    inFlight,
    queued: waiting.length,
    maxConcurrent: MAX_CONCURRENT_LLM,
    maxQueue: MAX_QUEUE_SIZE,
  };
}
