# GeekSpace 2.0 — Environment Variables Reference

All variables read by `server/src/config.ts`. Synced as of 2026-02-16.

---

## Core (required in production)

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | `development` | Yes (prod) | Set to `production` for security features |
| `PORT` | `3001` | No | Express listen port |
| `JWT_SECRET` | dev fallback | **Yes** | JWT signing key. Generate: `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | `7d` | No | Token expiry duration |
| `ENCRYPTION_KEY` | dev fallback | **Yes** | AES key for API-key encryption. Generate: `openssl rand -hex 32` |

## Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `./data/geekspace.db` | SQLite database file path. In Docker: `/app/data/geekspace.db` |

## Networking

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `PUBLIC_URL` | `http://localhost:5173` | Public-facing URL (used in OpenRouter headers) |
| `API_URL` | `http://localhost:3001` | API base URL |

## Local Engine — Ollama

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `qwen2.5-coder:1.5b` | Model name to use |
| `OLLAMA_TIMEOUT_MS` | `120000` | Request timeout in ms. 7B+ models on CPU need 90-120s |
| `OLLAMA_MAX_TOKENS` | `512` | Max tokens for Ollama to generate (`num_predict`) |

> **VPS note**: If Ollama maps port `32778→11434`, set `OLLAMA_BASE_URL=http://localhost:32778`

## Cloud Engine — OpenRouter

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | (empty) | API key from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | API base URL |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4-5-20250929` | Paid model identifier |
| `OPENROUTER_TIMEOUT_MS` | `90000` | Request timeout in ms |
| `OPENROUTER_MAX_TOKENS` | `1024` | Max generation tokens |

### OpenRouter Free Tier

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_FREE_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Free model identifier |
| `OPENROUTER_FREE_BASE_URL` | `https://openrouter.ai/api/v1` | Free tier base URL |
| `OPENROUTER_FREE_API_KEY` | (empty) | Separate API key for free tier (optional) |

## Premium Engine — Moonshot Reasoning

| Variable | Default | Description |
|----------|---------|-------------|
| `MOONSHOT_REASONING_MODEL` | `kimi-k2-thinking` | Heavy reasoning model (uses OpenRouter API key) |
| `MOONSHOT_TIMEOUT_MS` | `120000` | Request timeout in ms |
| `MOONSHOT_MAX_TOKENS` | `8192` | Max reasoning tokens |

## Automation Engine — PicoClaw

| Variable | Default | Description |
|----------|---------|-------------|
| `PICOCLAW_URL` | `http://localhost:8080` | PicoClaw endpoint |
| `PICOCLAW_ENABLED` | `false` | Enable PicoClaw automation engine |
| `PICOCLAW_TIMEOUT_MS` | `5000` | Request timeout in ms |

## [DEPRECATED] EDITH / OpenClaw Bridge

> These variables are no longer used. The EDITH WebSocket bridge has been replaced by direct Moonshot API calls via OpenRouter. Kept for reference only.

| Variable | Default | Description |
|----------|---------|-------------|
| ~~`EDITH_GATEWAY_URL`~~ | (empty) | ~~Bridge HTTP endpoint~~ |
| ~~`EDITH_TOKEN`~~ | (empty) | ~~Auth token for bridge~~ |

## Pico-Kimi Bridge (Orchestration)

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_ENABLED` | `false` | Enable multi-agent bridge orchestration |
| `BRIDGE_AUTO_ESCALATE` | `true` | Auto-detect complex requests for bridge routing |
| `BRIDGE_MAX_WORKFLOW_STEPS` | `6` | Max agents per workflow pipeline |

## n8n (Workflow Automation)

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_BASE_URL` | `http://n8n:5678` | n8n endpoint (Docker profile) |
| `N8N_WEBHOOK_SECRET` | (empty) | Secret for n8n callback verification |

## Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string. In Docker: `redis://redis:6379` |

## Telegram (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | (empty) | Bot token for Telegram integration |
| `TELEGRAM_WEBHOOK_SECRET` | (empty) | Webhook verification secret |

## Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Window duration (15 min) |
| `RATE_LIMIT_MAX` | `200` | Max requests per window |
| `RATE_LIMIT_AUTH_MAX` | `10` | Max login/signup attempts per 15 min |

## Credits / Billing

| Variable | Default | Description |
|----------|---------|-------------|
| `PREMIUM_MONTHLY_CREDITS` | `50000` | Credits allocated per month (premium plan) |
| `TRIAL_DAYS` | `3` | Trial period length |
| `TRIAL_PREMIUM_CREDITS` | `10000` | Credits given during trial |

## Session

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_IDLE_TIMEOUT_MS` | `1800000` | Session idle timeout (30 min) |

## Email (Resend)

| Variable | Default | Description |
|----------|---------|-------------|
| `RESEND_API_KEY` | (empty) | Resend API key for email sending. Server starts without it (logs warning) |
| `RESEND_FROM_EMAIL` | `agent@geekspace.space` | From address for agent-sent emails |

## Pico Fleet Worker

| Variable | Default | Description |
|----------|---------|-------------|
| `PICO_WORKER_INTERVAL_MS` | `10000` | Pico fleet task polling interval |

## Misc

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Request body size limit (1 MB) |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Pino log level |
| `SEED_DEMO_DATA` | `true` (dev) / `false` (prod) | Seed demo users/data on startup |
