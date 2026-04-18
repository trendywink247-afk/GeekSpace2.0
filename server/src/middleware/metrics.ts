// ============================================================
// Prometheus metrics middleware for Agentin
//
// Exposes text-format metrics at GET /api/metrics (no auth —
// Prometheus scrapes from a private Docker network).
//
// Metric families:
//   HTTP:        http_requests_total, http_request_duration_seconds
//   Application: agentin_active_users, agentin_llm_requests_total,
//                agentin_llm_tokens_total, agentin_goals_total,
//                agentin_delegations_total
//   System:      nodejs_heap_used_bytes, nodejs_uptime_seconds
//   Legacy:      agentin_process_*, agentin_http_*, agentin_sse_*,
//                agentin_endpoint_*, agentin_users_total,
//                agentin_active_conversations, agentin_messages_today,
//                agentin_reminders_active, agentin_goals_active,
//                agentin_confirmations_pending
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Rolling 5-minute window (used for JSON snapshot / RPM calculation only)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Cumulative counters — never reset (monotonically increasing, Prometheus-safe)
// ---------------------------------------------------------------------------

/** http_requests_total{method,path,status} */
const httpRequestsTotal = new Map<string, number>();

/** http_request_duration_seconds histogram buckets + sum + count per {method,path} */
const HIST_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

interface HistogramEntry {
  buckets: Map<number, number>; // le → cumulative count
  sum: number;
  count: number;
}

const httpDurationHistogram = new Map<string, HistogramEntry>();

function observeDuration(method: string, path: string, durationSec: number): void {
  const key = `${method}:${path}`;
  let entry = httpDurationHistogram.get(key);
  if (!entry) {
    const buckets = new Map<number, number>();
    for (const le of HIST_BUCKETS) buckets.set(le, 0);
    entry = { buckets, sum: 0, count: 0 };
    httpDurationHistogram.set(key, entry);
  }
  for (const le of HIST_BUCKETS) {
    if (durationSec <= le) {
      entry.buckets.set(le, (entry.buckets.get(le) ?? 0) + 1);
    }
  }
  entry.sum += durationSec;
  entry.count += 1;
}

// ---------------------------------------------------------------------------
// Express middleware — track every request
// ---------------------------------------------------------------------------

/** Express middleware — collect request count, latency, status */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const durationSec = durationMs / 1000;
    const isError = res.statusCode >= 400;
    const method = req.method;
    // Use matched route path (e.g. /api/users/:id) when available to avoid label explosion
    const path = req.route?.path ?? req.path;
    const status = String(res.statusCode);

    // ---- Cumulative counter ----
    const labelKey = `${method}|${path}|${status}`;
    httpRequestsTotal.set(labelKey, (httpRequestsTotal.get(labelKey) ?? 0) + 1);

    // ---- Histogram ----
    observeDuration(method, path, durationSec);

    // ---- Rolling window (for JSON snapshot) ----
    resetIfStale();
    totalRequests++;
    totalLatencyMs += durationMs;
    if (isError) totalErrors++;

    const key = `${method} ${path}`;
    const existing = endpointStats.get(key);
    if (existing) {
      existing.count++;
      existing.totalLatencyMs += durationMs;
      if (isError) existing.errors++;
    } else {
      endpointStats.set(key, {
        count: 1,
        errors: isError ? 1 : 0,
        totalLatencyMs: durationMs,
      });
    }
  });

  next();
}

// ---------------------------------------------------------------------------
// JSON snapshot (used by health dashboard, not Prometheus)
// ---------------------------------------------------------------------------

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
    requestsPerMinute: Math.round((totalRequests / elapsedMinutes) * 10) / 10,
    endpoints,
    uptime: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    activeConnections: activeSSEConnections,
    windowStart: new Date(windowStart).toISOString(),
  };
}

export function incrementSSEConnections(): void { activeSSEConnections++; }
export function decrementSSEConnections(): void { activeSSEConnections = Math.max(0, activeSSEConnections - 1); }

// ---------------------------------------------------------------------------
// Prometheus text format helpers
// ---------------------------------------------------------------------------

function escapeLabel(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function labels(pairs: Record<string, string>): string {
  const parts = Object.entries(pairs)
    .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
    .join(',');
  return `{${parts}}`;
}

// ---------------------------------------------------------------------------
// Prometheus text-format exposition
// ---------------------------------------------------------------------------

/**
 * Render all metrics in Prometheus text format (text/plain; version=0.0.4).
 * Called on every scrape — DB queries are synchronous (better-sqlite3).
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = [];
  const mem = process.memoryUsage();

  // ---- System / Node.js metrics ----
  lines.push('# HELP nodejs_heap_used_bytes V8 heap used in bytes');
  lines.push('# TYPE nodejs_heap_used_bytes gauge');
  lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);

  lines.push('# HELP nodejs_uptime_seconds Node.js process uptime in seconds');
  lines.push('# TYPE nodejs_uptime_seconds counter');
  lines.push(`nodejs_uptime_seconds ${process.uptime().toFixed(3)}`);

  // Keep legacy process metrics so existing Grafana dashboards keep working
  lines.push('# HELP agentin_process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE agentin_process_uptime_seconds counter');
  lines.push(`agentin_process_uptime_seconds ${process.uptime().toFixed(0)}`);

  lines.push('# HELP agentin_process_memory_bytes Memory usage in bytes');
  lines.push('# TYPE agentin_process_memory_bytes gauge');
  lines.push(`agentin_process_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
  lines.push(`agentin_process_memory_bytes{type="heap_total"} ${mem.heapTotal}`);
  lines.push(`agentin_process_memory_bytes{type="rss"} ${mem.rss}`);
  lines.push(`agentin_process_memory_bytes{type="external"} ${mem.external}`);

  // ---- HTTP request counter {method, path, status} ----
  lines.push('# HELP http_requests_total Total HTTP requests by method, path, and status code');
  lines.push('# TYPE http_requests_total counter');
  for (const [labelKey, count] of httpRequestsTotal) {
    const [method, path, status] = labelKey.split('|');
    lines.push(`http_requests_total${labels({ method: method ?? '', path: path ?? '', status: status ?? '' })} ${count}`);
  }

  // Legacy aggregate counter (no labels) — kept for backward compat
  let legacyTotal = 0;
  let legacyErrors = 0;
  for (const [labelKey, count] of httpRequestsTotal) {
    legacyTotal += count;
    const parts = labelKey.split('|');
    const statusCode = parseInt(parts[2] ?? '0', 10);
    if (statusCode >= 400) legacyErrors += count;
  }
  lines.push('# HELP agentin_http_requests_total Total HTTP requests (all time)');
  lines.push('# TYPE agentin_http_requests_total counter');
  lines.push(`agentin_http_requests_total ${legacyTotal}`);

  lines.push('# HELP agentin_http_errors_total Total HTTP errors (4xx+5xx, all time)');
  lines.push('# TYPE agentin_http_errors_total counter');
  lines.push(`agentin_http_errors_total ${legacyErrors}`);

  // ---- HTTP request duration histogram {method, path} ----
  lines.push('# HELP http_request_duration_seconds HTTP request latency histogram in seconds');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [key, entry] of httpDurationHistogram) {
    const [method, path] = key.split(':');
    const base = labels({ method: method ?? '', path: path ?? '' });
    // Cumulative bucket counts (le label)
    let cumulative = 0;
    for (const le of HIST_BUCKETS) {
      cumulative += entry.buckets.get(le) ?? 0;
      lines.push(`http_request_duration_seconds_bucket${base.slice(0, -1)},le="${le}"} ${cumulative}`);
    }
    lines.push(`http_request_duration_seconds_bucket${base.slice(0, -1)},le="+Inf"} ${entry.count}`);
    lines.push(`http_request_duration_seconds_sum${base} ${entry.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count${base} ${entry.count}`);
  }

  // Legacy rolling-window latency gauge (kept for existing dashboards)
  resetIfStale();
  const avgLatency = totalRequests > 0 ? totalLatencyMs / totalRequests : 0;
  lines.push('# HELP agentin_http_latency_ms_avg Average HTTP latency in ms over rolling 5-min window');
  lines.push('# TYPE agentin_http_latency_ms_avg gauge');
  lines.push(`agentin_http_latency_ms_avg ${avgLatency.toFixed(2)}`);

  // ---- SSE connections ----
  lines.push('# HELP agentin_sse_connections_active Currently active SSE connections');
  lines.push('# TYPE agentin_sse_connections_active gauge');
  lines.push(`agentin_sse_connections_active ${activeSSEConnections}`);

  // ---- Per-endpoint breakdown (rolling window, legacy) ----
  lines.push('# HELP agentin_endpoint_requests_total Requests per endpoint (5-min rolling window)');
  lines.push('# TYPE agentin_endpoint_requests_total counter');
  for (const [key, stats] of endpointStats) {
    lines.push(`agentin_endpoint_requests_total{endpoint="${escapeLabel(key)}"} ${stats.count}`);
  }

  lines.push('# HELP agentin_endpoint_errors_total Errors per endpoint (5-min rolling window)');
  lines.push('# TYPE agentin_endpoint_errors_total counter');
  for (const [key, stats] of endpointStats) {
    lines.push(`agentin_endpoint_errors_total{endpoint="${escapeLabel(key)}"} ${stats.errors}`);
  }

  // ---- Application-level metrics — queried from DB at scrape time ----
  try {
    // -- Total users (legacy) --
    const userCount = (db.prepare('SELECT count(*) as c FROM users').get() as { c: number }).c;
    lines.push('# HELP agentin_users_total Total registered users');
    lines.push('# TYPE agentin_users_total gauge');
    lines.push(`agentin_users_total ${userCount}`);

    // -- Active users in last 15 minutes --
    const activeUsers = (db.prepare(
      "SELECT count(DISTINCT user_id) as c FROM conversation_log WHERE created_at >= datetime('now', '-15 minutes')"
    ).get() as { c: number }).c;
    lines.push('# HELP agentin_active_users Distinct users with activity in the last 15 minutes');
    lines.push('# TYPE agentin_active_users gauge');
    lines.push(`agentin_active_users ${activeUsers}`);

    // -- Active conversations (legacy) --
    const convCount = (db.prepare('SELECT count(*) as c FROM conversations WHERE is_active = 1').get() as { c: number }).c;
    lines.push('# HELP agentin_active_conversations Active (non-idle) conversation threads');
    lines.push('# TYPE agentin_active_conversations gauge');
    lines.push(`agentin_active_conversations ${convCount}`);

    // -- Messages today (legacy) --
    const msgsToday = (db.prepare("SELECT count(*) as c FROM conversation_log WHERE created_at >= date('now')").get() as { c: number }).c;
    lines.push('# HELP agentin_messages_today Messages logged today');
    lines.push('# TYPE agentin_messages_today gauge');
    lines.push(`agentin_messages_today ${msgsToday}`);

    // -- Active reminders (legacy) --
    const remindersActive = (db.prepare('SELECT count(*) as c FROM reminders WHERE completed = 0').get() as { c: number }).c;
    lines.push('# HELP agentin_reminders_active Active reminders');
    lines.push('# TYPE agentin_reminders_active gauge');
    lines.push(`agentin_reminders_active ${remindersActive}`);

    // -- Goals by status (replaces legacy agentin_goals_active) --
    type GoalRow = { status: string; c: number };
    const goalRows = db.prepare(
      "SELECT status, count(*) as c FROM goals GROUP BY status"
    ).all() as GoalRow[];
    lines.push('# HELP agentin_goals_total Goals grouped by status');
    lines.push('# TYPE agentin_goals_total gauge');
    for (const row of goalRows) {
      lines.push(`agentin_goals_total${labels({ status: row.status })} ${row.c}`);
    }
    // Legacy: agentin_goals_active (backward compat for existing dashboards)
    const goalsActive = goalRows.find(r => r.status === 'active')?.c ?? 0;
    lines.push('# HELP agentin_goals_active Active goals (legacy; use agentin_goals_total{status="active"})');
    lines.push('# TYPE agentin_goals_active gauge');
    lines.push(`agentin_goals_active ${goalsActive}`);

    // -- Pending confirmations (legacy) --
    const pendingConfirms = (db.prepare("SELECT count(*) as c FROM pending_confirmations WHERE status = 'pending'").get() as { c: number }).c;
    lines.push('# HELP agentin_confirmations_pending Pending tool confirmations (human-in-the-loop)');
    lines.push('# TYPE agentin_confirmations_pending gauge');
    lines.push(`agentin_confirmations_pending ${pendingConfirms}`);

    // -- LLM requests: aggregate from usage_events by provider + model --
    type LLMRow = { provider: string; model: string; c: number };
    const llmRows = db.prepare(
      "SELECT provider, model, count(*) as c FROM usage_events GROUP BY provider, model"
    ).all() as LLMRow[];
    lines.push('# HELP agentin_llm_requests_total LLM requests grouped by provider and model');
    lines.push('# TYPE agentin_llm_requests_total counter');
    for (const row of llmRows) {
      lines.push(`agentin_llm_requests_total${labels({ provider: row.provider || 'unknown', model: row.model || 'unknown' })} ${row.c}`);
    }

    // -- LLM tokens by provider + direction (input / output) --
    type TokenRow = { provider: string; tokens_in: number; tokens_out: number };
    const tokenRows = db.prepare(
      "SELECT provider, sum(tokens_in) as tokens_in, sum(tokens_out) as tokens_out FROM usage_events GROUP BY provider"
    ).all() as TokenRow[];
    lines.push('# HELP agentin_llm_tokens_total LLM tokens consumed by provider and direction (input/output)');
    lines.push('# TYPE agentin_llm_tokens_total counter');
    for (const row of tokenRows) {
      const prov = row.provider || 'unknown';
      lines.push(`agentin_llm_tokens_total${labels({ provider: prov, direction: 'input' })} ${row.tokens_in ?? 0}`);
      lines.push(`agentin_llm_tokens_total${labels({ provider: prov, direction: 'output' })} ${row.tokens_out ?? 0}`);
    }

    // -- Delegation pipeline: aggregate from delegation_log --
    type DelegRow = { from_agent: string; to_agent: string; status: string; c: number };
    const delegRows = db.prepare(
      "SELECT from_agent, to_agent, status, count(*) as c FROM delegation_log GROUP BY from_agent, to_agent, status"
    ).all() as DelegRow[];
    lines.push('# HELP agentin_delegations_total Agent-to-agent delegations grouped by from_agent, to_agent, and status');
    lines.push('# TYPE agentin_delegations_total counter');
    for (const row of delegRows) {
      lines.push(`agentin_delegations_total${labels({ from_agent: row.from_agent, to_agent: row.to_agent, status: row.status })} ${row.c}`);
    }
  } catch { /* non-fatal — DB may not be fully migrated at early scrape */ }

  return lines.join('\n') + '\n';
}
