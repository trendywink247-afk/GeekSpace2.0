// ============================================================
// Agent State SSE — Real-time agent state stream
// GET /api/agent-state/stream — per-user SSE of agent events
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { addStateClient, removeStateClient, getAllAgentStates, isRedisPubSubEnabled, getConnectedClientCount } from '../services/agent-state-bus.js';
import { getAgentAutocompleteList, getRouterInfo, getUserDefaultAgent, parseMentions } from '../services/unified-agent-router.js';

export const agentStateRouter = Router();

// GET /api/agent-state/agents — autocomplete list for @mention UI
agentStateRouter.get('/agents', requireAuth, (req: AuthRequest, res) => {
  const agents = getAgentAutocompleteList();
  const defaultAgent = getUserDefaultAgent(req.userId!);
  res.json({ agents, defaultAgent });
});

// GET /api/agent-state/router-info — router configuration for UI
agentStateRouter.get('/router-info', requireAuth, (_req, res) => {
  res.json(getRouterInfo());
});

// POST /api/agent-state/parse-mentions — parse @mentions from a message
agentStateRouter.post('/parse-mentions', requireAuth, (req, res) => {
  const { message } = req.body as { message: string };
  if (!message) { res.status(400).json({ error: 'message required' }); return; }
  const result = parseMentions(message);
  res.json(result);
});

// GET /api/agent-state/states — current state of all 3 core agents
agentStateRouter.get('/states', requireAuth, (req: AuthRequest, res) => {
  const states = getAllAgentStates(req.userId!);
  res.json(states);
});

// GET /api/agent-state/info — bus health info
agentStateRouter.get('/info', requireAuth, (_req, res) => {
  res.json({
    connectedClients: getConnectedClientCount(),
    redisPubSub: isRedisPubSubEnabled(),
  });
});

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
