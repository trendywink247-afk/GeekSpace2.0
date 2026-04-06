// ============================================================
// In-memory request metrics for live health dashboard
// Lightweight — no DB writes, rolling window counters
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';

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

/**
 * Prometheus text-format exposition.
 * Returns metrics in the format Prometheus scrapes:
 *   # HELP metric_name description
 *   # TYPE metric_name counter|gauge|histogram
 *   metric_name{label="value"} 42
 */
export function getPrometheusMetrics(): string {
  resetIfStale();
  const lines: string[] = [];
  const mem = process.memoryUsage();

  // Process info
  lines.push('# HELP agentin_process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE agentin_process_uptime_seconds counter');
  lines.push(`agentin_process_uptime_seconds ${process.uptime().toFixed(0)}`);

  lines.push('# HELP agentin_process_memory_bytes Memory usage in bytes');
  lines.push('# TYPE agentin_process_memory_bytes gauge');
  lines.push(`agentin_process_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
  lines.push(`agentin_process_memory_bytes{type="heap_total"} ${mem.heapTotal}`);
  lines.push(`agentin_process_memory_bytes{type="rss"} ${mem.rss}`);
  lines.push(`agentin_process_memory_bytes{type="external"} ${mem.external}`);

  // Request metrics (from rolling window)
  lines.push('# HELP agentin_http_requests_total Total HTTP requests in rolling window');
  lines.push('# TYPE agentin_http_requests_total counter');
  lines.push(`agentin_http_requests_total ${totalRequests}`);

  lines.push('# HELP agentin_http_errors_total Total HTTP errors (4xx+5xx) in rolling window');
  lines.push('# TYPE agentin_http_errors_total counter');
  lines.push(`agentin_http_errors_total ${totalErrors}`);

  lines.push('# HELP agentin_http_latency_ms_avg Average HTTP latency in ms over rolling window');
  lines.push('# TYPE agentin_http_latency_ms_avg gauge');
  const avgLatency = totalRequests > 0 ? totalLatencyMs / totalRequests : 0;
  lines.push(`agentin_http_latency_ms_avg ${avgLatency.toFixed(2)}`);

  // SSE active connections
  lines.push('# HELP agentin_sse_connections_active Currently active SSE connections');
  lines.push('# TYPE agentin_sse_connections_active gauge');
  lines.push(`agentin_sse_connections_active ${activeSSEConnections}`);

  // Per-endpoint breakdown
  lines.push('# HELP agentin_endpoint_requests_total Requests per endpoint');
  lines.push('# TYPE agentin_endpoint_requests_total counter');
  for (const [key, stats] of endpointStats) {
    const sanitized = key.replace(/"/g, '\\"');
    lines.push(`agentin_endpoint_requests_total{endpoint="${sanitized}"} ${stats.count}`);
  }

  lines.push('# HELP agentin_endpoint_errors_total Errors per endpoint');
  lines.push('# TYPE agentin_endpoint_errors_total counter');
  for (const [key, stats] of endpointStats) {
    const sanitized = key.replace(/"/g, '\\"');
    lines.push(`agentin_endpoint_errors_total{endpoint="${sanitized}"} ${stats.errors}`);
  }

  // Application-level gauges — queried from DB at scrape time
  try {
    const userCount = (db.prepare('SELECT count(*) as c FROM users').get() as { c: number }).c;
    lines.push('# HELP agentin_users_total Total registered users');
    lines.push('# TYPE agentin_users_total gauge');
    lines.push(`agentin_users_total ${userCount}`);

    const convCount = (db.prepare('SELECT count(*) as c FROM conversations WHERE is_active = 1').get() as { c: number }).c;
    lines.push('# HELP agentin_active_conversations Active (not-idle) conversation threads');
    lines.push('# TYPE agentin_active_conversations gauge');
    lines.push(`agentin_active_conversations ${convCount}`);

    const msgsToday = (db.prepare("SELECT count(*) as c FROM conversation_log WHERE created_at >= date('now')").get() as { c: number }).c;
    lines.push('# HELP agentin_messages_today Messages logged today');
    lines.push('# TYPE agentin_messages_today gauge');
    lines.push(`agentin_messages_today ${msgsToday}`);

    const remindersActive = (db.prepare('SELECT count(*) as c FROM reminders WHERE completed = 0').get() as { c: number }).c;
    lines.push('# HELP agentin_reminders_active Active reminders');
    lines.push('# TYPE agentin_reminders_active gauge');
    lines.push(`agentin_reminders_active ${remindersActive}`);

    const goalsActive = (db.prepare("SELECT count(*) as c FROM goals WHERE status = 'active'").get() as { c: number }).c;
    lines.push('# HELP agentin_goals_active Active goals');
    lines.push('# TYPE agentin_goals_active gauge');
    lines.push(`agentin_goals_active ${goalsActive}`);

    const pendingConfirms = (db.prepare("SELECT count(*) as c FROM pending_confirmations WHERE status = 'pending'").get() as { c: number }).c;
    lines.push('# HELP agentin_confirmations_pending Pending tool confirmations');
    lines.push('# TYPE agentin_confirmations_pending gauge');
    lines.push(`agentin_confirmations_pending ${pendingConfirms}`);
  } catch { /* non-fatal — DB might not be ready at early scrape */ }

  return lines.join('\n') + '\n';
}
