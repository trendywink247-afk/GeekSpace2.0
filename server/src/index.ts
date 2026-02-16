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

import { edithProbe } from './services/edith.js';
import { picoClawProbe } from './services/picoclaw.js';
import { initAutomationsEngine } from './services/automations-engine.js';
import { initMemoryTables } from './services/memory.js';
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

// ---- Trust proxy (Caddy/nginx reverse proxy) ----
// Required for correct client IP in rate limiting and logging
app.set('trust proxy', 1);

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

// ---- Health check with live component probing ----
app.get('/api/health', async (_req, res) => {
  let dbOk = false;
  try {
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    dbOk = row?.ok === 1;
  } catch { /* db not ready */ }

  // Live probe: Ollama
  let ollamaOk = false;
  if (config.ollamaBaseUrl) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(timer);
      ollamaOk = r.ok;
    } catch { /* unreachable */ }
  }

  // Live probe: EDITH / OpenClaw — uses the shared edithProbe() which
  // correctly rejects HTML responses and handles 401/403/405 as "reachable"
  const edithOk = await edithProbe();

  // Live probe: PicoClaw (Brain 4 sidecar)
  const picoOk = config.picoClawEnabled ? await picoClawProbe() : false;

  const allOk = dbOk;  // core requirement
  const code = allOk ? 200 : 503;

  res.status(code).json({
    ok: allOk,
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '2.3.0',
    uptime: Math.floor(process.uptime()),
    edith: edithOk,
    ollama: ollamaOk,
    picoclaw: picoOk,
    components: {
      database: dbOk ? 'ok' : 'down',
      ollama: ollamaOk ? 'reachable' : (config.ollamaBaseUrl ? 'unreachable' : 'not_configured'),
      openrouter: config.openrouterApiKey ? 'configured' : 'not_configured',
      edith: edithOk ? 'reachable' : (config.edithGatewayUrl ? 'unreachable' : 'not_configured'),
      picoclaw: picoOk ? 'reachable' : (config.picoClawEnabled ? 'unreachable' : 'not_configured'),
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
  }, `GeekSpace API v2.3.0 running on :${config.port}`);

  // Initialize subsystems
  initMemoryTables();
  initAutomationsEngine();
});
