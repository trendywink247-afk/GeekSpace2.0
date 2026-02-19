// ============================================================
// Live API Health Dashboard — SSE endpoint
// Pushes health snapshot every 15 seconds from cached probe results.
// Probes run in background every 30s (parallel) — not on every request.
// ============================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { getMetricsSnapshot, incrementSSEConnections, decrementSSEConnections } from '../middleware/metrics.js';

import { config } from '../config.js';
import { db } from '../db/index.js';
import { edithProbe } from '../services/edith.js';
import { picoClawProbe } from '../services/picoclaw.js';
import { logger } from '../logger.js';

export const healthRouter = Router();

// ---- Cached component probe result ----
// Probes run every 30s in background via startHealthProbeCache().
// Both /health and SSE stream read from this cache — zero live probing per request.

type ComponentStatus = Record<string, string>;

let cachedComponents: ComponentStatus = {
  database: 'ok',
  ollama: 'not_configured',
  openrouter: 'not_configured',
  edith: 'not_configured',
  picoclaw: 'not_configured',
  bridge: 'no_backends',
  telegram: 'not_configured',
  n8n: 'not_configured',
};
let cacheAge = 0; // epoch ms of last successful probe

async function runProbes(): Promise<ComponentStatus> {
  // DB — synchronous, always fast
  let dbOk = false;
  try {
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    dbOk = row?.ok === 1;
  } catch { /* db not ready */ }

  // Ollama, Edith, PicoClaw — run in PARALLEL
  const [ollamaOk, edithOk, picoOk] = await Promise.all([
    // Ollama
    (async () => {
      if (!config.ollamaBaseUrl) return false;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const r = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: ctrl.signal });
        clearTimeout(timer);
        return r.ok;
      } catch { return false; }
    })(),
    // Edith
    edithProbe().catch(() => false),
    // PicoClaw
    config.picoClawEnabled ? picoClawProbe().catch(() => false) : Promise.resolve(false),
  ]);

  const bridgeOk = config.bridgeEnabled && (ollamaOk || edithOk || !!config.openrouterApiKey);

  return {
    database: dbOk ? 'ok' : 'down',
    ollama: ollamaOk ? 'reachable' : (config.ollamaBaseUrl ? 'unreachable' : 'not_configured'),
    openrouter: config.openrouterApiKey ? 'configured' : 'not_configured',
    edith: edithOk ? 'reachable' : (config.edithGatewayUrl ? 'unreachable' : 'not_configured'),
    picoclaw: picoOk ? 'reachable' : (config.picoClawEnabled ? 'unreachable' : 'not_configured'),
    bridge: bridgeOk ? 'active' : (config.bridgeEnabled ? 'no_backends' : 'disabled'),
    telegram: config.telegramBotToken ? 'configured' : 'not_configured',
    n8n: config.n8nBaseUrl ? 'configured' : 'not_configured',
  };
}

/** Returns the most recent cached probe result. */
export function getCachedComponents(): ComponentStatus {
  return cachedComponents;
}

/**
 * Start background probe cache — runs probes every 30s in parallel.
 * Call once at server startup. Safe to call in each cluster worker.
 */
export function startHealthProbeCache(): void {
  const refresh = async () => {
    try {
      cachedComponents = await runProbes();
      cacheAge = Date.now();
    } catch (err) {
      logger.warn({ err }, 'Health probe refresh failed');
    }
  };

  // Immediate first probe so cache is warm before first request
  refresh();
  setInterval(refresh, 30_000);
  logger.info('Health probe cache started (30s interval, parallel probes)');
}

// ---- Max SSE connections to prevent runaway resource use ----
const MAX_SSE_CONNECTIONS = 5;
let activeSSECount = 0;

// ---- SSE Stream ----

healthRouter.get('/stream', (req: Request, res: Response) => {
  if (activeSSECount >= MAX_SSE_CONNECTIONS) {
    res.status(429).json({ error: 'Too many health stream connections' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  activeSSECount++;
  incrementSSEConnections();
  logger.info({ activeSSECount }, 'SSE health stream connected');

  function buildPayload() {
    const metrics = getMetricsSnapshot();
    return {
      timestamp: new Date().toISOString(),
      cacheAgeMs: cacheAge ? Date.now() - cacheAge : null,
      components: cachedComponents,
      metrics: {
        totalRequests: metrics.totalRequests,
        totalErrors: metrics.totalErrors,
        avgLatencyMs: metrics.avgLatencyMs,
        requestsPerMinute: metrics.requestsPerMinute,
        activeConnections: metrics.activeConnections,
      },
      system: { uptime: metrics.uptime, memoryMb: metrics.memoryMb },
      topEndpoints: Object.entries(metrics.endpoints)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([path, stats]) => ({
          path,
          count: stats.count,
          errors: stats.errors,
          avgMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
        })),
    };
  }

  // Send first snapshot immediately (served from cache — instant)
  try {
    res.write(`data: ${JSON.stringify(buildPayload())}\n\n`);
  } catch (err) {
    logger.error({ err }, 'SSE health stream initial push error');
  }

  // Push cached snapshot every 15 seconds (no probing — just read cache)
  const interval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify(buildPayload())}\n\n`);
    } catch (err) {
      logger.error({ err }, 'SSE health stream error');
    }
  }, 15_000);

  // Auto-close after 30 minutes
  const timeout = setTimeout(() => {
    res.write('event: timeout\ndata: {}\n\n');
    cleanup();
  }, 30 * 60 * 1000);

  function cleanup() {
    clearInterval(interval);
    clearTimeout(timeout);
    activeSSECount--;
    decrementSSEConnections();
    res.end();
  }

  req.on('close', cleanup);
});
