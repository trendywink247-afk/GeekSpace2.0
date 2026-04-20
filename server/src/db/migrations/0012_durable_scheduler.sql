-- ============================================================
-- Durable Scheduler Schema
-- scheduled_jobs: persistent job queue for async background work
--
-- Not in 0000_baseline.sql; previously created by
-- initSchedulerTable() in services/durable-scheduler.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  run_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_schedjobs_run ON scheduled_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_schedjobs_user ON scheduled_jobs(user_id, type);
