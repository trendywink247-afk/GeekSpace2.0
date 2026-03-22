// ============================================================
// PicoClaw — Automation Engine (Lightweight AI Sidecar)
//
// Handles: quick automation tasks, heartbeat monitoring,
// Telegram presence, simple Q&A via a fast local model.
// Runs as a standalone Go binary (~10MB RAM).
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';

let picoAvailable: boolean | null = null;
let picoCheckTime = 0;

// Circuit breaker: track consecutive query timeouts
let picoConsecutiveFailures = 0;
let picoCircuitOpenUntil = 0;
const CIRCUIT_BREAKER_THRESHOLD = 1;   // open after 1 failure (PicoClaw is consistently slow on 2-core VPS)
const CIRCUIT_BREAKER_COOLDOWN = 300_000; // 5 min cooldown before retrying

export function picoCircuitBreakerTrip(): void {
  picoConsecutiveFailures++;
  if (picoConsecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    picoCircuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
    logger.info({ failures: picoConsecutiveFailures, cooldownMs: CIRCUIT_BREAKER_COOLDOWN },
      'PicoClaw circuit breaker OPEN — skipping for 5 min');
  }
}

export function picoCircuitBreakerReset(): void {
  if (picoConsecutiveFailures > 0) {
    logger.info({ previousFailures: picoConsecutiveFailures }, 'PicoClaw circuit breaker RESET — queries succeeding');
  }
  picoConsecutiveFailures = 0;
  picoCircuitOpenUntil = 0;
}

export async function isPicoClawAvailable(): Promise<boolean> {
  if (!config.picoClawEnabled) return false;

  // Circuit breaker: if open, skip entirely (no health check, no 3s wasted)
  if (picoCircuitOpenUntil > Date.now()) {
    return false;
  }

  // Cache check for 30 seconds
  if (picoAvailable !== null && Date.now() - picoCheckTime < 30_000) {
    return picoAvailable;
  }
  try {
    const res = await fetch(`${config.picoClawUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    picoAvailable = res.ok;
  } catch {
    picoAvailable = false;
  }
  picoCheckTime = Date.now();
  return picoAvailable;
}

export async function queryPicoClaw(
  message: string,
  systemPrompt?: string,
): Promise<{ text: string; tokensIn: number; tokensOut: number; latencyMs: number }> {
  const start = Date.now();

  const res = await fetch(`${config.picoClawUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      system: systemPrompt,
    }),
    signal: AbortSignal.timeout(config.picoClawTimeout),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PicoClaw returned ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    response?: string;
    text?: string;
    tokens_in?: number;
    tokens_out?: number;
  };

  const text = data.response || data.text || '';
  const latencyMs = Date.now() - start;

  logger.debug({ provider: 'picoclaw', latencyMs }, 'PicoClaw response');

  return {
    text,
    tokensIn: data.tokens_in || Math.ceil(message.length / 4),
    tokensOut: data.tokens_out || Math.ceil(text.length / 4),
    latencyMs,
  };
}

export async function picoClawProbe(): Promise<boolean> {
  if (!config.picoClawEnabled) return false;
  try {
    const res = await fetch(`${config.picoClawUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
