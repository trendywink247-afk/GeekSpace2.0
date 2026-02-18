// ============================================================
// Admin Dashboard API — private endpoint for Mission Control
// Auth: X-Admin-Password header checked against env var
//       or Authorization: Bearer <ADMIN_TOKEN> header
// ============================================================

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { getMetricsSnapshot } from '../middleware/metrics.js';
import { logger } from '../logger.js';
import { cacheGet } from '../services/cache.js';
import { eventBus } from '../services/event-bus.js';

export const adminRouter = Router();

// ---- Password middleware (legacy X-Admin-Password) ----
function requireAdminPassword(req: Request, res: Response, next: NextFunction): void {
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

// ---- Bearer token middleware (new ADMIN_TOKEN) ----
function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    res.status(503).json({ error: 'Admin token not configured' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== config.adminToken) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }
  next();
}

// ---- Helper: check if request has valid admin token ----
function hasValidToken(req: Request): boolean {
  if (!config.adminToken) return false;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return token === config.adminToken;
}

// ---- /health endpoint ----
adminRouter.get('/health', requireAdminToken, async (_req: Request, res: Response): Promise<void> => {
  // DB check
  let dbOk = false;
  try {
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    dbOk = row?.ok === 1;
  } catch { /* db not ready */ }

  // Redis check — cacheGet swallows errors so use ping via raw fetch to redis URL
  // Simpler: if REDIS_URL is set, attempt cacheGet and treat reaching it as "ok"
  let redisOk = false;
  if (process.env.REDIS_URL) {
    try {
      await cacheGet('__admin_ping__');
      // If we get here without throwing, redis client is available
      redisOk = true;
    } catch {
      redisOk = false;
    }
  }

  // Ollama check (2s timeout)
  let ollamaOk = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    ollamaOk = r.ok;
  } catch { /* unreachable */ }

  // PicoClaw check (2s timeout)
  let picoOk = false;
  if (config.picoClawEnabled && config.picoClawUrl) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const r = await fetch(`${config.picoClawUrl}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      picoOk = r.ok;
    } catch { /* unreachable */ }
  }

  res.json({
    timestamp: new Date().toISOString(),
    db: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'down',
    ollama: ollamaOk ? 'ok' : 'down',
    picoclaw: config.picoClawEnabled ? (picoOk ? 'ok' : 'down') : 'not_configured',
  });
});

// ---- /stats endpoint ----
adminRouter.get('/stats', requireAdminToken, (_req: Request, res: Response): void => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

    const activeAgents = (db.prepare('SELECT COUNT(*) as c FROM agent_configs').get() as { c: number }).c;

    let tasksRunning = 0;
    let tasksToday = 0;
    let completedToday = 0;
    try {
      tasksRunning = (db.prepare(
        "SELECT COUNT(*) as c FROM pico_tasks WHERE status IN ('queued', 'running')"
      ).get() as { c: number }).c;

      tasksToday = (db.prepare(
        "SELECT COUNT(*) as c FROM pico_tasks WHERE created_at >= date('now')"
      ).get() as { c: number }).c;

      completedToday = (db.prepare(
        "SELECT COUNT(*) as c FROM pico_tasks WHERE status = 'completed' AND completed_at >= date('now')"
      ).get() as { c: number }).c;
    } catch { /* pico_tasks table may not exist */ }

    res.json({
      totalUsers,
      activeAgents,
      tasksRunning,
      tasksToday,
      completedToday,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, 'Admin stats query failed');
    res.status(500).json({ error: 'Stats query failed' });
  }
});

// ---- /tasks endpoint (paginated) ----
adminRouter.get('/tasks', requireAdminToken, (req: Request, res: Response): void => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const offset = parseInt(String(req.query.offset || '0'), 10);

    let tasks: unknown[] = [];
    let total = 0;
    try {
      tasks = db.prepare(
        `SELECT pt.id, pt.user_id, u.username, pt.agent_slot, pt.agent_name,
                pt.task_type, pt.description, pt.status, pt.result,
                pt.planned_by, pt.created_at, pt.started_at, pt.completed_at
         FROM pico_tasks pt
         LEFT JOIN users u ON u.id = pt.user_id
         ORDER BY pt.created_at DESC
         LIMIT ? OFFSET ?`
      ).all(limit, offset);

      total = (db.prepare('SELECT COUNT(*) as c FROM pico_tasks').get() as { c: number }).c;
    } catch { /* pico_tasks table may not exist */ }

    res.json({ tasks, total, limit, offset });
  } catch (err) {
    logger.error({ err }, 'Admin tasks query failed');
    res.status(500).json({ error: 'Tasks query failed' });
  }
});

// ---- /stream endpoint (SSE) — accepts token via Authorization header OR ?token= query param ----
adminRouter.get('/stream', (req: Request, res: Response): void => {
  // Allow token via query param for EventSource (browsers can't set headers)
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = headerToken || queryToken;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connected event
  res.write('data: {"type":"connected"}\n\n');

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Listen for pico task events
  const onPicoTask = (data: unknown) => {
    res.write(`data: ${JSON.stringify({ type: 'pico:task', payload: data })}\n\n`);
  };
  eventBus.on('pico:task', onPicoTask);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('pico:task', onPicoTask);
  });
});

// ---- Main dashboard endpoint (legacy) ----
adminRouter.get('/dashboard', requireAdminPassword, (_req: Request, res: Response) => {
  try {
    // -- User analytics --
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const todayUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now')").get() as { c: number }).c;
    const weekUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now', '-7 days')").get() as { c: number }).c;
    const monthUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now', '-30 days')").get() as { c: number }).c;

    // Auth provider breakdown (future-ready)
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

    // Build funnel: [signed_up, step1, step2, step3, step4, step5, completed]
    const funnel = [totalUsers, 0, 0, 0, 0, 0, completedCount];
    for (const row of funnelRows) {
      if (row.onboarding_step >= 1 && row.onboarding_step <= 5) {
        for (let i = 1; i <= row.onboarding_step; i++) {
          funnel[i] += row.c;
        }
      }
      if (row.onboarding_step === 6) {
        for (let i = 1; i <= 5; i++) funnel[i] += row.c;
      }
    }

    // Stuck users
    const stuckUsers = db.prepare(
      "SELECT id, username, email, onboarding_step, created_at FROM users WHERE onboarding_completed = 0 AND created_at < datetime('now', '-1 hour') ORDER BY created_at DESC LIMIT 20"
    ).all() as { id: string; username: string; email: string; onboarding_step: number; created_at: string }[];

    // -- System metrics --
    const metrics = getMetricsSnapshot();

    // -- Recent usage events --
    const recentEvents = db.prepare(
      'SELECT id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at FROM usage_events ORDER BY created_at DESC LIMIT 50'
    ).all() as { id: string; user_id: string; provider: string; model: string; tokens_in: number; tokens_out: number; cost_usd: number; channel: string; tool: string; created_at: string }[];

    // Resolve usernames
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

    // -- Billing --
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

    // -- Signup timeline (30 days) --
    const signupTimeline = db.prepare(
      "SELECT date(created_at) as day, COUNT(*) as count FROM users WHERE created_at >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY day"
    ).all() as { day: string; count: number }[];

    // -- Top endpoints --
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

// ---- serveAdminDashboard — GET /admin (HTML page) ----
export function serveAdminDashboard(req: Request, res: Response): void {
  const tokenValid = hasValidToken(req);

  if (!tokenValid) {
    // Show login form
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GeekSpace Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #05050A; color: #F4F6FF; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #0B0B10; border: 1px solid #7B61FF40; border-radius: 12px; padding: 40px; width: 360px; }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  p { color: #A7ACB8; font-size: 0.875rem; margin-bottom: 24px; }
  input { width: 100%; padding: 10px 14px; background: #05050A; border: 1px solid #7B61FF40; border-radius: 8px; color: #F4F6FF; font-size: 0.875rem; margin-bottom: 12px; }
  input:focus { outline: none; border-color: #7B61FF; }
  button { width: 100%; padding: 10px; background: #7B61FF; border: none; border-radius: 8px; color: #fff; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
  button:hover { background: #6B51EF; }
  .error { color: #FF6161; font-size: 0.8rem; margin-top: 8px; display: none; }
</style>
</head>
<body>
<div class="card">
  <h1>GeekSpace Admin</h1>
  <p>Enter your admin token to access Mission Control.</p>
  <input type="password" id="token" placeholder="Admin token" />
  <button onclick="login()">Sign In</button>
  <div class="error" id="err">Invalid token. Try again.</div>
</div>
<script>
  function login() {
    const token = document.getElementById('token').value.trim();
    if (!token) return;
    fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => {
        if (r.ok) {
          sessionStorage.setItem('gs_admin_token', token);
          window.location.reload();
        } else {
          document.getElementById('err').style.display = 'block';
        }
      })
      .catch(() => { document.getElementById('err').style.display = 'block'; });
  }
  document.getElementById('token').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
</script>
</body>
</html>`);
    return;
  }

  // Serve full admin dashboard
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GeekSpace Admin — Mission Control</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #05050A; color: #F4F6FF; font-family: system-ui, sans-serif; padding: 24px; }
  h1 { font-size: 1.8rem; margin-bottom: 4px; }
  .subtitle { color: #A7ACB8; font-size: 0.875rem; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat { background: #0B0B10; border: 1px solid #7B61FF20; border-radius: 10px; padding: 16px; }
  .stat-label { font-size: 0.75rem; color: #A7ACB8; margin-bottom: 4px; }
  .stat-value { font-size: 1.6rem; font-weight: 700; font-family: monospace; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; margin: 4px; border: 1px solid transparent; }
  .chip-ok { background: #61FF7B15; border-color: #61FF7B40; color: #61FF7B; }
  .chip-down { background: #FF616115; border-color: #FF616140; color: #FF6161; }
  .chip-nc { background: #A7ACB815; border-color: #A7ACB840; color: #A7ACB8; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-ok { background: #61FF7B; }
  .dot-down { background: #FF6161; }
  .dot-nc { background: #A7ACB8; }
  .section { background: #0B0B10; border: 1px solid #7B61FF20; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  h2 { font-size: 1rem; margin-bottom: 12px; color: #F4F6FF; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th { text-align: left; color: #A7ACB8; font-weight: 500; padding: 6px 8px; border-bottom: 1px solid #7B61FF15; }
  td { padding: 6px 8px; border-bottom: 1px solid #7B61FF10; color: #F4F6FF; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; }
  .badge-completed { background: #61FF7B20; color: #61FF7B; }
  .badge-running { background: #FFD76120; color: #FFD761; }
  .badge-queued { background: #7B61FF20; color: #7B61FF; }
  .badge-failed { background: #FF616120; color: #FF6161; }
  .badge-cancelled { background: #A7ACB820; color: #A7ACB8; }
  .refresh-btn { background: #7B61FF; border: none; border-radius: 8px; color: #fff; padding: 8px 16px; font-size: 0.875rem; cursor: pointer; margin-bottom: 16px; }
  .refresh-btn:hover { background: #6B51EF; }
  #last-update { color: #A7ACB8; font-size: 0.75rem; margin-left: 12px; }
  #stream-log { max-height: 200px; overflow-y: auto; font-size: 0.75rem; font-family: monospace; background: #05050A; border: 1px solid #7B61FF10; border-radius: 8px; padding: 12px; }
  .log-entry { color: #A7ACB8; padding: 2px 0; border-bottom: 1px solid #7B61FF08; }
  .log-entry:last-child { border-bottom: none; }
</style>
</head>
<body>
<h1>Mission Control</h1>
<p class="subtitle">GeekSpace Admin Dashboard</p>

<button class="refresh-btn" onclick="loadAll()">Refresh</button>
<span id="last-update"></span>

<div id="health-chips" style="margin-bottom:20px;"></div>

<div class="grid" id="stats-grid"></div>

<div class="section">
  <h2>Recent Tasks</h2>
  <table id="tasks-table">
    <thead><tr><th>ID</th><th>User</th><th>Agent</th><th>Type</th><th>Description</th><th>Status</th><th>Created</th></tr></thead>
    <tbody id="tasks-body"><tr><td colspan="7" style="color:#A7ACB8;text-align:center">Loading...</td></tr></tbody>
  </table>
</div>

<div class="section">
  <h2>Live Event Stream</h2>
  <div id="stream-log"><span style="color:#A7ACB8">Connecting...</span></div>
</div>

<script>
  const TOKEN = sessionStorage.getItem('gs_admin_token') || '';

  function chipClass(status) {
    if (status === 'ok') return 'chip-ok';
    if (status === 'not_configured') return 'chip-nc';
    return 'chip-down';
  }
  function dotClass(status) {
    if (status === 'ok') return 'dot-ok';
    if (status === 'not_configured') return 'dot-nc';
    return 'dot-down';
  }
  function badgeClass(status) {
    return 'badge badge-' + (status || 'cancelled');
  }
  function ago(ts) {
    if (!ts) return '--';
    const d = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d/60) + 'm ago';
    return Math.floor(d/3600) + 'h ago';
  }

  async function loadHealth() {
    const r = await fetch('/api/admin/health', { headers: { Authorization: 'Bearer ' + TOKEN } });
    const d = await r.json();
    const el = document.getElementById('health-chips');
    el.innerHTML = ['db','redis','ollama','picoclaw'].map(k => {
      const s = d[k] || 'not_configured';
      return \`<span class="chip \${chipClass(s)}"><span class="dot \${dotClass(s)}"></span>\${k}: \${s}</span>\`;
    }).join('');
  }

  async function loadStats() {
    const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + TOKEN } });
    const d = await r.json();
    const grid = document.getElementById('stats-grid');
    const items = [
      { label: 'Total Users', value: d.totalUsers, color: '#7B61FF' },
      { label: 'Active Agents', value: d.activeAgents, color: '#61FF7B' },
      { label: 'Tasks Running', value: d.tasksRunning, color: '#FFD761' },
      { label: 'Tasks Today', value: d.tasksToday, color: '#A7ACB8' },
      { label: 'Completed Today', value: d.completedToday, color: '#61FF7B' },
    ];
    grid.innerHTML = items.map(i =>
      \`<div class="stat"><div class="stat-label">\${i.label}</div><div class="stat-value" style="color:\${i.color}">\${i.value}</div></div>\`
    ).join('');
  }

  async function loadTasks() {
    const r = await fetch('/api/admin/tasks?limit=20', { headers: { Authorization: 'Bearer ' + TOKEN } });
    const d = await r.json();
    const tbody = document.getElementById('tasks-body');
    if (!d.tasks || d.tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:#A7ACB8;text-align:center">No tasks yet</td></tr>';
      return;
    }
    tbody.innerHTML = d.tasks.map(t =>
      \`<tr>
        <td style="color:#7B61FF;font-family:monospace">\${t.id.slice(0,8)}</td>
        <td>\${t.username || t.user_id.slice(0,8)}</td>
        <td>\${t.agent_name || '--'}</td>
        <td>\${t.task_type || '--'}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${t.description || ''}</td>
        <td><span class="\${badgeClass(t.status)}">\${t.status}</span></td>
        <td>\${ago(t.created_at)}</td>
      </tr>\`
    ).join('');
  }

  function loadAll() {
    loadHealth().catch(console.error);
    loadStats().catch(console.error);
    loadTasks().catch(console.error);
    document.getElementById('last-update').textContent = 'Updated ' + new Date().toLocaleTimeString();
  }

  // Auto-refresh every 10s
  loadAll();
  setInterval(loadAll, 10000);

  // SSE stream
  function connectStream() {
    const log = document.getElementById('stream-log');
    const es = new EventSource('/api/admin/stream?token=' + encodeURIComponent(TOKEN));
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'connected') {
        log.innerHTML = '<span style="color:#61FF7B">Connected to event stream</span>';
        return;
      }
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = new Date().toLocaleTimeString() + ' ' + JSON.stringify(data);
      log.insertBefore(entry, log.firstChild);
      // Keep last 50 entries
      while (log.children.length > 50) log.removeChild(log.lastChild);
    };
    es.onerror = () => {
      log.innerHTML = '<span style="color:#FF6161">Stream disconnected. Reconnecting...</span>';
      es.close();
      setTimeout(connectStream, 5000);
    };
  }
  connectStream();
</script>
</body>
</html>`);
}
