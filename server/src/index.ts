import 'apminsight';
// ============================================================
// GeekSpace Core API — Express + SQLite + JWT
// Production-hardened with helmet, pino, validation, error handling
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { logger, requestLogger } from './logger.js';
import { errorHandler } from './middleware/errors.js';
import { db } from './db/index.js';

import { initAutomationsEngine } from './services/automations-engine.js';
import { initMemoryTables, startMemorySyncScheduler } from './services/memory.js';
import { initWorkflowTables } from './services/workflow-engine.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { agentRouter } from './routes/agent.js';
import { usageRouter } from './routes/usage.js';
import { integrationsRouter } from './routes/integrations.js';
import { remindersRouter } from './routes/reminders.js';
import { portfolioRouter } from './routes/portfolio.js';
import { automationsRouter } from './routes/automations.js';
import { dashboardRouter } from './routes/dashboard.js';
import { directoryRouter } from './routes/directory.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import { featuresRouter } from './routes/features.js';
import { billingRouter } from './routes/billing.js';
import { modelsRouter } from './routes/models.js';
import { webhooksRouter } from './routes/webhooks.js';
import { initTelegramBot } from './services/telegram.js';
import { initPicoFleetTables, ensureDefaultAgents, startPicoWorker } from './services/pico-fleet.js';
import { picoRouter } from './routes/pico.js';
import { briefingsRouter } from './routes/briefings.js';
import { recipesRouter } from './routes/recipes.js';
import { artifactsRouter } from './routes/artifacts.js';
import { templatesRouter, seedDefaultTemplates } from './routes/templates.js';
import testRouter from './routes/test.js';
import { startBriefingScheduler } from './services/daily-briefing.js';
import { startReminderScheduler } from './services/reminder-scheduler.js';
import { metricsMiddleware, getMetricsSnapshot } from './middleware/metrics.js';
import { healthRouter, getCachedComponents, startHealthProbeCache } from './routes/health.js';
import { adminRouter, serveAdminDashboard } from './routes/admin.js';
import { startModelSyncScheduler } from './services/model-sync.js';
import { startArtifactCleanupScheduler } from './services/artifact-cleanup.js';
import { generateOutput, packageAsTodo, packageAsPlan, packageAsPDF, summarizeChat } from './services/output-generator.js';
import { createProjectFromChat, detectProjectFromChat, getProjectSuggestionText } from './services/chat-to-project.js';
import { requireAuth } from './middleware/auth.js';

const APP_VERSION = '3.0.0';

const app = express();

// ---- Trust proxy (Caddy/nginx reverse proxy) ----
// Required for correct client IP in rate limiting and logging
app.set('trust proxy', 1);

// ---- Security headers ----
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://openrouter.ai", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
}));

// ---- CORS — from config, not hardcoded ----
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Admin-Password'],
}));

// ---- Body parsing with size limit ----
app.use(express.json({ limit: `${config.maxRequestBodyBytes}` }));

// ---- Request logging + ID tracking ----
app.use(requestLogger);

// ---- Metrics collection for health dashboard ----
app.use(metricsMiddleware);

// ---- Global rate limiting ----
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/api/health/stream' || req.path === '/api/health',
});
app.use('/api/', globalLimiter);

// ---- Strict rate limit on auth endpoints ----
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimitAuthMax,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/demo', authLimiter);

// ---- Rate limit on LLM chat endpoints (expensive) ----
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat requests. Please slow down.' },
});
app.use('/api/agent/chat', chatLimiter);
app.use('/api/agent/chat/stream', chatLimiter);

// ---- Strict rate limit on public (unauthenticated) endpoints ----
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/agent/chat/public', publicLimiter);
app.use('/api/dashboard/contact', publicLimiter);

// ---- Health check — served from 30s background cache (no live probing per request) ----
// Returns same structure as SSE stream for frontend compatibility
app.get('/api/health', (_req, res) => {
  const components = getCachedComponents();
  const metrics = getMetricsSnapshot();
  const allOk = components.database === 'ok';

  res.status(allOk ? 200 : 503).json({
    timestamp: new Date().toISOString(),
    components,
    metrics: {
      totalRequests: metrics.totalRequests,
      totalErrors: metrics.totalErrors,
      avgLatencyMs: metrics.avgLatencyMs,
      requestsPerMinute: metrics.requestsPerMinute,
      activeConnections: metrics.activeConnections,
    },
    system: {
      uptime: metrics.uptime,
      memoryMb: metrics.memoryMb,
    },
    topEndpoints: Object.entries(metrics.endpoints)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        errors: stats.errors,
        avgMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
      })),
    // Legacy fields for backwards compatibility
    ok: allOk,
    status: allOk ? 'ok' : 'degraded',
    version: APP_VERSION,
  });
});

// ---- Redirect stale /api/api/* double-prefix requests ----
// Stale frontend builds may request /api/api/health/stream etc.
// Redirect to the correct single-prefix path instead of 404-ing.
app.use('/api/api', (req, res) => {
  const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(301, `/api${req.path}${qs}`);
});

// ---- Mount routes ----
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/agent', agentRouter);
app.use('/api/usage', usageRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/automations', automationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/directory', directoryRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/features', featuresRouter);
app.use('/api/billing', billingRouter);
app.use('/api/models', modelsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/pico', picoRouter);
app.use('/api/briefings', briefingsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/health', healthRouter);
app.use('/api/admin', adminRouter);
app.use('/api/artifacts', artifactsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/test', testRouter);

// ---- Output Generator Routes (Authenticated) ----
app.post('/api/outputs/generate', requireAuth, async (req, res) => {
  const { format, title, content, metadata } = req.body;
  const userId = (req as any).userId;
  if (!format || !title || !content) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const result = await generateOutput({ userId, format, title, content, metadata });
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Output generation failed');
    res.status(500).json({ error: 'Failed to generate output' });
  }
});

app.post('/api/outputs/todo', requireAuth, async (req, res) => {
  const { title, content, actionItems } = req.body;
  const userId = (req as any).userId;

  try {
    const result = await packageAsTodo(userId, title || 'To-Do List', content, actionItems);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Todo packaging failed');
    res.status(500).json({ error: 'Failed to create todo list' });
  }
});

app.post('/api/outputs/plan', requireAuth, async (req, res) => {
  const { title, content, steps } = req.body;
  const userId = (req as any).userId;

  try {
    const result = await packageAsPlan(userId, title || 'Plan', content, steps);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Plan packaging failed');
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

app.post('/api/outputs/pdf', requireAuth, async (req, res) => {
  const { title, content, metadata } = req.body;
  const userId = (req as any).userId;

  try {
    const result = await packageAsPDF(userId, title || 'Document', content, metadata);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'PDF generation failed');
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.post('/api/outputs/summarize', requireAuth, async (req, res) => {
  const { messages } = req.body;
  const userId = (req as any).userId;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'Messages array required' });

  try {
    const summary = await summarizeChat(userId, messages);
    res.json({ success: true, summary });
  } catch (err) {
    logger.error({ err }, 'Chat summarization failed');
    res.status(500).json({ error: 'Failed to summarize chat' });
  }
});

// ---- Chat-to-Project Routes ----
app.post('/api/chat/detect-project', requireAuth, (req, res) => {
  const { messages, detectedIntent, artifactsCreated, actionsTaken } = req.body;
  const userId = (req as any).userId;

  const detected = detectProjectFromChat({
    userId,
    messages: messages || [],
    detectedIntent,
    artifactsCreated,
    actionsTaken,
  });

  if (detected) {
    res.json({
      detected: true,
      project: detected,
      suggestionText: getProjectSuggestionText(detected),
    });
  } else {
    res.json({ detected: false });
  }
});

app.post('/api/chat/create-project', requireAuth, async (req, res) => {
  const { project, autoCreate } = req.body;
  const userId = (req as any).userId;
  if (!project) return res.status(400).json({ error: 'Project data required' });

  try {
    const result = await createProjectFromChat(userId, project, { autoCreate });
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Project creation from chat failed');
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ---- Subdomain middleware for artifact custom domains ----
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const baseDomain = config.publicUrl.replace(/^https?:\/\//, '');

  // Check if this is a subdomain request
  if (host !== baseDomain && host.endsWith(baseDomain)) {
    const subdomain = host.replace(`.${baseDomain}`, '').split(':')[0];

    // Look up artifact by subdomain
    const domain = db.prepare('SELECT artifact_id, user_id FROM artifact_domains WHERE subdomain = ? AND is_active = 1').get(subdomain) as {
      artifact_id: string;
      user_id: string;
    } | undefined;

    if (domain) {
      // Rewrite URL to preview route
      req.url = `/preview/${domain.user_id}/${domain.artifact_id}`;
    }
  }
  next();
});

// ---- Public artifact preview (must be before /admin catch-all) ----
app.use('/preview', artifactsRouter);

app.get('/admin', serveAdminDashboard);

// ---- Global error handler (MUST be last) ----
app.use(errorHandler);

// ---- Graceful shutdown ----
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  db.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---- Start ----
app.listen(config.port, () => {
  logger.info({
    port: config.port,
    env: config.env,
    corsOrigins: config.corsOrigins,
    ollamaUrl: config.ollamaBaseUrl,
  }, `GeekSpace API v${APP_VERSION} running on :${config.port}`);

  // Idempotent table migrations — safe to run in every cluster worker
  initMemoryTables();
  initWorkflowTables();
  initPicoFleetTables();
  ensureDefaultAgents();
  seedDefaultTemplates();

  // Health probe cache — runs in every worker (own 30s timer per process)
  startHealthProbeCache();

  // Schedulers, Telegram bot, and cron jobs — run ONLY in the primary worker.
  // In PM2 cluster mode NODE_APP_INSTANCE is '0' for the primary worker.
  // In non-cluster mode (dev/local) the variable is undefined — run everything.
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
