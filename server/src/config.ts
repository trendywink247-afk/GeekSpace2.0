// ============================================================
// Validated environment configuration — crashes on missing required vars
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`FATAL: Required env var ${key} is not set.`);
    process.exit(1);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

const isProduction = optional('NODE_ENV', 'development') === 'production';

export const config = {
  env: optional('NODE_ENV', 'development'),
  isProduction,
  port: optionalInt('PORT', 3001),

  // JWT — required in production, has dev fallback
  jwtSecret: isProduction
    ? required('JWT_SECRET')
    : optional('JWT_SECRET', 'geekspace-dev-secret-CHANGE-IN-PRODUCTION'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '7d'),

  // CORS — comma-separated origins
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim()),

  // Database
  dbPath: optional('DB_PATH', './data/geekspace.db'),

  // Public URL
  publicUrl: optional('PUBLIC_URL', 'http://localhost:5173'),
  apiUrl: optional('API_URL', 'http://localhost:3001'),

  // Ollama (local brain)
  ollamaBaseUrl: optional('OLLAMA_BASE_URL', 'http://localhost:11434'),
  ollamaModel: optional('OLLAMA_MODEL', 'qwen2.5-coder:1.5b'),
  ollamaTimeout: optionalInt('OLLAMA_TIMEOUT_MS', 30000),

  // OpenRouter / OpenAI-compatible fallback (global brain)
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterBaseUrl: optional('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
  openrouterModel: optional('OPENROUTER_MODEL', 'anthropic/claude-sonnet-4-5-20250929'),

  // EDITH / OpenClaw — via edith-bridge (WS→HTTP bridge)
  edithGatewayUrl: process.env.EDITH_GATEWAY_URL || '',
  edithToken: process.env.EDITH_TOKEN || '',

  // Redis (job queue)
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',

  // Rate limiting
  rateLimitWindowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  rateLimitMax: optionalInt('RATE_LIMIT_MAX', 200),
  rateLimitAuthMax: optionalInt('RATE_LIMIT_AUTH_MAX', 10), // login/signup

  // Credits / billing
  premiumMonthlyCredits: optionalInt('PREMIUM_MONTHLY_CREDITS', 50000),
  trialDays: optionalInt('TRIAL_DAYS', 3),
  trialPremiumCredits: optionalInt('TRIAL_PREMIUM_CREDITS', 10000),

  // Request limits
  maxRequestBodyBytes: optionalInt('MAX_REQUEST_BODY_BYTES', 1024 * 1024), // 1MB

  // Logging
  logLevel: optional('LOG_LEVEL', isProduction ? 'info' : 'debug'),

  // API key encryption (required in production)
  encryptionKey: isProduction
    ? required('ENCRYPTION_KEY')
    : optional('ENCRYPTION_KEY', 'dev-encryption-key-32-chars-long!'),

  // Demo data
  seedDemoData: !isProduction && optional('SEED_DEMO_DATA', 'true') === 'true',
} as const;
