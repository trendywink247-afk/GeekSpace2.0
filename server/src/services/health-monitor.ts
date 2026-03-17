// ============================================================
// Self-Healing Health Monitor
//
// Tracks Ollama and Redis health. Alerts Telegram-connected users
// on state transitions (DOWN / RECOVERED). Called every ~60s from
// the durable scheduler.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { sendTelegramNotification } from './telegram.js';
import { logActivity } from './activity-log.js';
import { cacheGet } from './cache.js';

// ---- Types ----

type ServiceStatus = 'up' | 'down' | 'unknown';

interface ServiceState {
  status: ServiceStatus;
  lastCheck: string;
  lastError: string | null;
  alertSent: boolean;
}

interface ServiceHealthMap {
  ollama: ServiceState;
  redis: ServiceState;
}

// ---- In-Memory State ----

const state: ServiceHealthMap = {
  ollama: { status: 'unknown', lastCheck: '', lastError: null, alertSent: false },
  redis:  { status: 'unknown', lastCheck: '', lastError: null, alertSent: false },
};

const OLLAMA_URL = 'http://ollama:11434/api/tags';
const OLLAMA_TIMEOUT_MS = 4000;

// ---- Health Checks ----

async function checkOllama(): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

async function checkRedis(): Promise<{ ok: boolean; error: string | null }> {
  try {
    // cacheGet returns null on both miss and connection failure,
    // but throws nothing (errors are swallowed inside cache.ts).
    // A successful call that returns null is still "up" --
    // the key simply does not exist.
    await cacheGet('health:ping');
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ---- Telegram Notification Helpers ----

function getTelegramRecipients(): Array<{ user_id: string; external_id: string }> {
  try {
    return db.prepare(
      "SELECT user_id, external_id FROM channel_links WHERE channel = 'telegram' AND is_verified = 1 LIMIT 10"
    ).all() as Array<{ user_id: string; external_id: string }>;
  } catch (err) {
    logger.error({ err }, 'health-monitor: failed to query Telegram recipients');
    return [];
  }
}

async function broadcastTelegram(message: string): Promise<void> {
  const recipients = getTelegramRecipients();
  for (const r of recipients) {
    try {
      await sendTelegramNotification(r.external_id, message);
    } catch (err) {
      logger.warn(
        { externalId: r.external_id, err: (err as Error).message },
        'health-monitor: failed to send Telegram notification'
      );
    }
  }
}

// ---- State Transition Handlers ----

async function handleOllamaDown(error: string): Promise<void> {
  const prev = state.ollama.status;
  state.ollama.status = 'down';
  state.ollama.lastError = error;

  logger.warn({ error, prev }, 'health-monitor: Ollama is DOWN');

  if (!state.ollama.alertSent) {
    state.ollama.alertSent = true;

    await broadcastTelegram(
      '[Agentin Auto-Switch] Ollama is temporarily unavailable. Switched to cloud AI. Everything works normally.'
    );

    // Log activity for any connected users
    const recipients = getTelegramRecipients();
    for (const r of recipients) {
      logActivity(r.user_id, 'service_down', 'Ollama went offline, switched to cloud AI', 'warning');
    }
  }
}

async function handleOllamaRecovery(): Promise<void> {
  const prev = state.ollama.status;
  state.ollama.status = 'up';
  state.ollama.lastError = null;

  logger.info({ prev }, 'health-monitor: Ollama RECOVERED');

  if (state.ollama.alertSent) {
    state.ollama.alertSent = false;

    await broadcastTelegram(
      '[Agentin Update] Ollama is back online. Switching back to local AI.'
    );

    const recipients = getTelegramRecipients();
    for (const r of recipients) {
      logActivity(r.user_id, 'service_up', 'Ollama recovered, switching back to local AI', 'info');
    }
  }
}

async function handleRedisDown(error: string): Promise<void> {
  state.redis.status = 'down';
  state.redis.lastError = error;

  // Redis failures are non-fatal (app falls back to DB), so only log --
  // no user-facing alerts.
  if (!state.redis.alertSent) {
    state.redis.alertSent = true;
    logger.warn({ error }, 'health-monitor: Redis is DOWN');
  }
}

function handleRedisRecovery(): void {
  if (state.redis.alertSent) {
    state.redis.alertSent = false;
    logger.info('health-monitor: Redis RECOVERED');
  }
  state.redis.status = 'up';
  state.redis.lastError = null;
}

// ---- Public API ----

/**
 * Run a single health-check tick. Call from scheduler every ~60s.
 */
export async function runHealthTick(): Promise<void> {
  const now = new Date().toISOString();

  // -- Ollama --
  const ollama = await checkOllama();
  state.ollama.lastCheck = now;

  if (ollama.ok) {
    if (state.ollama.status === 'down') {
      await handleOllamaRecovery();
    } else {
      state.ollama.status = 'up';
      state.ollama.lastError = null;
    }
  } else {
    await handleOllamaDown(ollama.error ?? 'unknown');
  }

  // -- Redis --
  const redis = await checkRedis();
  state.redis.lastCheck = now;

  if (redis.ok) {
    if (state.redis.status === 'down') {
      handleRedisRecovery();
    } else {
      state.redis.status = 'up';
      state.redis.lastError = null;
    }
  } else {
    await handleRedisDown(redis.error ?? 'unknown');
  }

  logger.debug(
    { ollama: state.ollama.status, redis: state.redis.status },
    'health-monitor: tick complete'
  );
}

/**
 * Returns a snapshot of all tracked service statuses.
 */
export function getServiceHealth(): ServiceHealthMap {
  return {
    ollama: { ...state.ollama },
    redis:  { ...state.redis },
  };
}
