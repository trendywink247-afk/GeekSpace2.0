// ============================================================
// Generic Circuit Breaker — prevents cascading failures from
// unhealthy external services.
//
// States: CLOSED (normal) → OPEN (blocking) → HALF_OPEN (testing)
//
// Usage:
//   if (!breakers.groq.isAvailable()) { /* skip */ }
//   try { result = await callGroq(); breakers.groq.recordSuccess(); }
//   catch { breakers.groq.recordFailure(); }
// ============================================================

import { logger } from '../logger.js';

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;    // failures before opening (default: 3)
  resetTimeoutMs?: number;      // how long to stay open before half-open (default: 60_000)
  halfOpenMaxAttempts?: number;  // max probes in half-open (default: 1)
}

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 3;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 60_000;
    this.halfOpenMaxAttempts = opts.halfOpenMaxAttempts ?? 1;
  }

  /** Check if this provider should be attempted. Handles OPEN → HALF_OPEN transition. */
  isAvailable(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        logger.info({ breaker: this.name }, 'Circuit breaker HALF_OPEN — testing');
        return true;
      }
      return false;
    }
    // HALF_OPEN: allow up to halfOpenMaxAttempts
    if (this.halfOpenAttempts < this.halfOpenMaxAttempts) {
      this.halfOpenAttempts++;
      return true;
    }
    return false;
  }

  /** Call after a successful request — resets the breaker to CLOSED. */
  recordSuccess(): void {
    if (this.state !== 'CLOSED') {
      logger.info(
        { breaker: this.name, previousFailures: this.failures },
        'Circuit breaker CLOSED — recovered',
      );
    }
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.state = 'CLOSED';
  }

  /** Call after a failed request — increments failure count, may trip to OPEN. */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(
        { breaker: this.name, failures: this.failures, cooldownMs: this.resetTimeoutMs },
        'Circuit breaker OPEN — blocking requests',
      );
    }
  }

  /** Returns diagnostic info for health endpoints. */
  getStatus(): { name: string; state: State; failures: number; threshold: number; cooldownMs: number } {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      threshold: this.failureThreshold,
      cooldownMs: this.resetTimeoutMs,
    };
  }
}

// ---- Pre-created breakers for known external services ----
// Thresholds tuned per provider reliability and recovery speed.

export const breakers = {
  groq:       new CircuitBreaker({ name: 'groq',       failureThreshold: 2, resetTimeoutMs: 120_000 }),
  together:   new CircuitBreaker({ name: 'together',   failureThreshold: 3, resetTimeoutMs: 120_000 }),
  openrouter: new CircuitBreaker({ name: 'openrouter', failureThreshold: 3, resetTimeoutMs: 90_000 }),
  ollama:     new CircuitBreaker({ name: 'ollama',     failureThreshold: 2, resetTimeoutMs: 300_000 }),
  tavily:     new CircuitBreaker({ name: 'tavily',     failureThreshold: 3, resetTimeoutMs: 180_000 }),
  kimi:       new CircuitBreaker({ name: 'kimi',       failureThreshold: 3, resetTimeoutMs: 120_000 }),
  edith:      new CircuitBreaker({ name: 'edith',      failureThreshold: 3, resetTimeoutMs: 120_000 }),
};

/** Returns status of all breakers — for health/admin endpoints. */
export function getAllBreakerStatus() {
  return Object.values(breakers).map(b => b.getStatus());
}
