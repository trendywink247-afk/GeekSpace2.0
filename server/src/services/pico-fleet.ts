// ============================================================
// PicoClaw Fleet Engine — Slot-Based Per-User Task Agents
//
// Each user gets up to 6 Pico agents (slots 1-6). Slot 1 is
// auto-created on signup/backfill. Kimi (Moonshot) plans tasks
// as strict JSON; an in-process worker executes them with fair
// round-robin scheduling and 1-concurrent-per-agent limits.
//
// Allowed task types:
//   create_reminder, telegram_message, call_api,
//   n8n_webhook, portfolio_deploy
// ============================================================

import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { edithChat } from './edith.js';
import { computeCreditCost, deductSubscriptionCredits } from './llm.js';
import { refreshModelsIfStale } from './openrouter-models.js';
import { eventBus } from './event-bus.js';
import { upsertMemory } from './memory.js';

const PLAN_AGENT_SLOTS: Record<string, number> = {
  free: 2,
  intro: 4,
  monthly: 4,
  halfyear: 6,
  yearly: 6,
};

// ---- Types ----

export const ALLOWED_TASK_TYPES = [
  'create_reminder', 'telegram_message', 'call_api', 'n8n_webhook', 'portfolio_deploy', 'social_media_post', 'generate_code',
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
  personality: string;
  status: string;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
  system_prompt: string;
  mode: string;
  voice: string;
  creativity: number;
  formality: number;
  model_preference: string;
  custom_commands: string;
  assigned_tools: string;
  enabled: number;
}

export interface PicoCronJob {
  id: string;
  user_id: string;
  agent_slot: number;
  name: string;
  task_type: string;
  task_config: string;
  interval_minutes: number;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
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
  source_request_id?: string;
  attempts?: number;
  max_attempts?: number;
  idempotency_key?: string;
  retry_after?: string | null;
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

  // Migration: add personality column to pico_agents
  try {
    db.exec("ALTER TABLE pico_agents ADD COLUMN personality TEXT NOT NULL DEFAULT 'weebo'");
  } catch { /* column already exists */ }

  // Migration: add source_request_id column to pico_tasks
  try {
    db.exec("ALTER TABLE pico_tasks ADD COLUMN source_request_id TEXT DEFAULT ''");
  } catch { /* column already exists */ }

  // Migration: add index for source_request_id (after column migration)
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_pico_tasks_request_id ON pico_tasks(source_request_id)");
  } catch { /* index already exists or column doesn't exist yet */ }

  // Migration: add attempts column for retry tracking
  try {
    db.exec("ALTER TABLE pico_tasks ADD COLUMN attempts INTEGER DEFAULT 0");
  } catch { /* column already exists */ }

  // Migration: add max_attempts column for configurable retries
  try {
    db.exec("ALTER TABLE pico_tasks ADD COLUMN max_attempts INTEGER DEFAULT 3");
  } catch { /* column already exists */ }

  // Migration: add idempotency_key column for deduplication
  try {
    db.exec("ALTER TABLE pico_tasks ADD COLUMN idempotency_key TEXT DEFAULT ''");
    db.exec("CREATE INDEX IF NOT EXISTS idx_pico_tasks_idempotency ON pico_tasks(user_id, idempotency_key) WHERE idempotency_key != ''");
  } catch { /* column or index already exists */ }

  // Migration: add retry_after column for exponential backoff
  try {
    db.exec("ALTER TABLE pico_tasks ADD COLUMN retry_after TEXT");
  } catch { /* column already exists */ }

  // Migration: add per-agent config columns
  const agentCols: [string, string][] = [
    ['system_prompt', "TEXT DEFAULT ''"],
    ['mode', "TEXT DEFAULT 'builder'"],
    ['voice', "TEXT DEFAULT 'friendly'"],
    ['creativity', 'INTEGER DEFAULT 70'],
    ['formality', 'INTEGER DEFAULT 50'],
    ['model_preference', "TEXT DEFAULT 'auto'"],
    ['custom_commands', "TEXT DEFAULT ''"],
    ['assigned_tools', "TEXT DEFAULT '[]'"],
    ['enabled', 'INTEGER DEFAULT 1'],
  ];
  for (const [col, def] of agentCols) {
    try { db.exec(`ALTER TABLE pico_agents ADD COLUMN ${col} ${def}`); } catch { /* exists */ }
  }

  // Create pico_cron_jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pico_cron_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_slot INTEGER NOT NULL DEFAULT 2,
      name TEXT NOT NULL,
      task_type TEXT NOT NULL,
      task_config TEXT NOT NULL DEFAULT '{}',
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      run_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pico_cron_user ON pico_cron_jobs(user_id);
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

export function createAgent(userId: string, name: string, personality = 'weebo'): PicoAgent {
  // Get user's plan
  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string } | undefined;
  const maxSlots = PLAN_AGENT_SLOTS[sub?.plan || 'free'];

  const existing = getUserAgents(userId);
  if (existing.length >= maxSlots) {
    throw new Error(`Your plan allows ${maxSlots} agent(s). Upgrade to add more.`);
  }

  const usedSlots = existing.map(a => a.slot);
  const nextSlot = [1, 2, 3, 4, 5, 6].find(s => !usedSlots.includes(s));
  if (!nextSlot) {
    throw new Error('No free agent slots available');
  }

  const id = uuid();
  db.prepare('INSERT INTO pico_agents (id, user_id, slot, name, personality) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, nextSlot, name, personality);

  return db.prepare('SELECT * FROM pico_agents WHERE id = ?').get(id) as PicoAgent;
}

export interface AgentUpdateFields {
  name?: string;
  status?: string;
  system_prompt?: string;
  mode?: string;
  voice?: string;
  creativity?: number;
  formality?: number;
  model_preference?: string;
  custom_commands?: string;
  assigned_tools?: string[];
  enabled?: boolean;
}

export function updateAgent(agentId: string, userId: string, updates: AgentUpdateFields): PicoAgent {
  const agent = db.prepare('SELECT * FROM pico_agents WHERE id = ? AND user_id = ?')
    .get(agentId, userId) as PicoAgent | undefined;
  if (!agent) throw new Error('Agent not found');

  const fields: string[] = [];
  const values: unknown[] = [];

  const stringFields = ['name', 'status', 'system_prompt', 'mode', 'voice', 'model_preference', 'custom_commands'] as const;
  for (const f of stringFields) {
    if (updates[f] !== undefined) { fields.push(`${f} = ?`); values.push(updates[f]); }
  }
  const numFields = ['creativity', 'formality'] as const;
  for (const f of numFields) {
    if (updates[f] !== undefined) { fields.push(`${f} = ?`); values.push(updates[f]); }
  }
  if (updates.assigned_tools !== undefined) {
    fields.push('assigned_tools = ?');
    values.push(JSON.stringify(updates.assigned_tools));
  }
  if (updates.enabled !== undefined) {
    // Enforce: at least 1 Weebo must always remain active
    if (!updates.enabled) {
      const enabledCount = (db.prepare(
        'SELECT COUNT(*) as cnt FROM pico_agents WHERE user_id = ? AND enabled = 1'
      ).get(userId) as { cnt: number }).cnt;
      if (enabledCount <= 1 && agent.enabled) {
        throw new Error('Cannot disable the last active Weebo. At least one agent must remain active.');
      }
    }
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

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

// ---- Cron Job CRUD ----

export function getUserCronJobs(userId: string): PicoCronJob[] {
  return db.prepare('SELECT * FROM pico_cron_jobs WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as PicoCronJob[];
}

export function createCronJob(userId: string, data: {
  name: string; task_type: string; task_config?: Record<string, unknown>;
  interval_minutes: number; agent_slot?: number;
}): PicoCronJob {
  const id = uuid();
  const nextRun = new Date(Date.now() + data.interval_minutes * 60_000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  db.prepare(`INSERT INTO pico_cron_jobs (id, user_id, agent_slot, name, task_type, task_config, interval_minutes, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, userId, data.agent_slot ?? 2, data.name, data.task_type,
    JSON.stringify(data.task_config ?? {}), data.interval_minutes, nextRun,
  );
  return db.prepare('SELECT * FROM pico_cron_jobs WHERE id = ?').get(id) as PicoCronJob;
}

export function updateCronJob(jobId: string, userId: string, updates: {
  name?: string; task_type?: string; task_config?: Record<string, unknown>;
  interval_minutes?: number; agent_slot?: number; enabled?: boolean;
}): PicoCronJob {
  const job = db.prepare('SELECT * FROM pico_cron_jobs WHERE id = ? AND user_id = ?')
    .get(jobId, userId) as PicoCronJob | undefined;
  if (!job) throw new Error('Cron job not found');

  const fields: string[] = [];
  const values: unknown[] = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.task_type !== undefined) { fields.push('task_type = ?'); values.push(updates.task_type); }
  if (updates.task_config !== undefined) { fields.push('task_config = ?'); values.push(JSON.stringify(updates.task_config)); }
  if (updates.interval_minutes !== undefined) {
    fields.push('interval_minutes = ?'); values.push(updates.interval_minutes);
    // Recalculate next_run_at from now
    const nextRun = new Date(Date.now() + updates.interval_minutes * 60_000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    fields.push('next_run_at = ?'); values.push(nextRun);
  }
  if (updates.agent_slot !== undefined) { fields.push('agent_slot = ?'); values.push(updates.agent_slot); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

  if (fields.length) {
    values.push(jobId);
    db.prepare(`UPDATE pico_cron_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  return db.prepare('SELECT * FROM pico_cron_jobs WHERE id = ?').get(jobId) as PicoCronJob;
}

export function deleteCronJob(jobId: string, userId: string): void {
  const job = db.prepare('SELECT * FROM pico_cron_jobs WHERE id = ? AND user_id = ?')
    .get(jobId, userId) as PicoCronJob | undefined;
  if (!job) throw new Error('Cron job not found');
  db.prepare('DELETE FROM pico_cron_jobs WHERE id = ?').run(jobId);
}

function checkPicoCronJobs(): void {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  const dueJobs = db.prepare(
    "SELECT * FROM pico_cron_jobs WHERE enabled = 1 AND next_run_at <= ?"
  ).all(now) as PicoCronJob[];

  for (const job of dueJobs) {
    try {
      const config = JSON.parse(job.task_config || '{}') as Record<string, unknown>;
      const task: PlannedTask = {
        task_type: job.task_type as TaskType,
        description: `[cron] ${job.name}`,
        config,
        agent_slot: job.agent_slot,
      };
      queueTasks(job.user_id, [task], 'cron');

      // Bump next_run_at and run_count
      const nextRun = new Date(Date.now() + job.interval_minutes * 60_000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      db.prepare("UPDATE pico_cron_jobs SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1 WHERE id = ?")
        .run(now, nextRun, job.id);
    } catch (err) {
      logger.error({ err, cronJobId: job.id }, 'Cron job execution failed');
    }
  }
}

// ---- SSRF Protection ----

const BLOCKED_HOSTNAMES = new Set([
  'localhost', 'redis', 'picoclaw', 'geekspace', 'geekspace-app',
  'geekspace-redis', 'geekspace-picoclaw', 'geekspace-caddy',
  'ollama', 'ollama-qtzz-ollama-1', 'openclaw', 'openclaw-e3n5-openclaw-1',
  'caddy', 'n8n', 'edith-bridge', 'metadata.google.internal',
  'instance-data', '169.254.169.254',
]);

/**
 * Validate that a URL is safe for external HTTP requests.
 * Blocks: private IPs, Docker-internal hostnames, non-http(s) protocols.
 */
export function validateExternalUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow http(s)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked protocol: ${parsed.protocol} — only http/https allowed`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known internal hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked internal hostname: ${hostname}`);
  }

  // Block private/reserved IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 10 ||                          // 10.0.0.0/8
      a === 127 ||                         // 127.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||          // 192.168.0.0/16
      a === 0 ||                           // 0.0.0.0/8
      (a === 169 && b === 254)             // 169.254.0.0/16 (link-local)
    ) {
      throw new Error(`Blocked private/reserved IP: ${hostname}`);
    }
  }

  // Block IPv6 loopback and link-local
  if (hostname === '::1' || hostname === '[::1]' || hostname.startsWith('fe80')) {
    throw new Error(`Blocked IPv6 address: ${hostname}`);
  }
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
// Detects multiple intents in a single request and creates separate tasks.
// Splits on "and also", "and then", "also", "then" when multiple types match.

function parseSimpleTask(request: string): PlannedTask[] {
  const lower = request.toLowerCase();

  // Try to split multi-intent requests on common conjunctions
  const splitPatterns = /\b(?:and also|and then|,\s*(?:also|then)|;\s*(?:also|then)?)\b/i;
  const segments = request.split(splitPatterns).map(s => s.trim()).filter(Boolean);

  // If we have segments, parse each independently
  if (segments.length > 1) {
    const tasks: PlannedTask[] = [];
    for (const seg of segments) {
      tasks.push(...parseSingleIntent(seg));
    }
    // Deduplicate: if all tasks are the same type and same content, collapse
    if (tasks.length > 1) return tasks;
  }

  // Check if single request has multiple intent keywords
  const hasReminder = /\bremind(?:er|me)?\b/i.test(lower);
  const hasTelegram = /\b(?:send|message|telegram|notify)\b/i.test(lower) && /\b(?:telegram|message|send)\b/i.test(lower);
  const hasDeploy = /\bdeploy\b/i.test(lower) || /\bpublish\s*portfolio\b/i.test(lower);

  const intentCount = [hasReminder, hasTelegram, hasDeploy].filter(Boolean).length;

  // Multiple distinct intents detected — split by intent type
  if (intentCount >= 2) {
    const tasks: PlannedTask[] = [];
    if (hasReminder) {
      // Extract reminder part
      const reminderText = extractIntentText(request, /\bremind(?:er|me)?\b/i);
      tasks.push({ task_type: 'create_reminder', description: reminderText, config: { reminder_text: reminderText }, agent_slot: 1 });
    }
    if (hasTelegram) {
      const msgText = extractIntentText(request, /\b(?:send|telegram|message|notify)\b/i);
      tasks.push({ task_type: 'telegram_message', description: msgText, config: { message: msgText }, agent_slot: 1 });
    }
    if (hasDeploy) {
      tasks.push({ task_type: 'portfolio_deploy', description: 'Deploy portfolio', config: {}, agent_slot: 1 });
    }
    return tasks;
  }

  return parseSingleIntent(request);
}

function parseSingleIntent(request: string): PlannedTask[] {
  const lower = request.toLowerCase();
  if (/\bremind(?:er|me)?\b/i.test(lower)) {
    return [{ task_type: 'create_reminder', description: request, config: { reminder_text: request }, agent_slot: 1 }];
  }
  if (/\b(?:send|message)\b/i.test(lower) && /\b(?:telegram|message)\b/i.test(lower)) {
    return [{ task_type: 'telegram_message', description: request, config: { message: request }, agent_slot: 1 }];
  }
  if (/\bdeploy\b/i.test(lower) || /\bpublish\s*portfolio\b/i.test(lower)) {
    return [{ task_type: 'portfolio_deploy', description: 'Deploy portfolio', config: {}, agent_slot: 1 }];
  }
  // Fallback: generic reminder
  return [{ task_type: 'create_reminder', description: request, config: { reminder_text: request }, agent_slot: 1 }];
}

/** Extract the clause most relevant to a given intent keyword */
function extractIntentText(request: string, pattern: RegExp): string {
  // Try splitting on conjunctions to find the relevant clause
  const clauses = request.split(/\b(?:and also|and then|,\s*and|;\s*)\b/i).map(s => s.trim());
  for (const clause of clauses) {
    if (pattern.test(clause.toLowerCase())) return clause;
  }
  return request; // fallback to full request
}

// ---- Reminder Time Parsing ----

/**
 * Parse natural language time expressions from reminder text.
 * Returns ISO datetime string or null if no time found.
 * Supports: "in X minutes/hours", "at Xpm/am", "tomorrow at X", "tonight", "in half an hour"
 */
/** Convert luxon DateTime (in any zone) to SQLite-compatible UTC string: "YYYY-MM-DD HH:MM:SS" */
function toLuxonSqlite(dt: DateTime): string {
  return dt.toUTC().toISO()!.replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

export function parseReminderTime(text: string, userTimezone = 'Asia/Kolkata'): string | null {
  const lower = text.toLowerCase();
  const now = DateTime.now().setZone(userTimezone);

  // Helper: apply tomorrow shift if "tomorrow" appears in the text
  function applyTomorrow(target: DateTime): DateTime {
    if (!/\btomorrow\b/.test(lower)) return target;
    if (target.startOf('day').valueOf() === now.startOf('day').valueOf()) {
      return target.plus({ days: 1 });
    }
    return target;
  }

  // Helper: advance target to next day if it's in the past
  function nextIfPast(target: DateTime): DateTime {
    return target <= now ? target.plus({ days: 1 }) : target;
  }

  // Helper: build and return a set-time result
  function timeResult(hour: number, minute: number): string {
    let target = now.set({ hour, minute, second: 0, millisecond: 0 });
    target = applyTomorrow(target);
    target = nextIfPast(target);
    return toLuxonSqlite(target);
  }

  // ── Urgency shortcuts ────────────────────────────────────────────────────
  // "asap" / "right now" / "immediately" → 5 minutes
  if (/\b(?:asap|right\s+now|immediately|urgently|now)\b/.test(lower)) return toLuxonSqlite(now.plus({ minutes: 5 }));

  // ── Relative: seconds (for testing) ──────────────────────────────────────
  let match = lower.match(/\bin\s+(\d+)\s*(?:seconds?|secs?)\b/);
  if (match) return toLuxonSqlite(now.plus({ seconds: parseInt(match[1], 10) }));

  // ── Relative: minutes ────────────────────────────────────────────────────
  match = lower.match(/\bin\s+(\d+)\s*(?:min(?:ute)?s?)\b/);
  if (match) return toLuxonSqlite(now.plus({ minutes: parseInt(match[1], 10) }));

  // "after X minutes" / "after X hours" (same as "in X")
  match = lower.match(/\bafter\s+(\d+)\s*(?:min(?:ute)?s?)\b/);
  if (match) return toLuxonSqlite(now.plus({ minutes: parseInt(match[1], 10) }));

  // "in a minute" / "in one minute"
  if (/\bin\s+(?:a|one)\s+minute\b/.test(lower)) return toLuxonSqlite(now.plus({ minutes: 1 }));

  // "in a couple of minutes" / "in a few minutes"
  if (/\bin\s+(?:a\s+couple(?:\s+of)?|a\s+few)\s+minutes?\b/.test(lower)) return toLuxonSqlite(now.plus({ minutes: 5 }));

  // ── Relative: hours ──────────────────────────────────────────────────────
  match = lower.match(/\bin\s+(\d+)\s*(?:hours?|hrs?)\b/);
  if (match) return toLuxonSqlite(now.plus({ hours: parseInt(match[1], 10) }));

  // "in half an hour" / "in half hour"
  if (/\bin\s+half\s+an?\s+hour\b/.test(lower)) return toLuxonSqlite(now.plus({ minutes: 30 }));

  // "in X and a half hours" (e.g. "in 1 and a half hours")
  match = lower.match(/\bin\s+(\d+)\s+and\s+a\s+half\s+hours?\b/);
  if (match) return toLuxonSqlite(now.plus({ minutes: parseInt(match[1], 10) * 60 + 30 }));

  // ── Relative: days / weeks ───────────────────────────────────────────────
  match = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (match) return toLuxonSqlite(now.plus({ days: parseInt(match[1], 10) }).set({ second: 0, millisecond: 0 }));

  match = lower.match(/\bin\s+(\d+)\s+weeks?\b/);
  if (match) return toLuxonSqlite(now.plus({ weeks: parseInt(match[1], 10) }).set({ second: 0, millisecond: 0 }));

  // ── Named times ──────────────────────────────────────────────────────────

  // "noon" / "midday" → 12:00
  if (/\b(?:noon|midday)\b/.test(lower)) return timeResult(12, 0);

  // "midnight" → 00:00
  if (/\bmidnight\b/.test(lower)) {
    const target = now.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).plus({ days: 1 });
    return toLuxonSqlite(target);
  }

  // "this morning" → 9am, "this afternoon" → 2pm, "this evening" → 6pm, "this night" → 9pm
  if (/\bthis\s+morning\b/.test(lower)) return timeResult(9, 0);
  if (/\bthis\s+afternoon\b/.test(lower)) return timeResult(14, 0);
  if (/\bthis\s+evening\b/.test(lower)) return timeResult(18, 0);
  if (/\bthis\s+night\b/.test(lower)) return timeResult(21, 0);

  // "next week" → 7 days from now at 9am
  if (/\bnext\s+week\b/.test(lower)) {
    return toLuxonSqlite(now.plus({ weeks: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }));
  }

  // "next month" → 1 month from now at 9am
  if (/\bnext\s+month\b/.test(lower)) {
    return toLuxonSqlite(now.plus({ months: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }));
  }

  // Weekday names: "next Monday" / "on Friday" / bare "Monday" → next occurrence
  const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const wdMatch = lower.match(/\b(?:next\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wdMatch) {
    const targetWd = WEEKDAYS.indexOf(wdMatch[1]);
    const currentWd = now.weekday % 7; // luxon: 1=Mon…7=Sun → convert to 0=Sun
    let daysAhead = targetWd - currentWd;
    if (daysAhead <= 0 || /\bnext\b/.test(lower)) daysAhead += 7;
    const hour = /\bevening\b/.test(lower) ? 18 : /\bafternoon\b/.test(lower) ? 14 : /\bnight\b/.test(lower) ? 21 : 9;
    return toLuxonSqlite(now.plus({ days: daysAhead }).set({ hour, minute: 0, second: 0, millisecond: 0 }));
  }

  // ── Half-past / quarter-past / quarter-to ────────────────────────────────

  // "half past X" / "half X" (Indian/British: half past 6 = 6:30, half 6 = 6:30)
  match = lower.match(/\bhalf\s+past\s+(\d{1,2})\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, 30);
  }
  match = lower.match(/\bhalf\s+(\d{1,2})\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, 30);
  }

  // "quarter past X" = X:15
  match = lower.match(/\bquarter\s+past\s+(\d{1,2})\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, 15);
  }

  // "quarter to X" = (X-1):45
  match = lower.match(/\bquarter\s+to\s+(\d{1,2})\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    hour = hour === 0 ? 23 : hour - 1;
    return timeResult(hour, 45);
  }

  // ── Bare time patterns (no "at" prefix) ──────────────────────────────────

  // "9am" / "9pm" / "9:30am" / "9.30pm" — digit+am/pm, no "at" prefix
  match = lower.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/);
  if (match && !lower.match(/\bat\s+\d/)) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return timeResult(hour, minute);
  }

  // "H MM am/pm" — space-separated with am/pm, no "at" prefix (e.g. "6 40 pm")
  match = lower.match(/\b(\d{1,2})\s+(\d{2})\s*(am|pm)\b/);
  if (match && !lower.match(/\bat\s+\d/)) {
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = match[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return timeResult(hour, minute);
  }

  // "12:30" — colon-separated, no "at" prefix, no am/pm
  match = lower.match(/\b(\d{1,2}):(\d{2})\b(?!\s*(?:am|pm))/);
  if (match && !lower.match(/\bat\s+\d/)) {
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, minute);
  }

  // "12.30" — dot-separated, no am/pm (already covered above for X.XXam case)
  match = lower.match(/\b(\d{1,2})\.(\d{2})\b(?!\s*(?:am|pm))/);
  if (match && !lower.match(/\bat\s+\d/)) {
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, minute);
  }

  // ── "at" prefix patterns ──────────────────────────────────────────────────

  // "at noon" / "at midday"
  if (/\bat\s+(?:noon|midday)\b/.test(lower)) return timeResult(12, 0);

  // "at midnight"
  if (/\bat\s+midnight\b/.test(lower)) {
    return toLuxonSqlite(now.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).plus({ days: 1 }));
  }

  // "at half past X" / "at half X"
  match = lower.match(/\bat\s+half\s+past\s+(\d{1,2})\b/) || lower.match(/\bat\s+half\s+(\d{1,2})\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, 30);
  }

  // "at quarter past X"
  match = lower.match(/\bat\s+quarter\s+past\s+(\d{1,2})\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, 15);
  }

  // "at quarter to X"
  match = lower.match(/\bat\s+quarter\s+to\s+(\d{1,2})\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    if (hour >= 1 && hour <= 7) hour += 12;
    hour = hour === 0 ? 23 : hour - 1;
    return timeResult(hour, 45);
  }

  // "at H MM (am/pm)?" — space-separated hour and minute with "at" prefix (e.g. "at 6 40", "at 6 40 pm")
  match = lower.match(/\bat\s+(\d{1,2})\s+(\d{2})\s*(am|pm)?\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const ampm = match[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    else if (ampm === 'am' && hour === 12) hour = 0;
    else if (!ampm && hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, minute);
  }

  // "at X:XX pm/am" or "at X.XX pm/am" or "at Xpm/am"
  match = lower.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return timeResult(hour, minute);
  }

  // "at X" or "at X:XX" (no am/pm → hour 1–7 = PM, 0/8–23 = face value)
  match = lower.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\b(?!\s*(?:am|pm))/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    if (hour >= 1 && hour <= 7) hour += 12;
    return timeResult(hour, minute);
  }

  // ── Day-relative patterns ─────────────────────────────────────────────────

  // "tomorrow morning/afternoon/evening/night/tomorrow"
  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = now.plus({ days: 1 });
    let hour = 9;
    if (/\bevening\b/.test(lower)) hour = 18;
    else if (/\bafternoon\b/.test(lower)) hour = 14;
    else if (/\bnight\b/.test(lower)) hour = 21;
    return toLuxonSqlite(tomorrow.set({ hour, minute: 0, second: 0, millisecond: 0 }));
  }

  // "tonight" (9pm)
  if (/\btonight\b/.test(lower)) return timeResult(21, 0);

  // "morning" / "afternoon" / "evening" / "tonight" alone (no "this"/"tomorrow" prefix)
  if (/\bmorning\b/.test(lower)) return timeResult(9, 0);
  if (/\bafternoon\b/.test(lower)) return timeResult(14, 0);
  if (/\bevening\b/.test(lower)) return timeResult(18, 0);

  // "after work" / "end of day" / "eod" (6pm)
  if (/\b(?:after work|end of (?:the )?day|eod)\b/.test(lower)) return timeResult(18, 0);

  // "lunch" / "lunchtime" (1pm)
  if (/\blunch(?:time)?\b/.test(lower)) return timeResult(13, 0);

  // "breakfast" (8am)
  if (/\bbreakfast\b/.test(lower)) return timeResult(8, 0);

  // "dinner" / "dinnertime" (8pm)
  if (/\bdinner(?:time)?\b/.test(lower)) return timeResult(20, 0);

  // ── "at X o'clock" / "X o'clock" ─────────────────────────────────────────
  match = lower.match(/\b(?:at\s+)?(\d{1,2})\s+o['']?clock\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    // Apply morning/afternoon context
    if (/\b(?:morning|am)\b/.test(lower)) { /* keep as-is */ }
    else if (/\b(?:afternoon|evening|night|pm)\b/.test(lower) && hour < 12) hour += 12;
    else if (hour >= 1 && hour <= 7) hour += 12; // evening bias for ambiguous hours
    return timeResult(hour, 0);
  }

  // ── "at X in the morning" / "at X in the afternoon/evening" ──────────────
  match = lower.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s+in\s+the\s+(morning|afternoon|evening|night)\b/);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3];
    if (period === 'morning' && hour === 12) hour = 0;
    else if (period === 'morning') { /* keep as AM */ }
    else if ((period === 'afternoon' || period === 'evening' || period === 'night') && hour < 12) hour += 12;
    return timeResult(hour, minute);
  }

  // ── "day after tomorrow" ──────────────────────────────────────────────────
  if (/\bday\s+after\s+tomorrow\b/.test(lower)) {
    let hour = 9;
    if (/\bevening\b/.test(lower)) hour = 18;
    else if (/\bafternoon\b/.test(lower)) hour = 14;
    else if (/\bnight\b/.test(lower)) hour = 21;
    // Check for specific time e.g. "day after tomorrow at 3pm"
    const tMatch = lower.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/);
    if (tMatch) {
      hour = parseInt(tMatch[1], 10);
      const min = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
      const ap = tMatch[3];
      if (ap === 'pm' && hour < 12) hour += 12;
      else if (ap === 'am' && hour === 12) hour = 0;
      else if (!ap && hour >= 1 && hour <= 7) hour += 12;
      return toLuxonSqlite(now.plus({ days: 2 }).set({ hour, minute: min, second: 0, millisecond: 0 }));
    }
    return toLuxonSqlite(now.plus({ days: 2 }).set({ hour, minute: 0, second: 0, millisecond: 0 }));
  }

  // ── "end of the week" / "this weekend" ───────────────────────────────────
  if (/\b(?:end\s+of\s+(?:the\s+)?week|this\s+weekend|on\s+(?:the\s+)?weekend)\b/.test(lower)) {
    const daysToSat = (6 - now.weekday + 7) % 7 || 7; // days until next Saturday
    return toLuxonSqlite(now.plus({ days: daysToSat }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }));
  }

  // No time expression found → default to 1 hour from now
  return toLuxonSqlite(now.plus({ hours: 1 }));
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
- generate_code: config needs { "title": "string", "prompt": "string", "existingArtifactId": "string (optional, to update existing site)" }

Each task can target a specific agent slot (1-6). Default is 1.

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
      agent_slot: typeof t.agent_slot === 'number' ? Math.min(6, Math.max(1, Math.round(t.agent_slot))) : 1,
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

// ---- Idempotency Check ----

function generateIdempotencyKey(userId: string, taskType: string, description: string): string {
  // Simple hash for deduplication — same user + type + description within 5 min window
  return `${userId}:${taskType}:${description.slice(0, 50)}`;
}

function checkDuplicateTask(userId: string, idempotencyKey: string): string | null {
  // Check for completed/queued task with same key within last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const existing = db.prepare(
    `SELECT id FROM pico_tasks 
     WHERE user_id = ? AND idempotency_key = ? 
     AND (status IN ('completed', 'queued', 'running') OR (status = 'failed' AND created_at > ?))
     ORDER BY created_at DESC LIMIT 1`
  ).get(userId, idempotencyKey, fiveMinutesAgo) as { id: string } | undefined;
  return existing?.id || null;
}

// ---- Queue Tasks ----

export function queueTasks(
  userId: string,
  tasks: PlannedTask[],
  plannedBy: string,
  sourceRequestId?: string,
): string[] {
  const taskIds: string[] = [];

  for (const task of tasks) {
    // Resolve agent by slot (fall back to slot 1)
    let agent = getAgentBySlot(userId, task.agent_slot);
    if (!agent) agent = getAgentBySlot(userId, 1);
    if (!agent) {
      logger.warn({ userId, slot: task.agent_slot, sourceRequestId }, 'No agent found for task — skipping');
      continue;
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(userId, task.task_type, task.description);

    // Check for duplicate (idempotency)
    const duplicateId = checkDuplicateTask(userId, idempotencyKey);
    if (duplicateId) {
      logger.info({ userId, taskType: task.task_type, duplicateId, sourceRequestId }, 'Duplicate task detected — skipping');
      taskIds.push(duplicateId); // Return existing task ID
      continue;
    }

    const id = uuid();
    db.prepare(`INSERT INTO pico_tasks (id, user_id, agent_id, task_type, description, config, planned_by, source_request_id, idempotency_key, attempts, max_attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, userId, agent.id, task.task_type, task.description,
      JSON.stringify(task.config), plannedBy, sourceRequestId || '',
      idempotencyKey, 0, 3, // attempts=0, max_attempts=3
    );
    logger.info({ taskId: id, userId, taskType: task.task_type, sourceRequestId, idempotencyKey }, 'Task queued');
    taskIds.push(id);
  }

  // Wake the worker so tasks execute immediately (not 5 min later)
  if (taskIds.length > 0) wakeWorker();

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
  const now = new Date().toISOString();

  // Fair round-robin: find next queued task from a user after lastProcessedUserId
  // Skip paused agents and agents with a running task (1 concurrent per agent)
  // Also skip tasks with retry_after in the future
  const roundRobinQuery = `
    SELECT t.*, a.status AS agent_status, a.slot AS agent_slot
    FROM pico_tasks t
    JOIN pico_agents a ON a.id = t.agent_id
    WHERE t.status = 'queued'
      AND a.status = 'active'
      AND a.enabled = 1
      AND (t.retry_after IS NULL OR t.retry_after <= ?)
      AND NOT EXISTS (
        SELECT 1 FROM pico_tasks r
        WHERE r.agent_id = t.agent_id AND r.status = 'running'
      )
      AND t.user_id > ?
    ORDER BY t.user_id ASC, t.created_at ASC
    LIMIT 1
  `;

  let task = db.prepare(roundRobinQuery).get(now, lastProcessedUserId) as PicoTask | undefined;

  // Wrap around if nothing found after current user
  if (!task) {
    task = db.prepare(roundRobinQuery).get(now, '') as PicoTask | undefined;
  }

  if (!task) return false; // genuinely idle — nothing in queue

  // Task found — attempt execution; errors here don't mean idle
  lastProcessedUserId = task.user_id;
  try {
    await executeTask(task);
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : String(err), taskId: task.id }, 'Pico worker: unexpected task execution error');
  }
  return true;
}

async function executeTask(task: PicoTask): Promise<void> {
  const now = new Date().toISOString();

  // Mark running
  db.prepare("UPDATE pico_tasks SET status = 'running', started_at = ? WHERE id = ?")
    .run(now, task.id);
  db.prepare('INSERT INTO pico_task_logs (id, task_id, agent_id, event, detail) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), task.id, task.agent_id, 'started', `Executing ${task.task_type}`);
  eventBus.emit('pico:task', { event: 'started', taskId: task.id, taskType: task.task_type, userId: task.user_id });

  let output = '';
  try {
    const taskConfig = JSON.parse(task.config || '{}') as Record<string, unknown>;

    switch (task.task_type) {
      case 'create_reminder': {
        const text = String(taskConfig.reminder_text || task.description);
        const reminderId = uuid();
        // Look up user timezone (same pattern as action-executor.ts)
        const userId = task.user_id;
        const tzRow = db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined;
        const userTimezone = tzRow?.timezone || 'Asia/Kolkata';
        // LLMs are unreliable at timezone math — never trust a computed UTC datetime.
        // Treat ISO-without-timezone as user's local time; bare expressions go through parseReminderTime.
        const rawDatetime = taskConfig.datetime as string | undefined;
        const toUtcSqlite2 = (dt: DateTime) => dt.toUTC().toISO()!.replace('T', ' ').replace(/\.\d{3}Z$/, '');
        let dueAt: string | null;
        if (!rawDatetime) {
          dueAt = parseReminderTime(text, userTimezone);
        } else if (/[Zz]$|[+-]\d{2}:\d{2}$/.test(rawDatetime)) {
          const dt = DateTime.fromISO(rawDatetime);
          dueAt = dt.isValid ? toUtcSqlite2(dt) : parseReminderTime(text, userTimezone);
        } else if (rawDatetime.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(rawDatetime)) {
          // ISO without timezone → treat as user local time
          const dt = DateTime.fromISO(rawDatetime.replace(' ', 'T'), { zone: userTimezone });
          dueAt = dt.isValid ? toUtcSqlite2(dt) : parseReminderTime(text, userTimezone);
        } else {
          dueAt = parseReminderTime(rawDatetime, userTimezone);
        }
        // Use telegram channel if user has Telegram linked, otherwise push
        const hasChannel = db.prepare(
          "SELECT 1 FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
        ).get(task.user_id);
        const channel = hasChannel ? 'telegram' : 'push';
        const scheduledFor = dueAt ? new Date(dueAt).getTime() : Date.now();

        // Detect recurrence patterns (Smart Reminders V2)
        let picoRecurrence: string | null = null;
        const lowerReminderText = text.toLowerCase();
        if (/\b(every\s+day|daily|har\s+roz|roz)\b/i.test(lowerReminderText)) {
          picoRecurrence = 'daily';
        } else if (/\b(every\s+week|weekly|once\s+a\s+week)\b/i.test(lowerReminderText) ||
                   /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lowerReminderText)) {
          picoRecurrence = 'weekly';
        } else if (/\b(every\s+month|monthly|once\s+a\s+month)\b/i.test(lowerReminderText)) {
          picoRecurrence = 'monthly';
        }

        db.prepare('INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurrence, created_by, pico_task_id, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(reminderId, task.user_id, text, dueAt, channel, 'general', picoRecurrence, 'pico-fleet', task.id, scheduledFor);
        const timeNote = dueAt ? ` (due ${new Date(dueAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })})` : '';
        output = `Reminder created: ${text}${timeNote}`;

        // Create memory entry for the reminder
        upsertMemory(task.user_id, 'reminder', `reminder_${reminderId}`, JSON.stringify({
          text,
          dueAt,
          channel,
          reminderId,
          createdAt: new Date().toISOString(),
        }), 0.9, 'pico-fleet');

        // Update channel_links last_message_at
        db.prepare(
          "UPDATE channel_links SET last_message_at = datetime('now') WHERE user_id = ? AND channel = ?"
        ).run(task.user_id, channel);

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
        validateExternalUrl(url);
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

      case 'social_media_post': {
        const { executeSocialMediaPostTask } = await import('./social-media.js');
        output = await executeSocialMediaPostTask(task.user_id, taskConfig);
        break;
      }

      case 'generate_code': {
        // Fleet agent builds or updates a website using the LLM + action-executor pipeline.
        // config: { prompt: string, title?: string, existingArtifactId?: string }
        const { executeAction } = await import('./action-executor.js');
        const { parseActions } = await import('./action-parser.js');
        const { routeChat } = await import('./llm.js');
        const buildPrompt = String(taskConfig.prompt || task.description);
        const existingId = taskConfig.existingArtifactId as string | undefined;

        // If updating an existing artifact, fetch its current code for context
        let contextBlock = '';
        if (existingId) {
          const existing = db.prepare('SELECT title, html, css FROM generated_artifacts WHERE id = ? AND user_id = ?')
            .get(existingId, task.user_id) as { title: string; html: string; css: string } | undefined;
          if (existing) {
            contextBlock = `\nExisting project "${existing.title}". Update it based on the request. Current HTML (first 500 chars): ${existing.html.slice(0, 500)}`;
          }
        }

        const systemPrompt = `You are a website builder. Generate a complete, visually impressive website using the generate_code tool.
Always respond with a generate_code action block containing valid HTML, CSS, and JS.
<<<ACTION
{"tool": "generate_code", "params": {"title": "<title>", "html": "<html>", "css": "<css>", "js": "<js>"${existingId ? `, "existingArtifactId": "${existingId}"` : ''}}}
ACTION>>>`;

        const llmResult = await routeChat(
          [{ role: 'user', content: buildPrompt + contextBlock }],
          { userId: task.user_id, systemPrompt }
        );
        const { actions: parsedActions } = parseActions(llmResult.reply);
        const codeAction = parsedActions.find(a => a.tool === 'generate_code');
        if (!codeAction) throw new Error('LLM did not generate a website');

        codeAction.params.baseUrl = config.apiUrl;
        if (existingId) codeAction.params.existingArtifactId = existingId;

        const result = await executeAction(task.user_id, codeAction);
        if (!result.success) throw new Error(result.message);

        // Notify user via Telegram if linked
        const hasChannel = db.prepare(
          "SELECT 1 FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
        ).get(task.user_id);
        if (hasChannel && result.previewUrl) {
          const { sendTelegramMessage } = await import('./telegram.js');
          const notifyRow = db.prepare("SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram'").get(task.user_id) as { external_id: string } | undefined;
          if (notifyRow) {
            await sendTelegramMessage(notifyRow.external_id, `Your website is ready!\n\n${existingId ? 'Updated' : 'Created'}: ${String(result.data?.title ?? 'New Site')}\nPreview: ${result.previewUrl}`);
          }
        }
        output = `Website ${existingId ? 'updated' : 'created'}: ${result.data?.title ?? 'site'}. Preview: ${result.previewUrl ?? 'saved to projects'}`;
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

    // Mark any linked reminders as complete (for non-create_reminder tasks)
    if (task.task_type !== 'create_reminder') {
      db.prepare('UPDATE reminders SET completed = 1 WHERE pico_task_id = ? AND user_id = ?')
        .run(task.id, task.user_id);
    }

    // Deduct 1 credit for execution
    deductSubscriptionCredits(task.user_id, 1);

    // Log activity
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Pico task completed', ?, 'zap')`)
      .run(uuid(), task.user_id, `${task.task_type}: ${output.slice(0, 100)}`);

    eventBus.emit('pico:task', { event: 'completed', taskId: task.id, taskType: task.task_type, userId: task.user_id, result: output.slice(0, 200) });
    logger.info({ taskId: task.id, taskType: task.task_type }, 'Pico task completed');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failedAt = new Date().toISOString();
    const currentAttempts = (task.attempts || 0) + 1;
    const maxAttempts = task.max_attempts || 3;

    // Log the failure
    db.prepare('INSERT INTO pico_task_logs (id, task_id, agent_id, event, detail) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), task.id, task.agent_id, 'failed', `Attempt ${currentAttempts}/${maxAttempts}: ${errorMsg}`);

    // Check if we should retry
    if (currentAttempts < maxAttempts) {
      // Calculate exponential backoff: 5s, 15s, 45s...
      const backoffSeconds = 5 * Math.pow(3, currentAttempts - 1);
      const retryAfter = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      db.prepare("UPDATE pico_tasks SET status = 'queued', attempts = ?, retry_after = ?, result = ? WHERE id = ?")
        .run(currentAttempts, retryAfter, `Retry scheduled in ${backoffSeconds}s: ${errorMsg}`, task.id);

      logger.info({ taskId: task.id, taskType: task.task_type, attempt: currentAttempts, maxAttempts, retryAfter, backoffSeconds }, 'Pico task failed, will retry');
      eventBus.emit('pico:task', { event: 'retry_scheduled', taskId: task.id, taskType: task.task_type, userId: task.user_id, attempt: currentAttempts, retryAfter });
    } else {
      // Max retries exceeded — mark as permanently failed
      db.prepare("UPDATE pico_tasks SET status = 'failed', result = ?, completed_at = ?, attempts = ? WHERE id = ?")
        .run(`Failed after ${maxAttempts} attempts: ${errorMsg}`, failedAt, currentAttempts, task.id);
      db.prepare('UPDATE pico_agents SET tasks_failed = tasks_failed + 1 WHERE id = ?')
        .run(task.agent_id);

      eventBus.emit('pico:task', { event: 'failed', taskId: task.id, taskType: task.task_type, userId: task.user_id, error: errorMsg.slice(0, 200) });
      logger.warn({ taskId: task.id, taskType: task.task_type, error: errorMsg, attempts: currentAttempts }, 'Pico task failed permanently after max retries');
    }
  }
}

// ---- Daily Memory Summarizer ----

async function checkDailySummarization(): Promise<void> {
  const hour = new Date().getHours();
  if (hour !== 0) return; // only at midnight

  try {
    const { summarizeUserDay } = await import('./memory-summarizer.js');

    const users = db.prepare(`
      SELECT DISTINCT user_id FROM conversation_log
      WHERE date(created_at) = date('now', '-1 day')
      AND user_id NOT IN (
        SELECT user_id FROM agent_memory
        WHERE category = 'auto_summary' AND key = date('now')
      )
    `).all() as { user_id: string }[];

    for (const { user_id } of users) {
      await summarizeUserDay(user_id);
    }
  } catch (err) {
    logger.error({ err }, 'Daily summarization check failed');
  }
}

// ---- Recipe Scheduler ----

async function checkAndRunRecipes(): Promise<void> {
  try {
    const { executeRecipe } = await import('./recipes.js');
    const dueRecipes = db.prepare(`
      SELECT ir.user_id, ir.recipe_id
      FROM installed_recipes ir
      WHERE ir.last_run_at IS NULL
         OR (ir.recipe_id = 'morning-briefing' AND date(ir.last_run_at) < date('now') AND strftime('%H', 'now') >= '08')
         OR (ir.recipe_id = 'deadline-enforcer' AND date(ir.last_run_at) < date('now') AND strftime('%H', 'now') >= '07')
         OR (ir.recipe_id = 'weekly-review' AND date(ir.last_run_at, '-7 days') < date('now') AND strftime('%w', 'now') = '1')
         OR (ir.recipe_id = 'api-health-monitor' AND ir.last_run_at < datetime('now', '-15 minutes'))
         OR (ir.recipe_id = 'portfolio-traffic' AND date(ir.last_run_at) < date('now') AND strftime('%H', 'now') >= '09')
    `).all() as { user_id: string; recipe_id: string }[];

    for (const { user_id, recipe_id } of dueRecipes) {
      try {
        await executeRecipe(recipe_id, user_id);
      } catch (err) {
        logger.error({ err, recipe_id, user_id }, 'Recipe execution failed');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Recipe check failed');
  }
}

let workerRunning = false;
let idleStreak = 0;
let nextTickTimer: ReturnType<typeof setTimeout> | null = null;

/** Wake the worker immediately — call after queueing tasks */
export function wakeWorker(): void {
  if (!workerRunning) return;
  idleStreak = 0;
  if (nextTickTimer) {
    clearTimeout(nextTickTimer);
    nextTickTimer = null;
  }
  // Schedule immediate tick (1ms to avoid blocking caller)
  nextTickTimer = setTimeout(tick, 1);
  logger.debug('Pico worker woken — processing next tick immediately');
}

async function tick() {
  nextTickTimer = null;
  try {
    refreshModelsIfStale().catch(() => {});
    await checkDailySummarization();
    await checkAndRunRecipes();
    try {
      const { checkDueSocialPosts } = await import('./social-media.js');
      await checkDueSocialPosts();
    } catch (err) {
      logger.error({ err }, 'Social media post check failed');
    }
    checkPicoCronJobs();
    const worked = await processNextTask();
    if (worked) {
      idleStreak = 0;
    } else {
      idleStreak++;
    }
  } catch (err) {
    logger.error({ err }, 'Pico worker tick error');
  }

  const IDLE_THRESHOLD = 10;
  const interval = idleStreak >= IDLE_THRESHOLD
    ? config.picoIdleIntervalMs   // 5 min when idle
    : config.picoWorkerIntervalMs; // 10s normally

  nextTickTimer = setTimeout(tick, interval);
}

export function startPicoWorker(): void {
  if (workerRunning) return;
  workerRunning = true;

  tick();
  logger.info({ normal: config.picoWorkerIntervalMs, idle: config.picoIdleIntervalMs }, 'Pico worker started (adaptive)');
}
