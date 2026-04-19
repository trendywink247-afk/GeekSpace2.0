// ============================================================
// Live API Health Dashboard — SSE endpoint
// Pushes health snapshot every 15 seconds from cached probe results.
// Probes run in background every 30s (parallel) — not on every request.
// ============================================================

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getMetricsSnapshot, incrementSSEConnections, decrementSSEConnections } from '../../middleware/metrics.js';
import { requireAdminToken } from '../../middleware/auth.js';

import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { edithProbe } from '../../services/edith.js';
import { picoClawProbe } from '../../services/picoclaw.js';
import { logger } from '../../logger.js';

export const healthRouter = Router();

// Read version once at module load — package.json sits at the server package root.
const PACKAGE_VERSION: string = (() => {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
})();

healthRouter.get('/version', (_req: Request, res: Response) => {
  res.json({
    version: PACKAGE_VERSION,
    commit: process.env.GIT_SHA ?? 'unknown',
    nodeVersion: process.version,
  });
});

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

  // Ollama, Edith, PicoClaw, SearXNG, Meilisearch, Qdrant — run in PARALLEL
  const [ollamaOk, edithOk, picoOk, searxngOk, meiliOk, qdrantOk, browserOk] = await Promise.all([
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
    // SearXNG
    (async () => {
      try {
        const r = await fetch('http://geekspace-searxng:8080/healthz', { signal: AbortSignal.timeout(3000) });
        return r.ok;
      } catch { return false; }
    })(),
    // Meilisearch
    (async () => {
      try {
        const r = await fetch('http://geekspace-meilisearch:7700/health', { signal: AbortSignal.timeout(3000) });
        return r.ok;
      } catch { return false; }
    })(),
    // Qdrant
    (async () => {
      try {
        const r = await fetch('http://geekspace-qdrant:6333/healthz', { signal: AbortSignal.timeout(3000) });
        return r.ok || r.status === 200;
      } catch { return false; }
    })(),
    // Browser Agent
    (async () => {
      try {
        const r = await fetch('http://geekspace-browser:3010/health', {
          headers: { 'X-Browser-Secret': process.env.BROWSER_SECRET || 'agentin-browser-2026' },
          signal: AbortSignal.timeout(3000),
        });
        return r.ok;
      } catch { return false; }
    })(),
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
    searxng: searxngOk ? 'reachable' : 'unreachable',
    meilisearch: meiliOk ? 'reachable' : 'unreachable',
    qdrant: qdrantOk ? 'reachable' : 'unreachable',
    browser: browserOk ? 'reachable' : 'not_running',
  };
}

/** Returns the most recent cached probe result. */
export function getCachedComponents(): ComponentStatus {
  return cachedComponents;
}

// ── Health alert tracking ───────────────────────────────────
// Track previous component states so we can alert on transitions.
let prevComponents: ComponentStatus = {};
const alertSentAt: Record<string, number> = {}; // prevent re-alerting within 1h

async function sendHealthAlert(service: string, prevStatus: string, newStatus: string): Promise<void> {
  try {
    // Rate limit: max 1 alert per service per hour
    const now = Date.now();
    if (alertSentAt[service] && now - alertSentAt[service] < 60 * 60 * 1000) return;
    alertSentAt[service] = now;

    const emoji = newStatus === 'down' || newStatus === 'unreachable' ? '🔴' : '🟢';
    const msg = `${emoji} Health Alert: <b>${service}</b> changed from <b>${prevStatus}</b> → <b>${newStatus}</b>`;
    logger.warn({ service, prevStatus, newStatus }, 'Health state transition detected');

    // Send to admin users with Telegram linked
    const adminUsers = db.prepare(
      "SELECT u.id FROM users u JOIN channel_links cl ON cl.user_id = u.id WHERE cl.channel = 'telegram' AND cl.is_verified = 1 AND u.role = 'admin' LIMIT 3"
    ).all() as Array<{ id: string }>;

    if (adminUsers.length === 0) return;

    const { sendTelegramNotification } = await import('../../services/telegram.js');
    for (const admin of adminUsers) {
      const link = db.prepare(
        "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
      ).get(admin.id) as { external_id: string } | undefined;
      if (link) await sendTelegramNotification(link.external_id, msg).catch(() => {});
    }
  } catch (err) {
    logger.warn({ err, service }, 'Failed to send health alert');
  }
}

/**
 * Start background probe cache — runs probes every 30s in parallel.
 * Call once at server startup. Safe to call in each cluster worker.
 */
export function startHealthProbeCache(): void {
  const refresh = async () => {
    try {
      const newComponents = await runProbes();
      // Check for state transitions and send alerts
      for (const [service, newStatus] of Object.entries(newComponents)) {
        const prevStatus = prevComponents[service];
        if (prevStatus && prevStatus !== newStatus) {
          const isNowBad = newStatus === 'down' || newStatus === 'unreachable';
          const wasGood = prevStatus === 'ok' || prevStatus === 'reachable' || prevStatus === 'active';
          const isNowGood = newStatus === 'ok' || newStatus === 'reachable' || newStatus === 'active';
          const wasBad = prevStatus === 'down' || prevStatus === 'unreachable';
          if ((wasGood && isNowBad) || (wasBad && isNowGood)) {
            sendHealthAlert(service, prevStatus, newStatus).catch(() => {});
          }
        }
      }
      prevComponents = { ...newComponents };
      cachedComponents = newComponents;
      cacheAge = Date.now();
    } catch (err) {
      logger.warn({ err }, 'Health probe refresh failed');
    }
  };

  // Immediate first probe so cache is warm before first request
  const probeStart = Date.now();
  refresh().then(() => {
    logger.info({ firstProbeDurationMs: Date.now() - probeStart }, 'Health probe cache warmed');
  }).catch(() => { /* already logged in refresh() */ });
  setInterval(refresh, 30_000);
  logger.info('Health probe cache started (30s interval, parallel probes)');
}

// ── 56.8: Detailed health endpoint ─────────────────────────────
// GET /api/health/detailed — per-service status with latency (live probes, admin use)

type ServiceDetail = {
  status: 'ok' | 'degraded' | 'down' | 'not_configured';
  latencyMs: number | null;
  detail?: string;
};

async function probe<T>(fn: () => Promise<T>, timeoutMs = 3000): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    await fn();
    clearTimeout(timer);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, latencyMs: Date.now() - start };
  }
}

healthRouter.get('/detailed', requireAdminToken, async (_req: Request, res: Response) => {
  const services: Record<string, ServiceDetail> = {};
  const start = Date.now();

  // DB
  const dbResult = await probe(async () => {
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    if (row?.ok !== 1) throw new Error('DB query failed');
  });
  services.database = {
    status: dbResult.ok ? 'ok' : 'down',
    latencyMs: dbResult.latencyMs,
  };

  // Redis (via cache ping)
  try {
    const { cacheGet } = await import('../../services/cache.js');
    const redisResult = await probe(async () => {
      await cacheGet('health:ping');
    }, 2000);
    services.redis = {
      status: redisResult.ok ? 'ok' : 'degraded',
      latencyMs: redisResult.latencyMs,
      detail: redisResult.ok ? undefined : 'Redis unavailable — cache disabled',
    };
  } catch {
    services.redis = { status: 'down', latencyMs: null, detail: 'Cache module unavailable' };
  }

  // Ollama
  if (config.ollamaBaseUrl) {
    const ollamaResult = await probe(async () => {
      const r = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    });
    services.ollama = { status: ollamaResult.ok ? 'ok' : 'down', latencyMs: ollamaResult.latencyMs };
  } else {
    services.ollama = { status: 'not_configured', latencyMs: null };
  }

  // OpenRouter (config check only — no charge)
  services.openrouter = {
    status: config.openrouterApiKey ? 'ok' : 'not_configured',
    latencyMs: null,
    detail: config.openrouterApiKey ? 'API key present' : 'No API key set',
  };

  // Edith / fal.ai
  const edithResult = await probe(() => edithProbe().then((ok) => { if (!ok) throw new Error('unhealthy'); }));
  services.edith = {
    status: config.edithGatewayUrl ? (edithResult.ok ? 'ok' : 'down') : 'not_configured',
    latencyMs: edithResult.latencyMs,
  };

  // fal.ai (check via config)
  services.fal = {
    status: config.falEnabled ? 'ok' : 'not_configured',
    latencyMs: null,
    detail: config.falEnabled ? 'FAL_KEY present' : 'No FAL_KEY set',
  };

  const totalMs = Date.now() - start;
  const overallStatus = Object.values(services).some((s) => s.status === 'down') ? 'degraded' : 'ok';

  res.json({
    status: overallStatus,
    checkedAt: new Date().toISOString(),
    probeTimeMs: totalMs,
    services,
    cached: cachedComponents,
    cacheAgeMs: cacheAge ? Date.now() - cacheAge : null,
  });
});

// ---- Max SSE connections to prevent runaway resource use ----
const MAX_SSE_CONNECTIONS = 25; // Supports admin dashboard + monitoring tools simultaneously
let activeSSECount = 0;

// ---- SSE Stream (admin-only, accepts token via header OR ?token= query param) ----

healthRouter.get('/stream', (req: Request, res: Response) => {
  // Inline auth: EventSource can't set headers, so accept ?token= query param too
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = headerToken || queryToken;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }

  if (activeSSECount >= MAX_SSE_CONNECTIONS) {
    logger.warn({ activeSSECount, limit: MAX_SSE_CONNECTIONS }, 'SSE connection limit reached — rejecting new stream');
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

  // Delta fingerprint excludes timestamp/cacheAgeMs which change every tick
  // even when nothing meaningful has changed — prevents defeating the delta check
  function fingerprint(p: ReturnType<typeof buildPayload>): string {
    return JSON.stringify({ components: p.components, metrics: p.metrics, system: p.system, topEndpoints: p.topEndpoints });
  }

  // Send first snapshot immediately (served from cache — instant)
  let lastFingerprint = '';
  try {
    const p = buildPayload();
    res.write(`data: ${JSON.stringify(p)}\n\n`);
    lastFingerprint = fingerprint(p);
  } catch (err) {
    logger.error({ err }, 'SSE health stream initial push error');
  }

  // Push cached snapshot every 15 seconds — skip write if nothing meaningful changed
  const interval = setInterval(() => {
    try {
      const p = buildPayload();
      const fp = fingerprint(p);
      if (fp === lastFingerprint) return; // no meaningful change — save bandwidth
      res.write(`data: ${JSON.stringify(p)}\n\n`);
      lastFingerprint = fp;
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
