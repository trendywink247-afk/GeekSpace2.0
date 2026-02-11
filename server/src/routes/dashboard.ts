import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, (_req, res) => {
  res.json({
    messagesSent: 1247,
    messagesChange: 12,
    remindersActive: 23,
    remindersChange: 3,
    apiCalls: 8400,
    apiCallsChange: 24,
    responseTimeMs: 1200,
    responseTimeChange: -8,
    agentStatus: 'online',
    agentModel: 'OpenClaw v2.1',
    agentUptime: '99.99%',
  });
});
