// ============================================================
// Agent State Bus — Real-time agent state broadcasting
//
// The nervous system of Agentin's agentic experience.
// Every agent action (thinking, tool call, response) emits a
// typed event. SSE clients (Office page, Chat UI) subscribe
// per-userId and see agents work in real time.
//
// Phase 3 upgrade: Added delegation, inter-agent comm, and
// task events. Redis pub/sub backend for horizontal scaling.
// ============================================================

import type { Response } from 'express';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from './cache.js';

// ── Event types ──────────────────────────────────────────────

export type AgentStateType =
  | 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result'
  | 'responding' | 'done'
  // Phase 3: new autonomous agent states
  | 'delegating' | 'comm_sent' | 'comm_received'
  | 'task_started' | 'task_completed' | 'task_failed';

export interface AgentStateEvent {
  agentId: string;       // personality ID: 'weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'
  agentName: string;     // display name: 'Weebo', 'Edith', etc.
  state: AgentStateType;
  tool?: string;         // tool name if state is tool_call/tool_result
  content?: string;      // human-readable description of what's happening
  iteration?: number;    // ReAct loop iteration
  // Phase 3: new fields for autonomous events
  targetAgent?: string;  // for delegation/comm events — who is the recipient
  taskId?: string;       // for task events — which task
  commId?: string;       // for comm events — which communication
  timestamp: string;
}

// ── SSE client registry ──────────────────────────────────────

const clients = new Map<string, Set<Response>>();

export function addStateClient(userId: string, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
}

export function removeStateClient(userId: string, res: Response): void {
  clients.get(userId)?.delete(res);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

// ── Broadcast ────────────────────────────────────────────────

// ── Event buffer for polling-based Office page ──────────────
// Stores recent events per-user so Office can poll and trigger animations
const eventBuffers = new Map<string, AgentStateEvent[]>();
const MAX_BUFFER_PER_USER = 100;
const BUFFER_TTL_MS = 120_000; // keep events for 2 minutes

export function getRecentEvents(userId: string, sinceMs: number): AgentStateEvent[] {
  const buffer = eventBuffers.get(userId);
  if (!buffer) return [];
  const cutoff = new Date(sinceMs).toISOString();
  return buffer.filter(e => e.timestamp > cutoff);
}

export function broadcastAgentState(userId: string, event: Omit<AgentStateEvent, 'timestamp'>): void {
  const full: AgentStateEvent = { ...event, timestamp: new Date().toISOString() };

  // Track last state per agent (for getAllAgentStates)
  agentLastState.set(`${userId}:${event.agentId}`, full);

  // Buffer event for polling-based Office page
  if (!eventBuffers.has(userId)) eventBuffers.set(userId, []);
  const buf = eventBuffers.get(userId)!;
  buf.push(full);
  // Trim old events
  const cutoff = Date.now() - BUFFER_TTL_MS;
  const cutoffStr = new Date(cutoff).toISOString();
  while (buf.length > 0 && buf[0].timestamp < cutoffStr) buf.shift();
  if (buf.length > MAX_BUFFER_PER_USER) buf.splice(0, buf.length - MAX_BUFFER_PER_USER);

  // Local SSE delivery
  const userClients = clients.get(userId);
  if (userClients && userClients.size > 0) {
    const data = `data: ${JSON.stringify(full)}\n\n`;
    for (const res of userClients) {
      try {
        res.write(data);
      } catch {
        userClients.delete(res);
      }
    }
  }

  // Redis pub/sub for horizontal scaling (fire-and-forget)
  if (redisPubEnabled) {
    publishToRedis(userId, full).catch(() => { /* non-fatal */ });
  }

  logger.debug({ userId, agentId: event.agentId, state: event.state }, 'agent-state:broadcast');
}

// ── Convenience helpers ──────────────────────────────────────

/** Resolve personality ID to display name */
const PERSONALITY_NAMES: Record<string, string> = {
  weebo: 'Weebo', edith: 'Edith', jarvis: 'Jarvis', aria: 'Aria',
  forge: 'Forge', pulse: 'Pulse', echo: 'Echo', cal: 'Cal', nova: 'Nova',
};

export function emitThinking(userId: string, agentId: string, content?: string): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'thinking',
    content: content || 'Processing...',
  });
}

export function emitToolCall(userId: string, agentId: string, tool: string, content?: string): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'tool_call',
    tool,
    content: content || `Running ${tool}...`,
  });
}

export function emitToolResult(userId: string, agentId: string, tool: string, content?: string): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'tool_result',
    tool,
    content: content || `${tool} complete`,
  });
}

export function emitResponding(userId: string, agentId: string, content?: string): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'responding',
    content: content || 'Writing response...',
  });
}

export function emitDone(userId: string, agentId: string, content?: string): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'done',
    content: content || 'Finished',
  });
}

export function emitIdle(userId: string, agentId: string): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'idle',
  });
}

// ── Phase 3: Delegation events ──────────────────────────────

export function emitDelegation(
  userId: string,
  fromAgentId: string,
  toAgentId: string,
  reason: string,
): void {
  broadcastAgentState(userId, {
    agentId: fromAgentId,
    agentName: PERSONALITY_NAMES[fromAgentId] || fromAgentId,
    state: 'delegating',
    content: `Delegating to ${PERSONALITY_NAMES[toAgentId] || toAgentId}: ${reason}`,
    targetAgent: toAgentId,
  });
}

// ── Phase 3: Inter-agent communication events ───────────────

export function emitCommSent(
  userId: string,
  fromAgentId: string,
  toAgentId: string,
  message: string,
  commId?: string,
): void {
  broadcastAgentState(userId, {
    agentId: fromAgentId,
    agentName: PERSONALITY_NAMES[fromAgentId] || fromAgentId,
    state: 'comm_sent',
    content: `→ ${PERSONALITY_NAMES[toAgentId] || toAgentId}: ${message}`,
    targetAgent: toAgentId,
    commId,
  });
}

export function emitCommReceived(
  userId: string,
  toAgentId: string,
  fromAgentId: string,
  message: string,
  commId?: string,
): void {
  broadcastAgentState(userId, {
    agentId: toAgentId,
    agentName: PERSONALITY_NAMES[toAgentId] || toAgentId,
    state: 'comm_received',
    content: `← ${PERSONALITY_NAMES[fromAgentId] || fromAgentId}: ${message}`,
    targetAgent: fromAgentId,
    commId,
  });
}

// ── Phase 3: Task lifecycle events ──────────────────────────

export function emitTaskStarted(
  userId: string,
  agentId: string,
  taskId: string,
  taskTitle: string,
): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'task_started',
    content: `Working on: ${taskTitle}`,
    taskId,
  });
}

export function emitTaskCompleted(
  userId: string,
  agentId: string,
  taskId: string,
  taskTitle: string,
): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'task_completed',
    content: `Completed: ${taskTitle}`,
    taskId,
  });
}

export function emitTaskFailed(
  userId: string,
  agentId: string,
  taskId: string,
  error: string,
): void {
  broadcastAgentState(userId, {
    agentId,
    agentName: PERSONALITY_NAMES[agentId] || agentId,
    state: 'task_failed',
    content: `Failed: ${error}`,
    taskId,
  });
}

// ── Phase 3: Redis pub/sub for horizontal scaling ───────────
//
// When multiple Express instances are behind a load balancer,
// SSE clients connect to different instances. Redis pub/sub
// ensures events broadcast to ALL instances' connected clients.
//
// Usage: call initRedisPubSub() at startup when Redis is available.
// Falls back gracefully to local-only broadcast if Redis is down.

let redisPubEnabled = false;

export async function initRedisPubSub(): Promise<void> {
  try {
    // Dynamically import ioredis to avoid hard dependency
    const { default: Redis } = await import('ioredis');
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.info('agent-state-bus: No REDIS_URL, using local-only broadcast');
      return;
    }

    const pub = new Redis(redisUrl);
    const sub = new Redis(redisUrl);

    sub.subscribe('agent-state', (err) => {
      if (err) {
        logger.warn({ err }, 'agent-state-bus: Redis subscribe failed');
        return;
      }
      redisPubEnabled = true;
      logger.info('agent-state-bus: Redis pub/sub enabled for horizontal scaling');
    });

    sub.on('message', (_channel: string, message: string) => {
      try {
        const { userId, event } = JSON.parse(message) as { userId: string; event: AgentStateEvent };
        // Deliver to local SSE clients (skip re-publishing to avoid loops)
        const userClients = clients.get(userId);
        if (!userClients || userClients.size === 0) return;
        const data = `data: ${JSON.stringify(event)}\n\n`;
        for (const res of userClients) {
          try { res.write(data); } catch { userClients.delete(res); }
        }
      } catch { /* malformed message — ignore */ }
    });

    // Override broadcastAgentState to publish via Redis
    const originalBroadcast = broadcastAgentState;
    (globalThis as Record<string, unknown>).__originalBroadcast = originalBroadcast;

    // Monkey-patch: publish to Redis channel so other instances can relay
    const _origWrite = broadcastAgentState;
    // We just store pub for use in broadcastViaRedis
    (globalThis as Record<string, unknown>).__redisPub = pub;

  } catch {
    logger.info('agent-state-bus: ioredis not available, using local-only broadcast');
  }
}

/**
 * Publish an event via Redis so all instances relay it to their local SSE clients.
 * Called automatically by broadcastAgentState when Redis pub/sub is enabled.
 */
export async function publishToRedis(userId: string, event: AgentStateEvent): Promise<void> {
  if (!redisPubEnabled) return;
  try {
    const pub = (globalThis as Record<string, unknown>).__redisPub as { publish: (channel: string, message: string) => Promise<number> } | undefined;
    if (pub) {
      await pub.publish('agent-state', JSON.stringify({ userId, event }));
    }
  } catch {
    // Redis publish failure is non-fatal — local broadcast still works
  }
}

// ── Stats ────────────────────────────────────────────────────

export function getConnectedClientCount(): number {
  let count = 0;
  for (const set of clients.values()) count += set.size;
  return count;
}

export function isRedisPubSubEnabled(): boolean {
  return redisPubEnabled;
}

// ── Per-agent last state cache ──────────────────────────────

const agentLastState = new Map<string, AgentStateEvent>();

export function getAgentLastState(userId: string, agentId: string): AgentStateEvent | undefined {
  return agentLastState.get(`${userId}:${agentId}`);
}

export function getAllAgentStates(userId: string): AgentStateEvent[] {
  const states: AgentStateEvent[] = [];
  const agents = ['weebo', 'edith', 'jarvis'];
  for (const a of agents) {
    const s = agentLastState.get(`${userId}:${a}`);
    if (s) states.push(s);
    else states.push({
      agentId: a,
      agentName: PERSONALITY_NAMES[a] || a,
      state: 'idle',
      timestamp: new Date().toISOString(),
    });
  }
  return states;
}

