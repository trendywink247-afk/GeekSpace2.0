// src/dashboard/pages/office/taskQueue.ts
// Task queue system for the Agent Office — manages task creation, routing, and auto-assignment.
// Pure TypeScript, no React dependencies. Called by OfficePage and AgentProfileFlyout.

import type { AgentId } from './entities/types';

// ---------------------------------------------------------------------------
// Task Types & Interfaces
// ---------------------------------------------------------------------------

/** All supported task types that agents can handle. */
export type TaskType =
  | 'check_reminders'
  | 'summarize_inbox'
  | 'run_automation'
  | 'generate_insight'
  | 'research_topic'
  | 'draft_content'
  | 'code_review'
  | 'schedule_event';

/** Human-readable labels for each task type. */
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  check_reminders: 'Check Reminders',
  summarize_inbox: 'Summarize Inbox',
  run_automation: 'Run Automation',
  generate_insight: 'Generate Insight',
  research_topic: 'Research Topic',
  draft_content: 'Draft Content',
  code_review: 'Code Review',
  schedule_event: 'Schedule Event',
};

/** Status lifecycle of a task. */
export type TaskStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

/** Priority level: 1 = high, 2 = medium, 3 = low. */
export type TaskPriority = 1 | 2 | 3;

/** A single task in the office queue. */
export interface AgentTask {
  id: string;
  type: TaskType;
  label: string;
  assignedTo: AgentId | null;
  status: TaskStatus;
  priority: TaskPriority;
  payload?: Record<string, unknown>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
}

// ---------------------------------------------------------------------------
// Task Routing — which agents handle which task types
// ---------------------------------------------------------------------------

/**
 * Maps each task type to a prioritized list of agents capable of handling it.
 * First agent in the list is the preferred handler; fallbacks follow.
 */
export const TASK_ROUTING: Record<TaskType, AgentId[]> = {
  check_reminders: ['cal', 'jarvis'],
  summarize_inbox: ['aria', 'weebo', 'edith'],
  run_automation: ['jarvis', 'forge'],
  generate_insight: ['pulse', 'nova', 'edith'],
  research_topic: ['nova', 'edith', 'weebo'],
  draft_content: ['aria', 'weebo', 'echo'],
  code_review: ['forge', 'edith'],
  schedule_event: ['cal', 'jarvis'],
};

// ---------------------------------------------------------------------------
// In-memory task queue (lives in the browser session)
// ---------------------------------------------------------------------------

let taskQueue: AgentTask[] = [];
let nextId = 1;

/** Returns the current snapshot of all tasks. */
export function getAllTasks(): AgentTask[] {
  return [...taskQueue];
}

/** Returns tasks assigned to a specific agent. */
export function getTasksForAgent(agentId: AgentId): AgentTask[] {
  return taskQueue.filter(t => t.assignedTo === agentId);
}

/** Returns all queued (unstarted) tasks. */
export function getQueuedTasks(): AgentTask[] {
  return taskQueue.filter(t => t.status === 'queued');
}

// ---------------------------------------------------------------------------
// Task creation
// ---------------------------------------------------------------------------

/**
 * Creates a new task and adds it to the queue.
 * If assignedTo is provided and non-null, task starts as in_progress immediately.
 */
export function createTask(opts: {
  type: TaskType;
  label: string;
  assignedTo?: AgentId | null;
  priority?: TaskPriority;
  payload?: Record<string, unknown>;
}): AgentTask {
  const now = Date.now();
  const directAssign = opts.assignedTo ?? null;
  const task: AgentTask = {
    id: `task-${nextId++}-${now}`,
    type: opts.type,
    label: opts.label,
    assignedTo: directAssign,
    status: directAssign ? 'in_progress' : 'queued',
    priority: opts.priority ?? 2,
    payload: opts.payload,
    createdAt: now,
    startedAt: directAssign ? now : undefined,
  };
  taskQueue.push(task);
  return task;
}

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------

/** Marks a task as in_progress and assigns it to an agent. */
export function startTask(taskId: string, agentId: AgentId): void {
  const task = taskQueue.find(t => t.id === taskId);
  if (!task) return;
  task.assignedTo = agentId;
  task.status = 'in_progress';
  task.startedAt = Date.now();
}

/** Marks a task as completed with an optional result string. */
export function completeTask(taskId: string, result?: string): void {
  const task = taskQueue.find(t => t.id === taskId);
  if (!task) return;
  task.status = 'completed';
  task.completedAt = Date.now();
  if (result) task.result = result;
}

/** Marks a task as failed with an optional error message. */
export function failTask(taskId: string, error?: string): void {
  const task = taskQueue.find(t => t.id === taskId);
  if (!task) return;
  task.status = 'failed';
  task.completedAt = Date.now();
  if (error) task.result = error;
}

// ---------------------------------------------------------------------------
// Auto-assignment
// ---------------------------------------------------------------------------

/**
 * Finds unassigned queued tasks and assigns them to idle agents based on TASK_ROUTING.
 * @param idleAgentIds - Set of agent IDs that are currently idle and can accept work
 * @returns Array of tasks that were just assigned
 */
export function autoAssignTasks(idleAgentIds: Set<AgentId>): AgentTask[] {
  const assigned: AgentTask[] = [];
  const busyAgents = new Set<AgentId>();

  // Track agents already working on tasks
  for (const t of taskQueue) {
    if (t.status === 'in_progress' && t.assignedTo) {
      busyAgents.add(t.assignedTo);
    }
  }

  // Sort queued tasks by priority (1=high first), then by creation time (oldest first)
  const queued = taskQueue
    .filter(t => t.status === 'queued' && !t.assignedTo)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

  for (const task of queued) {
    const candidates = TASK_ROUTING[task.type] ?? [];
    const availableAgent = candidates.find(
      id => idleAgentIds.has(id) && !busyAgents.has(id),
    );
    if (availableAgent) {
      startTask(task.id, availableAgent);
      busyAgents.add(availableAgent);
      assigned.push(task);
    }
  }

  return assigned;
}

/** Clears all tasks (for testing or reset). */
export function clearAllTasks(): void {
  taskQueue = [];
  nextId = 1;
}
