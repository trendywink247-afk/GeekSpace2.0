import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, contactSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { cacheGet, cacheSet } from '../services/cache.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  // ---- Core counts ----
  const msgStats = db.prepare("SELECT COUNT(*) as total FROM usage_events WHERE user_id = ? AND tool = 'ai.chat'").get(userId) as { total: number };
  const prevMsgStats = db.prepare("SELECT COUNT(*) as total FROM usage_events WHERE user_id = ? AND tool = 'ai.chat' AND created_at < datetime('now', '-7 days') AND created_at >= datetime('now', '-14 days')").get(userId) as { total: number };
  const thisWeekMsgs = db.prepare("SELECT COUNT(*) as total FROM usage_events WHERE user_id = ? AND tool = 'ai.chat' AND created_at >= datetime('now', '-7 days')").get(userId) as { total: number };

  const remindersActive = db.prepare('SELECT COUNT(*) as total FROM reminders WHERE user_id = ? AND completed = 0').get(userId) as { total: number };
  const apiCalls = db.prepare('SELECT COUNT(*) as total FROM usage_events WHERE user_id = ?').get(userId) as { total: number };
  const prevApiCalls = db.prepare("SELECT COUNT(*) as total FROM usage_events WHERE user_id = ? AND created_at < datetime('now', '-7 days') AND created_at >= datetime('now', '-14 days')").get(userId) as { total: number };
  const thisWeekApi = db.prepare("SELECT COUNT(*) as total FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-7 days')").get(userId) as { total: number };

  const agent = db.prepare('SELECT status, primary_model, name FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  const user = db.prepare('SELECT credits, plan, created_at FROM users WHERE id = ?').get(userId) as { credits: number; plan: string; created_at: string } | undefined;
  const integrationsConnected = db.prepare("SELECT COUNT(*) as total FROM integrations WHERE user_id = ? AND status = 'connected'").get(userId) as { total: number };

  // ---- Change percentages ----
  const messagesChange = prevMsgStats.total > 0
    ? Math.round(((thisWeekMsgs.total - prevMsgStats.total) / prevMsgStats.total) * 100)
    : (thisWeekMsgs.total > 0 ? 100 : 0);

  const apiCallsChange = prevApiCalls.total > 0
    ? Math.round(((thisWeekApi.total - prevApiCalls.total) / prevApiCalls.total) * 100)
    : (thisWeekApi.total > 0 ? 100 : 0);

  // ---- Reminder breakdown (for pie chart) ----
  const remCompleted = db.prepare('SELECT COUNT(*) as total FROM reminders WHERE user_id = ? AND completed = 1').get(userId) as { total: number };
  const remPending = db.prepare("SELECT COUNT(*) as total FROM reminders WHERE user_id = ? AND completed = 0 AND (datetime IS NULL OR datetime >= datetime('now'))").get(userId) as { total: number };
  const remOverdue = db.prepare("SELECT COUNT(*) as total FROM reminders WHERE user_id = ? AND completed = 0 AND datetime < datetime('now') AND datetime IS NOT NULL").get(userId) as { total: number };

  // ---- Weekly chart data (last 7 days) ----
  const weeklyRaw = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count,
           COUNT(CASE WHEN tool = 'ai.chat' THEN 1 END) as messages
    FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at) ORDER BY day ASC
  `).all(userId) as { day: string; count: number; messages: number }[];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyChartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const row = weeklyRaw.find(r => r.day === dateStr);
    weeklyChartData.push({
      name: dayNames[d.getDay()],
      messages: row?.messages || 0,
      api: row?.count || 0,
    });
  }

  // ---- Hourly activity (last 7 days, grouped by 4-hour blocks) ----
  const hourlyRaw = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
    FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY hour ORDER BY hour ASC
  `).all(userId) as { hour: number; count: number }[];

  const hourBlocks = [0, 4, 8, 12, 16, 20];
  const hourlyActivity = hourBlocks.map(block => {
    const total = hourlyRaw
      .filter(r => r.hour >= block && r.hour < block + 4)
      .reduce((sum, r) => sum + r.count, 0);
    return { hour: `${String(block).padStart(2, '0')}:00`, activity: total };
  });

  // ---- Recent activity ----
  const recentActivity = db.prepare('SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);
  const connectedServices = db.prepare("SELECT name, type, health, requests_today FROM integrations WHERE user_id = ? AND status = 'connected'").all(userId);

  // ---- Uptime estimate (days since signup) ----
  const signupDate = user?.created_at ? new Date(user.created_at) : new Date();
  const daysSinceSignup = Math.max(1, Math.floor((Date.now() - signupDate.getTime()) / 86400000));
  const agentUptime = daysSinceSignup > 1 ? '99.9%' : '100%';

  res.json({
    messagesSent: msgStats.total || 0,
    messagesChange,
    remindersActive: remindersActive.total || 0,
    remindersChange: 0,
    apiCalls: apiCalls.total || 0,
    apiCallsChange,
    responseTimeMs: 0,
    responseTimeChange: 0,
    agentStatus: agent?.status || 'online',
    agentModel: agent?.primary_model || 'default',
    agentName: agent?.name || 'Geek',
    agentUptime,
    credits: user?.credits ?? 0,
    plan: user?.plan || 'free',
    integrationsConnected: integrationsConnected.total || 0,
    recentActivity,
    connectedServices,
    weeklyChartData,
    hourlyActivity,
    reminderBreakdown: {
      completed: remCompleted.total || 0,
      pending: remPending.total || 0,
      overdue: remOverdue.total || 0,
    },
  });
});

// ── 65.5: Quick-stats — lightweight 3-count payload, 60s Redis TTL ─────────
dashboardRouter.get('/quick-stats', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const cacheKey = `dashboard:quick-stats:${userId}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) { res.json(JSON.parse(cached)); return; }
  } catch { /* Redis unavailable — fall through */ }

  const remindersActive = (db.prepare('SELECT COUNT(*) as n FROM reminders WHERE user_id = ? AND completed = 0').get(userId) as { n: number }).n;
  const messagesToday = (db.prepare("SELECT COUNT(*) as n FROM usage_events WHERE user_id = ? AND tool = 'ai.chat' AND created_at >= date('now')").get(userId) as { n: number }).n;
  const automationsActive = (db.prepare("SELECT COUNT(*) as n FROM automations WHERE user_id = ? AND enabled = 1").get(userId) as { n: number }).n;

  const payload = { remindersActive, messagesToday, automationsActive };
  try { await cacheSet(cacheKey, JSON.stringify(payload), 60); } catch { /* ignore */ }
  res.json(payload);
});

dashboardRouter.post('/contact', validateBody(contactSchema), (req, res) => {
  const { name, email, company, message } = req.body;

  db.prepare('INSERT INTO contact_submissions (id, name, email, company, message) VALUES (?, ?, ?, ?, ?)').run(
    uuid(), name, email, company || '', message
  );
  res.json({ success: true, message: "Thank you! We'll be in touch soon." });
});
