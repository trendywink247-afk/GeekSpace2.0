// ============================================================
// Activity Stream — Unified real-time activity broadcasting
//
// Replaces agent-state-bus.ts with a richer, unified event model.
// Every agent action (thinking, tool call, response, messaging)
// emits a typed ActivityEvent. SSE clients (Office page, Chat UI)
// subscribe per-userId and see agents work in real time.
//
// Key additions over agent-state-bus.ts:
//   - unified emit() entry point with auto-populated compat fields
//   - channel param on all emitters (telegram/web/automation/proactive)
//   - new event types: message_in, message_out, error
//   - id and userId fields on every event
//   - backward-compat broadcastAgentState() alias (same signature)
// ============================================================

import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { logger } from '../logger.js';

// ── Event types ───────────────────────────────────────────────

export type ActivityEventType =
  | 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result' | 'responding' | 'done'
  | 'message_in' | 'message_out'
  | 'task_started' | 'task_completed' | 'task_failed'
  | 'delegating' | 'comm_sent' | 'comm_received'
  | 'error';

export type ActivityChannel = 'telegram' | 'web' | 'automation' | 'proactive';

export interface ActivityEvent {
  id: string;
  userId: string;
  agentId: string;
  type: ActivityEventType;
  channel: ActivityChannel;
  summary: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  // Backward-compat for AgentStatusStrip (mirrors state/agentName/content from old bus)
  state: ActivityEventType;
  agentName: string;
  content: string;
  // Legacy optional fields preserved for AgentStatusStrip consumers
  tool?: string;
  iteration?: number;
  targetAgent?: string;
  taskId?: string;
  commId?: string;
  // Multi-agent correlation fields
  requestId?: string;
  isMultiAgent?: boolean;
}

// Backward-compat type re-export (consumers that imported from agent-state-bus)
export type AgentStateType = ActivityEventType;
export type AgentStateEvent = ActivityEvent;

// Partial input for emit() — only required fields needed
export interface EmitInput {
  userId: string;
  agentId: string;
  type: ActivityEventType;
  channel: ActivityChannel;
  summary: string;
  metadata?: Record<string, unknown>;
  // Optional legacy fields passed through
  tool?: string;
  iteration?: number;
  targetAgent?: string;
  taskId?: string;
  commId?: string;
  // Multi-agent correlation fields
  requestId?: string;
  isMultiAgent?: boolean;
}

// ── Personality name map ──────────────────────────────────────

const PERSONALITY_NAMES: Record<string, string> = {
  weebo: 'Weebo',
  edith: 'Edith',
  jarvis: 'Jarvis',
  aria: 'Aria',
  forge: 'Forge',
  pulse: 'Pulse',
  echo: 'Echo',
  cal: 'Cal',
  nova: 'Nova',
};

// ── SSE client registry ───────────────────────────────────────

const clients = new Map<string, Set<Response>>();

export function addStateClient(userId: string, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
}

export function removeStateClient(userId: string, res: Response): void {
  clients.get(userId)?.delete(res);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

// ── Event buffer (polling-based Office page) ─────────────────

const eventBuffers = new Map<string, ActivityEvent[]>();
const MAX_BUFFER_PER_USER = 100;
const BUFFER_TTL_MS = 120_000; // 2 minutes

export function getRecentEvents(userId: string, sinceMs: number): ActivityEvent[] {
  const buffer = eventBuffers.get(userId);
  if (!buffer) return [];
  const cutoff = new Date(sinceMs).toISOString();
  return buffer.filter(e => e.timestamp > cutoff);
}

// ── Per-agent last state cache ────────────────────────────────

const agentLastState = new Map<string, ActivityEvent>();

export function getAgentLastState(userId: string, agentId: string): ActivityEvent | undefined {
  return agentLastState.get(`${userId}:${agentId}`);
}

export function getAllAgentStates(userId: string): ActivityEvent[] {
  const states: ActivityEvent[] = [];
  const agents = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];
  for (const a of agents) {
    const s = agentLastState.get(`${userId}:${a}`);
    if (s) {
      states.push(s);
    } else {
      const idle = buildEvent({
        userId,
        agentId: a,
        type: 'idle',
        channel: 'web',
        summary: 'idle',
      });
      states.push(idle);
    }
  }
  return states;
}

// ── Core: buildEvent (pure, no side effects) ──────────────────

function buildEvent(input: EmitInput): ActivityEvent {
  const agentName = PERSONALITY_NAMES[input.agentId] ?? input.agentId;
  return {
    id: randomUUID(),
    userId: input.userId,
    agentId: input.agentId,
    type: input.type,
    channel: input.channel,
    summary: input.summary,
    metadata: input.metadata,
    timestamp: new Date().toISOString(),
    // Backward-compat mirrors
    state: input.type,
    agentName,
    content: input.summary,
    // Legacy optional fields
    tool: input.tool,
    iteration: input.iteration,
    targetAgent: input.targetAgent,
    taskId: input.taskId,
    commId: input.commId,
    // Multi-agent correlation fields
    requestId: input.requestId,
    isMultiAgent: input.isMultiAgent,
  };
}

// ── Core: emit() — buffers, updates last state, SSE, Redis ───

export function emit(input: EmitInput): ActivityEvent {
  const event = buildEvent(input);
  const { userId, agentId } = input;

  // Track last state per agent
  agentLastState.set(`${userId}:${agentId}`, event);

  // Buffer event
  if (!eventBuffers.has(userId)) eventBuffers.set(userId, []);
  const buf = eventBuffers.get(userId)!;
  buf.push(event);

  // Trim TTL-expired events
  const cutoffStr = new Date(Date.now() - BUFFER_TTL_MS).toISOString();
  while (buf.length > 0 && buf[0].timestamp < cutoffStr) buf.shift();

  // Trim excess
  if (buf.length > MAX_BUFFER_PER_USER) buf.splice(0, buf.length - MAX_BUFFER_PER_USER);

  // Local SSE delivery
  const userClients = clients.get(userId);
  if (userClients && userClients.size > 0) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of userClients) {
      try {
        res.write(data);
      } catch {
        userClients.delete(res);
      }
    }
  }

  // Redis pub/sub (fire-and-forget)
  if (redisPubEnabled) {
    publishToRedis(userId, event).catch(() => { /* non-fatal */ });
  }

  logger.debug({ userId, agentId, type: input.type }, 'activity-stream:emit');

  return event;
}

// ── Backward-compat: broadcastAgentState() ───────────────────
//
// Accepts the OLD AgentStateEvent shape (without id, userId, channel).
// Converts to emit() internally. Required by re-export wrapper (Task 2).

export interface LegacyAgentStateEvent {
  agentId: string;
  agentName: string;
  state: ActivityEventType;
  tool?: string;
  content?: string;
  iteration?: number;
  targetAgent?: string;
  taskId?: string;
  commId?: string;
}

export function broadcastAgentState(
  userId: string,
  event: LegacyAgentStateEvent,
): void {
  emit({
    userId,
    agentId: event.agentId,
    type: event.state,
    channel: 'web',
    summary: event.content ?? '',
    tool: event.tool,
    iteration: event.iteration,
    targetAgent: event.targetAgent,
    taskId: event.taskId,
    commId: event.commId,
  });
}

// ── Convenience emitters ──────────────────────────────────────
//
// Same signatures as agent-state-bus.ts emitters, plus optional
// channel param at the end (defaults to 'web').

export function emitThinking(
  userId: string,
  agentId: string,
  content?: string,
  channel: ActivityChannel = 'web',
): void {
  emit({ userId, agentId, type: 'thinking', channel, summary: content ?? 'Processing...' });
}

export function emitToolCall(
  userId: string,
  agentId: string,
  tool: string,
  content?: string,
  channel: ActivityChannel = 'web',
): void {
  emit({
    userId,
    agentId,
    type: 'tool_call',
    channel,
    summary: content ?? `Running ${tool}...`,
    tool,
  });
}

export function emitToolResult(
  userId: string,
  agentId: string,
  tool: string,
  content?: string,
  channel: ActivityChannel = 'web',
): void {
  emit({
    userId,
    agentId,
    type: 'tool_result',
    channel,
    summary: content ?? `${tool} complete`,
    tool,
  });
}

export function emitResponding(
  userId: string,
  agentId: string,
  content?: string,
  channel: ActivityChannel = 'web',
): void {
  emit({ userId, agentId, type: 'responding', channel, summary: content ?? 'Writing response...' });
}

export function emitDone(
  userId: string,
  agentId: string,
  content?: string,
  channel: ActivityChannel = 'web',
): void {
  emit({ userId, agentId, type: 'done', channel, summary: content ?? 'Finished' });
}

export function emitIdle(
  userId: string,
  agentId: string,
  channel: ActivityChannel = 'web',
): void {
  emit({ userId, agentId, type: 'idle', channel, summary: '' });
}

export function emitDelegation(
  userId: string,
  fromAgentId: string,
  toAgentId: string,
  reason: string,
  channel: ActivityChannel = 'web',
): void {
  const toName = PERSONALITY_NAMES[toAgentId] ?? toAgentId;
  emit({
    userId,
    agentId: fromAgentId,
    type: 'delegating',
    channel,
    summary: `Delegating to ${toName}: ${reason}`,
    targetAgent: toAgentId,
  });
}

export function emitCommSent(
  userId: string,
  fromAgentId: string,
  toAgentId: string,
  message: string,
  commId?: string,
  channel: ActivityChannel = 'web',
): void {
  const toName = PERSONALITY_NAMES[toAgentId] ?? toAgentId;
  emit({
    userId,
    agentId: fromAgentId,
    type: 'comm_sent',
    channel,
    summary: `→ ${toName}: ${message}`,
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
  channel: ActivityChannel = 'web',
): void {
  const fromName = PERSONALITY_NAMES[fromAgentId] ?? fromAgentId;
  emit({
    userId,
    agentId: toAgentId,
    type: 'comm_received',
    channel,
    summary: `← ${fromName}: ${message}`,
    targetAgent: fromAgentId,
    commId,
  });
}

export function emitTaskStarted(
  userId: string,
  agentId: string,
  taskId: string,
  taskTitle: string,
  channel: ActivityChannel = 'web',
): void {
  emit({ userId, agentId, type: 'task_started', channel, summary: `Working on: ${taskTitle}`, taskId });
}

export function emitTaskCompleted(
  userId: string,
  agentId: string,
  taskId: string,
  taskTitle: string,
  channel: ActivityChannel = 'web',
): void {
  emit({ userId, agentId, type: 'task_completed', channel, summary: `Completed: ${taskTitle}`, taskId });
}

export function emitTaskFailed(
  userId: string,
  agentId: string,
  taskId: string,
  error: string,
  channel: ActivityChannel = 'web',
): void {
  emit({ userId, agentId, type: 'task_failed', channel, summary: `Failed: ${error}`, taskId });
}

// ── Stats ─────────────────────────────────────────────────────

export function getConnectedClientCount(): number {
  let count = 0;
  for (const set of clients.values()) count += set.size;
  return count;
}

export function isRedisPubSubEnabled(): boolean {
  return redisPubEnabled;
}

// ── Redis pub/sub for horizontal scaling ──────────────────────

let redisPubEnabled = false;

export async function initRedisPubSub(): Promise<void> {
  try {
    const { default: Redis } = await import('ioredis');
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.info('activity-stream: No REDIS_URL, using local-only broadcast');
      return;
    }

    const pub = new Redis(redisUrl);
    const sub = new Redis(redisUrl);

    sub.subscribe('agent-state', (err) => {
      if (err) {
        logger.warn({ err }, 'activity-stream: Redis subscribe failed');
        return;
      }
      redisPubEnabled = true;
      logger.info('activity-stream: Redis pub/sub enabled for horizontal scaling');
    });

    sub.on('message', (_channel: string, message: string) => {
      try {
        const { userId, event } = JSON.parse(message) as { userId: string; event: ActivityEvent };
        const userClients = clients.get(userId);
        if (!userClients || userClients.size === 0) return;
        const data = `data: ${JSON.stringify(event)}\n\n`;
        for (const res of userClients) {
          try { res.write(data); } catch { userClients.delete(res); }
        }
      } catch { /* malformed message — ignore */ }
    });

    (globalThis as Record<string, unknown>).__redisPub = pub;

  } catch {
    logger.info('activity-stream: ioredis not available, using local-only broadcast');
  }
}

export async function publishToRedis(userId: string, event: ActivityEvent): Promise<void> {
  if (!redisPubEnabled) return;
  try {
    const pub = (globalThis as Record<string, unknown>).__redisPub as {
      publish: (channel: string, message: string) => Promise<number>;
    } | undefined;
    if (pub) {
      await pub.publish('agent-state', JSON.stringify({ userId, event }));
    }
  } catch {
    // Redis publish failure is non-fatal — local broadcast still works
  }
}
