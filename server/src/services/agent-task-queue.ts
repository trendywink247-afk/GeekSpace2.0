// ============================================================
// Agent Task Queue — Per-agent autonomous task management
//
// Each core agent (Weebo, Edith, Jarvis) gets an independent
// task queue. Tasks can be created by the user or by other agents.
// Tasks are picked up by agents during proactive cycles or
// on-demand when the user interacts.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentId = 'weebo' | 'edith' | 'jarvis';

export interface AgentTask {
  id: string;
  user_id: string;
  agent_id: AgentId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  created_by: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// -- Create ---------------------------------------------------

export function createAgentTask(
  userId: string,
  agentId: AgentId,
  title: string,
  description = '',
  priority = 5,
  createdBy = 'user',
): AgentTask {
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO agent_tasks (id, user_id, agent_id, title, description, priority, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, agentId, title, description, priority, createdBy, now, now);

  logger.info({ userId, agentId, taskId: id, title }, 'agent-task:created');
  return getAgentTask(id)!;
}

// -- Read -----------------------------------------------------

export function getAgentTask(taskId: string): AgentTask | null {
  return (db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(taskId) as AgentTask) || null;
}

export function getAgentTasks(
  userId: string,
  agentId?: AgentId,
  status?: TaskStatus,
  limit = 50,
): AgentTask[] {
  let query = 'SELECT * FROM agent_tasks WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (agentId) {
    query += ' AND agent_id = ?';
    params.push(agentId);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY priority DESC, created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params) as AgentTask[];
}

export function getPendingTasks(userId: string, agentId: AgentId, limit = 10): AgentTask[] {
  return db.prepare(
    'SELECT * FROM agent_tasks WHERE user_id = ? AND agent_id = ? AND status = ? ORDER BY priority DESC, created_at ASC LIMIT ?'
  ).all(userId, agentId, 'pending', limit) as AgentTask[];
}

export function getTaskBoard(userId: string): Record<TaskStatus, AgentTask[]> {
  const all = db.prepare(
    'SELECT * FROM agent_tasks WHERE user_id = ? AND status != ? ORDER BY priority DESC, created_at DESC LIMIT 100'
  ).all(userId, 'cancelled') as AgentTask[];

  const board: Record<TaskStatus, AgentTask[]> = {
    pending: [],
    running: [],
    completed: [],
    failed: [],
    cancelled: [],
  };

  for (const task of all) {
    board[task.status]?.push(task);
  }
  return board;
}

// -- Update ---------------------------------------------------

export function startTask(taskId: string): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE agent_tasks SET status = ?, started_at = ?, updated_at = ? WHERE id = ? AND status = ?'
  ).run('running', now, now, taskId, 'pending');
  return result.changes > 0;
}

export function completeTask(taskId: string, resultText?: string): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE agent_tasks SET status = ?, completed_at = ?, result = ?, updated_at = ? WHERE id = ? AND status = ?'
  ).run('completed', now, resultText || null, now, taskId, 'running');
  if (result.changes > 0) {
    logger.info({ taskId }, 'agent-task:completed');
  }
  return result.changes > 0;
}

export function failTask(taskId: string, error: string): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE agent_tasks SET status = ?, error = ?, updated_at = ? WHERE id = ? AND status = ?'
  ).run('failed', error, now, taskId, 'running');
  return result.changes > 0;
}

export function reassignTask(taskId: string, newAgentId: AgentId): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE agent_tasks SET agent_id = ?, assigned_at = ?, updated_at = ? WHERE id = ?'
  ).run(newAgentId, now, now, taskId);
  if (result.changes > 0) {
    logger.info({ taskId, newAgentId }, 'agent-task:reassigned');
  }
  return result.changes > 0;
}

export function cancelTask(taskId: string): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE agent_tasks SET status = ?, updated_at = ? WHERE id = ? AND status IN (?, ?)'
  ).run('cancelled', now, taskId, 'pending', 'running');
  return result.changes > 0;
}

// -- Stats ----------------------------------------------------

export function getAgentTaskStats(userId: string, agentId?: AgentId): {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  completedToday: number;
} {
  let baseQuery = 'SELECT status, COUNT(*) as count FROM agent_tasks WHERE user_id = ?';
  const params: string[] = [userId];
  if (agentId) {
    baseQuery += ' AND agent_id = ?';
    params.push(agentId);
  }
  baseQuery += ' GROUP BY status';

  const rows = db.prepare(baseQuery).all(...params) as Array<{ status: string; count: number }>;
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row.count;

  // Completed today
  let todayQuery = "SELECT COUNT(*) as count FROM agent_tasks WHERE user_id = ? AND status = 'completed' AND completed_at >= datetime('now', 'start of day')";
  const todayParams: string[] = [userId];
  if (agentId) {
    todayQuery += ' AND agent_id = ?';
    todayParams.push(agentId);
  }
  const todayRow = db.prepare(todayQuery).get(...todayParams) as { count: number };

  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    pending: counts.pending || 0,
    running: counts.running || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    completedToday: todayRow?.count || 0,
  };
}
