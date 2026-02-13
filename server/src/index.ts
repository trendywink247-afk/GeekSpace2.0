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

const app = express();

// ---- Security headers ----
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false,
}));

// ---- CORS — from config, not hardcoded ----
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// ---- Body parsing with size limit ----
app.use(express.json({ limit: `${config.maxRequestBodyBytes}` }));

// ---- Request logging + ID tracking ----
app.use(requestLogger);

// ---- Global rate limiting ----
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
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

// ---- Health check with component status ----
app.get('/api/health', (_req, res) => {
  let dbOk = false;
  try {
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    dbOk = row?.ok === 1;
  } catch { /* db not ready */ }

  const status = dbOk ? 'ok' : 'degraded';
  const code = dbOk ? 200 : 503;

  res.status(code).json({
    status,
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    uptime: Math.floor(process.uptime()),
    components: {
      database: dbOk ? 'ok' : 'down',
      ollama: config.ollamaBaseUrl ? 'configured' : 'not_configured',
      openrouter: config.openrouterApiKey ? 'configured' : 'not_configured',
      edith: config.edithGatewayUrl ? 'configured' : 'not_configured',
    },
  });
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
  }, `GeekSpace API v2.1.0 running on :${config.port}`);
});
