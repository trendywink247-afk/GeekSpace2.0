# GeekSpace Ecosystem Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove internal name leaks, activate Telegram bot, build a live API health dashboard, prep WhatsApp architecture, and smoke test the entire system.

**Architecture:** Modular feature blocks deployed incrementally. Backend uses Express middleware for metrics collection, SSE for real-time push. Frontend adds one new lazy-loaded page. No external dependencies added.

**Tech Stack:** TypeScript, Express, better-sqlite3, React, Lucide, SSE (EventSource API), Bash/curl for smoke tests.

---

### Task 1: Remove "OPENCLAW POWERED" Badge

**Files:**
- Modify: `src/landing/sections/EngineSection.tsx:85`

**Step 1: Replace the badge text**

In `src/landing/sections/EngineSection.tsx` line 85, change:
```tsx
<span className="text-sm font-mono text-[#7B61FF]">OPENCLAW POWERED</span>
```
to:
```tsx
<span className="text-sm font-mono text-[#7B61FF]">WEEBO ENGINE</span>
```

**Step 2: Verify no other user-facing references**

Run a case-insensitive search across the frontend for `openclaw`, `pico` (as user-facing text — not code identifiers), and verify nothing else leaks. Known safe: backend variable names like `picoClawUrl`, `OPENCLAW_IDENTITY` (server-side prompt, never shown to end users), PicoClaw service names. Only user-facing strings matter.

**Step 3: Commit**

```bash
git add src/landing/sections/EngineSection.tsx
git commit -m "fix: replace OPENCLAW POWERED badge with WEEBO ENGINE"
```

---

### Task 2: Activate Telegram Bot

This task is configuration-only — no code changes. All Telegram bot code is already implemented.

**Files:**
- Reference: `server/src/services/telegram.ts` (bot init, webhook registration)
- Reference: `server/src/routes/webhooks.ts` (webhook handler)
- Reference: `server/src/services/message-router.ts` (message routing)
- Modify: `.env` (local, gitignored)

**Step 1: Create the bot via BotFather**

1. Open Telegram, message `@BotFather`
2. Send `/newbot`
3. Follow prompts: pick a name (e.g., "GeekSpace Weebo") and username (e.g., `geekspace_weebo_bot`)
4. Copy the API token BotFather gives you

**Step 2: Configure environment**

Add to `.env`:
```
TELEGRAM_BOT_TOKEN=<token-from-botfather>
TELEGRAM_WEBHOOK_SECRET=<generate-random-string>
```

Generate webhook secret:
```bash
openssl rand -hex 32
```

**Step 3: Restart server**

```bash
cd /root/GeekSpace2.0
fuser -k 3001/tcp
OLLAMA_BASE_URL=http://localhost:32778 OLLAMA_MODEL=llama3.1:8b OLLAMA_TIMEOUT_MS=120000 node server/dist/index.js
```

The server auto-registers the webhook on startup via `initTelegramBot()` in `server/src/index.ts:214`.

**Step 4: Verify bot responds**

1. In Telegram, open your new bot
2. Send `/start` — should respond with a welcome message
3. Send `/help` — should list available commands
4. Send `/link <email>` — should generate a linking code

**Step 5: No commit needed** — `.env` is gitignored, no code changed.

---

### Task 3: Create Metrics Middleware

**Files:**
- Create: `server/src/middleware/metrics.ts`

**Step 1: Write the metrics collector**

Create `server/src/middleware/metrics.ts`:

```typescript
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
```

**Step 2: Verify it compiles**

```bash
cd /root/GeekSpace2.0/server && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add server/src/middleware/metrics.ts
git commit -m "feat: add in-memory metrics middleware for health dashboard"
```

---

### Task 4: Create SSE Health Stream Endpoint

**Files:**
- Create: `server/src/routes/health.ts`
- Modify: `server/src/index.ts` (mount route + add metrics middleware)

**Step 1: Create the health stream router**

Create `server/src/routes/health.ts`:

```typescript
// ============================================================
// Live API Health Dashboard — SSE endpoint
// Pushes health snapshot every 5 seconds
// ============================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getMetricsSnapshot, incrementSSEConnections, decrementSSEConnections } from '../middleware/metrics.js';
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

healthRouter.get('/stream', (req: Request, res: Response) => {
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
```

**Step 2: Wire metrics middleware and health route into index.ts**

In `server/src/index.ts`, add the import near the top (after line 14):

```typescript
import { metricsMiddleware } from './middleware/metrics.js';
import { healthRouter } from './routes/health.js';
```

Add the metrics middleware after `app.use(requestLogger);` (after line 67):

```typescript
app.use(metricsMiddleware);
```

Mount the health router with the other routes (after line 184, before `app.use(errorHandler)`):

```typescript
app.use('/api/health', healthRouter);
```

**Step 3: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 4: Commit**

```bash
git add server/src/routes/health.ts server/src/index.ts
git commit -m "feat: add SSE health stream endpoint with live metrics"
```

---

### Task 5: Create HealthDashboardPage Frontend

**Files:**
- Create: `src/dashboard/pages/HealthDashboardPage.tsx`

**Step 1: Write the health dashboard page**

Create `src/dashboard/pages/HealthDashboardPage.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Database,
  Cpu,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  Zap,
  Server,
  RefreshCw,
  ArrowUpRight,
  Send,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';

// ---- Types ----

interface ComponentStatus {
  database: string;
  ollama: string;
  openrouter: string;
  edith: string;
  picoclaw: string;
  bridge: string;
  telegram: string;
  n8n: string;
}

interface TopEndpoint {
  path: string;
  count: number;
  errors: number;
  avgMs: number;
}

interface HealthSnapshot {
  timestamp: string;
  components: ComponentStatus;
  metrics: {
    totalRequests: number;
    totalErrors: number;
    avgLatencyMs: number;
    requestsPerMinute: number;
    activeConnections: number;
  };
  system: {
    uptime: number;
    memoryMb: number;
  };
  topEndpoints: TopEndpoint[];
}

// ---- Status helpers ----

function statusColor(status: string): string {
  switch (status) {
    case 'ok': case 'reachable': case 'configured': case 'active':
      return '#61FF7B';
    case 'unreachable': case 'down': case 'no_backends':
      return '#FF6161';
    case 'not_configured': case 'disabled':
      return '#A7ACB8';
    default:
      return '#FFD761';
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const componentIcons: Record<string, typeof Database> = {
  database: Database,
  ollama: Cpu,
  openrouter: Wifi,
  edith: Server,
  picoclaw: Zap,
  bridge: ArrowUpRight,
  telegram: Send,
  n8n: RefreshCw,
};

const componentLabels: Record<string, string> = {
  database: 'Database',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  edith: 'Premium Engine',
  picoclaw: 'Weebo Engine',
  bridge: 'Bridge',
  telegram: 'Telegram',
  n8n: 'n8n Automations',
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ---- Component ----

export function HealthDashboardPage() {
  const { token } = useAuthStore();
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = import.meta.env.VITE_API_URL || '';
    const url = `${apiBase}/api/health/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as HealthSnapshot;
        setSnapshot(data);
      } catch { /* ignore malformed */ }
    };

    es.addEventListener('timeout', () => {
      es.close();
      setConnected(false);
      // Auto-reconnect after timeout
      reconnectTimerRef.current = setTimeout(connect, 1000);
    });

    es.onerror = () => {
      es.close();
      setConnected(false);
      setError('Connection lost. Reconnecting...');
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#7B61FF] animate-spin" />
      </div>
    );
  }

  const errorRate = snapshot.metrics.totalRequests > 0
    ? Math.round((snapshot.metrics.totalErrors / snapshot.metrics.totalRequests) * 100 * 10) / 10
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl md:text-4xl font-bold mb-1"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            API Health
          </h1>
          <p className="text-[#A7ACB8] flex items-center gap-2">
            {connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#61FF7B] animate-pulse" />
                Live — updates every 5s
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#FF6161]" />
                {error || 'Disconnected'}
              </>
            )}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-[#7B61FF]/40 text-[#7B61FF]"
        >
          {new Date(snapshot.timestamp).toLocaleTimeString()}
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Requests',
            value: snapshot.metrics.totalRequests,
            icon: Activity,
            color: '#7B61FF',
          },
          {
            label: 'Errors',
            value: snapshot.metrics.totalErrors,
            icon: AlertTriangle,
            color: snapshot.metrics.totalErrors > 0 ? '#FF6161' : '#61FF7B',
          },
          {
            label: 'Avg Latency',
            value: `${snapshot.metrics.avgLatencyMs}ms`,
            icon: Clock,
            color: snapshot.metrics.avgLatencyMs > 1000 ? '#FFD761' : '#61FF7B',
          },
          {
            label: 'Req/min',
            value: snapshot.metrics.requestsPerMinute,
            icon: Zap,
            color: '#7B61FF',
          },
          {
            label: 'Uptime',
            value: formatUptime(snapshot.system.uptime),
            icon: Server,
            color: '#61FF7B',
          },
        ].map((stat) => (
          <Card key={stat.label} className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-[#A7ACB8]">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-[#F4F6FF]">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Component Status Grid */}
      <div>
        <h2 className="text-lg font-semibold text-[#F4F6FF] mb-3">Components</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(snapshot.components).map(([key, status]) => {
            const Icon = componentIcons[key] || Wifi;
            const color = statusColor(status);
            return (
              <Card
                key={key}
                className="bg-[#0B0B10] border-[#7B61FF]/20 transition-all hover:border-[#7B61FF]/40"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F4F6FF] truncate">
                      {componentLabels[key] || key}
                    </p>
                    <p className="text-xs" style={{ color }}>
                      {statusLabel(status)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Error Rate + Memory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-5">
            <h3 className="text-sm text-[#A7ACB8] mb-2">Error Rate (5-min window)</h3>
            <div className="flex items-end gap-3">
              <span
                className="text-3xl font-bold"
                style={{ color: errorRate > 5 ? '#FF6161' : errorRate > 0 ? '#FFD761' : '#61FF7B' }}
              >
                {errorRate}%
              </span>
              <span className="text-sm text-[#A7ACB8] mb-1">
                {snapshot.metrics.totalErrors} / {snapshot.metrics.totalRequests} requests
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-5">
            <h3 className="text-sm text-[#A7ACB8] mb-2">Memory Usage</h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-[#7B61FF]">
                {snapshot.system.memoryMb} MB
              </span>
              <span className="text-sm text-[#A7ACB8] mb-1">
                heap used
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Endpoints */}
      {snapshot.topEndpoints.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[#F4F6FF] mb-3">Hot Endpoints (5-min window)</h2>
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#7B61FF]/10">
                    <th className="text-left text-[#A7ACB8] font-medium px-4 py-3">Endpoint</th>
                    <th className="text-right text-[#A7ACB8] font-medium px-4 py-3">Hits</th>
                    <th className="text-right text-[#A7ACB8] font-medium px-4 py-3">Errors</th>
                    <th className="text-right text-[#A7ACB8] font-medium px-4 py-3">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.topEndpoints.map((ep) => (
                    <tr key={ep.path} className="border-b border-[#7B61FF]/5 hover:bg-[#7B61FF]/5 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[#F4F6FF] text-xs">{ep.path}</td>
                      <td className="px-4 py-2.5 text-right text-[#F4F6FF]">{ep.count}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: ep.errors > 0 ? '#FF6161' : '#61FF7B' }}>
                        {ep.errors}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: ep.avgMs > 1000 ? '#FFD761' : '#A7ACB8' }}>
                        {ep.avgMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* SSE Connections */}
      <div className="text-center text-xs text-[#A7ACB8]/50 py-2">
        {snapshot.metrics.activeConnections} active stream{snapshot.metrics.activeConnections !== 1 ? 's' : ''} · Window resets every 5 min
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
cd /root/GeekSpace2.0 && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/dashboard/pages/HealthDashboardPage.tsx
git commit -m "feat: add real-time health dashboard page"
```

---

### Task 6: Wire Health Dashboard into DashboardApp

**Files:**
- Modify: `src/dashboard/DashboardApp.tsx`

**Step 1: Add Activity icon to imports (line 4)**

In `src/dashboard/DashboardApp.tsx`, the `Activity` icon is already available via lucide-react. Check line 4-6 — if `Activity` is not in the import list, add it. (It may already be imported; if so, skip this sub-step.)

**Step 2: Add lazy import for HealthDashboardPage**

After line 34 (RecipesPage lazy import), add:

```typescript
const HealthDashboardPage = lazy(() => import('./pages/HealthDashboardPage').then(m => ({ default: m.HealthDashboardPage })));
```

**Step 3: Extend PageType union**

On line 39, add `'health'` to the PageType union:

```typescript
type PageType = 'overview' | 'portfolio' | 'usage' | 'billing' | 'memory' | 'connections' | 'agent' | 'reminders' | 'automations' | 'recipes' | 'pico' | 'terminal' | 'health' | 'settings';
```

**Step 4: Add sidebar menu item**

In the `menuItems` array (between `settings` and the closing `]`, so it appears before Settings), add at line 103 (before the terminal entry):

```typescript
{ id: 'health', label: 'Health', icon: Activity },
```

Place it after `pico` (Weebo's) and before `terminal`.

**Step 5: Add renderPage case**

In the `renderPage` switch (around line 142), add before the `case 'terminal'`:

```typescript
case 'health':
  return <HealthDashboardPage />;
```

**Step 6: Verify frontend compiles**

```bash
cd /root/GeekSpace2.0 && npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/dashboard/DashboardApp.tsx
git commit -m "feat: wire health dashboard into sidebar navigation"
```

---

### Task 7: WhatsApp Architecture Prep — Backend Routing

**Files:**
- Modify: `server/src/services/message-router.ts:181-197`
- Modify: `server/src/config.ts`
- Modify: `.env.example`

**Step 1: Add WhatsApp config vars**

In `server/src/config.ts`, add after the Telegram section (after line 91):

```typescript
  // WhatsApp Business (future phase)
  whatsappBusinessId: process.env.WHATSAPP_BUSINESS_ID || '',
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
```

**Step 2: Add WhatsApp vars to .env.example**

After the Telegram section (after line 76), add:

```
# ---- WhatsApp Business (future — not yet active) ----
# Requires Meta Business verification + WhatsApp Business API access.
WHATSAPP_BUSINESS_ID=
WHATSAPP_TOKEN=
WHATSAPP_VERIFY_TOKEN=
```

**Step 3: Uncomment WhatsApp case in message-router.ts**

In `server/src/services/message-router.ts`, replace the commented-out WhatsApp case (lines 190-193) with a placeholder log:

```typescript
    case 'whatsapp':
      // WhatsApp Business API integration — future phase
      logger.warn({ externalId: response.externalId }, 'WhatsApp send not yet implemented');
      break;
```

**Step 4: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 5: Commit**

```bash
git add server/src/services/message-router.ts server/src/config.ts .env.example
git commit -m "feat: prep WhatsApp routing architecture and env vars"
```

---

### Task 8: WhatsApp Architecture Prep — Frontend "Coming Soon" Card

**Files:**
- Modify: `src/dashboard/pages/ConnectionsPage.tsx`

**Step 1: Add WhatsApp "Coming Soon" handling**

In `ConnectionsPage.tsx`, find the `handleConnect` function (line 92). Add a WhatsApp guard before the existing Telegram check:

```typescript
    if (type === 'whatsapp') {
      // Coming soon — no action yet
      return;
    }
```

**Step 2: Verify the integration list already includes WhatsApp**

Check that the backend's integrations list already returns a `whatsapp` entry. If it does, the card already renders. The `colorMap` on line 50 already has `whatsapp: '#25d366'`. The integration card just needs a "Coming Soon" badge overlay.

Find the section in the JSX where integration cards are rendered. Look for the connect/disconnect button area. Add a conditional "Coming Soon" badge for WhatsApp:

Where the action button is rendered for each integration, wrap it to show "Coming Soon" badge instead for whatsapp type integrations. The exact implementation depends on the card structure — the key is: if `integration.type === 'whatsapp'`, show a "Coming Soon" badge instead of the connect button.

**Step 3: Verify frontend compiles**

```bash
cd /root/GeekSpace2.0 && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/dashboard/pages/ConnectionsPage.tsx
git commit -m "feat: add WhatsApp 'Coming Soon' card in Connections"
```

---

### Task 9: Build & Deploy

**Files:**
- None new

**Step 1: Full backend build**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 2: Full frontend build**

```bash
cd /root/GeekSpace2.0 && npx vite build
```

**Step 3: Deploy frontend**

```bash
cp -r /root/GeekSpace2.0/dist/* /var/www/geekspace/
```

**Step 4: Rebuild Docker containers**

```bash
cd /root/GeekSpace2.0 && docker compose up -d --build geekspace
```

**Step 5: Verify health**

```bash
curl -s http://localhost:3001/api/health | jq
```

All components should show appropriate status.

**Step 6: Commit any build artifacts if needed (unlikely — dist/ is gitignored)**

---

### Task 10: Write Smoke Test Script

**Files:**
- Create: `scripts/smoke-test.sh`

**Step 1: Create the smoke test script**

Create `scripts/smoke-test.sh`:

```bash
#!/usr/bin/env bash
# ============================================================
# GeekSpace Smoke Test Suite
# Hits key API endpoints and reports pass/fail
# Usage: ./scripts/smoke-test.sh [base_url]
# ============================================================

set -euo pipefail

BASE="${1:-http://localhost:3001}"
PASS=0
FAIL=0

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
bold()  { printf '\033[1m%s\033[0m\n' "$1"; }

check() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="${4:-200}"
  local body="${5:-}"

  local args=(-s -o /dev/null -w '%{http_code}' -X "$method")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local status
  status=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    green "  PASS  $name ($status)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (got $status, expected $expected_status)"
    FAIL=$((FAIL + 1))
  fi
}

check_auth() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="${4:-200}"
  local body="${5:-}"

  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" -H "Authorization: Bearer $TOKEN")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local status
  status=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    green "  PASS  $name ($status)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (got $status, expected $expected_status)"
    FAIL=$((FAIL + 1))
  fi
}

check_sse() {
  local name="$1"
  local path="$2"

  local output
  output=$(curl -s -N --max-time 8 "${BASE}${path}" 2>/dev/null | head -1 || echo "")

  if echo "$output" | grep -q "data:"; then
    green "  PASS  $name (SSE streaming)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (no SSE data received)"
    FAIL=$((FAIL + 1))
  fi
}

bold "=========================================="
bold "  GeekSpace Smoke Test"
bold "  Target: $BASE"
bold "=========================================="
echo ""

# ---- Public endpoints ----
bold "[Public Endpoints]"
check "GET /api/health" GET "/api/health"
check "GET /api/billing/plans" GET "/api/billing/plans"
check "GET /api/agent/personalities" GET "/api/agent/personalities"

echo ""

# ---- Auth ----
bold "[Authentication]"
TOKEN=$(curl -s -X POST "${BASE}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@demo.dev","password":"demo123"}' \
  2>/dev/null | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  green "  PASS  POST /api/auth/login (got JWT)"
  PASS=$((PASS + 1))
else
  red "  FAIL  POST /api/auth/login (no token)"
  FAIL=$((FAIL + 1))
  bold "Cannot continue without auth token. Aborting."
  exit 1
fi

echo ""

# ---- Authenticated endpoints ----
bold "[Authenticated Endpoints]"
check_auth "GET /api/agent/config" GET "/api/agent/config"
check_auth "GET /api/billing/plan" GET "/api/billing/plan"
check_auth "GET /api/billing/usage" GET "/api/billing/usage"
check_auth "GET /api/recipes" GET "/api/recipes"
check_auth "GET /api/pico/agents" GET "/api/pico/agents"
check_auth "GET /api/usage/summary" GET "/api/usage/summary"

echo ""

# ---- SSE ----
bold "[SSE Streams]"
check_sse "GET /api/health/stream" "/api/health/stream"

echo ""

# ---- Summary ----
bold "=========================================="
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  green "  ALL $TOTAL TESTS PASSED"
else
  red "  $FAIL/$TOTAL TESTS FAILED"
fi
bold "=========================================="

exit "$FAIL"
```

**Step 2: Make it executable**

```bash
chmod +x /root/GeekSpace2.0/scripts/smoke-test.sh
```

**Step 3: Run the smoke tests**

```bash
/root/GeekSpace2.0/scripts/smoke-test.sh
```

All tests should pass.

**Step 4: Commit**

```bash
git add scripts/smoke-test.sh
git commit -m "feat: add automated smoke test script"
```

---

### Task 11: Manual Smoke Test Walkthrough

After all automated tests pass, visually verify in the browser:

1. **Landing page** — "WEEBO ENGINE" badge visible (not "OPENCLAW")
2. **Login** — alex@demo.dev / demo123
3. **Overview** — loads with briefing card, quick stats
4. **Portfolio** — portfolio page renders, public chat works
5. **Usage** — charts load
6. **Billing** — plans grid, currency toggle
7. **Memory** — categories display, delete works
8. **Connections** — Telegram linking UI, WhatsApp "Coming Soon"
9. **Agent Settings** — personality picker works
10. **Reminders** — list loads
11. **Automations** — list loads
12. **Recipes** — card grid, activate/deactivate
13. **Weebo's** — fleet page loads
14. **Terminal** — commands execute
15. **Health** — live dashboard with green indicators, request counter updating
16. **Settings** — profile settings load

No code changes — this is a verification step only.

---

## Summary

| Task | Description | Type |
|------|-------------|------|
| 1 | Remove "OPENCLAW POWERED" badge | Fix |
| 2 | Activate Telegram bot | Config |
| 3 | Create metrics middleware | Feature |
| 4 | Create SSE health stream endpoint | Feature |
| 5 | Create HealthDashboardPage frontend | Feature |
| 6 | Wire health dashboard into DashboardApp | Integration |
| 7 | WhatsApp backend routing prep | Feature |
| 8 | WhatsApp "Coming Soon" card | Feature |
| 9 | Build & deploy | Deploy |
| 10 | Automated smoke tests | Test |
| 11 | Manual smoke test walkthrough | Test |
