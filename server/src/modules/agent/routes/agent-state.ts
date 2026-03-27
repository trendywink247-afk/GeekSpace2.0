// ============================================================
// Agent State SSE — Real-time agent state stream
// GET /api/agent-state/stream — per-user SSE of agent events
// ============================================================

import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import jwtPkg from 'jsonwebtoken';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { config } from '../../../config.js';
import { type AgentStateType, addStateClient, removeStateClient, broadcastAgentState, getAllAgentStates, isRedisPubSubEnabled, getConnectedClientCount } from '../services/agent-state-bus.js';
import { getAgentAutocompleteList, getRouterInfo, getUserDefaultAgent, parseMentions } from '../services/unified-agent-router.js';

const { verify } = jwtPkg;

/**
 * SSE auth middleware — accepts token from Authorization header OR query param.
 * EventSource API doesn't support custom headers, so the SSE stream endpoint
 * needs to accept ?token=<jwt> as a fallback.
 */
function requireAuthSSE(req: AuthRequest, res: Response, next: NextFunction): void {
  // Try standard Authorization header first
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return requireAuth(req, res, next);
  }

  // Fallback: read token from query parameter (for EventSource)
  const queryToken = req.query.token as string | undefined;
  if (!queryToken) {
    res.status(401).json({ error: 'Missing auth token' });
    return;
  }

  try {
    const payload = verify(queryToken, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

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

// POST /api/agent-state/emit — allow any authenticated page to trigger canvas animations
agentStateRouter.post('/emit', requireAuth, (req: AuthRequest, res) => {
  const { agentId, state, content, tool } = req.body as { agentId: string; state: string; content?: string; tool?: string };
  const validStates = ['task_started', 'task_completed', 'task_failed', 'thinking', 'idle'];
  if (!agentId || !state || !validStates.includes(state)) {
    res.status(400).json({ error: 'Invalid agentId or state' });
    return;
  }
  broadcastAgentState(req.userId!, {
    agentId,
    agentName: agentId,
    state: state as AgentStateType,
    content: content || '',
    tool: tool || '',
  });
  res.json({ ok: true });
});

agentStateRouter.get('/stream', requireAuthSSE, (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Disable compression for this response (belt + suspenders with app-level filter)
  res.setHeader('Content-Encoding', 'identity');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Force flush headers + initial confirmation immediately
  res.write(':connected\n\n');
  if (typeof (res as unknown as { flush: () => void }).flush === 'function') {
    (res as unknown as { flush: () => void }).flush();
  }

  addStateClient(userId, res);

  // Heartbeat every 15 seconds (keep connection alive through proxies)
  const heartbeat = setInterval(() => {
    try {
      res.write(':ping\n\n');
      if (typeof (res as unknown as { flush: () => void }).flush === 'function') {
        (res as unknown as { flush: () => void }).flush();
      }
    } catch { clearInterval(heartbeat); }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeStateClient(userId, res);
  });
});
