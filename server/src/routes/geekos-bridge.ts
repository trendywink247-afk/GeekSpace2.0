// ============================================================
// GeekOS Bridge — Full CRUD + Rooms + Memory + Plugin Fallback
//
// Proxy to ElizaOS agent runtime with user agent management,
// multi-agent rooms, semantic memory, and plugin bridge.
// ============================================================

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export const geekosBridgeRouter = Router();

const GEEKOS_HOST = process.env.GEEKOS_HOST || 'geekos';
const GEEKOS_PORT = process.env.GEEKOS_PORT || '3000';
const GEEKOS_URL = `http://${GEEKOS_HOST}:${GEEKOS_PORT}`;

// ── Plan limits ──────────────────────────────────────────────
const AGENT_LIMITS: Record<string, number> = {
  free: 2,
  pilot: Infinity,
  intro: Infinity,
  monthly: Infinity,
  halfyear: Infinity,
  yearly: Infinity,
};

function getUserPlan(userId: string): string {
  const sub = db.prepare(
    "SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
  ).get(userId) as { plan: string } | undefined;
  return sub?.plan || 'free';
}

function getUserAgentCount(userId: string): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM user_agents WHERE user_id = ? AND is_active = 1').get(userId) as { cnt: number };
  return row.cnt;
}

// ── Seed default agent ───────────────────────────────────────
function seedDefaultAgent(userId: string): void {
  const existing = db.prepare('SELECT id FROM user_agents WHERE user_id = ? LIMIT 1').get(userId);
  if (existing) return;

  const agentConfig = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(userId) as { personality: string } | undefined;
  const personality = agentConfig?.personality || 'weebo';

  const characterJson = JSON.stringify({
    name: personality.charAt(0).toUpperCase() + personality.slice(1),
    personality_base: personality,
    modelProvider: 'openai',
    settings: { model: 'agentin-default' },
  });

  db.prepare(`INSERT INTO user_agents (id, user_id, name, personality_base, character_json, is_default, is_active)
    VALUES (?, ?, ?, ?, ?, 1, 1)`).run(uuid(), userId, personality.charAt(0).toUpperCase() + personality.slice(1), personality, characterJson);
}

// ── GET /api/geekos/status ───────────────────────────────────
geekosBridgeRouter.get('/status', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const resp = await fetch(`${GEEKOS_URL}/api/agents`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      const agents = Array.isArray(data) ? data : (data?.agents || []);
      res.json({ geekos: 'running', agentCount: agents.length, agents: agents.map((a: { name?: string; id?: string }) => ({ name: a.name, id: a.id })) });
    } else {
      res.json({ geekos: 'error', error: `ElizaOS returned ${resp.status}` });
    }
  } catch {
    res.json({ geekos: 'offline', error: 'ElizaOS not reachable. Start with: docker compose --profile geekos up -d geekos' });
  }
});

// ── GET /api/geekos/agents — list user's agents ──────────────
geekosBridgeRouter.get('/agents', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  seedDefaultAgent(userId);

  const agents = db.prepare(
    'SELECT id, name, personality_base, plugins, is_default, is_active, eliza_agent_id, created_at, updated_at FROM user_agents WHERE user_id = ? ORDER BY is_default DESC, created_at ASC'
  ).all(userId);

  const plan = getUserPlan(userId);
  const limit = AGENT_LIMITS[plan] ?? 2;

  res.json({ agents, plan, agentLimit: limit === Infinity ? 'unlimited' : limit });
});

// ── POST /api/geekos/agents — create new agent ──────────────
geekosBridgeRouter.post('/agents', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { name, personality_base, system_prompt, plugins } = req.body;

  if (!name || typeof name !== 'string' || name.length > 50) {
    res.status(400).json({ error: 'name is required (max 50 chars)' }); return;
  }

  const plan = getUserPlan(userId);
  const limit = AGENT_LIMITS[plan] ?? 2;
  const count = getUserAgentCount(userId);

  if (count >= limit) {
    res.status(403).json({ error: `Agent limit reached (${limit}). Upgrade your plan for unlimited agents.` }); return;
  }

  const agentId = uuid();
  const characterJson = JSON.stringify({
    name,
    personality_base: personality_base || 'weebo',
    system: system_prompt || '',
    modelProvider: 'openai',
    settings: { model: 'agentin-default' },
    plugins: Array.isArray(plugins) ? plugins : ['@elizaos/plugin-node'],
  });

  db.prepare(`INSERT INTO user_agents (id, user_id, name, personality_base, character_json, plugins, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)`).run(
    agentId, userId, name, personality_base || 'weebo', characterJson,
    JSON.stringify(Array.isArray(plugins) ? plugins : ['@elizaos/plugin-node']),
  );

  // Try to spawn in ElizaOS (non-blocking — GeekOS may be offline)
  let elizaAgentId: string | null = null;
  try {
    const resp = await fetch(`${GEEKOS_URL}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: characterJson,
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json();
      elizaAgentId = data?.id || null;
      if (elizaAgentId) {
        db.prepare('UPDATE user_agents SET eliza_agent_id = ? WHERE id = ?').run(elizaAgentId, agentId);
      }
    }
  } catch {
    logger.debug({ agentId, name }, 'GeekOS offline — agent saved to DB, will sync on next start');
  }

  res.status(201).json({ id: agentId, name, personality_base: personality_base || 'weebo', eliza_agent_id: elizaAgentId });
});

// ── PUT /api/geekos/agents/:id — update agent ───────────────
geekosBridgeRouter.put('/agents/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM user_agents WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Agent not found' }); return; }

  const { name, system_prompt, plugins } = req.body;
  const updates: string[] = [];
  const params: unknown[] = [];

  if (name) { updates.push('name = ?'); params.push(name); }
  if (system_prompt !== undefined) {
    const charJson = JSON.parse(existing.character_json as string);
    charJson.system = system_prompt;
    updates.push('character_json = ?'); params.push(JSON.stringify(charJson));
  }
  if (plugins) { updates.push('plugins = ?'); params.push(JSON.stringify(plugins)); }
  updates.push("updated_at = datetime('now')");

  if (updates.length > 1) {
    db.prepare(`UPDATE user_agents SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params, id, userId);
  }

  const updated = db.prepare('SELECT * FROM user_agents WHERE id = ?').get(id);
  res.json(updated);
});

// ── DELETE /api/geekos/agents/:id — deactivate agent ─────────
geekosBridgeRouter.delete('/agents/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM user_agents WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Agent not found' }); return; }

  if (existing.is_default) {
    res.status(400).json({ error: 'Cannot delete default agent' }); return;
  }

  // Check it's not the last active agent
  const activeCount = getUserAgentCount(userId);
  if (activeCount <= 1) {
    res.status(400).json({ error: 'Cannot delete last active agent' }); return;
  }

  db.prepare('UPDATE user_agents SET is_active = 0 WHERE id = ? AND user_id = ?').run(id, userId);

  // Try to stop in ElizaOS
  if (existing.eliza_agent_id) {
    try {
      await fetch(`${GEEKOS_URL}/api/agents/${existing.eliza_agent_id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* non-fatal */ }
  }

  res.json({ deleted: true });
});

// ── POST /api/geekos/agents/:id/chat — chat with agent ──────
geekosBridgeRouter.post('/agents/:id/chat', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { message, roomId } = req.body;

  if (!message) { res.status(400).json({ error: 'message is required' }); return; }

  const agent = db.prepare('SELECT * FROM user_agents WHERE id = ? AND user_id = ? AND is_active = 1').get(id, userId) as Record<string, unknown> | undefined;
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

  try {
    const resp = await fetch(`${GEEKOS_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agentin-User-Id': userId,
      },
      body: JSON.stringify({
        content: message,
        userId,
        roomId: roomId || `agentin-${userId}-${id}`,
        agentId: agent.eliza_agent_id || undefined,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: `GeekOS agent returned ${resp.status}` }); return;
    }

    const data = await resp.json();
    res.json({ agent: agent.name, response: data });
  } catch (err) {
    logger.error({ err, agentId: id }, 'GeekOS chat error');
    res.status(503).json({ error: 'GeekOS is offline' });
  }
});

// ── GET /api/geekos/agents/:id/memory — agent memory ────────
geekosBridgeRouter.get('/agents/:id/memory', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const agent = db.prepare('SELECT eliza_agent_id FROM user_agents WHERE id = ? AND user_id = ?').get(id, userId) as { eliza_agent_id: string | null } | undefined;
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

  if (!agent.eliza_agent_id) {
    res.json({ memories: [], note: 'Agent not yet synced with GeekOS runtime' }); return;
  }

  try {
    const url = q
      ? `${GEEKOS_URL}/api/agents/${agent.eliza_agent_id}/memory?q=${encodeURIComponent(q)}`
      : `${GEEKOS_URL}/api/agents/${agent.eliza_agent_id}/memory`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    res.json(data);
  } catch {
    res.json({ memories: [], error: 'GeekOS offline' });
  }
});

// ── POST /api/geekos/agents/:id/memory/ingest — add knowledge
geekosBridgeRouter.post('/agents/:id/memory/ingest', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { text, source } = req.body;

  if (!text) { res.status(400).json({ error: 'text is required' }); return; }

  const agent = db.prepare('SELECT eliza_agent_id FROM user_agents WHERE id = ? AND user_id = ?').get(id, userId) as { eliza_agent_id: string | null } | undefined;
  if (!agent?.eliza_agent_id) { res.status(404).json({ error: 'Agent not synced with GeekOS' }); return; }

  try {
    const resp = await fetch(`${GEEKOS_URL}/api/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: source || 'user-upload', agentId: agent.eliza_agent_id }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    res.json(data);
  } catch {
    res.status(503).json({ error: 'GeekOS offline' });
  }
});

// ── POST /api/geekos/rooms — create multi-agent room ────────
geekosBridgeRouter.post('/rooms', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { name, agentIds } = req.body;

  if (!Array.isArray(agentIds) || agentIds.length < 2) {
    res.status(400).json({ error: 'At least 2 agent IDs required' }); return;
  }

  // Verify all agents belong to user
  const placeholders = agentIds.map(() => '?').join(',');
  const agents = db.prepare(
    `SELECT id, name, eliza_agent_id FROM user_agents WHERE id IN (${placeholders}) AND user_id = ? AND is_active = 1`
  ).all(...agentIds, userId) as Array<{ id: string; name: string; eliza_agent_id: string | null }>;

  if (agents.length < 2) {
    res.status(400).json({ error: 'Need at least 2 valid active agents' }); return;
  }

  const roomId = `room-${userId}-${Date.now()}`;

  // Try to create room in ElizaOS
  try {
    await fetch(`${GEEKOS_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: roomId,
        name: name || `Room ${new Date().toLocaleTimeString()}`,
        agentIds: agents.map(a => a.eliza_agent_id).filter(Boolean),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // GeekOS offline — room will work in fallback mode
  }

  res.json({
    roomId,
    name: name || `Room ${new Date().toLocaleTimeString()}`,
    agents: agents.map(a => ({ id: a.id, name: a.name })),
  });
});

// ── POST /api/geekos/rooms/:id/message — message all agents in room
geekosBridgeRouter.post('/rooms/:id/message', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const roomId = req.params.id;
  const { message, agentIds } = req.body;

  if (!message) { res.status(400).json({ error: 'message is required' }); return; }

  // Get agents for this room
  const agents = agentIds && Array.isArray(agentIds)
    ? db.prepare(`SELECT id, name, eliza_agent_id FROM user_agents WHERE id IN (${agentIds.map(() => '?').join(',')}) AND user_id = ? AND is_active = 1`).all(...agentIds, userId) as Array<{ id: string; name: string; eliza_agent_id: string | null }>
    : db.prepare('SELECT id, name, eliza_agent_id FROM user_agents WHERE user_id = ? AND is_active = 1 LIMIT 4').all(userId) as Array<{ id: string; name: string; eliza_agent_id: string | null }>;

  const results: Array<{ agent: string; agentId: string; response: unknown; latencyMs: number }> = [];

  const promises = agents.map(async (agent) => {
    const start = Date.now();
    try {
      const resp = await fetch(`${GEEKOS_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agentin-User-Id': userId },
        body: JSON.stringify({ content: message, userId, roomId, agentId: agent.eliza_agent_id }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      results.push({ agent: agent.name, agentId: agent.id, response: data, latencyMs: Date.now() - start });
    } catch {
      results.push({ agent: agent.name, agentId: agent.id, response: { error: 'Agent offline' }, latencyMs: Date.now() - start });
    }
  });

  await Promise.allSettled(promises);

  res.json({
    roomId,
    message,
    results: results.sort((a, b) => a.latencyMs - b.latencyMs),
  });
});

// ── GET /api/geekos/rooms/:id/stream — SSE room transcript ──
geekosBridgeRouter.get('/rooms/:id/stream', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(':ok\n\n');

  const heartbeat = setInterval(() => {
    try { res.write(':ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 30000);

  // For now, room streaming works via polling from the frontend
  // Full SSE integration with ElizaOS room events will be added when ElizaOS
  // exposes a room event stream API
  void userId;

  req.on('close', () => { clearInterval(heartbeat); });
});

// ── Plugin bridge helper (exported for action-executor) ──────
export async function forwardToGeekOS(userId: string, tool: string, params: Record<string, unknown>): Promise<string | null> {
  // Find user's first active agent with relevant plugins
  const agents = db.prepare(
    'SELECT eliza_agent_id, plugins FROM user_agents WHERE user_id = ? AND is_active = 1 AND eliza_agent_id IS NOT NULL'
  ).all(userId) as Array<{ eliza_agent_id: string; plugins: string }>;

  for (const agent of agents) {
    try {
      const resp = await fetch(`${GEEKOS_URL}/api/agents/${agent.eliza_agent_id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agentin-User-Id': userId },
        body: JSON.stringify({ action: tool, params }),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return typeof data === 'string' ? data : JSON.stringify(data);
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ── Semantic memory query (exported for message-router) ──────
export async function queryGeekOSMemory(userId: string, query: string): Promise<string | null> {
  try {
    const agent = db.prepare(
      'SELECT eliza_agent_id FROM user_agents WHERE user_id = ? AND is_active = 1 AND eliza_agent_id IS NOT NULL AND is_default = 1 LIMIT 1'
    ).get(userId) as { eliza_agent_id: string } | undefined;

    if (!agent) return null;

    const resp = await fetch(`${GEEKOS_URL}/api/agents/${agent.eliza_agent_id}/memory?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const memories = Array.isArray(data) ? data : (data?.memories || []);
    if (memories.length === 0) return null;

    return memories.slice(0, 5).map((m: { content?: string; text?: string }) => m.content || m.text || '').filter(Boolean).join('\n');
  } catch {
    return null;
  }
}

// ── Conversation ingest (exported for memory.ts) ─────────────
export async function ingestToGeekOS(userId: string, role: string, content: string): Promise<void> {
  try {
    const agent = db.prepare(
      'SELECT eliza_agent_id FROM user_agents WHERE user_id = ? AND is_active = 1 AND eliza_agent_id IS NOT NULL AND is_default = 1 LIMIT 1'
    ).get(userId) as { eliza_agent_id: string } | undefined;

    if (!agent) return;

    await fetch(`${GEEKOS_URL}/api/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${role}: ${content}`, source: 'conversation', agentId: agent.eliza_agent_id }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-fatal — GeekOS may be offline
  }
}
