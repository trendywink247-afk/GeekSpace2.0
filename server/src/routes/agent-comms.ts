// ============================================================
// Agent Communications Routes — Inter-agent message API
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  getAgentComms,
  getRecentComms,
  getCommStats,
  sendAgentComm,
  acknowledgeComm,
  acknowledgeAllComms,
  delegateTask,
  type AgentId,
  type CommType,
} from '../services/agent-comms.js';

export const agentCommsRouter = Router();

// GET /api/agent-comms — list communications with filters
agentCommsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const agentId = req.query.agent_id as AgentId | undefined;
  const type = req.query.type as CommType | undefined;
  const unacknowledgedOnly = req.query.unacknowledged === 'true';
  const limit = parseInt(req.query.limit as string) || 50;

  const comms = getAgentComms(req.userId!, { agentId, type, unacknowledgedOnly, limit });
  res.json(comms);
});

// GET /api/agent-comms/recent — recent communications feed
agentCommsRouter.get('/recent', requireAuth, (req: AuthRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const comms = getRecentComms(req.userId!, limit);
  res.json(comms);
});

// GET /api/agent-comms/stats — communication statistics
agentCommsRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const stats = getCommStats(req.userId!);
  res.json(stats);
});

// POST /api/agent-comms — send a message between agents (user-initiated)
agentCommsRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const { from_agent, to_agent, message, type } = req.body as {
    from_agent: AgentId;
    to_agent: AgentId;
    message: string;
    type?: CommType;
  };

  if (!from_agent || !to_agent || !message) {
    res.status(400).json({ error: 'from_agent, to_agent, and message are required' });
    return;
  }

  const validAgents = ['weebo', 'edith', 'jarvis'];
  if (!validAgents.includes(from_agent) || !validAgents.includes(to_agent)) {
    res.status(400).json({ error: 'Agents must be weebo, edith, or jarvis' });
    return;
  }

  const comm = sendAgentComm(req.userId!, from_agent, to_agent, message, type);
  res.status(201).json(comm);
});

// POST /api/agent-comms/delegate — delegate a task between agents
agentCommsRouter.post('/delegate', requireAuth, (req: AuthRequest, res) => {
  const { from_agent, to_agent, task_description, task_id } = req.body as {
    from_agent: AgentId;
    to_agent: AgentId;
    task_description: string;
    task_id?: string;
  };

  if (!from_agent || !to_agent || !task_description) {
    res.status(400).json({ error: 'from_agent, to_agent, and task_description are required' });
    return;
  }

  const comm = delegateTask(req.userId!, from_agent, to_agent, task_description, task_id);
  res.json(comm);
});

// PATCH /api/agent-comms/:id/acknowledge — mark a message as acknowledged
agentCommsRouter.patch('/:id/acknowledge', requireAuth, (req: AuthRequest, res) => {
  const success = acknowledgeComm(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Communication not found' });
    return;
  }
  res.json({ success: true });
});

// POST /api/agent-comms/acknowledge-all — acknowledge all messages for an agent
agentCommsRouter.post('/acknowledge-all', requireAuth, (req: AuthRequest, res) => {
  const { agent_id } = req.body as { agent_id: AgentId };
  if (!agent_id) {
    res.status(400).json({ error: 'agent_id is required' });
    return;
  }
  const count = acknowledgeAllComms(req.userId!, agent_id);
  res.json({ acknowledged: count });
});
