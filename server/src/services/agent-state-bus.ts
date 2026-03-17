// ============================================================
// Agent State Bus — Real-time agent state broadcasting
//
// The nervous system of Agentin's agentic experience.
// Every agent action (thinking, tool call, response) emits a
// typed event. SSE clients (Office page, Chat UI) subscribe
// per-userId and see agents work in real time.
// ============================================================

import type { Response } from 'express';
import { logger } from '../logger.js';

// ── Event types ──────────────────────────────────────────────

export interface AgentStateEvent {
  agentId: string;       // personality ID: 'weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'
  agentName: string;     // display name: 'Weebo', 'Edith', etc.
  state: 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result' | 'responding' | 'done';
  tool?: string;         // tool name if state is tool_call/tool_result
  content?: string;      // human-readable description of what's happening
  iteration?: number;    // ReAct loop iteration
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

export function broadcastAgentState(userId: string, event: Omit<AgentStateEvent, 'timestamp'>): void {
  const full: AgentStateEvent = { ...event, timestamp: new Date().toISOString() };
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const data = `data: ${JSON.stringify(full)}\n\n`;
  for (const res of userClients) {
    try {
      res.write(data);
    } catch {
      userClients.delete(res);
    }
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

// ── Stats ────────────────────────────────────────────────────

export function getConnectedClientCount(): number {
  let count = 0;
  for (const set of clients.values()) count += set.size;
  return count;
}
