// ============================================================
// Agent Communications — Inter-agent message system
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { broadcastAgentState } from './agent-state-bus.js';

export type CommType = 'info' | 'request' | 'delegation' | 'response' | 'alert';
export type AgentId = 'weebo' | 'edith' | 'jarvis';

export interface AgentComm {
  id: string;
  user_id: string;
  from_agent: AgentId;
  to_agent: AgentId;
  message: string;
  message_type: CommType;
  related_task_id: string | null;
  acknowledged: number;
  created_at: string;
}

// -- Personality display names -----------------------------------------------

const AGENT_NAMES: Record<string, string> = {
  weebo: 'Weebo', edith: 'Edith', jarvis: 'Jarvis',
};

// -- Send --------------------------------------------------------------------

export function sendAgentComm(
  userId: string,
  fromAgent: AgentId,
  toAgent: AgentId,
  message: string,
  type: CommType = 'info',
  relatedTaskId?: string,
): AgentComm {
  const id = uuid();
  db.prepare(`
    INSERT INTO agent_comms (id, user_id, from_agent, to_agent, message, message_type, related_task_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, fromAgent, toAgent, message, type, relatedTaskId || null);

  const comm = getAgentComm(id)!;

  // Broadcast to SSE clients so Agent Office sees this in real-time
  broadcastAgentState(userId, {
    agentId: fromAgent,
    agentName: AGENT_NAMES[fromAgent] || fromAgent,
    state: 'responding',
    content: `→ ${AGENT_NAMES[toAgent]}: ${message}`,
  });

  logger.info({ userId, from: fromAgent, to: toAgent, type }, 'agent-comm:sent');
  return comm;
}

// -- Read --------------------------------------------------------------------

export function getAgentComm(commId: string): AgentComm | null {
  return (db.prepare('SELECT * FROM agent_comms WHERE id = ?').get(commId) as AgentComm) || null;
}

export function getAgentComms(
  userId: string,
  options?: {
    agentId?: AgentId;
    type?: CommType;
    unacknowledgedOnly?: boolean;
    limit?: number;
  },
): AgentComm[] {
  const { agentId, type, unacknowledgedOnly, limit = 50 } = options || {};

  let query = 'SELECT * FROM agent_comms WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (agentId) {
    query += ' AND (from_agent = ? OR to_agent = ?)';
    params.push(agentId, agentId);
  }
  if (type) {
    query += ' AND message_type = ?';
    params.push(type);
  }
  if (unacknowledgedOnly) {
    query += ' AND acknowledged = 0';
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params) as AgentComm[];
}

export function getRecentComms(userId: string, limit = 20): AgentComm[] {
  return db.prepare(
    'SELECT * FROM agent_comms WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as AgentComm[];
}

// -- Acknowledge -------------------------------------------------------------

export function acknowledgeComm(commId: string): boolean {
  const result = db.prepare(
    'UPDATE agent_comms SET acknowledged = 1 WHERE id = ?'
  ).run(commId);
  return result.changes > 0;
}

export function acknowledgeAllComms(userId: string, toAgent: AgentId): number {
  const result = db.prepare(
    'UPDATE agent_comms SET acknowledged = 1 WHERE user_id = ? AND to_agent = ? AND acknowledged = 0'
  ).run(userId, toAgent);
  return result.changes;
}

// -- Delegation helpers ------------------------------------------------------

export function delegateTask(
  userId: string,
  fromAgent: AgentId,
  toAgent: AgentId,
  taskDescription: string,
  relatedTaskId?: string,
): AgentComm {
  return sendAgentComm(
    userId,
    fromAgent,
    toAgent,
    taskDescription,
    'delegation',
    relatedTaskId,
  );
}

export function respondToComm(
  userId: string,
  originalCommId: string,
  fromAgent: AgentId,
  response: string,
): AgentComm | null {
  const original = getAgentComm(originalCommId);
  if (!original) return null;

  acknowledgeComm(originalCommId);
  return sendAgentComm(
    userId,
    fromAgent,
    original.from_agent as AgentId,
    response,
    'response',
    original.related_task_id || undefined,
  );
}

// -- Stats -------------------------------------------------------------------

export function getCommStats(userId: string): {
  total: number;
  unacknowledged: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
} {
  const total = (db.prepare('SELECT COUNT(*) as count FROM agent_comms WHERE user_id = ?').get(userId) as { count: number }).count;
  const unack = (db.prepare('SELECT COUNT(*) as count FROM agent_comms WHERE user_id = ? AND acknowledged = 0').get(userId) as { count: number }).count;

  const agentRows = db.prepare(
    'SELECT from_agent, COUNT(*) as count FROM agent_comms WHERE user_id = ? GROUP BY from_agent'
  ).all(userId) as Array<{ from_agent: string; count: number }>;
  const byAgent: Record<string, number> = {};
  for (const row of agentRows) byAgent[row.from_agent] = row.count;

  const typeRows = db.prepare(
    'SELECT message_type, COUNT(*) as count FROM agent_comms WHERE user_id = ? GROUP BY message_type'
  ).all(userId) as Array<{ message_type: string; count: number }>;
  const byType: Record<string, number> = {};
  for (const row of typeRows) byType[row.message_type] = row.count;

  return { total, unacknowledged: unack, byAgent, byType };
}
