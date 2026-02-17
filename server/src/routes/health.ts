// ============================================================
// Live API Health Dashboard — SSE endpoint
// Pushes health snapshot every 5 seconds
// ============================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getMetricsSnapshot, incrementSSEConnections, decrementSSEConnections } from '../middleware/metrics.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { edithProbe } from '../services/edith.js';
import { picoClawProbe } from '../services/picoclaw.js';
import { logger } from '../logger.js';

export const healthRouter = Router();

// ---- Component Health Probes ----

async function probeComponents() {
  let dbOk = false;
  try {
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    dbOk = row?.ok === 1;
  } catch { /* db not ready */ }

  let ollamaOk = false;
  if (config.ollamaBaseUrl) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(timer);
      ollamaOk = r.ok;
    } catch { /* unreachable */ }
  }

  const edithOk = await edithProbe();
  const picoOk = config.picoClawEnabled ? await picoClawProbe() : false;
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

// ---- SSE Stream ----

healthRouter.get('/stream', requireAuth, async (req: Request, res: Response) => {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  incrementSSEConnections();
  logger.info('SSE health stream connected');

  // Send first snapshot immediately on connect (no 5s wait)
  try {
    const metrics = getMetricsSnapshot();
    const components = await probeComponents();
    const payload = {
      timestamp: new Date().toISOString(),
      components,
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
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch (err) {
    logger.error({ err }, 'SSE health stream initial push error');
  }

  // Send snapshot every 5 seconds
  const interval = setInterval(async () => {
    try {
      const metrics = getMetricsSnapshot();
      const components = await probeComponents();

      const payload = {
        timestamp: new Date().toISOString(),
        components,
        metrics: {
          totalRequests: metrics.totalRequests,
          totalErrors: metrics.totalErrors,
          avgLatencyMs: metrics.avgLatencyMs,
          requestsPerMinute: metrics.requestsPerMinute,
          activeConnections: metrics.activeConnections,
        },
        system: {
          uptime: metrics.uptime,
          memoryMb: metrics.memoryMb,
        },
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

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      logger.error({ err }, 'SSE health stream error');
    }
  }, 5000);

  // Auto-close after 30 minutes
  const timeout = setTimeout(() => {
    res.write('event: timeout\ndata: {}\n\n');
    cleanup();
  }, 30 * 60 * 1000);

  function cleanup() {
    clearInterval(interval);
    clearTimeout(timeout);
    decrementSSEConnections();
    res.end();
  }

  req.on('close', cleanup);
});
