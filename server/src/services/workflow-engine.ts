// ============================================================
// Workflow Engine — Multi-Step Task Execution
//
// Manages the lifecycle of multi-agent workflows:
//   - Create workflows with steps
//   - Track step execution status
//   - Store results for chaining
//   - Query workflow status and history
//
// A workflow is a sequence of agent tasks that feed into each
// other. The Pico-Kimi bridge creates workflows for complex
// requests and drives execution through this engine.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import type { AgentRole } from './agent-registry.js';

// Defined inline to avoid circular import with pico-kimi-bridge
type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'multi-step';

// ---- Types ----

export interface WorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  agentRole: AgentRole;
  input: string;
  output: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  createdAt: string;
  completedAt?: string;
}

export interface WorkflowStatus {
  id: string;
  userId: string;
  task: string;
  complexity: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: WorkflowStep[];
  totalSteps: number;
  completedSteps: number;
  createdAt: string;
  completedAt?: string;
}

// ---- Schema Initialization ----

export function initWorkflowTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task TEXT NOT NULL,
      complexity TEXT NOT NULL DEFAULT 'moderate',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      step_order INTEGER NOT NULL DEFAULT 0,
      agent_role TEXT NOT NULL,
      input TEXT NOT NULL DEFAULT '',
      output TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bridge_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      route TEXT NOT NULL,
      complexity TEXT NOT NULL,
      agents_used TEXT NOT NULL DEFAULT '[]',
      workflow_id TEXT,
      latency_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
    CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_bridge_events_user ON bridge_events(user_id, created_at);
  `);

  logger.info('Workflow tables initialized');
}

// ---- Workflow CRUD ----

/**
 * Create a new workflow for a user's task.
 */
export function createWorkflow(
  userId: string,
  task: string,
  complexity: TaskComplexity,
): string {
  const id = uuid();
  db.prepare(`
    INSERT INTO workflows (id, user_id, task, complexity, status)
    VALUES (?, ?, ?, ?, 'running')
  `).run(id, userId, task, complexity);

  logger.info({ workflowId: id, userId, complexity }, 'Workflow created');
  return id;
}

/**
 * Add a step to a workflow.
 */
export function addWorkflowStep(
  workflowId: string,
  agentRole: AgentRole | string,
  input: string,
  output: string,
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
): string {
  const id = uuid();

  // Get next step order
  const lastStep = db.prepare(
    'SELECT MAX(step_order) as max_order FROM workflow_steps WHERE workflow_id = ?'
  ).get(workflowId) as { max_order: number | null } | undefined;
  const stepOrder = (lastStep?.max_order ?? -1) + 1;

  const completedAt = (status === 'completed' || status === 'failed' || status === 'skipped')
    ? new Date().toISOString()
    : null;

  db.prepare(`
    INSERT INTO workflow_steps (id, workflow_id, step_order, agent_role, input, output, status, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, workflowId, stepOrder, agentRole, input, output, status, completedAt);

  return id;
}

/**
 * Update a workflow step's status and output.
 */
export function updateWorkflowStep(
  stepId: string,
  status: string,
  output?: string,
): void {
  const completedAt = (status === 'completed' || status === 'failed' || status === 'skipped')
    ? new Date().toISOString()
    : null;

  if (output !== undefined) {
    db.prepare(
      'UPDATE workflow_steps SET status = ?, output = ?, completed_at = ? WHERE id = ?'
    ).run(status, output, completedAt, stepId);
  } else {
    db.prepare(
      'UPDATE workflow_steps SET status = ?, completed_at = ? WHERE id = ?'
    ).run(status, completedAt, stepId);
  }
}

// ---- Workflow Queries ----

/**
 * Get the full status of a workflow including all steps.
 */
export function getWorkflowStatus(workflowId: string, userId: string): WorkflowStatus | null {
  const workflow = db.prepare(
    'SELECT * FROM workflows WHERE id = ? AND user_id = ?'
  ).get(workflowId, userId) as Record<string, unknown> | undefined;

  if (!workflow) return null;

  const steps = db.prepare(
    'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC'
  ).all(workflowId) as Array<Record<string, unknown>>;

  const mappedSteps: WorkflowStep[] = steps.map(s => ({
    id: s.id as string,
    workflowId: s.workflow_id as string,
    stepOrder: s.step_order as number,
    agentRole: s.agent_role as AgentRole,
    input: s.input as string,
    output: s.output as string,
    status: s.status as WorkflowStep['status'],
    createdAt: s.created_at as string,
    completedAt: s.completed_at as string | undefined,
  }));

  return {
    id: workflow.id as string,
    userId: workflow.user_id as string,
    task: workflow.task as string,
    complexity: workflow.complexity as string,
    status: workflow.status as WorkflowStatus['status'],
    steps: mappedSteps,
    totalSteps: mappedSteps.length,
    completedSteps: mappedSteps.filter(s => s.status === 'completed').length,
    createdAt: workflow.created_at as string,
    completedAt: workflow.completed_at as string | undefined,
  };
}

/**
 * Get recent workflows for a user.
 */
export function getUserWorkflows(userId: string, limit = 20): WorkflowStatus[] {
  const workflows = db.prepare(
    'SELECT * FROM workflows WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as Array<Record<string, unknown>>;

  return workflows.map(w => {
    const steps = db.prepare(
      'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC'
    ).all(w.id as string) as Array<Record<string, unknown>>;

    const mappedSteps: WorkflowStep[] = steps.map(s => ({
      id: s.id as string,
      workflowId: s.workflow_id as string,
      stepOrder: s.step_order as number,
      agentRole: s.agent_role as AgentRole,
      input: s.input as string,
      output: s.output as string,
      status: s.status as WorkflowStep['status'],
      createdAt: s.created_at as string,
      completedAt: s.completed_at as string | undefined,
    }));

    return {
      id: w.id as string,
      userId: w.user_id as string,
      task: w.task as string,
      complexity: w.complexity as string,
      status: w.status as WorkflowStatus['status'],
      steps: mappedSteps,
      totalSteps: mappedSteps.length,
      completedSteps: mappedSteps.filter(s => s.status === 'completed').length,
      createdAt: w.created_at as string,
      completedAt: w.completed_at as string | undefined,
    };
  });
}

/**
 * Execute a workflow — placeholder for future async execution.
 * Currently workflows are executed synchronously by the bridge.
 * This will be used when we add BullMQ job queue support.
 */
export function executeWorkflow(workflowId: string): void {
  db.prepare("UPDATE workflows SET status = 'running' WHERE id = ?").run(workflowId);
  logger.info({ workflowId }, 'Workflow execution started');
}

/**
 * Get workflow analytics for a user.
 */
export function getWorkflowAnalytics(userId: string): {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  avgStepsPerWorkflow: number;
  mostUsedAgents: Array<{ agent: string; count: number }>;
} {
  const total = (db.prepare(
    'SELECT COUNT(*) as c FROM workflows WHERE user_id = ?'
  ).get(userId) as { c: number })?.c || 0;

  const completed = (db.prepare(
    "SELECT COUNT(*) as c FROM workflows WHERE user_id = ? AND status = 'completed'"
  ).get(userId) as { c: number })?.c || 0;

  const failed = (db.prepare(
    "SELECT COUNT(*) as c FROM workflows WHERE user_id = ? AND status = 'failed'"
  ).get(userId) as { c: number })?.c || 0;

  const avgSteps = (db.prepare(`
    SELECT AVG(step_count) as avg FROM (
      SELECT COUNT(*) as step_count
      FROM workflow_steps ws
      JOIN workflows w ON ws.workflow_id = w.id
      WHERE w.user_id = ?
      GROUP BY ws.workflow_id
    )
  `).get(userId) as { avg: number | null })?.avg || 0;

  const agentCounts = db.prepare(`
    SELECT ws.agent_role as agent, COUNT(*) as count
    FROM workflow_steps ws
    JOIN workflows w ON ws.workflow_id = w.id
    WHERE w.user_id = ?
    GROUP BY ws.agent_role
    ORDER BY count DESC
    LIMIT 6
  `).all(userId) as Array<{ agent: string; count: number }>;

  return {
    totalWorkflows: total,
    completedWorkflows: completed,
    failedWorkflows: failed,
    avgStepsPerWorkflow: Math.round(avgSteps * 10) / 10,
    mostUsedAgents: agentCounts,
  };
}
