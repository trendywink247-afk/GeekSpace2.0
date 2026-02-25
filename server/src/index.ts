import 'apminsight';
// ============================================================
// Agentin Core API — Production Entry Point
// Express + SQLite + JWT, production-hardened
// ============================================================

import { createApp, APP_VERSION } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { db } from './db/index.js';

import { initAutomationsEngine, initWeeklyReportScheduler } from './services/automations-engine.js';
import { initCleanupCron } from './services/cleanup.js';
import { initMemoryTables, startMemorySyncScheduler } from './services/memory.js';
import { initWorkflowTables } from './services/workflow-engine.js';
import { initTelegramBot } from './services/telegram.js';
import { initPicoFleetTables, ensureDefaultAgents, startPicoWorker } from './services/pico-fleet.js';
import { initSocialMediaTables } from './services/social-media.js';
import { seedDefaultTemplates } from './routes/templates.js';
import { startBriefingScheduler } from './services/daily-briefing.js';
import { startReminderScheduler } from './services/reminder-scheduler.js';
import { startHealthProbeCache } from './routes/health.js';
import { startModelSyncScheduler } from './services/model-sync.js';
import { startArtifactCleanupScheduler } from './services/artifact-cleanup.js';
import { startOllamaKeepalive } from './services/llm.js';

// Create the Express app using the factory
const app = createApp();

// ---- Graceful shutdown ----
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  // Force-exit after 10s to prevent hung processes during restart
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timeout (10s exceeded) — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref(); // Don't let this timer prevent normal exit
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
  initSocialMediaTables();
  ensureDefaultAgents();
  seedDefaultTemplates();

  // Health probe cache — runs in every worker
  startHealthProbeCache();

  // Schedulers, Telegram bot, and cron jobs — run ONLY in the primary worker
  const instanceId = process.env.NODE_APP_INSTANCE ?? 'standalone';
  const isMainWorker = instanceId === 'standalone' || instanceId === '0';
  logger.info({ instanceId, isMainWorker }, 'Cluster init');

  if (isMainWorker) {
    // Named wrappers so failures are logged with the scheduler name
    const safeStart = (name: string, fn: () => void | Promise<void>) => {
      try {
        const result = fn();
        if (result && typeof result.catch === 'function') {
          result.catch((err: unknown) => logger.error({ err, scheduler: name }, 'Scheduler startup failed'));
        }
      } catch (err) {
        logger.error({ err, scheduler: name }, 'Scheduler startup failed (sync)');
      }
    };

    safeStart('automations-engine', initAutomationsEngine);
    safeStart('pico-worker', startPicoWorker);
    safeStart('telegram-bot', () => initTelegramBot().catch(err => logger.warn({ err }, 'Telegram bot init failed (non-fatal)')));
    safeStart('ollama-keepalive', startOllamaKeepalive);
    safeStart('briefing-scheduler', startBriefingScheduler);
    safeStart('reminder-scheduler', startReminderScheduler);
    safeStart('memory-sync', startMemorySyncScheduler);
    safeStart('model-sync', startModelSyncScheduler);
    safeStart('artifact-cleanup', startArtifactCleanupScheduler);
    safeStart('db-cleanup-cron', initCleanupCron);
    safeStart('weekly-report-scheduler', initWeeklyReportScheduler);

    // Startup subsystem summary — visible in Docker logs for quick operator verification
    logger.info({
      telegram: !!config.telegramBotToken,
      whatsapp: !!(config.whatsappToken && config.whatsappBusinessId),
      email: !!(config.resendApiKey || config.smtpHost),
      ollama: config.ollamaBaseUrl,
      version: APP_VERSION,
    }, 'GeekSpace subsystem startup complete');
  } else {
    logger.info({ worker: instanceId }, 'Cluster worker — schedulers skipped');
  }
});
