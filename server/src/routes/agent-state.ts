// ============================================================
// Agent State SSE — Real-time agent state stream
// GET /api/agent-state/stream — per-user SSE of agent events
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { addStateClient, removeStateClient } from '../services/agent-state-bus.js';

export const agentStateRouter = Router();

agentStateRouter.get('/stream', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection confirmation
  res.write(':connected\n\n');

  addStateClient(userId, res);

  // Heartbeat every 25 seconds
  const heartbeat = setInterval(() => {
    try { res.write(':ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeStateClient(userId, res);
  });
});
