// ============================================================
// PicoClaw Fleet Engine — Slot-Based Per-User Task Agents
//
// Each user gets up to 3 Pico agents (slots 1-3). Slot 1 is
// auto-created on signup/backfill. Kimi (Moonshot) plans tasks
// as strict JSON; an in-process worker executes them with fair
// round-robin scheduling and 1-concurrent-per-agent limits.
//
// Allowed task types:
//   create_reminder, telegram_message, call_api,
//   n8n_webhook, portfolio_deploy
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { edithChat } from './edith.js';
import { computeCreditCost, deductSubscriptionCredits } from './llm.js';

// ---- Types ----

export const ALLOWED_TASK_TYPES = [
  'create_reminder', 'telegram_message', 'call_api', 'n8n_webhook', 'portfolio_deploy',
] as const;
export type TaskType = typeof ALLOWED_TASK_TYPES[number];

export interface PlannedTask {
  task_type: TaskType;
  description: string;
  config: Record<string, unknown>;
  agent_slot: number;
}

interface PicoAgent {
  id: string;
  user_id: string;
  slot: number;
  name: string;
  status: string;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
}

interface PicoTask {
  id: string;
  user_id: string;
  agent_id: string;
  task_type: string;
  description: string;
  config: string;
  status: string;
  result: string;
  credits_used: number;
  planned_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agent_status?: string;
  agent_slot?: number;
}

// ---- Schema Init ----

export function initPicoFleetTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pico_agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT 'Weebo',
      status TEXT NOT NULL DEFAULT 'active',
      tasks_completed INTEGER DEFAULT 0,
      tasks_failed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, slot)
    );
    CREATE INDEX IF NOT EXISTS idx_pico_agents_user ON pico_agents(user_id);

    CREATE TABLE IF NOT EXISTS pico_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES pico_agents(id) ON DELETE CASCADE,
      task_type TEXT NOT NULL,
      description TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      result TEXT DEFAULT '',
      credits_used INTEGER DEFAULT 0,
      planned_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pico_tasks_user ON pico_tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_pico_tasks_agent ON pico_tasks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_pico_tasks_status ON pico_tasks(status);

    CREATE TABLE IF NOT EXISTS pico_task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES pico_tasks(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pico_task_logs_task ON pico_task_logs(task_id);
  `);

  logger.info('Pico Fleet tables initialized');
}

// ---- Default Agent Backfill ----

export function ensureDefaultAgents(): void {
  const usersWithout = db.prepare(`
    SELECT u.id FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM pico_agents pa WHERE pa.user_id = u.id AND pa.slot = 1
    )
  `).all() as { id: string }[];

  for (const { id } of usersWithout) {
    db.prepare('INSERT INTO pico_agents (id, user_id, slot, name) VALUES (?, ?, 1, ?)')
      .run(uuid(), id, 'Weebo');
  }

  if (usersWithout.length > 0) {
    logger.info({ count: usersWithout.length }, 'Backfilled default Pico agents');
  }
}

// ---- Agent CRUD helpers ----

export function getUserAgents(userId: string): PicoAgent[] {
  return db.prepare('SELECT * FROM pico_agents WHERE user_id = ? ORDER BY slot ASC')
    .all(userId) as PicoAgent[];
}

export function getAgentBySlot(userId: string, slot: number): PicoAgent | undefined {
  return db.prepare('SELECT * FROM pico_agents WHERE user_id = ? AND slot = ?')
    .get(userId, slot) as PicoAgent | undefined;
}

export function createAgent(userId: string, name: string): PicoAgent {
  const existing = getUserAgents(userId);
  if (existing.length >= 3) {
    throw new Error('Maximum 3 Pico agents allowed');
  }

  const usedSlots = existing.map(a => a.slot);
  const nextSlot = [1, 2, 3].find(s => !usedSlots.includes(s));
  if (!nextSlot) {
    throw new Error('No free agent slots available');
  }

  const id = uuid();
  db.prepare('INSERT INTO pico_agents (id, user_id, slot, name) VALUES (?, ?, ?, ?)')
    .run(id, userId, nextSlot, name);

  return db.prepare('SELECT * FROM pico_agents WHERE id = ?').get(id) as PicoAgent;
}

export function updateAgent(agentId: string, userId: string, updates: { name?: string; status?: string }): PicoAgent {
  const agent = db.prepare('SELECT * FROM pico_agents WHERE id = ? AND user_id = ?')
    .get(agentId, userId) as PicoAgent | undefined;
  if (!agent) throw new Error('Agent not found');

  const fields: string[] = [];
  const values: unknown[] = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length) {
    values.push(agentId);
    db.prepare(`UPDATE pico_agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return db.prepare('SELECT * FROM pico_agents WHERE id = ?').get(agentId) as PicoAgent;
}

export function deleteAgent(agentId: string, userId: string): void {
  const agent = db.prepare('SELECT * FROM pico_agents WHERE id = ? AND user_id = ?')
    .get(agentId, userId) as PicoAgent | undefined;
  if (!agent) throw new Error('Agent not found');
  if (agent.slot === 1) throw new Error('Cannot delete default agent (slot 1)');

  const pendingTasks = db.prepare(
    "SELECT COUNT(*) as c FROM pico_tasks WHERE agent_id = ? AND status IN ('queued', 'running')"
  ).get(agentId) as { c: number };
  if (pendingTasks.c > 0) {
    throw new Error('Cannot delete agent with queued or running tasks');
  }

  db.prepare('DELETE FROM pico_agents WHERE id = ?').run(agentId);
}

// ---- Complexity Estimator ----

function estimateComplexity(request: string): 'simple' | 'medium' | 'complex' {
  const lower = request.toLowerCase();
  const complexKeywords = ['analyze', 'research', 'compare', 'generate report', 'multi-step', 'workflow'];
  const simpleKeywords = ['remind me', 'send', 'message', 'set reminder', 'notify', 'deploy portfolio'];
  if (complexKeywords.some(k => lower.includes(k))) return 'complex';
  if (simpleKeywords.some(k => lower.includes(k))) return 'simple';
  return request.split(' ').length > 15 ? 'medium' : 'simple';
}

// ---- Simple Task Parser (no LLM) ----

function parseSimpleTask(request: string): PlannedTask[] {
  const lower = request.toLowerCase();
  if (lower.includes('remind') || lower.includes('reminder')) {
    return [{
      task_type: 'create_reminder',
      description: request,
      config: { reminder_text: request },
      agent_slot: 1,
    }];
  }
  if (lower.includes('send') && (lower.includes('message') || lower.includes('telegram'))) {
    return [{
      task_type: 'telegram_message',
      description: request,
      config: { message: request },
      agent_slot: 1,
    }];
  }
  if (lower.includes('deploy') || lower.includes('publish portfolio')) {
    return [{
      task_type: 'portfolio_deploy',
      description: 'Deploy portfolio',
      config: {},
      agent_slot: 1,
    }];
  }
  // Fallback: generic reminder for unrecognised simple requests
  return [{
    task_type: 'create_reminder',
    description: request,
    config: { reminder_text: request },
    agent_slot: 1,
  }];
}

// ---- Kimi Task Planner ----

const PLANNER_SYSTEM_PROMPT = `You are a task planner for GeekSpace. The user wants to automate something.
Break their request into 1-5 concrete tasks.

ALLOWED task_type values (ONLY these):
- create_reminder: config needs { "reminder_text": "string" }
- telegram_message: config needs { "message": "string" }
- call_api: config needs { "url": "string", "method": "GET|POST|PUT|DELETE", "headers": {}, "body": "string" }
- n8n_webhook: config needs { "url": "string", "body": "string" }
- portfolio_deploy: config needs {} (no params needed)

Each task can target a specific agent slot (1-3). Default is 1.

Respond with ONLY a JSON array. No markdown fences, no explanation, no extra text.
Example: [{"task_type":"create_reminder","description":"Set morning standup reminder","config":{"reminder_text":"Daily standup at 9am"},"agent_slot":1}]

If the request cannot be mapped to these task types, return exactly: []`;

export async function planWithKimi(userId: string, userRequest: string): Promise<{
  tasks: PlannedTask[];
  creditCost: number;
}> {
  const result = await edithChat(userRequest, PLANNER_SYSTEM_PROMPT);

  // Compute planning credit cost
  const creditCost = computeCreditCost('edith', result.tokensIn, result.tokensOut);

  // Deduct planning credits
  deductSubscriptionCredits(userId, creditCost);

  // Log planning usage
  db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
    VALUES (?, ?, 'edith', 'kimi-k2-thinking', ?, ?, ?, 'pico-fleet', 'task.plan')`).run(
    uuid(), userId, result.tokensIn, result.tokensOut, creditCost,
  );

  // Parse JSON response
  let parsed: unknown[];
  try {
    // Strip markdown fences if Kimi wraps them anyway
    let text = result.text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    logger.warn({ raw: result.text.slice(0, 200) }, 'Kimi planner returned non-JSON');
    return { tasks: [], creditCost };
  }

  // Validate and filter tasks
  const tasks: PlannedTask[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const t = item as Record<string, unknown>;
    const taskType = t.task_type as string;

    if (!ALLOWED_TASK_TYPES.includes(taskType as TaskType)) {
      logger.warn({ taskType }, 'Kimi planner returned unknown task type — skipping');
      continue;
    }

    tasks.push({
      task_type: taskType as TaskType,
      description: String(t.description || ''),
      config: (typeof t.config === 'object' && t.config !== null) ? t.config as Record<string, unknown> : {},
      agent_slot: typeof t.agent_slot === 'number' ? Math.min(3, Math.max(1, Math.round(t.agent_slot))) : 1,
    });
  }

  return { tasks, creditCost };
}

export async function planTasks(userId: string, userRequest: string, userPlan: string): Promise<{
  tasks: PlannedTask[];
  creditCost: number;
}> {
  const complexity = estimateComplexity(userRequest);
  const isPremium = ['halfyear', 'yearly'].includes(userPlan);

  if (complexity === 'simple') {
    return { tasks: parseSimpleTask(userRequest), creditCost: 0 };
  }

  if (complexity === 'complex' && !isPremium) {
    throw Object.assign(new Error('ESCALATE'), { code: 'ESCALATE_TO_PREMIUM' });
  }

  // medium or complex + premium → use Kimi
  return planWithKimi(userId, userRequest);
}

// ---- Queue Tasks ----

export function queueTasks(userId: string, tasks: PlannedTask[], plannedBy: string): string[] {
  const taskIds: string[] = [];

  for (const task of tasks) {
    // Resolve agent by slot (fall back to slot 1)
    let agent = getAgentBySlot(userId, task.agent_slot);
    if (!agent) agent = getAgentBySlot(userId, 1);
    if (!agent) {
      logger.warn({ userId, slot: task.agent_slot }, 'No agent found for task — skipping');
      continue;
    }

    const id = uuid();
    db.prepare(`INSERT INTO pico_tasks (id, user_id, agent_id, task_type, description, config, planned_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, userId, agent.id, task.task_type, task.description,
      JSON.stringify(task.config), plannedBy,
    );
    taskIds.push(id);
  }

  return taskIds;
}

// ---- Task Queries ----

export function getUserTasks(userId: string, opts?: { status?: string; slot?: number; limit?: number }): PicoTask[] {
  let sql = `SELECT t.*, a.slot as agent_slot, a.name as agent_name
    FROM pico_tasks t JOIN pico_agents a ON a.id = t.agent_id
    WHERE t.user_id = ?`;
  const params: unknown[] = [userId];

  if (opts?.status) { sql += ' AND t.status = ?'; params.push(opts.status); }
  if (opts?.slot) {
    sql += ' AND a.slot = ?';
    params.push(opts.slot);
  }
  sql += ' ORDER BY t.created_at DESC LIMIT ?';
  params.push(opts?.limit || 50);

  return db.prepare(sql).all(...params) as PicoTask[];
}

export function getTaskWithLogs(taskId: string, userId: string) {
  const task = db.prepare(`SELECT t.*, a.slot as agent_slot, a.name as agent_name
    FROM pico_tasks t JOIN pico_agents a ON a.id = t.agent_id
    WHERE t.id = ? AND t.user_id = ?`).get(taskId, userId) as PicoTask | undefined;
  if (!task) return null;

  const logs = db.prepare('SELECT * FROM pico_task_logs WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId);

  return { ...task, logs };
}

export function cancelTask(taskId: string, userId: string): void {
  const task = db.prepare('SELECT * FROM pico_tasks WHERE id = ? AND user_id = ?')
    .get(taskId, userId) as PicoTask | undefined;
  if (!task) throw new Error('Task not found');
  if (task.status !== 'queued') throw new Error('Can only cancel queued tasks');

  db.prepare("UPDATE pico_tasks SET status = 'failed', result = 'Cancelled by user', completed_at = datetime('now') WHERE id = ?")
    .run(taskId);
}

// ---- Worker ----

let lastProcessedUserId = '';

async function processNextTask(): Promise<boolean> {
  try {
    // Fair round-robin: find next queued task from a user after lastProcessedUserId
    // Skip paused agents and agents with a running task (1 concurrent per agent)
    const roundRobinQuery = `
      SELECT t.*, a.status AS agent_status, a.slot AS agent_slot
      FROM pico_tasks t
      JOIN pico_agents a ON a.id = t.agent_id
      WHERE t.status = 'queued'
        AND a.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM pico_tasks r
          WHERE r.agent_id = t.agent_id AND r.status = 'running'
        )
        AND t.user_id > ?
      ORDER BY t.user_id ASC, t.created_at ASC
      LIMIT 1
    `;

    let task = db.prepare(roundRobinQuery).get(lastProcessedUserId) as PicoTask | undefined;

    // Wrap around if nothing found after current user
    if (!task) {
      task = db.prepare(roundRobinQuery).get('') as PicoTask | undefined;
    }

    if (!task) return false; // idle — no eligible tasks

    lastProcessedUserId = task.user_id;
    await executeTask(task);
    return true;
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Pico worker error');
    return false;
  }
}

async function executeTask(task: PicoTask): Promise<void> {
  const now = new Date().toISOString();

  // Mark running
  db.prepare("UPDATE pico_tasks SET status = 'running', started_at = ? WHERE id = ?")
    .run(now, task.id);
  db.prepare('INSERT INTO pico_task_logs (id, task_id, agent_id, event, detail) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), task.id, task.agent_id, 'started', `Executing ${task.task_type}`);

  let output = '';
  try {
    const taskConfig = JSON.parse(task.config || '{}') as Record<string, unknown>;

    switch (task.task_type) {
      case 'create_reminder': {
        const text = String(taskConfig.reminder_text || task.description);
        db.prepare('INSERT INTO reminders (id, user_id, text, channel, category, created_by) VALUES (?, ?, ?, ?, ?, ?)')
          .run(uuid(), task.user_id, text, 'push', 'general', 'pico-fleet');
        output = `Reminder created: ${text}`;
        break;
      }

      case 'telegram_message': {
        const message = String(taskConfig.message || task.description);
        const link = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram'"
        ).get(task.user_id) as { external_id: string } | undefined;
        if (link) {
          const { sendTelegramMessage } = await import('./telegram.js');
          await sendTelegramMessage(link.external_id, message);
          output = `Telegram message sent: ${message}`;
        } else {
          output = `No Telegram link found — message queued: ${message}`;
        }
        break;
      }

      case 'call_api':
      case 'n8n_webhook': {
        const url = String(taskConfig.url || '');
        if (!url) throw new Error('No URL configured');
        const method = String(taskConfig.method || 'POST');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(typeof taskConfig.headers === 'object' && taskConfig.headers !== null
            ? taskConfig.headers as Record<string, string> : {}),
        };
        const body = taskConfig.body ? String(taskConfig.body) : JSON.stringify({
          task: task.description,
          userId: task.user_id,
          timestamp: now,
        });

        const res = await fetch(url, {
          method,
          headers,
          body: method !== 'GET' ? body : undefined,
          signal: AbortSignal.timeout(30000),
        });
        output = `HTTP ${res.status} ${res.statusText}`;
        if (!res.ok) throw new Error(output);
        break;
      }

      case 'portfolio_deploy': {
        db.prepare('UPDATE portfolios SET is_public = 1 WHERE user_id = ?').run(task.user_id);
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(task.user_id) as { username: string } | undefined;
        output = `Portfolio deployed for ${user?.username || 'user'}`;
        break;
      }

      default:
        throw new Error(`Unknown task type: ${task.task_type}`);
    }

    // Success
    const completedAt = new Date().toISOString();
    db.prepare("UPDATE pico_tasks SET status = 'completed', result = ?, completed_at = ?, credits_used = 1 WHERE id = ?")
      .run(output, completedAt, task.id);
    db.prepare('UPDATE pico_agents SET tasks_completed = tasks_completed + 1 WHERE id = ?')
      .run(task.agent_id);
    db.prepare('INSERT INTO pico_task_logs (id, task_id, agent_id, event, detail) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), task.id, task.agent_id, 'completed', output);

    // Deduct 1 credit for execution
    deductSubscriptionCredits(task.user_id, 1);

    // Log activity
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Pico task completed', ?, 'zap')`)
      .run(uuid(), task.user_id, `${task.task_type}: ${output.slice(0, 100)}`);

    logger.info({ taskId: task.id, taskType: task.task_type }, 'Pico task completed');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failedAt = new Date().toISOString();

    db.prepare("UPDATE pico_tasks SET status = 'failed', result = ?, completed_at = ? WHERE id = ?")
      .run(errorMsg, failedAt, task.id);
    db.prepare('UPDATE pico_agents SET tasks_failed = tasks_failed + 1 WHERE id = ?')
      .run(task.agent_id);
    db.prepare('INSERT INTO pico_task_logs (id, task_id, agent_id, event, detail) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), task.id, task.agent_id, 'failed', errorMsg);

    logger.warn({ taskId: task.id, taskType: task.task_type, error: errorMsg }, 'Pico task failed');
  }
}

let workerRunning = false;

export function startPicoWorker(): void {
  if (workerRunning) return;
  workerRunning = true;

  let idleStreak = 0;           // consecutive ticks with no work
  const IDLE_THRESHOLD = 10;    // after 10 idle ticks → slow mode

  async function tick() {
    try {
      const worked = await processNextTask();
      if (worked) {
        idleStreak = 0;
      } else {
        idleStreak++;
      }
    } catch (err) {
      logger.error({ err }, 'Pico worker tick error');
    }

    const interval = idleStreak >= IDLE_THRESHOLD
      ? config.picoIdleIntervalMs   // 5 min when idle
      : config.picoWorkerIntervalMs; // 10s normally

    setTimeout(tick, interval);
  }

  tick();
  logger.info({ normal: config.picoWorkerIntervalMs, idle: config.picoIdleIntervalMs }, 'Pico worker started (adaptive)');
}
