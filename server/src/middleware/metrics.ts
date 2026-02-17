// ============================================================
// In-memory request metrics for live health dashboard
// Lightweight — no DB writes, rolling window counters
// ============================================================

import type { Request, Response, NextFunction } from 'express';

interface EndpointStats {
  count: number;
  errors: number;
  totalLatencyMs: number;
}

interface MetricsSnapshot {
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  requestsPerMinute: number;
  endpoints: Record<string, EndpointStats>;
  uptime: number;
  memoryMb: number;
  activeConnections: number;
  windowStart: string;
}

// Rolling 5-minute window
const WINDOW_MS = 5 * 60 * 1000;

let windowStart = Date.now();
let totalRequests = 0;
let totalErrors = 0;
let totalLatencyMs = 0;
const endpointStats = new Map<string, EndpointStats>();
let activeSSEConnections = 0;

function resetIfStale(): void {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    totalRequests = 0;
    totalErrors = 0;
    totalLatencyMs = 0;
    endpointStats.clear();
  }
}

/** Express middleware — track request count, errors, latency */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    resetIfStale();
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;
    const key = `${req.method} ${req.route?.path || req.path}`;

    totalRequests++;
    totalLatencyMs += duration;
    if (isError) totalErrors++;

    const existing = endpointStats.get(key);
    if (existing) {
      existing.count++;
      existing.totalLatencyMs += duration;
      if (isError) existing.errors++;
    } else {
      endpointStats.set(key, {
        count: 1,
        errors: isError ? 1 : 0,
        totalLatencyMs: duration,
      });
    }
  });

  next();
}

export function getMetricsSnapshot(): MetricsSnapshot {
  resetIfStale();
  const elapsedMinutes = Math.max((Date.now() - windowStart) / 60000, 0.1);

  const endpoints: Record<string, EndpointStats> = {};
  for (const [key, stats] of endpointStats) {
    endpoints[key] = { ...stats };
  }

  return {
    totalRequests,
    totalErrors,
    avgLatencyMs: totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0,
    requestsPerMinute: Math.round(totalRequests / elapsedMinutes * 10) / 10,
    endpoints,
    uptime: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    activeConnections: activeSSEConnections,
    windowStart: new Date(windowStart).toISOString(),
  };
}

export function incrementSSEConnections(): void { activeSSEConnections++; }
export function decrementSSEConnections(): void { activeSSEConnections = Math.max(0, activeSSEConnections - 1); }
