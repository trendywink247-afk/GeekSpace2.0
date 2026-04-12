/**
 * @module config
 *
 * Centralized, validated environment configuration for the Agentin backend.
 *
 * All environment variables are read once at startup via `dotenv` and exposed
 * through a single frozen `config` object. Variables marked **required** in
 * production (JWT_SECRET, ENCRYPTION_KEY) trigger a hard `process.exit(1)`
 * if missing, preventing the server from starting in an insecure state.
 * Optional variables fall back to sensible development defaults.
 *
 * The config is organized into sections: server basics, JWT/auth, CORS,
 * database, LLM providers (Ollama, OpenRouter, Groq, Kimi, Gemini, Together),
 * integrations (Telegram, WhatsApp, n8n, Stripe, Razorpay), rate limiting,
 * credits/billing, and infrastructure (Redis, Meilisearch, Qdrant).
 *
 * **Security note:** API keys and secrets are read from `process.env` and
 * stored in memory only -- they are never logged or serialized to disk.
 */

// ============================================================
// Validated environment configuration -- crashes on missing required vars
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
const isTestMode = process.env.TEST_MODE === 'true' || process.env.TEST_MODE === '1';

/**
 * Immutable application configuration object (`as const`). Accessing any
 * property is safe at runtime -- required vars have already been validated.
 *
 * @see The module-level JSDoc for the full section breakdown.
 */
export const config = {
  env: optional('NODE_ENV', 'development'),
  isProduction,
  isTestMode,
  port: optionalInt('PORT', 3001),

  // JWT — required in production, has dev fallback
  jwtSecret: isProduction
    ? required('JWT_SECRET')
    : optional('JWT_SECRET', 'geekspace-dev-secret-CHANGE-IN-PRODUCTION'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '15m'),

  // CORS — comma-separated origins.
  // Default is the production domains. For local development, set CORS_ORIGINS in .env:
  //   CORS_ORIGINS=http://localhost:5173,http://localhost:4173
  corsOrigins: optional('CORS_ORIGINS', 'https://ai.agentin.chat,https://staging.agentin.chat')
    .split(',')
    .map((s) => s.trim()),

  // Database
  dbPath: optional('DB_PATH', './data/geekspace.db'),

  // Public URL
  publicUrl: optional('PUBLIC_URL', 'http://localhost:5173'),
  apiUrl: optional('API_URL', 'http://localhost:3001'),

  // Ollama (local engine)
  ollamaBaseUrl: optional('OLLAMA_BASE_URL', 'http://localhost:11434'),
  ollamaModel: optional('OLLAMA_MODEL', 'gemma4:e4b'),
  ollamaComplexModel: optional('OLLAMA_COMPLEX_MODEL', 'gemma4:e4b'),
  ollamaTimeout: optionalInt('OLLAMA_TIMEOUT_MS', 90000),
  ollamaMaxTokens: optionalInt('OLLAMA_MAX_TOKENS', 4096),
  ollamaThinkingEnabled: optional('OLLAMA_THINKING_ENABLED', 'true') === 'true',

  // OpenRouter / OpenAI-compatible fallback (cloud engine)
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterBaseUrl: optional('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
  openrouterModel: optional('OPENROUTER_MODEL', 'claude-sonnet-4-6'),
  openrouterTimeout: optionalInt('OPENROUTER_TIMEOUT_MS', 90000),
  openrouterMaxTokens: optionalInt('OPENROUTER_MAX_TOKENS', 1024),
  openrouterFreeModel: optional('OPENROUTER_FREE_MODEL', 'meta-llama/llama-3.3-70b-instruct:free'),
  openrouterFreeBaseUrl: optional('OPENROUTER_FREE_BASE_URL', 'https://openrouter.ai/api/v1'),
  openrouterFreeApiKey: process.env.OPENROUTER_FREE_API_KEY || '',

  // [DEPRECATED] EDITH / OpenClaw — via edith-bridge (WS→HTTP bridge), replaced by direct Moonshot API
  edithGatewayUrl: process.env.EDITH_GATEWAY_URL || '', // [DEPRECATED]
  edithToken: process.env.EDITH_TOKEN || '', // [DEPRECATED]

  // Moonshot reasoning model (heavy tasks — uses same API key as openrouter)
  moonshotReasoningModel: optional('MOONSHOT_REASONING_MODEL', 'kimi-k2-thinking'),
  moonshotTimeout: optionalInt('MOONSHOT_TIMEOUT_MS', 120000),
  moonshotMaxTokens: optionalInt('MOONSHOT_MAX_TOKENS', 8192),

  // Moonshot direct API (api.moonshot.cn — used for Logo AI suggestions)
  moonshotDirectApiKey: process.env.MOONSHOT_DIRECT_API_KEY || '',
  moonshotDirectBaseUrl: optional('MOONSHOT_DIRECT_BASE_URL', 'https://api.moonshot.ai/v1'),
  moonshotDirectModel: optional('MOONSHOT_DIRECT_MODEL', 'kimi-k2.5'),
  // NOTE P3: Together AI and OllamaCloud removed — no API keys, dead providers

  // HuggingFace (image generation fallback — FLUX.1-schnell)
  hfToken: process.env.HF_TOKEN || '',

  // fal.ai — Seedance Director Mode video generation
  falApiKey: process.env.FAL_KEY || '',
  falEnabled: !!process.env.FAL_KEY,

  // PicoClaw (lightweight automation engine)
  picoClawUrl: optional('PICOCLAW_URL', 'http://localhost:8080'),
  picoClawEnabled: optional('PICOCLAW_ENABLED', 'false') === 'true',
  picoClawTimeout: optionalInt('PICOCLAW_TIMEOUT_MS', 5000),

  // Pico-Kimi Bridge (orchestration layer)
  bridgeEnabled: optional('BRIDGE_ENABLED', 'false') === 'true',
  bridgeMaxWorkflowSteps: optionalInt('BRIDGE_MAX_WORKFLOW_STEPS', 6),
  bridgeAutoEscalate: optional('BRIDGE_AUTO_ESCALATE', 'true') === 'true', // Auto-detect complex requests

  // Redis (job queue)
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  // OpenAI (kept for optional future use)
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // Voice: TTS fallback chain (Kokoro → Piper → edge-tts) + STT (whisper.cpp → Groq Whisper)
  edgeTtsBin: optional('EDGE_TTS_BIN', '/opt/tts-venv/bin/edge-tts'),
  ttsVoice: optional('TTS_VOICE', 'en-US-AriaNeural'),
  kokoroTtsUrl: optional('KOKORO_TTS_URL', 'http://kokoro-tts:5101'),
  kokoroTtsEnabled: optional('KOKORO_TTS_ENABLED', 'true') === 'true',
  piperTtsUrl: optional('PIPER_TTS_URL', 'http://piper-tts:5100'),
  piperTtsEnabled: optional('PIPER_TTS_ENABLED', 'true') === 'true',
  whisperLocalUrl: optional('WHISPER_LOCAL_URL', 'http://whisper-stt:5102'),
  whisperLocalEnabled: optional('WHISPER_LOCAL_ENABLED', 'true') === 'true',

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',

  // WhatsApp Business (future phase)
  whatsappBusinessId: process.env.WHATSAPP_BUSINESS_ID || '',
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  whatsappBusinessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '',

  // n8n (workflow automation)
  n8nBaseUrl: optional('N8N_BASE_URL', 'http://n8n:5678'),
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || '',

  // Rate limiting
  rateLimitWindowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  rateLimitMax: optionalInt('RATE_LIMIT_MAX', 500),
  rateLimitAuthMax: optionalInt('RATE_LIMIT_AUTH_MAX', 10), // login/signup

  // Credits / billing
  premiumMonthlyCredits: optionalInt('PREMIUM_MONTHLY_CREDITS', 50000),
  trialDays: optionalInt('TRIAL_DAYS', 3),
  trialPremiumCredits: optionalInt('TRIAL_PREMIUM_CREDITS', 10000),

  // Session
  sessionIdleTimeoutMs: optionalInt('SESSION_IDLE_TIMEOUT_MS', 30 * 60 * 1000), // 30 min

  // Request limits
  maxRequestBodyBytes: optionalInt('MAX_REQUEST_BODY_BYTES', 1024 * 1024), // 1MB

  // Logging
  logLevel: optional('LOG_LEVEL', isProduction ? 'info' : 'debug'),

  // API key encryption (required in production)
  encryptionKey: isProduction
    ? required('ENCRYPTION_KEY')
    : optional('ENCRYPTION_KEY', 'dev-encryption-key-32-chars-long!'),

  // Pico Fleet worker
  picoWorkerIntervalMs: optionalInt('PICO_WORKER_INTERVAL_MS', 10000),
  picoIdleIntervalMs: optionalInt('PICO_IDLE_INTERVAL_MS', 300000), // 5 min default

  // Resend email
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: optional('RESEND_FROM_EMAIL', 'agent@agentin.chat'),

  // SMTP (optional — used if Resend not configured)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: optionalInt('SMTP_PORT', 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: optional('SMTP_FROM', 'noreply@geekspace.app'),

  // Admin dashboard
  adminDashboardPassword: process.env.ADMIN_DASHBOARD_PASSWORD || '',
  adminToken: optional('ADMIN_TOKEN', ''),

  // Docker tool services
  crawl4aiUrl: optional('CRAWL4AI_URL', 'http://crawl4ai-ykgs-crawl4ai-1:11235'),
  windmillUrl: optional('WINDMILL_URL', 'http://windmill-95s4-windmill_server-1:8000'),
  windmillToken: process.env.WINDMILL_TOKEN || '',

  // DevClaw Bridge
  githubDevToken: process.env.GITHUB_DEV_TOKEN || '',
  devRunnerTimeoutMs: optionalInt('DEV_RUNNER_TIMEOUT_MS', 300000), // 5 min

  // OAuth - Google & GitHub
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',

  // Gate (Caddy access gate — cookie + password verification)
  gateCookieValue: optional('GATE_COOKIE_VALUE', 'dev-gate-cookie'),
  gatePasswordHash: optional('GATE_PASSWORD_HASH', ''),

  // Demo data
  seedDemoData: !isProduction && optional('SEED_DEMO_DATA', 'true') === 'true',

  // 83.5: Invite-gated registration (set INVITE_REQUIRED=true to enable)
  inviteRequired: optional('INVITE_REQUIRED', 'false') === 'true',

  // Stripe billing (Phase 89)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripeBasicPriceId: process.env.STRIPE_BASIC_PRICE_ID || '',
  stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  stripeEnabled: !!process.env.STRIPE_SECRET_KEY,

  // Razorpay billing (INR payments)
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayEnabled: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),

  // ---- Meilisearch (typo-tolerant instant search) ----
  meilisearchUrl: optional('MEILISEARCH_URL', 'http://geekspace-meilisearch:7700'),
  meilisearchApiKey: optional('MEILISEARCH_API_KEY', 'agentin-meili-2026'),

  // ---- Qdrant (vector DB for semantic memory) ----
  qdrantUrl: optional('QDRANT_URL', 'http://geekspace-qdrant:6333'),

  // ---- Embedding (via Ollama nomic-embed-text) ----
  embeddingModel: optional('EMBEDDING_MODEL', 'nomic-embed-text'),

  // ---- Groq (free tier — Llama 3.3 70B, 14,400 req/day free) ----
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqApiKey2: process.env.GROQ_API_KEY_2 ?? '',
  groqApiKey3: process.env.GROQ_API_KEY_3 ?? '',
  groqBaseUrl: optional('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
  groqModel: optional('GROQ_MODEL', 'llama-3.3-70b-versatile'),
  moonshotBaseModel: optional('MOONSHOT_BASE_MODEL', 'kimi-k2'),
  groqTimeoutMs: optionalInt('GROQ_TIMEOUT_MS', 30000),
  groqMaxTokens: optionalInt('GROQ_MAX_TOKENS', 2048),

  // ---- Gemini Flash 2.0 (free 1M tokens/day + paid degradation fallback) ----
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: optional('GEMINI_MODEL', 'gemini-2.0-flash-exp'),
  geminiBaseUrl: optional('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
  geminiTimeoutMs: optionalInt('GEMINI_TIMEOUT_MS', 30000),
  geminiMaxTokens: optionalInt('GEMINI_MAX_TOKENS', 2048),

  // ---- Together AI ----
  // T3 (cheap fallback, all users): Qwen3.5 9B — $0.10/$0.15 per 1M, 262K ctx, tool calling
  // T4 (premium): Llama 4 Maverick 17B×128E — $0.27/$0.85 per 1M, 1M ctx, tool calling
  togetherApiKey: process.env.TOGETHER_API_KEY ?? '',
  togetherModel: optional('TOGETHER_MODEL', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
  togetherQwenModel: optional('TOGETHER_QWEN_MODEL', 'Qwen/Qwen3.5-9B'),
  togetherBaseUrl: optional('TOGETHER_BASE_URL', 'https://api.together.xyz/v1'),
  togetherTimeoutMs: optionalInt('TOGETHER_TIMEOUT_MS', 30000),
  togetherMaxTokens: optionalInt('TOGETHER_MAX_TOKENS', 2048),
  // Daily spend cap across all Together AI calls (in USD cents, default $2.00)
  togetherDailyBudgetCents: optionalInt('TOGETHER_DAILY_BUDGET_CENTS', 200),
} as const;

// ---- Startup validation ----
if (config.isProduction) {
  if (!config.adminToken) {
    console.warn('WARNING: ADMIN_TOKEN not set — admin API will return 503');
  }
  if (config.encryptionKey && !/^[a-f0-9]{64}$/i.test(config.encryptionKey)) {
    console.error('FATAL: ENCRYPTION_KEY must be 64 hex characters');
    process.exit(1);
  }
}
