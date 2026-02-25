// ============================================================
// Agentin App Factory — Express app without server start
// Used by both production (index.ts) and tests
// ============================================================

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { type Options as RateLimitOptions } from 'express-rate-limit';
import passport from 'passport';

import { config } from './config.js';
import { logger, requestLogger } from './logger.js';
import { errorHandler } from './middleware/errors.js';
import { db } from './db/index.js';

import { authRouter } from './routes/auth.js';
import { oauthRouter } from './routes/oauth.js';
import { routingDebugRouter } from './routes/debug-routing.js';
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
import { imagesRouter } from './routes/images.js';
import { videosRouter } from './routes/videos.js';
import { socialMediaRouter } from './routes/social-media.js';
import { activityRouter } from './routes/activity.js';
import { routesListRouter } from './routes/routes-list.js';
import { healthRouter, getCachedComponents } from './routes/health.js';
import { adminRouter, serveAdminDashboard } from './routes/admin.js';
import { devRouter } from './routes/dev.js';
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
  // NOTE (Risk R11): script-src uses 'self' without nonces. Nonce-based CSP would require
  // frontend templating changes that are out of scope. style-src uses 'unsafe-inline' for
  // Tailwind/shadcn inline styles. Both are documented in the risk register as accepted risks.
  app.use(helmet({
    contentSecurityPolicy: config.isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://openrouter.ai", "wss:"],
        frameSrc: ["'none'"],
        // Prevent embedding in iframes — defence-in-depth alongside X-Frame-Options: DENY
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        // Force HTTP resources to upgrade to HTTPS (safe, widely supported)
        upgradeInsecureRequests: [],
      },
    } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
  }));

  // 48.7: Permissions-Policy header — restrict browser APIs to those the app actually uses
  app.use((_req, res, next) => {
    res.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()');
    next();
  });

  // ---- CORS ----
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Admin-Password'],
  }));

  // ---- 47.8: Response compression (gzip/deflate) ----
  // Applied before body parsing so all responses (JSON, HTML, SSE) can be compressed.
  // SSE streams are excluded automatically because they flush headers before compression kicks in.
  app.use(compression());

  // ---- Body parsing ----
  app.use(express.json({ limit: `${config.maxRequestBodyBytes}` }));

  // ---- Passport initialization (for OAuth) ----
  app.use(passport.initialize());

  // ---- Request timeout (29.3) — 30s for all routes ----
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setTimeout(30000, () => {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Request timeout' });
      }
    });
    next();
  });

  // ---- Request logging ----
  app.use(requestLogger);

  // ---- Metrics collection ----
  app.use(metricsMiddleware);

  // ---- Rate limiting (disabled in TEST_MODE) ----
  const enableRateLimiting = !config.isTestMode;

  if (enableRateLimiting) {
    // Shared handler: adds Retry-After header to all 429 responses
    const rateLimitHandler = (_req: express.Request, res: express.Response, _next: express.NextFunction, options: RateLimitOptions) => {
      // RateLimit-Reset is epoch seconds (express-rate-limit v8 standardHeaders)
      const resetEpochSec = (res.getHeader('RateLimit-Reset') as number) || 0;
      const retryAfterSecs = resetEpochSec
        ? Math.max(1, Math.ceil(resetEpochSec - Date.now() / 1000))
        : Math.ceil((options.windowMs ?? 60000) / 1000);
      res.setHeader('Retry-After', retryAfterSecs);
      res.status(options.statusCode ?? 429).json(typeof options.message === 'object' ? options.message : { error: options.message });
    };

    // Global rate limiting
    const globalLimiter = rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please slow down.' },
      handler: rateLimitHandler,
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
      handler: rateLimitHandler,
    });
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/demo', authLimiter);

    // 47.7: Signup rate limit — 5 req/15min including successful requests to prevent account spam
    // Intentionally does NOT use skipSuccessfulRequests so successful account creations are counted.
    const signupLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many registration attempts. Try again in 15 minutes.' },
      handler: rateLimitHandler,
    });
    app.use('/api/auth/signup', signupLimiter);

    // Rate limit on LLM chat endpoints — 60 req/15min (4/min) balances protection with usability
    const chatLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many chat requests. Please slow down.' },
      handler: rateLimitHandler,
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
      handler: rateLimitHandler,
    });
    app.use('/api/agent/chat/public', publicLimiter);
    app.use('/api/dashboard/contact', publicLimiter);

    // Strict rate limit on admin endpoints — 10 requests per minute
    // Admin routes are sensitive (user management, system ops) so apply a tight window
    const adminLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many admin requests, please slow down' },
      handler: rateLimitHandler,
    });
    app.use('/api/admin', adminLimiter);
  }

  // ---- Health check ----
  app.get('/api/health', (_req, res) => {
    // 47.1: Live DB check on every call so db status is always fresh (not just cached probe)
    let liveDbStatus = 'ok';
    try {
      const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
      liveDbStatus = row?.ok === 1 ? 'ok' : 'error';
    } catch {
      liveDbStatus = 'error';
    }
    const components = { ...getCachedComponents(), database: liveDbStatus }; // merge live DB over cached
    const metrics = getMetricsSnapshot();
    const allOk = components.database === 'ok';

    // Build topEndpoints so the REST fallback gives HealthDashboardPage the same shape as SSE
    const topEndpoints = Object.entries(metrics.endpoints)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        errors: stats.errors,
        avgMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
      }));

    res.status(allOk ? 200 : 503).json({
      timestamp: new Date().toISOString(),
      cacheAgeMs: null, // not available in REST context
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
      topEndpoints,
      ok: allOk,
      status: allOk ? 'ok' : 'degraded',
      version: APP_VERSION,
      build: {
        version: process.env.npm_package_version ?? '3.0.0',
        nodeVersion: process.versions.node,
        platform: process.platform,
      },
    });
  });

  // ---- 47.9: Version endpoint — app version + git SHA + env ----
  // Unauthenticated by design (used by deployment tooling and health dashboards).
  app.get('/api/version', (_req, res) => {
    res.json({
      version: APP_VERSION,
      gitSha: process.env.GIT_SHA ?? 'unknown',
      env: config.isProduction ? 'production' : 'development',
      buildTime: process.env.BUILD_TIME ?? new Date().toISOString(),
      nodeVersion: process.versions.node,
    });
  });

  // ---- 46.9: Readiness probe — checks DB connectivity ----
  // Unauthenticated by design (used by orchestration/K8s readiness probes).
  // Returns 200 when the database is reachable, 503 when it is not.
  app.get('/api/ready', (_req, res) => {
    try {
      const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
      if (row?.ok === 1) {
        res.status(200).json({ status: 'ready', db: 'ok' });
      } else {
        res.status(503).json({ status: 'not ready', db: 'error', message: 'DB query returned unexpected result' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      res.status(503).json({ status: 'not ready', db: 'error', message });
    }
  });

  // ---- Redirect stale /api/api/* double-prefix requests ----
  app.use('/api/api', (req, res) => {
    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(301, `/api${req.path}${qs}`);
  });

  // ---- Mount routes ----
  app.use('/api/auth', authRouter);
  app.use('/api/oauth', oauthRouter);
  app.use('/api/debug', routingDebugRouter);
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
  app.use('/api/dev', devRouter);
  app.use('/api/artifacts', artifactsRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/images', imagesRouter);
  app.use('/api/videos', videosRouter);
  app.use('/api/social-media', socialMediaRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/routes', routesListRouter);

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

  // ---- Root redirect ----
  app.get('/', (_req, res) => res.redirect('/admin'));

  // ---- Admin dashboard ----
  app.get('/admin', serveAdminDashboard);

  // ---- Global error handler (MUST be last) ----
  app.use(errorHandler);

  return app;
}

export { APP_VERSION };
