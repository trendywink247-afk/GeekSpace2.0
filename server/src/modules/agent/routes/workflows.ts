/**
 * @fileoverview Workflow and agent-orchestration routes — workflow history, bridge preview,
 * agent registry, and agent-to-agent messaging.
 */
// Extracted from agent.ts — Sprint 3 decomposition
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { validateBody, chatSchema } from '../../../middleware/validate.js';
import { classifyComplexity, getRecentBridgeEvents } from '../../../services/pico-kimi-bridge.js';
import { getUserWorkflows, getWorkflowStatus, getWorkflowAnalytics } from '../../../services/workflow-engine.js';
import { getAllAgentDefinitions, selectAgents } from '../services/agent-registry.js';
import { sendAgentMessage, getAgentMessages, canChatWithAgent } from '../services/agent-chat.js';

const router = Router();

// ============================================================
// Pico-Kimi Bridge — Workflow & Agent Orchestration Endpoints
// ============================================================

// ---- Agent Registry (public) ----

/**
 * GET /api/agent/agents
 * Returns a public list of all available agent definitions.
 */
router.get('/agents', (_req, res) => {
  const agents = getAllAgentDefinitions().map(a => ({
    role: a.role,
    name: a.name,
    description: a.description,
    capabilities: a.capabilities,
    costMultiplier: a.costMultiplier,
  }));
  res.json(agents);
});

// ---- Workflow History ----

router.get('/workflows', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const workflows = getUserWorkflows(req.userId!, limit);
  res.json(workflows);
});

// ---- Workflow Status ----

router.get('/workflows/:workflowId', requireAuth, (req: AuthRequest, res) => {
  const status = getWorkflowStatus(req.params.workflowId, req.userId!);
  if (!status) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(status);
});

// ---- Workflow Analytics ----

router.get('/workflows-analytics', requireAuth, (req: AuthRequest, res) => {
  const analytics = getWorkflowAnalytics(req.userId!);
  res.json(analytics);
});

// ---- Bridge Events (debugging/analytics) ----

router.get('/bridge-events', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const events = getRecentBridgeEvents(req.userId!, limit);
  res.json(events);
});

// ---- Complexity Preview (dry run) ----

router.post('/bridge-preview', requireAuth, validateBody(chatSchema), (req: AuthRequest, res) => {
  const { message } = req.body as { message: string };
  const complexity = classifyComplexity(message);

  const selectedAgents = selectAgents(message, 3);

  res.json({
    complexity,
    selectedAgents,
    wouldUseWorkflow: complexity === 'complex' || complexity === 'multi-step',
    estimatedCreditRange: complexity === 'trivial' ? '1'
      : complexity === 'simple' ? '1-5'
      : complexity === 'moderate' ? '5-20'
      : complexity === 'complex' ? '20-80'
      : '50-200',
  });
});

// ---- Agent-to-Agent Messaging ----

router.post('/send-message', requireAuth, async (req: AuthRequest, res) => {
  const { recipientAgentId, message } = req.body as { recipientAgentId?: string; message?: string };

  if (!recipientAgentId || !message) {
    res.status(400).json({ error: 'Missing recipientAgentId or message' });
    return;
  }

  if (message.length > 2000) {
    res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    return;
  }

  const success = await sendAgentMessage(req.userId!, recipientAgentId, message);

  if (!success) {
    res.status(400).json({ error: 'Cannot send message to this agent. They may have agent chat disabled or not exist.' });
    return;
  }

  res.json({ success: true, message: 'Message sent successfully' });
});

router.get('/messages', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const messages = getAgentMessages(req.userId!, limit);
  res.json(messages);
});

router.get('/can-chat/:username', requireAuth, (req: AuthRequest, res) => {
  const canChat = canChatWithAgent(req.userId!, req.params.username);
  res.json({ canChat });
});

export default router;
