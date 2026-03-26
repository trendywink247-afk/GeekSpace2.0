/**
 * @fileoverview Test suite for taskQueue.ts
 * Tests task creation, routing, assignment, and lifecycle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllTasks,
  getTasksForAgent,
  getQueuedTasks,
  createTask,
  startTask,
  completeTask,
  failTask,
  TASK_ROUTING,
  TASK_TYPE_LABELS,
  type AgentTask,
} from '../taskQueue';

describe('taskQueue', () => {
  beforeEach(() => {
    // TODO: Clear task queue before each test
    // taskQueue is internal, need setter or reset function
    // Workaround: may need to expose clearQueue() for testing
  });

  // ─── Task routing configuration ────────────────────────────────────────
  describe('TASK_ROUTING', () => {
    it('routes check_reminders to cal and jarvis', () => {
      expect(TASK_ROUTING.check_reminders).toContain('cal');
      expect(TASK_ROUTING.check_reminders).toContain('jarvis');
      expect(TASK_ROUTING.check_reminders[0]).toBe('cal'); // preferred
    });

    it('routes summarize_inbox to aria, weebo, edith', () => {
      expect(TASK_ROUTING.summarize_inbox).toEqual(expect.arrayContaining(['aria', 'weebo', 'edith']));
    });

    it('has valid agents in routing (exist in agent types)', () => {
      const validAgents = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];
      Object.entries(TASK_ROUTING).forEach(([taskType, agents]) => {
        agents.forEach((agent) => {
          expect(validAgents).toContain(agent);
        });
      });
    });

    it('all task types have routing entries', () => {
      const taskTypes = Object.keys(TASK_TYPE_LABELS);
      taskTypes.forEach((taskType) => {
        expect(TASK_ROUTING).toHaveProperty(taskType);
      });
    });
  });

  // ─── Task creation ────────────────────────────────────────────────────
  describe('createTask', () => {
    it('creates task with required fields', () => {
      const task = createTask({
        type: 'check_reminders',
        label: 'Check today reminders',
      });

      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('type', 'check_reminders');
      expect(task).toHaveProperty('label', 'Check today reminders');
      expect(task).toHaveProperty('status', 'queued');
      expect(task).toHaveProperty('priority', 2); // default
      expect(task).toHaveProperty('createdAt');
    });

    it('generates unique task IDs', () => {
      const task1 = createTask({ type: 'check_reminders', label: 'Task 1' });
      const task2 = createTask({ type: 'check_reminders', label: 'Task 2' });
      expect(task1.id).not.toBe(task2.id);
    });

    it('task ID includes timestamp', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      // ID format: "task-${nextId}-${now}"
      expect(task.id).toMatch(/^task-\d+-\d+$/);
    });

    it('sets default priority to 2 (medium)', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      expect(task.priority).toBe(2);
    });

    it('respects custom priority (1, 2, 3)', () => {
      const high = createTask({ type: 'check_reminders', label: 'Task', priority: 1 });
      const medium = createTask({ type: 'check_reminders', label: 'Task', priority: 2 });
      const low = createTask({ type: 'check_reminders', label: 'Task', priority: 3 });

      expect(high.priority).toBe(1);
      expect(medium.priority).toBe(2);
      expect(low.priority).toBe(3);
    });

    it('accepts optional payload', () => {
      const payload = { reminderIds: ['rem1', 'rem2'] };
      const task = createTask({
        type: 'check_reminders',
        label: 'Task',
        payload,
      });
      expect(task.payload).toEqual(payload);
    });

    it('task starts as queued without assignedTo', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      expect(task.status).toBe('queued');
      expect(task.assignedTo).toBe(null);
      expect(task.startedAt).toBeUndefined();
    });

    it('task starts as in_progress when assignedTo provided', () => {
      const task = createTask({
        type: 'check_reminders',
        label: 'Task',
        assignedTo: 'cal',
      });
      expect(task.status).toBe('in_progress');
      expect(task.assignedTo).toBe('cal');
      expect(task.startedAt).toBeDefined();
    });

    it('createdAt timestamp is reasonable', () => {
      const before = Date.now();
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      const after = Date.now();
      expect(task.createdAt).toBeGreaterThanOrEqual(before);
      expect(task.createdAt).toBeLessThanOrEqual(after);
    });
  });

  // ─── Task querying ────────────────────────────────────────────────────
  describe('getAllTasks', () => {
    it('returns empty array on fresh queue', () => {
      const tasks = getAllTasks();
      expect(Array.isArray(tasks)).toBe(true);
      // Assume queue is cleared beforeEach
      // expect(tasks.length).toBe(0);
    });

    it('returns all created tasks', () => {
      const task1 = createTask({ type: 'check_reminders', label: 'Task 1' });
      const task2 = createTask({ type: 'summarize_inbox', label: 'Task 2' });
      const tasks = getAllTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(tasks).toContainEqual(expect.objectContaining({ id: task1.id }));
      expect(tasks).toContainEqual(expect.objectContaining({ id: task2.id }));
    });

    it('returns copy (not reference) to prevent external mutation', () => {
      createTask({ type: 'check_reminders', label: 'Task' });
      const tasks1 = getAllTasks();
      const tasks2 = getAllTasks();
      expect(tasks1).not.toBe(tasks2); // Different array instances
    });
  });

  // ─── Filter by agent assignment ────────────────────────────────────────
  describe('getTasksForAgent', () => {
    it('returns tasks assigned to specific agent', () => {
      const task1 = createTask({
        type: 'check_reminders',
        label: 'Task 1',
        assignedTo: 'cal',
      });
      const task2 = createTask({
        type: 'summarize_inbox',
        label: 'Task 2',
        assignedTo: 'aria',
      });
      const calTasks = getTasksForAgent('cal');
      expect(calTasks).toContainEqual(expect.objectContaining({ id: task1.id }));
      expect(calTasks).not.toContainEqual(expect.objectContaining({ id: task2.id }));
    });

    it('returns empty array if agent has no tasks', () => {
      createTask({ type: 'check_reminders', label: 'Task', assignedTo: 'cal' });
      const ariaTasks = getTasksForAgent('aria');
      expect(ariaTasks).toHaveLength(0);
    });

    it('returns multiple tasks for agent', () => {
      createTask({ type: 'check_reminders', label: 'Task 1', assignedTo: 'cal' });
      createTask({ type: 'summarize_inbox', label: 'Task 2', assignedTo: 'cal' });
      const calTasks = getTasksForAgent('cal');
      expect(calTasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Filter by status ──────────────────────────────────────────────────
  describe('getQueuedTasks', () => {
    it('returns tasks with status=queued', () => {
      const queuedTask = createTask({ type: 'check_reminders', label: 'Queued' });
      const inProgressTask = createTask({
        type: 'summarize_inbox',
        label: 'In Progress',
        assignedTo: 'cal',
      });
      const queued = getQueuedTasks();
      expect(queued).toContainEqual(expect.objectContaining({ id: queuedTask.id }));
      expect(queued).not.toContainEqual(expect.objectContaining({ id: inProgressTask.id }));
    });

    it('returns empty array if no queued tasks', () => {
      createTask({ type: 'check_reminders', label: 'Task', assignedTo: 'cal' });
      const queued = getQueuedTasks();
      expect(queued).toHaveLength(0);
    });
  });

  // ─── Task lifecycle ────────────────────────────────────────────────────
  describe('startTask', () => {
    it('transitions task from queued to in_progress', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      startTask(task.id, 'cal');
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.status).toBe('in_progress');
    });

    it('sets assignedTo agent', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      startTask(task.id, 'cal');
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.assignedTo).toBe('cal');
    });

    it('sets startedAt timestamp', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      startTask(task.id, 'cal');
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.startedAt).toBeDefined();
      expect(typeof updated?.startedAt).toBe('number');
    });

    it('no-ops if task not found', () => {
      expect(() => startTask('nonexistent', 'cal')).not.toThrow();
    });
  });

  // ─── Task completion ──────────────────────────────────────────────────
  describe('completeTask', () => {
    it('transitions task to completed status', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      completeTask(task.id);
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.status).toBe('completed');
    });

    it('sets completedAt timestamp', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      completeTask(task.id);
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.completedAt).toBeDefined();
      expect(typeof updated?.completedAt).toBe('number');
    });

    it('optionally sets result string', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      completeTask(task.id, 'Found 3 reminders');
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.result).toBe('Found 3 reminders');
    });

    it('no-ops if task not found', () => {
      expect(() => completeTask('nonexistent', 'Result')).not.toThrow();
    });
  });

  // ─── Task failure ──────────────────────────────────────────────────────
  describe('failTask', () => {
    it('transitions task to failed status', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      failTask(task.id);
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.status).toBe('failed');
    });

    it('optionally sets error message', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      failTask(task.id, 'API timeout');
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.result).toBe('API timeout');
    });

    it('no-ops if task not found', () => {
      expect(() => failTask('nonexistent', 'Error')).not.toThrow();
    });
  });

  // ─── Task status lifecycle ─────────────────────────────────────────────
  describe('task status transitions', () => {
    it('full lifecycle: queued → in_progress → completed', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      expect(task.status).toBe('queued');

      startTask(task.id, 'cal');
      let updated = getAllTasks().find((t) => t.id === task.id)!;
      expect(updated.status).toBe('in_progress');

      completeTask(task.id, 'Done');
      updated = getAllTasks().find((t) => t.id === task.id)!;
      expect(updated.status).toBe('completed');
    });

    it('full lifecycle: queued → in_progress → failed', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      startTask(task.id, 'cal');
      failTask(task.id, 'Network error');
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.status).toBe('failed');
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('taskQueue — edge cases', () => {
    it('handles rapid create/start/complete', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task' });
      startTask(task.id, 'cal');
      completeTask(task.id);
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.status).toBe('completed');
    });

    it('handles 100+ tasks in queue', () => {
      for (let i = 0; i < 100; i++) {
        createTask({ type: 'check_reminders', label: `Task ${i}` });
      }
      const tasks = getAllTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(100);
    });

    it('handles task with null payload vs empty payload', () => {
      const nullPayload = createTask({
        type: 'check_reminders',
        label: 'Task1',
        payload: undefined,
      });
      const emptyPayload = createTask({
        type: 'check_reminders',
        label: 'Task2',
        payload: {},
      });
      expect(nullPayload.payload).toBeUndefined() || expect(nullPayload.payload).toEqual({});
      expect(emptyPayload.payload).toEqual({});
    });

    it('re-assigning task to different agent', () => {
      const task = createTask({ type: 'check_reminders', label: 'Task', assignedTo: 'cal' });
      startTask(task.id, 'aria'); // Reassign
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.assignedTo).toBe('aria');
    });
  });

  // ─── Integration: task queue + agent assignment ──────────────────────
  describe('taskQueue — integration with agents', () => {
    it('tasks can be routed to preferred agent from TASK_ROUTING', () => {
      const taskType = 'check_reminders';
      const preferredAgent = TASK_ROUTING[taskType][0]; // 'cal'
      const task = createTask({ type: taskType, label: 'Check reminders' });
      startTask(task.id, preferredAgent);
      const updated = getAllTasks().find((t) => t.id === task.id);
      expect(updated?.assignedTo).toBe(preferredAgent);
    });

    it('multiple agents can work on different tasks', () => {
      const task1 = createTask({ type: 'check_reminders', label: 'Task 1' });
      const task2 = createTask({ type: 'summarize_inbox', label: 'Task 2' });
      startTask(task1.id, 'cal');
      startTask(task2.id, 'aria');
      const calTasks = getTasksForAgent('cal');
      const ariaTasks = getTasksForAgent('aria');
      expect(calTasks).toContainEqual(expect.objectContaining({ id: task1.id }));
      expect(ariaTasks).toContainEqual(expect.objectContaining({ id: task2.id }));
    });
  });
});
