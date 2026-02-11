import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const msgStats = db.prepare("SELECT COUNT(*) as total FROM usage_events WHERE user_id = ? AND tool = 'ai.chat'").get(userId) as Record<string, unknown>;
  const remindersActive = db.prepare('SELECT COUNT(*) as total FROM reminders WHERE user_id = ? AND completed = 0').get(userId) as Record<string, unknown>;
  const apiCalls = db.prepare('SELECT COUNT(*) as total FROM usage_events WHERE user_id = ?').get(userId) as Record<string, unknown>;
  const agent = db.prepare('SELECT status, primary_model, name FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  const integrationsConnected = db.prepare("SELECT COUNT(*) as total FROM integrations WHERE user_id = ? AND status = 'connected'").get(userId) as Record<string, unknown>;
  const recentActivity = db.prepare('SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);
  const connectedServices = db.prepare("SELECT name, type, health, requests_today FROM integrations WHERE user_id = ? AND status = 'connected'").all(userId);

  const weeklyData = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at) ORDER BY day ASC
  `).all(userId);

  const channelData = db.prepare(`
    SELECT channel, COUNT(*) as count FROM usage_events WHERE user_id = ? GROUP BY channel
  `).all(userId);

  res.json({
    messagesSent: (msgStats.total as number) || 0,
    remindersActive: (remindersActive.total as number) || 0,
    apiCalls: (apiCalls.total as number) || 0,
    integrationsConnected: (integrationsConnected.total as number) || 0,
    agentStatus: agent?.status || 'offline',
    agentModel: agent?.primary_model || 'default',
    agentName: agent?.name || 'Geek',
    recentActivity,
    connectedServices,
    weeklyData,
    channelData,
  });
});

dashboardRouter.post('/contact', (req, res) => {
  const { name, email, company, message } = req.body;
  if (!name || !email || !message) { res.status(400).json({ error: 'Name, email, and message are required' }); return; }

  db.prepare('INSERT INTO contact_submissions (id, name, email, company, message) VALUES (?, ?, ?, ?, ?)').run(
    uuid(), name, email, company || '', message
  );
  res.json({ success: true, message: "Thank you! We'll be in touch soon." });
});
