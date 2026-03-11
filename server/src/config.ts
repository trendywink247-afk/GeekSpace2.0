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
const isTestMode = process.env.TEST_MODE === 'true' || process.env.TEST_MODE === '1';

export const config = {
  env: optional('NODE_ENV', 'development'),
  isProduction,
  isTestMode,
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

  // Ollama (local engine)
  ollamaBaseUrl: optional('OLLAMA_BASE_URL', 'http://localhost:11434'),
  ollamaModel: optional('OLLAMA_MODEL', 'qwen2.5-coder:1.5b'),
  ollamaTimeout: optionalInt('OLLAMA_TIMEOUT_MS', 45000),
  ollamaMaxTokens: optionalInt('OLLAMA_MAX_TOKENS', 512),

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
  // NOTE P3: Together AI and OllamaCloud removed — no API keys, dead providers

  // HuggingFace (image generation fallback — FLUX.1-schnell)
  hfToken: process.env.HF_TOKEN || '',

  // fal.ai — Seedance Director Mode video generation
  falApiKey: process.env.FAL_KEY || '',
  falEnabled: !!process.env.FAL_KEY,

  // PicoClaw (lightweight automation engine)
  picoClawUrl: optional('PICOCLAW_URL', 'http://localhost:8080'),
  picoClawEnabled: optional('PICOCLAW_ENABLED', 'false') === 'true',
  picoClawTimeout: optionalInt('PICOCLAW_TIMEOUT_MS', 15000),

  // Pico-Kimi Bridge (orchestration layer)
  bridgeEnabled: optional('BRIDGE_ENABLED', 'false') === 'true',
  bridgeMaxWorkflowSteps: optionalInt('BRIDGE_MAX_WORKFLOW_STEPS', 6),
  bridgeAutoEscalate: optional('BRIDGE_AUTO_ESCALATE', 'true') === 'true', // Auto-detect complex requests

  // Redis (job queue)
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  // OpenAI (kept for optional future use)
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // Voice: edge-tts (TTS) + Groq Whisper (STT — uses existing GROQ_API_KEY)
  edgeTtsBin: optional('EDGE_TTS_BIN', '/opt/tts-venv/bin/edge-tts'),
  ttsVoice: optional('TTS_VOICE', 'en-US-AriaNeural'),

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
  rateLimitMax: optionalInt('RATE_LIMIT_MAX', 200),
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

  // ---- Together AI (paid primary — Llama 4 Maverick 17B×128E) ----
  togetherApiKey: process.env.TOGETHER_API_KEY ?? '',
  togetherModel: optional('TOGETHER_MODEL', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
  togetherBaseUrl: optional('TOGETHER_BASE_URL', 'https://api.together.xyz/v1'),
  togetherTimeoutMs: optionalInt('TOGETHER_TIMEOUT_MS', 30000),
  togetherMaxTokens: optionalInt('TOGETHER_MAX_TOKENS', 2048),
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
