/**
 * Self-Healing Health Monitor
 *
 * Periodically probes Ollama and Redis, tracks their status in memory,
 * and broadcasts Telegram alerts on state transitions (DOWN / RECOVERED).
 * Called every ~60 seconds from the automations engine scheduler.
 *
 * **Alert behaviour:**
 * - Ollama outages trigger user-facing Telegram alerts after 3
 *   consecutive failures (`ALERT_THRESHOLD`) to suppress transient blips.
 * - Redis outages are logged but not user-alerted (Redis is non-fatal;
 *   the app falls back to direct DB access).
 * - Alerts are rate-limited to once per 5 minutes per service+status
 *   via a Redis-backed TTL key (falls through if Redis itself is down).
 *
 * **Recovery:** When a previously-down service passes its probe, a
 * recovery alert is sent and the in-memory state is reset.
 *
 * The public API exposes {@link runHealthTick} (one probe cycle) and
 * {@link getServiceHealth} (read-only snapshot for the `/api/health` route).
 *
 * @module services/health-monitor
 */

import { config } from '../config.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { sendTelegramNotification } from './telegram.js';
import { logActivity } from './activity-log.js';
import { cacheGet, cacheSet } from './cache.js';

// ---- Types ----

type ServiceStatus = 'up' | 'down' | 'unknown';

interface ServiceState {
  status: ServiceStatus;
  lastCheck: string;
  lastError: string | null;
  alertSent: boolean;
  consecutiveFailures: number;
}

interface ServiceHealthMap {
  ollama: ServiceState;
  redis: ServiceState;
}

// ---- In-Memory State ----

const state: ServiceHealthMap = {
  ollama: { status: 'unknown', lastCheck: '', lastError: null, alertSent: false, consecutiveFailures: 0 },
  redis:  { status: 'unknown', lastCheck: '', lastError: null, alertSent: false, consecutiveFailures: 0 },
};

// Use config.ollamaBaseUrl — NOT a hardcoded hostname (container name varies by deploy)
const OLLAMA_TIMEOUT_MS = 5000;
// Only alert after 3 consecutive failures (~3 minutes) to avoid transient blips
const ALERT_THRESHOLD = 3;

// ---- Health Checks ----

async function checkOllama(): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, {
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
  // If ADMIN_TELEGRAM_CHAT_ID is set, alert only that chat ID
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    return [{ user_id: 'admin', external_id: adminChatId }];
  }
  try {
    return db.prepare(
      "SELECT user_id, external_id FROM channel_links WHERE channel = 'telegram' AND is_verified = 1 LIMIT 10"
    ).all() as Array<{ user_id: string; external_id: string }>;
  } catch (err) {
    logger.error({ err }, 'health-monitor: failed to query Telegram recipients');
    return [];
  }
}

/**
 * Returns true if an alert for the given service+status was already sent
 * within the last 5 minutes (Redis-backed rate limit).
 * Sets the key if not rate-limited, so the caller just fires without extra logic.
 */
async function isAlertRateLimited(service: string, status: string): Promise<boolean> {
  const key = `alert:${service}:${status}`;
  try {
    const existing = await cacheGet(key);
    if (existing) return true;
    await cacheSet(key, '1', 300); // 5-minute TTL
    return false;
  } catch {
    // Redis unavailable — fall through (don't suppress alerts)
    return false;
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
  state.ollama.consecutiveFailures++;
  state.ollama.lastError = error;

  // Don't flip to "down" or alert until we've seen consecutive failures
  // (transient blips, cold starts after KEEP_ALIVE timeout, brief network hiccups)
  if (state.ollama.consecutiveFailures < ALERT_THRESHOLD) {
    logger.debug(
      { error, failures: state.ollama.consecutiveFailures, threshold: ALERT_THRESHOLD },
      'health-monitor: Ollama check failed (waiting for threshold before alerting)'
    );
    return;
  }

  const prev = state.ollama.status;
  state.ollama.status = 'down';

  logger.warn({ error, prev, consecutiveFailures: state.ollama.consecutiveFailures }, 'health-monitor: Ollama is DOWN');

  if (!state.ollama.alertSent) {
    state.ollama.alertSent = true;

    if (!await isAlertRateLimited('ollama', 'down')) {
      await broadcastTelegram(
        '⚠️ [Ollama] is offline (' + error + '). Chat is using cloud AI — no action needed.'
      );
    }

    // Log activity for any connected users
    const recipients = getTelegramRecipients();
    for (const r of recipients) {
      if (r.user_id !== 'admin') {
        logActivity(r.user_id, 'service_down', 'Ollama offline, using cloud AI fallback', 'warning');
      }
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

    if (!await isAlertRateLimited('ollama', 'up')) {
      await broadcastTelegram(
        '✅ [Ollama] recovered. Back to normal.'
      );
    }

    const recipients = getTelegramRecipients();
    for (const r of recipients) {
      if (r.user_id !== 'admin') {
        logActivity(r.user_id, 'service_up', 'Ollama recovered, switching back to local AI', 'info');
      }
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
    // Note: cannot use Redis rate limit when Redis itself is down — just log
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
 * Run a single health-check tick for all monitored services.
 *
 * Probes Ollama (HTTP GET to `/api/tags`) and Redis (cache read)
 * sequentially, then updates the in-memory state machine. On state
 * transitions (up->down or down->up), triggers the appropriate
 * handler which may broadcast Telegram alerts and log activity entries.
 *
 * Designed to be called from a `setInterval` every ~60 seconds.
 * Each tick is independent and idempotent.
 */
export async function runHealthTick(): Promise<void> {
  const now = new Date().toISOString();

  // -- Ollama --
  const ollama = await checkOllama();
  state.ollama.lastCheck = now;

  if (ollama.ok) {
    state.ollama.consecutiveFailures = 0;
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
 * Return a read-only snapshot of all tracked service statuses.
 *
 * Returns shallow copies of the Ollama and Redis state objects so
 * callers (e.g. the `/api/health` route) cannot mutate internal state.
 *
 * @returns Current {@link ServiceHealthMap} with status, lastCheck,
 *          lastError, alertSent, and consecutiveFailures for each service
 */
export function getServiceHealth(): ServiceHealthMap {
  return {
    ollama: { ...state.ollama },
    redis:  { ...state.redis },
  };
}
