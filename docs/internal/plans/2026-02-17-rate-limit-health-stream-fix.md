# Rate Limit & Health Stream Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the cascading failure where the health stream SSE reconnect loop exhausts the global rate limiter, blocking all other API requests including login.

**Architecture:** Four bugs create a cascading failure: (1) the HealthDashboardPage builds a double `/api/api/` URL, (2) EventSource can't send Authorization headers so `requireAuth` always 401s it, (3) the SSE onerror handler reconnects aggressively (3s) with no backoff or max-retry limit, and (4) the health stream shares the global rate limiter with no exemption. Each reconnect attempt generates 2 requests (301 redirect + 401 auth fail), burning through the 200-request global limit in ~7 minutes and blocking all endpoints for that IP. Fix all four root causes and harden the system so no single endpoint can starve others.

**Tech Stack:** TypeScript, Express, express-rate-limit, EventSource (browser SSE API), Caddy reverse proxy

**Root Cause Evidence:**
```
Server logs show:
  GET /api/api/health/stream 301 → GET /api/health/stream 401 (every 4 seconds)
  After ~200 hits → all requests from same IP get 429

User impact: trendywink24.7@gmail.com — account exists, onboarding_completed=0,
onboarding_step=0. Cannot login due to global rate limit exhaustion.
```

---

### Task 1: Remove requireAuth from health stream SSE

**Why:** EventSource API cannot send custom headers (no Authorization). Adding `requireAuth` to the SSE endpoint was a mistake from the audit fixes — it made the endpoint permanently inaccessible from the browser, causing infinite 401 → reconnect loops.

**Files:**
- Modify: `server/src/routes/health.ts:9` (remove import if unused)
- Modify: `server/src/routes/health.ts:56` (remove `requireAuth` from route)

**Step 1: Remove requireAuth from the SSE stream route**

In `server/src/routes/health.ts`, change line 56 from:
```typescript
healthRouter.get('/stream', requireAuth, async (req: Request, res: Response) => {
```
to:
```typescript
healthRouter.get('/stream', async (req: Request, res: Response) => {
```

Also remove the unused `requireAuth` import on line 9:
```typescript
// DELETE this line:
import { requireAuth } from '../middleware/auth.js';
```

**Step 2: Verify server compiles**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compilation, no errors.

**Step 3: Verify the endpoint responds without auth**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health/stream`
Expected: `200` (not 401)

**Step 4: Commit**

```bash
git add server/src/routes/health.ts
git commit -m "fix: remove requireAuth from health SSE stream

EventSource API cannot send Authorization headers, so requireAuth
causes permanent 401 → reconnect loops that exhaust the rate limiter."
```

---

### Task 2: Fix double /api prefix in HealthDashboardPage

**Why:** The frontend builds the URL as `/api` (from apiBase) + `/health/stream`, producing `/api/health/stream`. This is correct for direct requests to Express. But the code was generating `/api/api/health/stream` because something in the Caddy → Express chain redirects. The real fix: use the same API utility the rest of the app uses, ensuring consistent URL construction.

**Files:**
- Modify: `src/dashboard/pages/HealthDashboardPage.tsx:120-121`

**Step 1: Fix the URL construction**

In `src/dashboard/pages/HealthDashboardPage.tsx`, replace lines 120-121:
```typescript
    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
    const url = `${apiBase}/health/stream`;
```
with:
```typescript
    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
    const url = `${apiBase}/api/health/stream`;
```

**Why this works:** In production, `apiBase` becomes empty string `''`, so the URL is `/api/health/stream` — a relative path. The browser sends this directly to Caddy at the current origin. Caddy matches `handle /api/*` and proxies to `localhost:3001/api/health/stream`. Express sees `/api/health/stream` and matches the health router at `/api/health` + `/stream`. No double prefix.

In dev, `apiBase` becomes `http://localhost:3001`, so the URL is `http://localhost:3001/api/health/stream` — a direct request to Express.

**Step 2: Verify frontend compiles**

Run: `cd /root/GeekSpace2.0 && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/dashboard/pages/HealthDashboardPage.tsx
git commit -m "fix: remove double /api prefix in health stream SSE URL

Was building /api/health/stream with apiBase=/api, causing /api/api/
when proxied through Caddy. Now uses empty base in production."
```

---

### Task 3: Add exponential backoff and max retries to SSE reconnect

**Why:** The current onerror handler reconnects after a fixed 3 seconds with no limit. If the server is down or returns errors, this creates an infinite request flood. Add exponential backoff (3s → 6s → 12s → 24s → 30s cap) and a max retry limit (10 attempts), after which it shows a "Connection failed" message instead of silently hammering the server.

**Files:**
- Modify: `src/dashboard/pages/HealthDashboardPage.tsx:108-157` (the SSE connection logic)

**Step 1: Rewrite the SSE connection with backoff**

Replace the entire `connect` function and the `useEffect` that calls it (lines ~108-157) with:

```typescript
export function HealthDashboardPage() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 3000;
  const MAX_DELAY_MS = 30000;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
    const url = `${apiBase}/api/health/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
      retriesRef.current = 0; // Reset retries on successful connection
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
      retriesRef.current = 0; // Server-initiated timeout is not an error
      reconnectTimerRef.current = setTimeout(connect, 1000);
    });

    es.onerror = () => {
      es.close();
      setConnected(false);

      if (retriesRef.current >= MAX_RETRIES) {
        setError('Health stream unavailable. Refresh the page to retry.');
        return; // Stop reconnecting
      }

      retriesRef.current += 1;
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retriesRef.current - 1), MAX_DELAY_MS);
      setError(`Connection lost. Retrying in ${Math.round(delay / 1000)}s... (${retriesRef.current}/${MAX_RETRIES})`);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);
```

**Step 2: Verify frontend compiles**

Run: `cd /root/GeekSpace2.0 && npx tsc --noEmit -p tsconfig.app.json`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/dashboard/pages/HealthDashboardPage.tsx
git commit -m "fix: add exponential backoff and max retries to health SSE

Prevents infinite reconnect loops from flooding the rate limiter.
Backs off from 3s to 30s cap, stops after 10 failed attempts."
```

---

### Task 4: Exempt health stream from global rate limiter

**Why:** Even with the SSE fixes, the health stream endpoint should not count against the global rate limit. It's an internal monitoring tool that makes periodic requests. If it shares the global bucket, a user viewing the health dashboard reduces their available API budget for actual work.

**Files:**
- Modify: `server/src/index.ts:75-82` (global rate limiter config)

**Step 1: Add skip function to global rate limiter**

In `server/src/index.ts`, modify the global limiter (lines 75-82) to skip health stream requests:

```typescript
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/api/health/stream' || req.path === '/api/health',
});
```

**Step 2: Verify server compiles**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "fix: exempt health endpoints from global rate limiter

Health stream SSE and health check should not consume the global
rate limit budget, which would starve other endpoints."
```

---

### Task 5: Reset user state and deploy

**Why:** The user `trendywink24.7@gmail.com` has `onboarding_completed=0, onboarding_step=0`. They went through onboarding but it wasn't saved. The rate limiter needs to be reset (container restart). Deploy all fixes.

**Step 1: Docker build**

Run: `cd /root/GeekSpace2.0 && docker compose build geekspace --no-cache`
Expected: Build succeeds (both frontend and server compile).

**Step 2: Deploy**

```bash
docker compose up -d geekspace
rm -rf /var/www/geekspace/* && docker cp geekspace-app:/app/dist/. /var/www/geekspace/
```

Container restart automatically resets in-memory rate limit counters.

**Step 3: Verify health stream works**

Run: `curl -s -N http://localhost:3001/api/health/stream | head -c 500`
Expected: `data: {"timestamp":...}` — valid SSE data without 401.

**Step 4: Verify login works**

Run:
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"trendywink24.7@gmail.com","password":"<their-password>"}'
```
Expected: 200 with `{ user, token }` (or 401 if wrong password — but NOT 429).

**Step 5: Verify rate limiter doesn't block normal usage**

Run:
```bash
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "%{http_code} " http://localhost:3001/api/health
done
echo ""
```
Expected: `200 200 200 200 200` — health checks pass without 429.

**Step 6: Commit and push**

```bash
git push origin live-production
```
