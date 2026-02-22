import 'apminsight';
// ============================================================
// Agentin Core API — Production Entry Point
// Express + SQLite + JWT, production-hardened
// ============================================================

import { createApp, APP_VERSION } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { db } from './db/index.js';

import { initAutomationsEngine } from './services/automations-engine.js';
import { initMemoryTables, startMemorySyncScheduler } from './services/memory.js';
import { initWorkflowTables } from './services/workflow-engine.js';
import { initTelegramBot } from './services/telegram.js';
import { initPicoFleetTables, ensureDefaultAgents, startPicoWorker } from './services/pico-fleet.js';
import { seedDefaultTemplates } from './routes/templates.js';
import { startBriefingScheduler } from './services/daily-briefing.js';
import { startReminderScheduler } from './services/reminder-scheduler.js';
import { startHealthProbeCache } from './routes/health.js';
import { startModelSyncScheduler } from './services/model-sync.js';
import { startArtifactCleanupScheduler } from './services/artifact-cleanup.js';

// Create the Express app using the factory
const app = createApp();

// ---- Graceful shutdown ----
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  db.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---- Start server ----
app.listen(config.port, () => {
  logger.info({
    port: config.port,
    env: config.env,
    corsOrigins: config.corsOrigins,
    ollamaUrl: config.ollamaBaseUrl,
  }, `Agentin API v${APP_VERSION} running on :${config.port}`);

  // Idempotent table migrations — safe to run in every cluster worker
  initMemoryTables();
  initWorkflowTables();
  initPicoFleetTables();
  ensureDefaultAgents();
  seedDefaultTemplates();

  // Health probe cache — runs in every worker
  startHealthProbeCache();

  // Schedulers, Telegram bot, and cron jobs — run ONLY in the primary worker
  const isMainWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
  if (isMainWorker) {
    initAutomationsEngine();
    startPicoWorker();
    initTelegramBot().catch(err => logger.warn({ err }, 'Telegram bot init failed (non-fatal)'));
    startBriefingScheduler();
    startReminderScheduler();
    startMemorySyncScheduler();
    startModelSyncScheduler();
    startArtifactCleanupScheduler();
  } else {
    logger.info({ worker: process.env.NODE_APP_INSTANCE }, 'Cluster worker — schedulers skipped');
  }
});
