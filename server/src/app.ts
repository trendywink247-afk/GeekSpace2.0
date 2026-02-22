// ============================================================
// GeekSpace App Factory — Express app without server start
// Used by both production (index.ts) and tests
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { logger, requestLogger } from './logger.js';
import { errorHandler } from './middleware/errors.js';
import { db } from './db/index.js';

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
import { picoRouter } from './routes/pico.js';
import { briefingsRouter } from './routes/briefings.js';
import { recipesRouter } from './routes/recipes.js';
import { artifactsRouter } from './routes/artifacts.js';
import { templatesRouter } from './routes/templates.js';
import { healthRouter } from './routes/health.js';
import { adminRouter, serveAdminDashboard } from './routes/admin.js';
import { metricsMiddleware, getMetricsSnapshot } from './middleware/metrics.js';
import { requireAuth } from './middleware/auth.js';
import {
  generateOutput,
  packageAsTodo,
  packageAsPlan,
  packageAsPDF,
  summarizeChat,
} from './services/output-generator.js';
import { createProjectFromChat, detectProjectFromChat, getProjectSuggestionText } from './services/chat-to-project.js';

// Import test routes conditionally (only in test mode)
import testRouter from './routes/test.js';

const APP_VERSION = '3.0.0';

/**
 * Create and configure the Express application
 * This factory function wires up the app exactly like production
 */
export function createApp(): express.Application {
  const app = express();

  // ---- Trust proxy (Caddy/nginx reverse proxy) ----
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

  // ---- CORS ----
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Admin-Password'],
  }));

  // ---- Body parsing ----
  app.use(express.json({ limit: `${config.maxRequestBodyBytes}` }));

  // ---- Request logging ----
  app.use(requestLogger);

  // ---- Metrics collection ----
  app.use(metricsMiddleware);

  // ---- Rate limiting (disabled in TEST_MODE) ----
  const enableRateLimiting = !config.isTestMode;

  if (enableRateLimiting) {
    // Global rate limiting
    const globalLimiter = rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please slow down.' },
      skip: (req) =>
        req.path === '/health/stream' ||
        req.path === '/health',
    });
    app.use('/api/', globalLimiter);

    // Strict rate limit on auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: config.rateLimitAuthMax,
      skipSuccessfulRequests: true,
      message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    });
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/signup', authLimiter);
    app.use('/api/auth/demo', authLimiter);

    // Rate limit on LLM chat endpoints
    const chatLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many chat requests. Please slow down.' },
    });
    app.use('/api/agent/chat', chatLimiter);
    app.use('/api/agent/chat/stream', chatLimiter);

    // Strict rate limit on public endpoints
    const publicLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please try again later.' },
    });
    app.use('/api/agent/chat/public', publicLimiter);
    app.use('/api/dashboard/contact', publicLimiter);
  }

  // ---- Health check ----
  app.get('/api/health', (_req, res) => {
    const components = { database: 'ok' };
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
      ok: allOk,
      status: allOk ? 'ok' : 'degraded',
      version: APP_VERSION,
    });
  });

  // ---- Redirect stale /api/api/* double-prefix requests ----
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

  // ---- Test routes (only in test mode) ----
  if (config.isTestMode) {
    app.use('/api/test', testRouter);
  }

  // ---- Output Generator Routes (Authenticated) ----
  app.post('/api/outputs/generate', requireAuth, async (req, res) => {
    const { format, title, content, metadata } = req.body;
    const userId = (req as unknown as { userId: string }).userId;
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
    const userId = (req as unknown as { userId: string }).userId;

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
    const userId = (req as unknown as { userId: string }).userId;

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
    const userId = (req as unknown as { userId: string }).userId;

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
    const userId = (req as unknown as { userId: string }).userId;
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
    const userId = (req as unknown as { userId: string }).userId;

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
    const userId = (req as unknown as { userId: string }).userId;
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

    if (host !== baseDomain && host.endsWith(baseDomain)) {
      const subdomain = host.replace(`.${baseDomain}`, '').split(':')[0];
      const domain = db.prepare('SELECT artifact_id, user_id FROM artifact_domains WHERE subdomain = ? AND is_active = 1').get(subdomain) as {
        artifact_id: string;
        user_id: string;
      } | undefined;

      if (domain) {
        req.url = `/preview/${domain.user_id}/${domain.artifact_id}`;
      }
    }
    next();
  });

  // ---- Public artifact preview ----
  app.use('/preview', artifactsRouter);

  // ---- Admin dashboard ----
  app.get('/admin', serveAdminDashboard);

  // ---- Global error handler (MUST be last) ----
  app.use(errorHandler);

  return app;
}

export { APP_VERSION };
