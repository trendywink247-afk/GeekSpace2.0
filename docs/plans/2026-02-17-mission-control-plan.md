# Mission Control Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone, private admin monitoring dashboard at `api.geekspace.space` — a single HTML file with live SSE data, user analytics, onboarding funnel, system vitals, request feed, and billing summary.

**Architecture:** Three pieces: (1) a new Express admin router with a single `GET /api/admin/dashboard` endpoint that queries SQLite for all analytics + merges in-memory metrics, protected by a simple password header; (2) a single self-contained `index.html` file with inline CSS/JS that fetches data and connects to the existing SSE stream; (3) a Caddy config block for `api.geekspace.space`. No React, no build step, no dependencies.

**Tech Stack:** Express (existing server), SQLite (existing DB), vanilla HTML/CSS/JS, EventSource (SSE), Canvas API (latency chart), Caddy

---

### Task 1: Add ADMIN_DASHBOARD_PASSWORD to config

**Files:**
- Modify: `server/src/config.ts:130` (add new config entry)
- Modify: `.env.example` (document the var)

**Step 1: Add config entry**

In `server/src/config.ts`, add after line 131 (`resendFromEmail`):

```typescript
  // Admin dashboard
  adminDashboardPassword: process.env.ADMIN_DASHBOARD_PASSWORD || '',
```

**Step 2: Add to .env.example**

After the `RESEND_FROM_EMAIL` line, add:

```env
# ---- Admin Dashboard (api.geekspace.space) ----
# Password for the private admin monitoring dashboard
ADMIN_DASHBOARD_PASSWORD=
```

**Step 3: Set the password in .env**

```bash
# Generate a strong password and add to .env
echo "ADMIN_DASHBOARD_PASSWORD=$(openssl rand -hex 16)" >> /root/GeekSpace2.0/.env
```

**Step 4: Verify server compiles**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compilation.

**Step 5: Commit**

```bash
git add server/src/config.ts .env.example
git commit -m "feat: add ADMIN_DASHBOARD_PASSWORD config for mission control"
```

---

### Task 2: Create admin router with /api/admin/dashboard endpoint

**Files:**
- Create: `server/src/routes/admin.ts`
- Modify: `server/src/index.ts` (import + mount)

**Step 1: Create the admin router**

Create `server/src/routes/admin.ts` with the following content:

```typescript
// ============================================================
// Admin Dashboard API — private endpoint for Mission Control
// Auth: X-Admin-Password header checked against env var
// ============================================================

import { Router } from 'express';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { getMetricsSnapshot } from '../middleware/metrics.js';
import { logger } from '../logger.js';

export const adminRouter = Router();

// ---- Password middleware ----
function requireAdminPassword(req: Request, res: Response, next: () => void): void {
  if (!config.adminDashboardPassword) {
    res.status(503).json({ error: 'Admin dashboard not configured' });
    return;
  }
  const provided = req.headers['x-admin-password'] as string;
  if (!provided || provided !== config.adminDashboardPassword) {
    res.status(401).json({ error: 'Invalid admin password' });
    return;
  }
  next();
}

// ---- Main dashboard endpoint ----
adminRouter.get('/dashboard', requireAdminPassword, (_req: Request, res: Response) => {
  try {
    // -- User analytics --
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const todayUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now')").get() as { c: number }).c;
    const weekUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now', '-7 days')").get() as { c: number }).c;
    const monthUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now', '-30 days')").get() as { c: number }).c;

    // Auth provider breakdown (future-ready: column doesn't exist yet, default to 'email')
    const byProvider: Record<string, number> = { email: totalUsers, google: 0, facebook: 0, mobile: 0 };

    // Active sessions (users with usage in last 30 min)
    const activeSessions = (db.prepare(
      "SELECT COUNT(DISTINCT user_id) as c FROM usage_events WHERE created_at >= datetime('now', '-30 minutes')"
    ).get() as { c: number }).c;

    // -- Onboarding funnel --
    const funnelRows = db.prepare(
      'SELECT onboarding_step, COUNT(*) as c FROM users GROUP BY onboarding_step ORDER BY onboarding_step'
    ).all() as { onboarding_step: number; c: number }[];

    const completedCount = (db.prepare(
      'SELECT COUNT(*) as c FROM users WHERE onboarding_completed = 1'
    ).get() as { c: number }).c;

    // Build funnel array: [signed_up, step1, step2, step3, step4, step5, completed]
    const funnel = [totalUsers, 0, 0, 0, 0, 0, completedCount];
    for (const row of funnelRows) {
      if (row.onboarding_step >= 1 && row.onboarding_step <= 5) {
        // Users AT step N have completed steps 1..N
        for (let i = 1; i <= row.onboarding_step; i++) {
          funnel[i] += row.c;
        }
      }
      if (row.onboarding_step === 6) {
        // Completed users passed all steps
        for (let i = 1; i <= 5; i++) funnel[i] += row.c;
      }
    }

    // Stuck users
    const stuckUsers = db.prepare(
      "SELECT id, username, email, onboarding_step, created_at FROM users WHERE onboarding_completed = 0 AND created_at < datetime('now', '-1 hour') ORDER BY created_at DESC LIMIT 20"
    ).all() as { id: string; username: string; email: string; onboarding_step: number; created_at: string }[];

    // -- System metrics (from in-memory rolling window) --
    const metrics = getMetricsSnapshot();

    // -- Recent usage events (request log) --
    const recentEvents = db.prepare(
      "SELECT id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at FROM usage_events ORDER BY created_at DESC LIMIT 50"
    ).all() as { id: string; user_id: string; provider: string; model: string; tokens_in: number; tokens_out: number; cost_usd: number; channel: string; tool: string; created_at: string }[];

    // Resolve usernames for events
    const userIds = [...new Set(recentEvents.map(e => e.user_id))];
    const userMap: Record<string, string> = {};
    for (const uid of userIds) {
      const u = db.prepare('SELECT username FROM users WHERE id = ?').get(uid) as { username: string } | undefined;
      if (u) userMap[uid] = u.username;
    }

    const recentLogs = recentEvents.map(e => ({
      ...e,
      username: userMap[e.user_id] || 'unknown',
    }));

    // -- Billing / credits --
    const creditsToday = (db.prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as c FROM usage_events WHERE created_at >= date('now')"
    ).get() as { c: number }).c;

    const creditsWeek = (db.prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as c FROM usage_events WHERE created_at >= date('now', '-7 days')"
    ).get() as { c: number }).c;

    const topConsumers = db.prepare(
      "SELECT u.username, SUM(ue.cost_usd) as total_credits FROM usage_events ue JOIN users u ON u.id = ue.user_id WHERE ue.created_at >= date('now', '-7 days') GROUP BY ue.user_id ORDER BY total_credits DESC LIMIT 10"
    ).all() as { username: string; total_credits: number }[];

    const planDistribution = db.prepare(
      'SELECT plan, COUNT(*) as count FROM subscriptions GROUP BY plan'
    ).all() as { plan: string; count: number }[];

    // -- Signup timeline (last 30 days) --
    const signupTimeline = db.prepare(
      "SELECT date(created_at) as day, COUNT(*) as count FROM users WHERE created_at >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY day"
    ).all() as { day: string; count: number }[];

    // -- Top endpoints from metrics --
    const topEndpoints = Object.entries(metrics.endpoints)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        errors: stats.errors,
        avgMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
      }));

    res.json({
      timestamp: new Date().toISOString(),
      users: { total: totalUsers, today: todayUsers, week: weekUsers, month: monthUsers, byProvider, activeSessions },
      onboarding: { funnel, stuckUsers },
      system: { uptime: metrics.uptime, memoryMb: metrics.memoryMb },
      metrics: {
        totalRequests: metrics.totalRequests,
        totalErrors: metrics.totalErrors,
        avgLatencyMs: metrics.avgLatencyMs,
        requestsPerMinute: metrics.requestsPerMinute,
        activeConnections: metrics.activeConnections,
        windowStart: metrics.windowStart,
      },
      topEndpoints,
      recentLogs,
      billing: { creditsToday, creditsWeek, topConsumers, planDistribution },
      signupTimeline,
    });
  } catch (err) {
    logger.error({ err }, 'Admin dashboard query failed');
    res.status(500).json({ error: 'Dashboard query failed' });
  }
});
```

**Step 2: Mount the admin router in index.ts**

In `server/src/index.ts`, add the import after line 42 (`import { healthRouter }`):

```typescript
import { adminRouter } from './routes/admin.js';
```

Add the mount after line 200 (`app.use('/api/health', healthRouter);`):

```typescript
app.use('/api/admin', adminRouter);
```

**Step 3: Verify server compiles**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compilation.

**Step 4: Test the endpoint**

```bash
# Should return 401 without password
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/admin/dashboard

# Should return 200 with correct password (read from .env)
ADMIN_PW=$(grep ADMIN_DASHBOARD_PASSWORD /root/GeekSpace2.0/.env | cut -d= -f2)
curl -s http://localhost:3001/api/admin/dashboard -H "X-Admin-Password: $ADMIN_PW" | python3 -m json.tool | head -20
```

Expected: 401 without password, 200 with full JSON payload.

**Step 5: Commit**

```bash
git add server/src/routes/admin.ts server/src/index.ts
git commit -m "feat: add /api/admin/dashboard endpoint for mission control"
```

---

### Task 3: Create the Mission Control HTML dashboard

**Files:**
- Create: `/var/www/geekspace-admin/index.html`

**Step 1: Create the directory**

```bash
mkdir -p /var/www/geekspace-admin
```

**Step 2: Create the dashboard HTML file**

Create `/var/www/geekspace-admin/index.html` — a single self-contained HTML file with all CSS and JS inline. This is the largest piece of work. The file contains:

1. **Login screen** — password input, stored in sessionStorage
2. **Dashboard layout** — CSS Grid, 9 sections as described in design
3. **Data fetching** — polls `/api/admin/dashboard` every 10s
4. **SSE connection** — connects to `/api/health/stream` for live component status
5. **Canvas chart** — rolling latency sparkline
6. **Animations** — scan-lines, glow pulses, count-up numbers, terminal cursor

The complete HTML file content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GeekSpace Mission Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#05050A;--card:#0B0B10;--accent:#7B61FF;--text:#F4F6FF;--text2:#A7ACB8;
  --green:#61FF7B;--red:#FF6161;--yellow:#FFD761;--blue:#61B5FF;
  --border:rgba(123,97,255,.2);--border-hover:rgba(123,97,255,.4);
  --glow:0 0 20px rgba(123,97,255,.15);
}
body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',system-ui,sans-serif;min-height:100vh;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(123,97,255,.015) 2px,rgba(123,97,255,.015) 4px);
}

/* Login */
#login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:24px}
#login-screen h1{font-size:2rem;background:linear-gradient(135deg,var(--text),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
#login-screen input{background:var(--card);border:1px solid var(--border);color:var(--text);padding:12px 20px;border-radius:12px;font-size:1rem;width:300px;outline:none;font-family:inherit}
#login-screen input:focus{border-color:var(--accent);box-shadow:var(--glow)}
#login-screen button{background:var(--accent);color:#fff;border:none;padding:12px 32px;border-radius:12px;font-size:1rem;cursor:pointer;font-family:inherit;font-weight:600;transition:all .2s}
#login-screen button:hover{background:#6B51EF;transform:translateY(-1px)}
#login-error{color:var(--red);font-size:.875rem;min-height:20px}

/* Dashboard */
#dashboard{display:none;max-width:1400px;margin:0 auto;padding:24px 20px 60px}
.grid{display:grid;gap:16px}
.grid-5{grid-template-columns:repeat(5,1fr)}
.grid-4{grid-template-columns:repeat(4,1fr)}
.grid-3{grid-template-columns:repeat(3,1fr)}
.grid-2{grid-template-columns:repeat(2,1fr)}
@media(max-width:1024px){.grid-5,.grid-4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.grid-5,.grid-4,.grid-3,.grid-2{grid-template-columns:1fr}}

/* Cards */
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;transition:border-color .3s,box-shadow .3s}
.card:hover{border-color:var(--border-hover)}
.card.glow{animation:card-glow 2s ease-in-out}
@keyframes card-glow{0%,100%{box-shadow:none}50%{box-shadow:var(--glow)}}
.card-label{font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.card-value{font-size:2rem;font-weight:700;line-height:1.1}
.card-sub{font-size:.8rem;color:var(--text2);margin-top:4px}

/* Header */
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:16px}
.header h1{font-size:2rem;font-weight:700;background:linear-gradient(135deg,var(--text) 0%,var(--accent) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.header-meta{display:flex;align-items:center;gap:16px;font-size:.85rem;color:var(--text2)}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.status-dot.live{background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s infinite}
.status-dot.dead{background:var(--red)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

/* Section headers */
.section-title{font-size:1.1rem;font-weight:600;margin:28px 0 12px;display:flex;align-items:center;gap:8px}
.section-title::before{content:'';width:3px;height:18px;background:var(--accent);border-radius:2px}

/* Component grid */
.component{display:flex;align-items:center;gap:12px}
.component-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.component-dot.ok{background:var(--green);box-shadow:0 0 6px var(--green);animation:pulse 3s infinite}
.component-dot.down{background:var(--red);box-shadow:0 0 6px var(--red)}
.component-dot.off{background:#3a3a4a}
.component-name{font-size:.9rem;font-weight:500}
.component-status{font-size:.75rem;color:var(--text2)}

/* Funnel */
.funnel{display:flex;align-items:flex-end;gap:4px;height:120px;margin:12px 0}
.funnel-bar{flex:1;background:linear-gradient(to top,var(--accent),rgba(123,97,255,.3));border-radius:6px 6px 0 0;position:relative;min-height:8px;transition:height .5s ease}
.funnel-bar-label{position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);font-size:.65rem;color:var(--text2);white-space:nowrap}
.funnel-bar-value{position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:.75rem;font-weight:600;color:var(--text)}

/* Table */
.table-wrap{overflow-x:auto;border-radius:12px;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:.8rem}
thead{background:rgba(123,97,255,.05)}
th{text-align:left;padding:10px 14px;color:var(--text2);font-weight:500;font-size:.75rem;text-transform:uppercase;letter-spacing:.03em}
td{padding:8px 14px;border-top:1px solid rgba(123,97,255,.07);color:var(--text)}
tr:hover td{background:rgba(123,97,255,.03)}
.mono{font-family:'JetBrains Mono',monospace;font-size:.75rem}

/* Request feed */
#feed{background:#000;border:1px solid var(--border);border-radius:12px;padding:12px;height:300px;overflow-y:auto;font-family:'JetBrains Mono',monospace;font-size:.72rem;line-height:1.7;scroll-behavior:smooth}
#feed:hover{overflow-y:auto}
.feed-line{white-space:nowrap}
.feed-time{color:var(--text2)}
.feed-method{font-weight:600;display:inline-block;width:48px}
.feed-2xx{color:var(--green)}.feed-3xx{color:var(--yellow)}.feed-4xx{color:#FF9F61}.feed-5xx{color:var(--red)}
.feed-path{color:var(--text)}
.feed-ms{color:var(--text2)}
.feed-user{color:var(--accent);opacity:.7}
#feed-cursor{display:inline-block;width:7px;height:14px;background:var(--accent);animation:blink 1s step-end infinite;vertical-align:middle}
@keyframes blink{50%{opacity:0}}

/* Canvas chart */
#latency-chart{width:100%;height:120px;border-radius:8px;background:rgba(0,0,0,.3)}

/* Dot grid background */
.dot-bg{position:fixed;inset:0;pointer-events:none;z-index:-1;
  background-image:radial-gradient(rgba(123,97,255,.08) 1px,transparent 1px);
  background-size:24px 24px;
}

/* Count-up animation */
.count-up{transition:all .3s ease}

/* Scrollbar */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(123,97,255,.3);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:rgba(123,97,255,.5)}

/* Billing bars */
.plan-bar{display:flex;align-items:center;gap:10px;margin:4px 0}
.plan-bar-fill{height:22px;border-radius:4px;background:linear-gradient(90deg,var(--accent),rgba(123,97,255,.4));transition:width .5s ease;min-width:2px}
.plan-bar-label{font-size:.8rem;color:var(--text2);min-width:70px}
.plan-bar-count{font-size:.8rem;font-weight:600;color:var(--text)}
</style>
</head>
<body>
<div class="dot-bg"></div>

<!-- Login Screen -->
<div id="login-screen">
  <h1>Mission Control</h1>
  <p style="color:var(--text2);font-size:.9rem">GeekSpace Admin Dashboard</p>
  <input type="password" id="pw-input" placeholder="Admin password" autofocus>
  <button onclick="tryLogin()">Enter</button>
  <div id="login-error"></div>
</div>

<!-- Dashboard -->
<div id="dashboard">
  <!-- Header -->
  <div class="header">
    <div>
      <h1>GeekSpace Mission Control</h1>
      <p style="color:var(--text2);font-size:.85rem"><span class="status-dot live" id="conn-dot"></span>&nbsp; <span id="conn-label">Connecting...</span></p>
    </div>
    <div class="header-meta">
      <span id="clock"></span>
      <span id="last-refresh" style="opacity:.6"></span>
    </div>
  </div>

  <!-- User Analytics -->
  <div class="section-title">User Analytics</div>
  <div class="grid grid-5">
    <div class="card"><div class="card-label">Total Users</div><div class="card-value" id="stat-total">—</div></div>
    <div class="card"><div class="card-label">Today</div><div class="card-value" id="stat-today">—</div><div class="card-sub" id="stat-today-sub"></div></div>
    <div class="card"><div class="card-label">This Week</div><div class="card-value" id="stat-week">—</div></div>
    <div class="card"><div class="card-label">This Month</div><div class="card-value" id="stat-month">—</div></div>
    <div class="card"><div class="card-label">Active Now</div><div class="card-value" style="color:var(--green)" id="stat-active">—</div></div>
  </div>

  <!-- Auth Provider -->
  <div class="grid grid-4" style="margin-top:16px">
    <div class="card"><div class="card-label">Email Signups</div><div class="card-value" id="auth-email">—</div></div>
    <div class="card"><div class="card-label">Google</div><div class="card-value" style="opacity:.3" id="auth-google">0</div><div class="card-sub">Coming soon</div></div>
    <div class="card"><div class="card-label">Facebook</div><div class="card-value" style="opacity:.3" id="auth-facebook">0</div><div class="card-sub">Coming soon</div></div>
    <div class="card"><div class="card-label">Mobile</div><div class="card-value" style="opacity:.3" id="auth-mobile">0</div><div class="card-sub">Coming soon</div></div>
  </div>

  <!-- Onboarding Funnel -->
  <div class="section-title">Onboarding Funnel</div>
  <div class="card">
    <div class="funnel" id="funnel"></div>
    <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text2);margin-top:28px;padding:0 4px">
      <span>Signup</span><span>Profile</span><span>Bio</span><span>Agent</span><span>Portfolio</span><span>Connect</span><span>Done</span>
    </div>
  </div>

  <!-- Stuck Users -->
  <div class="section-title">Stuck Users (onboarding incomplete &gt; 1hr)</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Username</th><th>Email</th><th>Stuck At</th><th>Signed Up</th></tr></thead>
      <tbody id="stuck-table"><tr><td colspan="4" style="text-align:center;color:var(--text2)">Loading...</td></tr></tbody>
    </table>
  </div>

  <!-- System Vitals -->
  <div class="section-title">System Vitals</div>
  <div class="grid grid-5">
    <div class="card"><div class="card-label">Uptime</div><div class="card-value" id="stat-uptime">—</div></div>
    <div class="card"><div class="card-label">Memory</div><div class="card-value" id="stat-memory">—</div><div class="card-sub">MB heap</div></div>
    <div class="card"><div class="card-label">Avg Latency</div><div class="card-value" id="stat-latency">—</div><div class="card-sub">ms (5-min window)</div></div>
    <div class="card"><div class="card-label">Req / min</div><div class="card-value" id="stat-rpm">—</div></div>
    <div class="card"><div class="card-label">Error Rate</div><div class="card-value" id="stat-errors">—</div></div>
  </div>

  <!-- Components -->
  <div class="section-title">Components</div>
  <div class="grid grid-4" id="components-grid"></div>

  <!-- Latency Chart -->
  <div class="section-title">Latency (rolling 5 min)</div>
  <div class="card" style="padding:12px">
    <canvas id="latency-chart"></canvas>
  </div>

  <!-- Live Request Feed -->
  <div class="section-title">Live Request Feed</div>
  <div id="feed"><span id="feed-cursor"></span></div>

  <!-- Top Endpoints -->
  <div class="section-title">Hot Endpoints (5-min window)</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Endpoint</th><th style="text-align:right">Hits</th><th style="text-align:right">Errors</th><th style="text-align:right">Avg Ms</th></tr></thead>
      <tbody id="endpoints-table"><tr><td colspan="4" style="text-align:center;color:var(--text2)">Loading...</td></tr></tbody>
    </table>
  </div>

  <!-- Billing -->
  <div class="section-title">Credits &amp; Billing</div>
  <div class="grid grid-3">
    <div class="card"><div class="card-label">Credits Today</div><div class="card-value" id="bill-today">—</div></div>
    <div class="card"><div class="card-label">Credits This Week</div><div class="card-value" id="bill-week">—</div></div>
    <div class="card">
      <div class="card-label">Plan Distribution</div>
      <div id="plan-dist" style="margin-top:8px"></div>
    </div>
  </div>

  <!-- Top Consumers -->
  <div class="section-title">Top Credit Consumers (7 days)</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>User</th><th style="text-align:right">Credits Used</th></tr></thead>
      <tbody id="consumers-table"><tr><td colspan="2" style="text-align:center;color:var(--text2)">Loading...</td></tr></tbody>
    </table>
  </div>

  <!-- Signup Timeline -->
  <div class="section-title">Signup Timeline (30 days)</div>
  <div class="card" style="padding:12px">
    <canvas id="signup-chart" style="width:100%;height:100px;border-radius:8px"></canvas>
  </div>

  <!-- Footer -->
  <div style="text-align:center;color:var(--text2);opacity:.4;font-size:.75rem;margin-top:40px">
    GeekSpace Mission Control &middot; Data refreshes every 10s
  </div>
</div>

<script>
// ---- Config ----
const API_BASE = 'https://ai.geekspace.space';
const REFRESH_MS = 10000;

let password = sessionStorage.getItem('mc_pw') || '';
let refreshTimer = null;
let latencyHistory = [];
const MAX_LATENCY_POINTS = 60;
let feedPaused = false;

// ---- Login ----
const $login = document.getElementById('login-screen');
const $dashboard = document.getElementById('dashboard');
const $pwInput = document.getElementById('pw-input');
const $loginError = document.getElementById('login-error');

$pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

async function tryLogin() {
  const pw = $pwInput.value.trim();
  if (!pw) return;
  try {
    const res = await fetch(`${API_BASE}/api/admin/dashboard`, { headers: { 'X-Admin-Password': pw } });
    if (!res.ok) { $loginError.textContent = res.status === 401 ? 'Wrong password' : 'Server error'; return; }
    password = pw;
    sessionStorage.setItem('mc_pw', pw);
    $login.style.display = 'none';
    $dashboard.style.display = 'block';
    startDashboard();
  } catch { $loginError.textContent = 'Cannot reach server'; }
}

// Auto-login if password stored
if (password) {
  fetch(`${API_BASE}/api/admin/dashboard`, { headers: { 'X-Admin-Password': password } })
    .then(r => { if (r.ok) { $login.style.display = 'none'; $dashboard.style.display = 'block'; startDashboard(); } else { sessionStorage.removeItem('mc_pw'); password = ''; } })
    .catch(() => {});
}

// ---- Dashboard ----
function startDashboard() {
  updateClock();
  setInterval(updateClock, 1000);
  fetchData();
  refreshTimer = setInterval(fetchData, REFRESH_MS);
  connectSSE();
}

function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}

async function fetchData() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/dashboard`, { headers: { 'X-Admin-Password': password } });
    if (!res.ok) { if (res.status === 401) { sessionStorage.removeItem('mc_pw'); location.reload(); } return; }
    const d = await res.json();
    render(d);
    document.getElementById('last-refresh').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (err) { console.error('Fetch failed:', err); }
}

function render(d) {
  // User stats
  setText('stat-total', d.users.total);
  setText('stat-today', d.users.today);
  setText('stat-week', d.users.week);
  setText('stat-month', d.users.month);
  setText('stat-active', d.users.activeSessions);
  setText('auth-email', d.users.byProvider.email);
  setText('auth-google', d.users.byProvider.google);
  setText('auth-facebook', d.users.byProvider.facebook);
  setText('auth-mobile', d.users.byProvider.mobile);

  // Onboarding funnel
  renderFunnel(d.onboarding.funnel);
  renderStuckUsers(d.onboarding.stuckUsers);

  // System
  setText('stat-uptime', formatUptime(d.system.uptime));
  setText('stat-memory', d.system.memoryMb);
  const latMs = d.metrics.avgLatencyMs;
  const $lat = document.getElementById('stat-latency');
  $lat.textContent = latMs;
  $lat.style.color = latMs > 1000 ? 'var(--red)' : latMs > 300 ? 'var(--yellow)' : 'var(--green)';
  setText('stat-rpm', d.metrics.requestsPerMinute);
  const errRate = d.metrics.totalRequests > 0 ? ((d.metrics.totalErrors / d.metrics.totalRequests) * 100).toFixed(1) : '0.0';
  const $err = document.getElementById('stat-errors');
  $err.textContent = errRate + '%';
  $err.style.color = parseFloat(errRate) > 5 ? 'var(--red)' : parseFloat(errRate) > 0 ? 'var(--yellow)' : 'var(--green)';

  // Latency history for chart
  latencyHistory.push(latMs);
  if (latencyHistory.length > MAX_LATENCY_POINTS) latencyHistory.shift();
  drawLatencyChart();

  // Top endpoints
  renderEndpoints(d.topEndpoints);

  // Recent logs as feed
  renderFeed(d.recentLogs);

  // Billing
  setText('bill-today', d.billing.creditsToday.toLocaleString());
  setText('bill-week', d.billing.creditsWeek.toLocaleString());
  renderPlanDist(d.billing.planDistribution);
  renderConsumers(d.billing.topConsumers);

  // Signup timeline
  drawSignupChart(d.signupTimeline);
}

function setText(id, val) { document.getElementById(id).textContent = val; }

function formatUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

// ---- Funnel ----
function renderFunnel(funnel) {
  const $f = document.getElementById('funnel');
  const max = Math.max(...funnel, 1);
  const labels = ['Signup','Profile','Bio','Agent','Portfolio','Connect','Done'];
  $f.innerHTML = funnel.map((v, i) => {
    const pct = Math.max((v / max) * 100, 5);
    return `<div class="funnel-bar" style="height:${pct}%"><div class="funnel-bar-value">${v}</div></div>`;
  }).join('');
}

// ---- Stuck Users ----
function renderStuckUsers(users) {
  const $t = document.getElementById('stuck-table');
  if (!users.length) { $t.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text2)">No stuck users</td></tr>'; return; }
  const stepNames = ['Signup','Profile','Bio','Agent','Portfolio','Integrations','Review'];
  $t.innerHTML = users.map(u => `<tr>
    <td class="mono">${esc(u.username)}</td>
    <td class="mono">${esc(u.email)}</td>
    <td><span style="color:var(--yellow)">Step ${u.onboarding_step}: ${stepNames[u.onboarding_step] || '?'}</span></td>
    <td class="mono" style="color:var(--text2)">${u.created_at}</td>
  </tr>`).join('');
}

// ---- Components (from SSE) ----
function renderComponents(components) {
  const $g = document.getElementById('components-grid');
  const names = {database:'Database',ollama:'Local Engine',openrouter:'Cloud Engine',edith:'Premium Engine',picoclaw:'Weebo Engine',bridge:'Bridge',telegram:'Telegram',n8n:'n8n Automations'};
  const statClass = s => ['ok','reachable','configured','active'].includes(s) ? 'ok' : ['unreachable','down','no_backends'].includes(s) ? 'down' : 'off';
  $g.innerHTML = Object.entries(components).map(([k,s]) => `<div class="card component">
    <div class="component-dot ${statClass(s)}"></div>
    <div><div class="component-name">${names[k]||k}</div><div class="component-status">${s.replace(/_/g,' ')}</div></div>
  </div>`).join('');
}

// ---- SSE ----
function connectSSE() {
  const es = new EventSource(`${API_BASE}/api/health/stream`);
  es.onopen = () => {
    document.getElementById('conn-dot').className = 'status-dot live';
    document.getElementById('conn-label').textContent = 'Live';
  };
  es.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.components) renderComponents(d.components);
    } catch {}
  };
  es.onerror = () => {
    document.getElementById('conn-dot').className = 'status-dot dead';
    document.getElementById('conn-label').textContent = 'Disconnected';
    es.close();
    setTimeout(connectSSE, 5000);
  };
}

// ---- Endpoints Table ----
function renderEndpoints(eps) {
  const $t = document.getElementById('endpoints-table');
  if (!eps.length) { $t.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text2)">No data</td></tr>'; return; }
  $t.innerHTML = eps.map(e => `<tr>
    <td class="mono">${esc(e.path)}</td>
    <td style="text-align:right">${e.count}</td>
    <td style="text-align:right;color:${e.errors > 0 ? 'var(--red)' : 'var(--green)'}">${e.errors}</td>
    <td style="text-align:right;color:${e.avgMs > 1000 ? 'var(--yellow)' : 'var(--text2)'}">${e.avgMs}ms</td>
  </tr>`).join('');
}

// ---- Feed ----
let feedItems = [];
function renderFeed(logs) {
  if (feedPaused) return;
  const $f = document.getElementById('feed');
  const statusClass = (provider) => 'feed-2xx'; // usage events are all successful
  const newItems = logs.slice(0, 30).reverse();
  feedItems = newItems;
  $f.innerHTML = newItems.map(l => {
    const time = l.created_at.split(' ')[1] || l.created_at.substring(11,19);
    return `<div class="feed-line"><span class="feed-time">${time}</span> <span class="feed-method feed-2xx">${esc(l.tool)}</span> <span class="feed-path">${esc(l.provider)}/${esc(l.model)}</span> <span class="feed-ms">${l.tokens_in + l.tokens_out}tok</span> <span class="feed-user">@${esc(l.username)}</span> <span class="feed-ms">${l.channel || 'web'}</span></div>`;
  }).join('') + '<span id="feed-cursor"></span>';
  $f.scrollTop = $f.scrollHeight;
}

document.getElementById('feed').addEventListener('mouseenter', () => feedPaused = true);
document.getElementById('feed').addEventListener('mouseleave', () => feedPaused = false);

// ---- Latency Chart ----
function drawLatencyChart() {
  const canvas = document.getElementById('latency-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;

  ctx.clearRect(0, 0, W, H);

  if (latencyHistory.length < 2) return;
  const max = Math.max(...latencyHistory, 1);
  const step = W / (MAX_LATENCY_POINTS - 1);

  // Grid lines
  ctx.strokeStyle = 'rgba(123,97,255,.1)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += H / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(123,97,255,.3)');
  grad.addColorStop(1, 'rgba(123,97,255,.01)');

  ctx.beginPath();
  ctx.moveTo(0, H);
  latencyHistory.forEach((v, i) => {
    const x = i * step;
    const y = H - (v / max) * (H - 10);
    if (i === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo((latencyHistory.length - 1) * step, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  latencyHistory.forEach((v, i) => {
    const x = i * step;
    const y = H - (v / max) * (H - 10);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#7B61FF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Last point dot
  const lastX = (latencyHistory.length - 1) * step;
  const lastY = H - (latencyHistory[latencyHistory.length - 1] / max) * (H - 10);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#7B61FF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(123,97,255,.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label
  ctx.fillStyle = 'var(--text2)';
  ctx.font = '11px JetBrains Mono';
  ctx.fillStyle = '#A7ACB8';
  ctx.fillText(latencyHistory[latencyHistory.length - 1] + 'ms', lastX - 30, lastY - 12);
}

// ---- Signup Chart ----
function drawSignupChart(timeline) {
  const canvas = document.getElementById('signup-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  ctx.clearRect(0, 0, W, H);

  if (!timeline.length) return;
  const max = Math.max(...timeline.map(t => t.count), 1);
  const barW = Math.max((W / 30) - 3, 4);

  timeline.forEach((t, i) => {
    const x = (i / 30) * W + 2;
    const h = Math.max((t.count / max) * (H - 20), 2);
    const grad = ctx.createLinearGradient(x, H - h, x, H);
    grad.addColorStop(0, '#7B61FF');
    grad.addColorStop(1, 'rgba(123,97,255,.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, H - h - 2, barW, h, 2);
    ctx.fill();

    // Value on top
    if (t.count > 0) {
      ctx.fillStyle = '#A7ACB8';
      ctx.font = '9px JetBrains Mono';
      ctx.fillText(t.count, x, H - h - 6);
    }
  });
}

// ---- Plan Distribution ----
function renderPlanDist(plans) {
  const $d = document.getElementById('plan-dist');
  if (!plans.length) { $d.innerHTML = '<span style="color:var(--text2);font-size:.8rem">No data</span>'; return; }
  const total = plans.reduce((s, p) => s + p.count, 0);
  const colors = { free: 'var(--text2)', intro: 'var(--blue)', monthly: 'var(--accent)', halfyear: 'var(--yellow)', yearly: 'var(--green)' };
  $d.innerHTML = plans.map(p => {
    const pct = Math.max((p.count / total) * 100, 3);
    return `<div class="plan-bar"><span class="plan-bar-label">${p.plan}</span><div class="plan-bar-fill" style="width:${pct}%;background:${colors[p.plan]||'var(--accent)'}"></div><span class="plan-bar-count">${p.count}</span></div>`;
  }).join('');
}

// ---- Consumers Table ----
function renderConsumers(consumers) {
  const $t = document.getElementById('consumers-table');
  if (!consumers.length) { $t.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text2)">No usage</td></tr>'; return; }
  $t.innerHTML = consumers.map(c => `<tr><td class="mono">@${esc(c.username)}</td><td style="text-align:right;font-weight:600">${c.total_credits.toLocaleString()}</td></tr>`).join('');
}

// ---- Utils ----
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
</script>
</body>
</html>
```

**Step 3: Verify the file was created**

```bash
ls -la /var/www/geekspace-admin/index.html
wc -l /var/www/geekspace-admin/index.html
```

Expected: File exists, ~400+ lines.

**Step 4: Commit** (this file is outside the git repo, so just note it's deployed)

No git commit needed — this file lives on the server at `/var/www/geekspace-admin/`, not in the repo. Optionally copy to repo for version control:

```bash
mkdir -p /root/GeekSpace2.0/admin-dashboard
cp /var/www/geekspace-admin/index.html /root/GeekSpace2.0/admin-dashboard/index.html
git add admin-dashboard/index.html
git commit -m "feat: add mission control admin dashboard HTML"
```

---

### Task 4: Configure Caddy for api.geekspace.space

**Files:**
- Modify: `/etc/caddy/Caddyfile`

**Step 1: Add the api.geekspace.space block**

Add the following block to `/etc/caddy/Caddyfile` after the `edith.geekspace.space` block:

```
api.geekspace.space {
    handle /api/* {
        reverse_proxy localhost:3001
    }
    handle {
        root * /var/www/geekspace-admin
        file_server
    }
}
```

**Step 2: Validate Caddy config**

```bash
caddy validate --config /etc/caddy/Caddyfile
```

Expected: `Valid configuration`

**Step 3: Reload Caddy**

```bash
systemctl reload caddy
```

Expected: No errors.

**Step 4: Verify the dashboard loads**

```bash
curl -s -o /dev/null -w "%{http_code}" https://api.geekspace.space
```

Expected: `200` — the login page HTML is served.

**Step 5: Verify API proxy works through api.geekspace.space**

```bash
ADMIN_PW=$(grep ADMIN_DASHBOARD_PASSWORD /root/GeekSpace2.0/.env | cut -d= -f2)
curl -s -o /dev/null -w "%{http_code}" https://api.geekspace.space/api/admin/dashboard -H "X-Admin-Password: $ADMIN_PW"
```

Expected: `200`

---

### Task 5: Build, deploy, and verify end-to-end

**Step 1: Docker build**

```bash
cd /root/GeekSpace2.0 && docker compose build geekspace --no-cache
```

Expected: Build succeeds.

**Step 2: Deploy**

```bash
docker compose up -d geekspace
rm -rf /var/www/geekspace/* && docker cp geekspace-app:/app/dist/. /var/www/geekspace/
```

**Step 3: Add CORS for api.geekspace.space**

The admin dashboard at `api.geekspace.space` needs to call the API at `ai.geekspace.space`. Add `https://api.geekspace.space` to the `CORS_ORIGINS` in `.env`:

```bash
# Check current CORS_ORIGINS and append
grep CORS_ORIGINS /root/GeekSpace2.0/.env
# Edit to add: ,https://api.geekspace.space
```

Then restart the container:

```bash
docker compose restart geekspace
```

**Step 4: Verify in browser**

1. Open `https://api.geekspace.space` in browser
2. Enter the admin password
3. Verify all 9 sections render with live data
4. Verify SSE connection shows green dot
5. Wait 10s, verify data refreshes

**Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: mission control admin dashboard at api.geekspace.space

Standalone HTML dashboard with:
- User analytics (total, today, week, month, active, auth providers)
- Onboarding funnel with stuck user detection
- System vitals (uptime, memory, latency, RPM, error rate)
- Live component status via SSE
- Rolling latency chart (canvas)
- Live request feed (terminal style)
- Top endpoints table
- Credit/billing summary with plan distribution
- 30-day signup timeline chart

Protected by ADMIN_DASHBOARD_PASSWORD env var."

git push origin live-production
```
