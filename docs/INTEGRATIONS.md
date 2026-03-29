# GeekSpace 2.0 — Integration Map

> Complete reference for all external services, connectors, and third-party APIs.
> Each integration lists its environment variables, API endpoints, data flow, and health checks.

---

## Overview

GeekSpace connects to 20+ external services organized into categories:

| Category | Services |
|----------|----------|
| **LLM Providers** | Ollama, OpenRouter, Groq, Moonshot/Kimi, Gemini, Together AI, OpenAI |
| **Payments** | Stripe, Razorpay |
| **Communication** | Telegram, WhatsApp (future), Email (Resend/SMTP) |
| **OAuth** | Google, GitHub |
| **Calendar** | Google Calendar |
| **Search & Memory** | Qdrant, Meilisearch, SearXNG |
| **Media** | HuggingFace (FLUX), fal.ai (Seedance), Kokoro TTS, Piper TTS, Whisper STT |
| **Infrastructure** | Redis, PicoClaw, n8n, Browser sidecar |
| **Deployment** | Netlify, Vercel |

---

## LLM Providers (7-Tier Fallback Chain)

The LLM router (`server/src/modules/agent/services/llm.ts`) tries providers in order,
falling back to the next on failure. This ensures high availability with cost optimization.

### Tier 1: Ollama (Local)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama instance |
| `OLLAMA_MODEL` | `qwen3:8b` | Standard model |
| `OLLAMA_COMPLEX_MODEL` | `qwen3:14b` | Complex reasoning model |
| `OLLAMA_TIMEOUT_MS` | `90000` | Request timeout |
| `OLLAMA_MAX_TOKENS` | `4096` | Max output tokens |
| `OLLAMA_THINKING_ENABLED` | `true` | Enable chain-of-thought |

**Data flow:** Direct HTTP to local Ollama API. Zero cost, lowest latency.

### Tier 2: OpenRouter (Cloud)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | — | API key (required for tier) |
| `OPENROUTER_MODEL` | `claude-sonnet-4-6` | Primary model |
| `OPENROUTER_FREE_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Free fallback |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | API base |
| `OPENROUTER_TIMEOUT_MS` | `90000` | Request timeout |
| `OPENROUTER_MAX_TOKENS` | `1024` | Max output tokens |

**Data flow:** OpenAI-compatible API via OpenRouter. Supports streaming.

### Tier 3: Groq (Free Tier)

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | Primary API key |
| `GROQ_API_KEY_2` | — | Rotation key 2 |
| `GROQ_API_KEY_3` | — | Rotation key 3 |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Model |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | API base |
| `GROQ_TIMEOUT_MS` | `30000` | Timeout |
| `GROQ_MAX_TOKENS` | `2048` | Max tokens |

**Data flow:** OpenAI-compatible API. 14,400 req/day free tier. 3 keys for rotation.

### Tier 4: Moonshot / Kimi (Reasoning)

| Variable | Default | Description |
|----------|---------|-------------|
| `MOONSHOT_REASONING_MODEL` | `kimi-k2-thinking` | Reasoning model |
| `MOONSHOT_TIMEOUT_MS` | `120000` | Extended timeout for reasoning |
| `MOONSHOT_MAX_TOKENS` | `8192` | Higher token limit |
| `MOONSHOT_DIRECT_API_KEY` | — | Direct Moonshot API key |
| `MOONSHOT_DIRECT_MODEL` | `kimi-k2.5` | Direct API model |
| `MOONSHOT_BASE_MODEL` | `kimi-k2` | Base chat model |

**Data flow:** Used for complex reasoning tasks, deep planning, and Logo AI suggestions.

### Tier 5: Gemini (Google)

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Google AI API key |
| `GEMINI_MODEL` | `gemini-2.0-flash-exp` | Flash model |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | API base |
| `GEMINI_TIMEOUT_MS` | `30000` | Timeout |
| `GEMINI_MAX_TOKENS` | `2048` | Max tokens |

**Data flow:** Google Generative AI API. 1M tokens/day free tier.

### Tier 6: Together AI

| Variable | Default | Description |
|----------|---------|-------------|
| `TOGETHER_API_KEY` | — | API key |
| `TOGETHER_MODEL` | `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` | Premium model |
| `TOGETHER_QWEN_MODEL` | `Qwen/Qwen3.5-9B` | Budget model |
| `TOGETHER_BASE_URL` | `https://api.together.xyz/v1` | API base |
| `TOGETHER_TIMEOUT_MS` | `30000` | Timeout |
| `TOGETHER_MAX_TOKENS` | `2048` | Max tokens |
| `TOGETHER_DAILY_BUDGET_CENTS` | `200` | Daily spend cap (cents) |

**Data flow:** OpenAI-compatible API. Budget-capped to prevent overspend.

### Tier 7: OpenAI / Anthropic (Final Fallback)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key (optional) |

**Data flow:** Standard OpenAI SDK. Last resort fallback.

---

## Payment Processors

### Stripe

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (enables Stripe if set) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `STRIPE_BASIC_PRICE_ID` | Price ID for Basic plan |
| `STRIPE_PRO_PRICE_ID` | Price ID for Pro plan |

**Endpoints:** `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook`
**Module:** `server/src/modules/billing/`

### Razorpay (INR Payments)

| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key |

**Endpoints:** `/api/billing/razorpay/*`
**Enabled:** Automatically when both key ID and secret are set.

---

## Communication Channels

### Telegram

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification secret |

**Endpoints:** `/api/integrations/telegram/webhook` (incoming), bot API for outgoing.
**Module:** `server/src/modules/integrations/`
**Test mode:** Mocked when `TEST_MODE=true`.

### Email (Resend / SMTP)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key (preferred) |
| `RESEND_FROM_EMAIL` | From address (default: `agent@agentin.chat`) |
| `SMTP_HOST` | SMTP server (fallback if Resend not configured) |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials |
| `SMTP_FROM` | From address for SMTP |

**Usage:** Password reset, notifications, briefing delivery.

### WhatsApp (Future)

| Variable | Description |
|----------|-------------|
| `WHATSAPP_BUSINESS_ID` | Business account ID |
| `WHATSAPP_TOKEN` | API token |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification |
| `WHATSAPP_BUSINESS_NUMBER` | Business phone number |

**Status:** Placeholder — not yet fully integrated.

---

## OAuth Providers

### Google OAuth

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |

**Endpoints:** `/api/auth/google`, `/api/auth/google/callback`
**Scopes:** Profile, email, Google Calendar (optional)

### GitHub OAuth

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | OAuth app client secret |

**Endpoints:** `/api/auth/github`, `/api/auth/github/callback`

---

## Search & Memory Services

### Qdrant (Vector Database)

| Variable | Default | Description |
|----------|---------|-------------|
| `QDRANT_URL` | `http://geekspace-qdrant:6333` | Qdrant instance URL |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Ollama embedding model |

**Docker:** `qdrant/qdrant:v1.13.2`, port 6333, 256M memory
**Usage:** Semantic memory search, conversation similarity, context retrieval.
**Module:** `server/src/modules/memory/`

### Meilisearch (Full-Text Search)

| Variable | Default | Description |
|----------|---------|-------------|
| `MEILISEARCH_URL` | `http://geekspace-meilisearch:7700` | Meilisearch instance |
| `MEILISEARCH_API_KEY` | `agentin-meili-2026` | Master API key |

**Docker:** `getmeili/meilisearch:v1.12`, port 7700, 128M memory
**Usage:** Typo-tolerant instant search across conversations, memories, docs.

### SearXNG (Meta-Search)

**Docker:** SearXNG container, port 8888, 256M memory
**Config:** `searxng/` directory at repo root
**Usage:** Free metasearch engine replacing Tavily. Used by agent for web research.

---

## Media Services

### Image Generation (HuggingFace FLUX)

| Variable | Description |
|----------|-------------|
| `HF_TOKEN` | HuggingFace API token |

**Usage:** FLUX.1-schnell model for image generation.
**Module:** `server/src/modules/media/`

### Video Generation (fal.ai Seedance)

| Variable | Description |
|----------|-------------|
| `FAL_KEY` | fal.ai API key (enables video gen if set) |

**Usage:** Seedance Director Mode for video generation.

### Text-to-Speech

**Kokoro TTS** (primary):
| Variable | Default |
|----------|---------|
| `KOKORO_TTS_URL` | `http://kokoro-tts:5101` |
| `KOKORO_TTS_ENABLED` | `true` |

**Piper TTS** (fallback):
| Variable | Default |
|----------|---------|
| `PIPER_TTS_URL` | `http://piper-tts:5100` |
| `PIPER_TTS_ENABLED` | `true` |

**edge-tts** (last resort): System Python binary at `EDGE_TTS_BIN`.

**Fallback chain:** Kokoro → Piper → edge-tts

### Speech-to-Text

**Whisper STT** (local):
| Variable | Default |
|----------|---------|
| `WHISPER_LOCAL_URL` | `http://whisper-stt:5102` |
| `WHISPER_LOCAL_ENABLED` | `true` |

**Groq Whisper** (cloud fallback): Uses `GROQ_API_KEY`.

---

## Infrastructure Services

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |

**Docker:** Redis Alpine, port 6379, 256M memory
**Usage:** Job queue (BullMQ), caching, rate limiting, session data.

### PicoClaw (Triage Engine)

| Variable | Default | Description |
|----------|---------|-------------|
| `PICOCLAW_URL` | `http://localhost:8080` | PicoClaw instance |
| `PICOCLAW_ENABLED` | `false` | Enable triage engine |
| `PICOCLAW_TIMEOUT_MS` | `5000` | Request timeout |
| `BRIDGE_ENABLED` | `false` | Enable Pico-Kimi orchestration |
| `BRIDGE_MAX_WORKFLOW_STEPS` | `6` | Max workflow steps |
| `BRIDGE_AUTO_ESCALATE` | `true` | Auto-detect complex requests |

**Docker:** Node 20 Alpine, port 8080, 64M memory
**Module:** `picoclaw/` at repo root

### n8n (Workflow Automation)

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_BASE_URL` | `http://n8n:5678` | n8n instance URL |
| `N8N_WEBHOOK_SECRET` | — | Webhook auth secret |

**Docker:** Optional profile, port 5678.

### Browser Sidecar

**Docker:** Custom Playwright container, port 3010, 1.5G memory
**Directory:** `browser-agent/` at repo root
**Usage:** Web scraping, browser automation, screenshot capture.

---

## Data Flow Diagrams

### Chat Message Flow

```
User → /api/agent/chat → message-router.ts
  → classifyMessageComplexity()
  → [simple] react-loop.ts (5 iterations)
  → [complex] deep-reasoning.ts (10 iterations)
    → LLM Router (7-tier fallback)
      → Ollama → OpenRouter → Groq → Moonshot → Gemini → Together → OpenAI
    → Tool execution (search, memory, browser, etc.)
    → Delegation check → delegation-pipeline.ts (if specialist needed)
  → Response streamed via SSE
  → conversation_log + memory_entries saved
```

### Goal Execution Flow

```
User creates goal → /api/agent/goals
  → goal-service.ts → AI generates steps
  → Steps saved to goal_steps table
  → Proactive engine (30min cycles):
    → proactive-goals.ts picks up pending steps
    → Executes via LLM + tools
    → Updates step status
    → Sends notification via agent-notifications.ts
    → Nudges stale goals
```

### Media Generation Flow

```
User → /api/media/generate-image
  → media service checks provider availability
  → HuggingFace FLUX API (image)
  → OR fal.ai Seedance (video)
  → Result stored, URL returned

User → /api/media/tts
  → Kokoro TTS (:5101)
  → fallback: Piper TTS (:5100)
  → fallback: edge-tts (system binary)
  → Audio buffer returned
```

---

## Health Checks

Each service can be verified:

| Service | Check |
|---------|-------|
| Main API | `GET /api/health` |
| Redis | Connection test via ioredis |
| Qdrant | `GET {QDRANT_URL}/collections` |
| Meilisearch | `GET {MEILISEARCH_URL}/health` |
| Ollama | `GET {OLLAMA_BASE_URL}/api/tags` |
| PicoClaw | `GET {PICOCLAW_URL}/health` |
| Kokoro TTS | `GET {KOKORO_TTS_URL}/health` |
| Piper TTS | `GET {PIPER_TTS_URL}/health` |
| Whisper STT | `GET {WHISPER_LOCAL_URL}/health` |

The admin health endpoint (`GET /api/health/detailed`) checks all services and returns aggregate status.
