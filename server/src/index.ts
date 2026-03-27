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
import { initMemoryTables, startMemorySyncScheduler, startWeeklySummaryScheduler } from './services/memory.js';
import { initWorkflowTables } from './services/workflow-engine.js';
import { initTelegramBot } from './services/telegram.js';
import { initPicoFleetTables, ensureDefaultAgents, startPicoWorker } from './services/pico-fleet.js';
import { initSocialMediaTables } from './services/social-media.js';
import { seedDefaultTemplates } from './routes/templates.js';
// DEPRECATED: briefing scheduler removed — proactive-engine.ts handles all scheduled briefings
// import { startBriefingScheduler } from './services/daily-briefing.js';
// startReminderScheduler and startHealthProbeCache now managed by module lifecycle hooks
import { healthModule } from './modules/health/index.js';
import { remindersModule } from './modules/reminders/index.js';
import { startModelSyncScheduler } from './services/model-sync.js';
import { startArtifactCleanupScheduler } from './services/artifact-cleanup.js';
import { initProactiveEngine } from './services/proactive-engine.js';
import { startCalendarSyncScheduler } from './services/calendar-sync.js';
import { startOllamaKeepalive } from './services/llm.js';
import { startGmailSyncScheduler } from './services/gmail-sync.js';

// Create the Express app using the factory
const app = createApp();

// ---- Graceful shutdown ----
function shutdown(signal: string, httpServer: import('http').Server) {
  logger.info(`Received ${signal} — stopping new connections, draining in-flight requests...`);

  // Force-exit after 10s to prevent hung processes during container restart
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timeout (10s exceeded) — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref(); // Don't block normal exit

  httpServer.close(() => {
    logger.info('HTTP server closed — no more in-flight requests');
    try { db.close(); } catch { /* ignore if already closed */ }
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });
}

// P2-3: Startup security configuration audit — log which critical keys are present/missing
// This runs once at boot so operators can spot misconfigured environments immediately
const securityAudit = {
  jwtSecret: !!process.env.JWT_SECRET,
  encryptionKey: !!process.env.ENCRYPTION_KEY,
  adminToken: !!process.env.ADMIN_TOKEN,
  stripeEnabled: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  tavilySearch: !!process.env.TAVILY_API_KEY,
  huggingFace: !!process.env.HF_TOKEN,
  openrouter: !!process.env.OPENROUTER_API_KEY,
  telegram: !!process.env.TELEGRAM_BOT_TOKEN,
};
const missingCritical = Object.entries(securityAudit)
  .filter(([k, v]) => !v && ['jwtSecret', 'encryptionKey'].includes(k))
  .map(([k]) => k);
if (missingCritical.length > 0) {
  logger.error({ missingKeys: missingCritical }, 'SECURITY: Critical environment variables missing — server may not work correctly');
} else {
  logger.info({ securityAudit }, 'Security configuration audit');
}

// ---- Start server ----
const httpServer = app.listen(config.port, () => {
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

  // Health probe cache — runs in every worker (via module lifecycle)
  healthModule.initialize?.();

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
    // DEPRECATED: briefing scheduler removed — proactive-engine.ts handles all scheduled briefings
    // safeStart('briefing-scheduler', startBriefingScheduler);
    safeStart('reminder-scheduler', () => remindersModule.initialize?.());
    safeStart('memory-sync', startMemorySyncScheduler);
    safeStart('memory-weekly-summary', startWeeklySummaryScheduler);
    safeStart('model-sync', startModelSyncScheduler);
    safeStart('artifact-cleanup', startArtifactCleanupScheduler);
    safeStart('db-cleanup-cron', initCleanupCron);
    safeStart('weekly-report-scheduler', initWeeklyReportScheduler);
    safeStart('proactive-engine', initProactiveEngine);
    safeStart('gmail-sync', startGmailSyncScheduler);
    safeStart('calendar-sync', startCalendarSyncScheduler);

    // Initialize Meilisearch + Qdrant (non-blocking, graceful if unavailable)
    safeStart('meilisearch-init', async () => {
      const { initMeilisearch, bulkIndexExistingData } = await import('./services/search-index.js');
      await initMeilisearch();
      await bulkIndexExistingData();
    });
    safeStart('qdrant-init', async () => {
      const { initQdrant } = await import('./services/search-vector.js');
      await initQdrant();
    });

    // Startup subsystem summary — visible in Docker logs for quick operator verification
    logger.info({
      telegram: !!config.telegramBotToken,
      whatsapp: !!(config.whatsappToken && config.whatsappBusinessId),
      email: !!(config.resendApiKey || config.smtpHost),
      ollama: config.ollamaBaseUrl,
      meilisearch: config.meilisearchUrl,
      qdrant: config.qdrantUrl,
      version: APP_VERSION,
    }, 'GeekSpace subsystem startup complete');

    // 49.9: Log DB row counts for key tables on startup — quick sanity check in operator logs
    try {
      const tables = ['users', 'reminders', 'automations', 'integrations', 'portfolios', 'activity_log'] as const;
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const row = db.prepare(`SELECT count(*) as cnt FROM ${table}`).get() as { cnt: number } | undefined;
        counts[table] = row?.cnt ?? 0;
      }
      logger.info({ dbRows: counts }, 'DB row counts at startup');
    } catch (err) {
      logger.warn({ err }, 'Could not read startup DB row counts (non-fatal)');
    }
  } else {
    logger.info({ worker: instanceId }, 'Cluster worker — schedulers skipped');
  }
});

process.on('SIGTERM', () => shutdown('SIGTERM', httpServer));
process.on('SIGINT', () => shutdown('SIGINT', httpServer));

// Catch unhandled promise rejections so stray async errors don't crash the process silently
process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: reason }, 'Unhandled promise rejection — this is a bug, please wrap async handlers');
});
process.on('uncaughtException', (err: Error) => {
  logger.error({ err }, 'Uncaught exception — shutting down');
  shutdown('uncaughtException', httpServer);
});
