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

// ── GAP-1: Unified dashboard overview — single fetch for OverviewPage ────────
dashboardRouter.get('/overview', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Fetch user info (name + timezone) for personalized greeting
  const user = db.prepare('SELECT name, timezone FROM users WHERE id = ?').get(userId) as
    { name: string; timezone: string } | undefined;
  const firstName = user?.name?.split(' ')[0] || 'there';
  const tz = user?.timezone || 'Asia/Kolkata';

  // Determine current hour in user's timezone for greeting
  let userHour: number;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    userHour = parseInt(formatter.format(new Date()), 10);
  } catch {
    userHour = new Date().getHours();
  }

  let timeOfDay: string;
  if (userHour < 12) timeOfDay = 'Good morning';
  else if (userHour < 18) timeOfDay = 'Good afternoon';
  else timeOfDay = 'Good evening';
  const greeting = `${timeOfDay}, ${firstName}`;

  // Today boundaries in ISO (UTC) for queries
  const todayISO = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowISO = tomorrowDate.toISOString().split('T')[0];

  // Today boundaries as epoch ms (for tables using INTEGER timestamps)
  const nowMs = Date.now();
  const todayStartMs = new Date(todayISO + 'T00:00:00Z').getTime();
  const tomorrowStartMs = new Date(tomorrowISO + 'T00:00:00Z').getTime();

  // Week boundary for stats
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgoISO = weekAgoDate.toISOString().split('T')[0];
  const weekAgoMs = weekAgoDate.getTime();

  // ---- Fresh queries (reminders + habits — no cache) ----
  const fetchFresh = () => {
    // Incomplete reminders due in next 24h (datetime is ISO string)
    const remindersDueToday = db.prepare(`
      SELECT id, text, datetime, category, recurring, priority
      FROM reminders
      WHERE user_id = ? AND completed = 0
        AND datetime IS NOT NULL AND datetime != ''
        AND datetime >= ? AND datetime < ?
      ORDER BY datetime ASC
      LIMIT 10
    `).all(userId, todayISO, tomorrowISO) as {
      id: string; text: string; datetime: string;
      category: string; recurring: string; priority: string;
    }[];

    // All habits with loggedToday flag via LEFT JOIN
    const habitsToday = db.prepare(`
      SELECT h.id, h.name, h.icon, h.current_streak AS streak,
        CASE WHEN hl.id IS NOT NULL THEN 1 ELSE 0 END AS loggedToday
      FROM habits h
      LEFT JOIN habit_logs hl
        ON hl.habit_id = h.id
        AND hl.logged_at >= ? AND hl.logged_at < ?
      WHERE h.user_id = ?
      ORDER BY h.name ASC
    `).all(todayStartMs, tomorrowStartMs, userId) as {
      id: number; name: string; icon: string; streak: number; loggedToday: number;
    }[];

    return { remindersDueToday, habitsToday };
  };

  // ---- Cacheable queries (weekly stats + recent conversations) ----
  const cacheKey = `dashboard:overview:${userId}`;
  let weeklyStats: { messagesThisWeek: number; remindersCompleted: number; habitsLogged: number };
  let recentConversations: { id: string; content: string; created_at: string }[];
  let calendarEventsToday: { id: number; title: string; start_time: number; end_time: number | null }[];

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      weeklyStats = parsed.weeklyStats;
      recentConversations = parsed.recentConversations;
      calendarEventsToday = parsed.calendarEventsToday;
    } else {
      throw new Error('cache miss');
    }
  } catch {
    // Cache miss or unavailable — query DB
    const messagesThisWeek = (db.prepare(
      "SELECT COUNT(*) as n FROM conversation_log WHERE user_id = ? AND created_at >= ?"
    ).get(userId, weekAgoISO) as { n: number }).n;

    const remindersCompleted = (db.prepare(
      "SELECT COUNT(*) as n FROM reminders WHERE user_id = ? AND completed = 1 AND datetime >= ? AND datetime < ?"
    ).get(userId, weekAgoISO, tomorrowISO) as { n: number }).n;

    const habitsLogged = (db.prepare(
      "SELECT COUNT(*) as n FROM habit_logs WHERE user_id = ? AND logged_at >= ?"
    ).get(userId, weekAgoMs) as { n: number }).n;

    weeklyStats = { messagesThisWeek, remindersCompleted, habitsLogged };

    recentConversations = db.prepare(`
      SELECT id, content, created_at
      FROM conversation_log
      WHERE user_id = ? AND role = 'assistant'
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId) as { id: string; content: string; created_at: string }[];

    calendarEventsToday = db.prepare(`
      SELECT id, title, start_time, end_time
      FROM calendar_events
      WHERE user_id = ? AND start_time >= ? AND start_time < ?
      ORDER BY start_time ASC
      LIMIT 8
    `).all(userId, todayStartMs, tomorrowStartMs) as { id: number; title: string; start_time: number; end_time: number | null }[];

    // Write to cache (60s TTL) — fire and forget
    try {
      await cacheSet(cacheKey, JSON.stringify({ weeklyStats, recentConversations, calendarEventsToday }), 60);
    } catch { /* non-fatal */ }
  }

  // Fetch fresh data (always from DB, never cached)
  const { remindersDueToday, habitsToday } = fetchFresh();

  // Mark overdue reminders
  const nowISO = new Date().toISOString();
  const remindersWithOverdue = remindersDueToday.map(r => ({
    ...r,
    overdue: r.datetime < nowISO,
  }));

  res.json({
    greeting,
    remindersDueToday: remindersWithOverdue,
    habitsToday: habitsToday.map(h => ({
      ...h,
      loggedToday: h.loggedToday === 1,
    })),
    calendarEventsToday,
    weeklyStats,
    recentConversations,
  });
});

dashboardRouter.post('/contact', validateBody(contactSchema), (req, res) => {
  const { name, email, company, message } = req.body;

  db.prepare('INSERT INTO contact_submissions (id, name, email, company, message) VALUES (?, ?, ?, ?, ?)').run(
    uuid(), name, email, company || '', message
  );
  res.json({ success: true, message: "Thank you! We'll be in touch soon." });
});
