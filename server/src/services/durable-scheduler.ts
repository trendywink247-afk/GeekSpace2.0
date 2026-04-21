// ============================================================
// Durable Scheduler — SQLite-backed, restart-safe job queue
// Schedules proactive "wakeups" that survive server restarts.
// Replaces fragile setInterval loops with persistent jobs.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';

// ── Types ────────────────────────────────────────────────────

export type ScheduledJobType =
  | 'morning_brief' | 'overdue_alert' | 'idle_checkin'
  | 'habit_nudge' | 'weekly_report' | 'reminder_preview'
  | 'streak_celebration' | 'expense_alert' | 'memory_decay'
  | 'page_monitor' | 'pre_meeting_brief' | 'custom';

export interface ScheduledJob {
  id: string;
  userId: string;
  type: ScheduledJobType;
  payload: Record<string, unknown>;
  runAt: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  lastError?: string;
}

// ── Schedule a job ───────────────────────────────────────────

export function scheduleJob(
  userId: string,
  type: ScheduledJobType,
  runAt: number | Date,
  payload: Record<string, unknown> = {},
  opts?: { maxAttempts?: number; dedupeKey?: string }
): string {
  const runAtMs = typeof runAt === 'number' ? runAt : runAt.getTime();
  const id = opts?.dedupeKey || uuid();

  // Dedupe: skip if pending job with same key exists
  if (opts?.dedupeKey) {
    const existing = db.prepare(
      "SELECT id FROM scheduled_jobs WHERE id = ? AND status = 'pending'"
    ).get(id);
    if (existing) return id;
  }

  db.prepare(`
    INSERT OR REPLACE INTO scheduled_jobs (id, user_id, type, payload, run_at, status, attempts, max_attempts, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
  `).run(id, userId, type, JSON.stringify(payload), runAtMs, opts?.maxAttempts ?? 3, Date.now());

  return id;
}

// ── Cancel ───────────────────────────────────────────────────

export function cancelJob(jobId: string): void {
  db.prepare("UPDATE scheduled_jobs SET status = 'done' WHERE id = ?").run(jobId);
}

export function cancelUserJobs(userId: string, type?: ScheduledJobType): void {
  if (type) {
    db.prepare("UPDATE scheduled_jobs SET status = 'done' WHERE user_id = ? AND type = ? AND status = 'pending'").run(userId, type);
  } else {
    db.prepare("UPDATE scheduled_jobs SET status = 'done' WHERE user_id = ? AND status = 'pending'").run(userId);
  }
}

// ── Poll for due jobs ────────────────────────────────────────

export function getDueJobs(limit = 50): ScheduledJob[] {
  const rows = db.prepare(`
    SELECT * FROM scheduled_jobs
    WHERE status = 'pending' AND run_at <= ?
    ORDER BY run_at ASC LIMIT ?
  `).all(Date.now(), limit) as Array<Record<string, unknown>>;

  return rows.map(r => ({
    id: String(r.id),
    userId: String(r.user_id),
    type: String(r.type) as ScheduledJobType,
    payload: JSON.parse(String(r.payload || '{}')),
    runAt: Number(r.run_at),
    status: String(r.status) as ScheduledJob['status'],
    attempts: Number(r.attempts),
    maxAttempts: Number(r.max_attempts),
    createdAt: Number(r.created_at),
    lastError: r.last_error ? String(r.last_error) : undefined,
  }));
}

// ── Status updates ───────────────────────────────────────────

export function markRunning(jobId: string): void {
  db.prepare("UPDATE scheduled_jobs SET status = 'running', attempts = attempts + 1 WHERE id = ?").run(jobId);
}

export function markDone(jobId: string): void {
  db.prepare("UPDATE scheduled_jobs SET status = 'done' WHERE id = ?").run(jobId);
}

export function markFailed(jobId: string, error: string): void {
  const job = db.prepare('SELECT attempts, max_attempts FROM scheduled_jobs WHERE id = ?')
    .get(jobId) as { attempts: number; max_attempts: number } | undefined;

  if (job && job.attempts >= job.max_attempts) {
    db.prepare("UPDATE scheduled_jobs SET status = 'failed', last_error = ? WHERE id = ?").run(error, jobId);
    logger.warn({ jobId, attempts: job.attempts }, 'Scheduled job permanently failed');
  } else {
    // Exponential backoff retry (max 1h)
    const backoffMs = Math.min(60000 * Math.pow(2, (job?.attempts ?? 1) - 1), 3600000);
    db.prepare("UPDATE scheduled_jobs SET status = 'pending', run_at = ?, last_error = ? WHERE id = ?")
      .run(Date.now() + backoffMs, error, jobId);
  }
}

// ── Recurring job helper ─────────────────────────────────────

export function scheduleRecurringDaily(
  userId: string,
  type: ScheduledJobType,
  hourLocal: number,
  timezone: string,
  payload: Record<string, unknown> = {}
): string {
  const currentHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }), 10
  );

  let hoursUntil = hourLocal - currentHour;
  if (hoursUntil <= 0) hoursUntil += 24; // tomorrow
  const runAt = Date.now() + hoursUntil * 3600_000;

  const dateStr = new Date(runAt).toISOString().slice(0, 10);
  return scheduleJob(userId, type, runAt, payload, {
    dedupeKey: `${type}:${userId}:${dateStr}`,
  });
}

// ── Cleanup ──────────────────────────────────────────────────

export function cleanupOldJobs(olderThanDays = 7): number {
  const cutoff = Date.now() - olderThanDays * 86_400_000;
  return db.prepare("DELETE FROM scheduled_jobs WHERE status IN ('done', 'failed') AND created_at < ?").run(cutoff).changes;
}

// ── Stats ────────────────────────────────────────────────────

export function getSchedulerStats(): Record<string, number> {
  const rows = db.prepare("SELECT status, COUNT(*) as c FROM scheduled_jobs GROUP BY status")
    .all() as Array<{ status: string; c: number }>;
  const stats: Record<string, number> = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const r of rows) stats[r.status] = r.c;
  return stats;
}

// ── Job Runner (replaces setInterval) ────────────────────────

type JobHandler = (job: ScheduledJob) => Promise<void>;
const handlers = new Map<string, JobHandler>();
let runnerInterval: ReturnType<typeof setInterval> | null = null;

export function registerHandler(type: ScheduledJobType, handler: JobHandler): void {
  handlers.set(type, handler);
}

async function processJobs(): Promise<void> {
  const jobs = getDueJobs(20);
  for (const job of jobs) {
    const handler = handlers.get(job.type);
    if (!handler) {
      markDone(job.id); // no handler = skip
      continue;
    }
    markRunning(job.id);
    try {
      await handler(job);
      markDone(job.id);
    } catch (err) {
      markFailed(job.id, (err as Error).message?.slice(0, 200) || 'Unknown error');
    }
  }
}

export function startJobRunner(intervalMs = 30_000): void {
  if (runnerInterval) return;

  // Recover stuck 'running' jobs from previous crash
  db.prepare("UPDATE scheduled_jobs SET status = 'pending' WHERE status = 'running'").run();

  runnerInterval = setInterval(async () => {
    processJobs().catch(err => logger.warn({ err }, 'Job runner cycle failed'));
    // Morning operator + health monitor ticks (fire-and-forget)
    import('./morning-operator.js').then(m => m.runMorningOperatorTick()).catch(() => {});
    import('./health-monitor.js').then(m => m.runHealthTick()).catch(() => {});
  }, intervalMs);

  // Run immediately on startup
  processJobs().catch(err => logger.warn({ err }, 'Job runner initial cycle failed'));

  logger.info({ intervalMs }, 'Durable job runner started');
}

export function stopJobRunner(): void {
  if (runnerInterval) {
    clearInterval(runnerInterval);
    runnerInterval = null;
  }
}
