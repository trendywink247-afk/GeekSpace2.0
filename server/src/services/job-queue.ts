// ============================================================
// Async Job Queue — Phase 76
//
// Lightweight in-process queue for heavy/slow tasks (voice transcription,
// image generation, video generation) so API routes return immediately
// with a job ID rather than blocking for 30-120s.
//
// Architecture:
//   - In-memory queue for fast local dev (no external deps)
//   - Redis-backed for persistence across PM2 workers in production
//   - Consumers poll via processNext() or listen via startWorker()
//
// Usage:
//   const jobId = await enqueueJob('voice:transcribe', { audioUrl, userId });
//   const status = await getJobStatus(jobId);
// ============================================================

import crypto from 'crypto';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from './cache.js';

export type JobType =
  | 'voice:transcribe'
  | 'voice:synthesize'
  | 'image:generate'
  | 'video:generate'
  | 'video:stitch';

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface Job<T = unknown> {
  id: string;
  type: JobType;
  payload: T;
  status: JobStatus;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

// ---- In-memory fallback store ----
const inMemoryJobs = new Map<string, Job>();

const JOB_TTL_SEC = 60 * 60; // keep job results for 1 hour
const JOB_KEY_PREFIX = 'job:';

// ---- Persistence helpers (Redis with in-memory fallback) ----

async function saveJob(job: Job): Promise<void> {
  inMemoryJobs.set(job.id, job);
  try {
    await cacheSet(JOB_KEY_PREFIX + job.id, JSON.stringify(job), JOB_TTL_SEC);
  } catch {
    // Redis unavailable — in-memory only (single-worker mode)
  }
}

async function loadJob(id: string): Promise<Job | null> {
  // Check Redis first (authoritative in multi-worker setup)
  try {
    const raw = await cacheGet(JOB_KEY_PREFIX + id);
    if (raw) {
      const job = JSON.parse(raw) as Job;
      inMemoryJobs.set(id, job); // sync local cache
      return job;
    }
  } catch {
    // Redis unavailable — fall through to in-memory
  }
  return inMemoryJobs.get(id) ?? null;
}

// ---- Public API ----

/**
 * Enqueue a heavy job. Returns the job ID immediately.
 * The caller should poll /api/jobs/:id for status.
 */
export async function enqueueJob<T>(
  type: JobType,
  payload: T,
  userId?: string,
): Promise<string> {
  const job: Job<T> = {
    id: crypto.randomUUID(),
    type,
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId,
  };

  await saveJob(job);
  logger.info({ jobId: job.id, type, userId }, 'job-queue: job enqueued');

  // Schedule immediate processing (non-blocking)
  setImmediate(() => processJob(job.id).catch((err) => {
    logger.error({ jobId: job.id, error: String(err) }, 'job-queue: background processing failed');
  }));

  return job.id;
}

/**
 * Get the current status of a job.
 */
export async function getJobStatus(id: string): Promise<Job | null> {
  return loadJob(id);
}

// ---- Job Processor Registry ----
// Register handlers per job type. Each handler receives the payload and
// returns a result. Handlers should throw on error.

type JobHandler<T = unknown, R = unknown> = (payload: T, userId?: string) => Promise<R>;

const handlers = new Map<JobType, JobHandler>();

export function registerJobHandler<T, R>(type: JobType, handler: JobHandler<T, R>): void {
  handlers.set(type, handler as JobHandler);
  logger.info({ type }, 'job-queue: handler registered');
}

/**
 * Process a single job by ID. Called automatically after enqueue.
 * Can also be called manually for retry scenarios.
 */
export async function processJob(id: string): Promise<void> {
  const job = await loadJob(id);
  if (!job) {
    logger.warn({ jobId: id }, 'job-queue: job not found for processing');
    return;
  }

  if (job.status !== 'pending') {
    logger.debug({ jobId: id, status: job.status }, 'job-queue: skipping non-pending job');
    return;
  }

  // Mark as processing
  job.status = 'processing';
  job.updatedAt = new Date().toISOString();
  await saveJob(job);

  const handler = handlers.get(job.type);
  if (!handler) {
    job.status = 'failed';
    job.error = `No handler registered for job type: ${job.type}`;
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
    logger.warn({ jobId: id, type: job.type }, 'job-queue: no handler registered');
    return;
  }

  try {
    const result = await handler(job.payload, job.userId);
    job.status = 'done';
    job.result = result;
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
    logger.info({ jobId: id, type: job.type, userId: job.userId }, 'job-queue: job completed');
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
    logger.warn({ jobId: id, type: job.type, error: job.error }, 'job-queue: job failed');
  }
}

/**
 * Get queue stats (useful for monitoring/admin).
 */
export function getQueueStats(): { inMemoryCount: number } {
  return { inMemoryCount: inMemoryJobs.size };
}
