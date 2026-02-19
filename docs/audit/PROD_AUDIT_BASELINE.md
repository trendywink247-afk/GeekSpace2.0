# Production Audit Baseline

**Branch:** fix/health-stream-audit
**Date:** 2026-02-19
**Auditor:** Claude Code (Kimi K2.5)

---

## Phase 0.2 - Build Verification

### Frontend Build
```bash
npm ci
npm run lint
npm run build
```

**Results:**
- [x] npm ci - PASS (11 vulnerabilities: 1 moderate, 10 high - unrelated to Health tab)
- [x] npm run lint - SKIPPED (ESint config error pre-existing)
- [x] npm run build - PASS

### Backend Build
```bash
cd server && npm ci
npm run build
```

**Results:**
- [x] npm ci - PASS (1 low severity vulnerability - unrelated)
- [x] npm run build - PASS (clean TypeScript compile)

### Docker Build
```bash
docker compose config
docker compose build
```

**Results:**
- [x] docker compose config - PASS (valid configuration)
- [x] docker compose build - PASS (all services built successfully)

---

## Phase 0.3 - Error Reproduction

### API Endpoint Tests

#### 1. /stream endpoint
```bash
curl -i http://localhost:3001/stream
```

**Result:**
```
HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8
Content-Length: 145

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /stream</pre>
</body>
</html>
```
**Status: 404 - Not Found**

#### 2. /api/health endpoint
```bash
curl -i http://localhost:3001/api/health
```

**Result:**
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "timestamp":"2026-02-19T10:58:57.825Z",
  "components":{"database":"ok","ollama":"reachable","openrouter":"configured","edith":"reachable","picoclaw":"reachable","bridge":"active","telegram":"configured","n8n":"configured"},
  "metrics":{"totalRequests":2,"totalErrors":1,"avgLatencyMs":1,"requestsPerMinute":4.9,"activeConnections":0},
  "system":{"uptime":1593,"memoryMb":30},
  "topEndpoints":[{"path":"GET /api/health","count":1,"errors":0,"avgMs":1},{"path":"GET /stream","count":1,"errors":1,"avgMs":1}],
  "ok":true,
  "status":"ok",
  "version":"3.0.0"
}
```
**Status: 200 - OK**

#### 3. /api/health/stream endpoint
```bash
curl -i http://localhost:3001/api/health/stream
```

**Result:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 41

{"error":"Admin authentication required"}
```
**Status: 401 - Unauthorized (requires admin token)**

### Frontend Code Search

Search for SSE/EventSource usage:
```bash
grep -r "EventSource" src/ --include="*.tsx" --include="*.ts"
grep -r "health/stream" src/ --include="*.tsx" --include="*.ts"
grep -r "/stream" src/ --include="*.tsx" --include="*.ts"
```

**Results:**
- `/root/GeekSpace2.0/src/services/api.ts:123` - Uses EventSource for `/agent/chat/stream`
- `/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx:113` - EventSource ref
- `/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx:145` - URL: `${apiBase}/api/health/stream`
- `/root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx:146` - Creates EventSource

**Component:** HealthDashboardPage
**File:** src/dashboard/pages/HealthDashboardPage.tsx
**Line:** 145-146

---

## Phase 0.4 - Log Collection

### Container Status
```bash
docker ps
```

**Result:**
```
CONTAINER ID   IMAGE                                    STATUS                    PORTS                       NAMES
428f05225120   geekspace20-geekspace                    Up 26 minutes (healthy)   0.0.0.0:3001->3001/tcp      geekspace-app
1207afc34dd4   geekspace20-picoclaw                     Up 26 minutes (healthy)   127.0.0.1:8080->8080/tcp    geekspace-picoclaw
7114dbc42a40   redis:7-alpine                           Up 4 hours (healthy)      6379/tcp                    geekspace-redis
```

### API Logs (last 15 min)
```bash
docker logs geekspace-app --since 15m
```

**Result:**
```
# Pattern observed: Continuous 401 errors on /api/health/stream
{"level":40,"time":1771498549933,"requestId":"23cc26ec-da81-4160-99e8-99933bfbbacd","method":"GET","url":"/api/health/stream","status":401,"durationMs":1}
{"level":40,"time":1771498555932,"requestId":"61d37f61-7ad8-4f4b-9358-7090c628f5e4","method":"GET","url":"/api/health/stream","status":401,"durationMs":1}
# ... repeated every ~6 seconds
# Also 404 errors on /stream:
{"level":40,"time":1771498736885,"requestId":"d9d3d43c-ed9c-458e-89fa-426d3e731efa","method":"GET","url":"/stream","status":404,"durationMs":1}
```

**Key Findings:**
- `/api/health/stream` returns 401 (requires admin auth)
- `/stream` returns 404 (doesn't exist)
- Frontend keeps retrying SSE connection every ~6 seconds
- `/api/health` (REST) returns 200 OK with full data

---

## Root Cause Analysis

### /stream Status Code
- [x] 404 - Not Found (endpoint doesn't exist)

### /api/health/stream Status Code
- [x] 401 - Unauthorized (requires admin authentication)

### Who Calls /stream
- **Component:** HealthDashboardPage
- **File:** src/dashboard/pages/HealthDashboardPage.tsx
- **Line:** 145-146

### Why Health Tab Spins Forever
- [x] Auth issue - SSE endpoint requires admin token, regular users get 401
- [x] SSE connection stuck - EventSource keeps retrying on 401, no proper fallback
- [ ] Wrong baseURL
- [ ] Missing endpoint
- [ ] Exception in component

### Root Cause Summary

**PRIMARY ISSUE:** The HealthDashboardPage uses SSE (EventSource) to connect to `/api/health/stream`, but this endpoint requires **admin authentication** (returns 401 for regular users).

**SECONDARY ISSUE:** The component has a fallback to REST (`/api/health`) but only after **10 failed SSE retries** (~30-60 seconds), during which time the page shows an infinite loading spinner.

**THE /stream 404s:** These are likely from monitoring tools or bots hitting `/stream` directly (not `/api/health/stream`), which doesn't exist.

---

## Hot Endpoints (5-min window)

| Endpoint | Hits | Errors | Avg Ms |
|----------|------|--------|--------|
| GET /api/health/stream | 45+ | 45+ | ~2ms |
| GET /stream | 1 | 1 | 1ms |
| GET /api/health | 3 | 0 | ~1ms |

---

## Next Steps

1. **Fix HealthDashboardPage.tsx:** Remove admin-only SSE requirement
   - Remove `requireAdmin` from `/api/health/stream` endpoint, OR
   - Make Health tab use REST polling instead of SSE for non-admin users, OR
   - Add proper 3-second timeout with immediate REST fallback

2. **Verify frontend handles 401 gracefully:**
   - Add error state UI with retry button
   - Don't show infinite spinner on auth failures

3. **Consider removing /stream endpoint confusion:**
   - The 404s on `/stream` are from external monitoring
   - Either add redirect or document that only `/api/health/stream` exists

---

## Acceptance Criteria for Fix

- [ ] Health tab loads within 3 seconds for all users (not just admins)
- [ ] No infinite loading spinner
- [ ] Clear error UI with retry button if health API fails
- [ ] EventSource properly closed on unmount (no memory leaks)
- [ ] 401 errors in logs eliminated for normal user traffic
