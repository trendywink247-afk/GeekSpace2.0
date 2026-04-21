-- ============================================================
-- Pico Fleet Schema
-- pico_agents, pico_tasks, pico_task_logs, pico_cron_jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS pico_agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Weebo',
  personality TEXT NOT NULL DEFAULT 'weebo',
  status TEXT NOT NULL DEFAULT 'active',
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  system_prompt TEXT DEFAULT '',
  mode TEXT DEFAULT 'builder',
  voice TEXT DEFAULT 'friendly',
  creativity INTEGER DEFAULT 70,
  formality INTEGER DEFAULT 50,
  model_preference TEXT DEFAULT 'auto',
  custom_commands TEXT DEFAULT '',
  assigned_tools TEXT DEFAULT '[]',
  enabled INTEGER DEFAULT 1,
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
  source_request_id TEXT DEFAULT '',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  idempotency_key TEXT DEFAULT '',
  retry_after TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pico_tasks_user ON pico_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_pico_tasks_agent ON pico_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_pico_tasks_status ON pico_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pico_tasks_request_id ON pico_tasks(source_request_id);
CREATE INDEX IF NOT EXISTS idx_pico_tasks_idempotency ON pico_tasks(user_id, idempotency_key) WHERE idempotency_key != '';

CREATE TABLE IF NOT EXISTS pico_task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES pico_tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pico_task_logs_task ON pico_task_logs(task_id);

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
