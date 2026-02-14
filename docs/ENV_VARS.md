# GeekSpace 2.0 — Environment Variables Reference

All variables read by the server (`server/src/config.ts`) and the EDITH bridge.

## Core (required in production)

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | `development` | Yes (prod) | Set to `production` for security features |
| `PORT` | `3001` | No | Express listen port |
| `JWT_SECRET` | dev fallback | **Yes** | JWT signing key. Generate: `openssl rand -hex 64` |
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

## Brain 1 — Ollama (local)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint. In Docker: `http://host.docker.internal:11434` |
| `OLLAMA_MODEL` | `qwen2.5-coder:1.5b` | Model name to use |
| `OLLAMA_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |

> **VPS note**: If Ollama maps port `32768→11434`, set `OLLAMA_BASE_URL=http://host.docker.internal:32768`
> or use the internal port directly from the host.

## Brain 2 — OpenRouter (cloud)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | (empty) | API key from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | API base URL |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4-5-20250929` | Model identifier |

## Brain 3 — EDITH / OpenClaw (via bridge)

### GeekSpace side

| Variable | Default | Description |
|----------|---------|-------------|
| `EDITH_GATEWAY_URL` | `http://edith-bridge:8787` | Bridge HTTP endpoint (GeekSpace calls this) |
| `EDITH_TOKEN` | (empty) | Auth token. Without this, EDITH is disabled |

### Bridge side (only when using `--profile edith`)

| Variable | Default | Description |
|----------|---------|-------------|
| `EDITH_OPENCLAW_WS` | `ws://host.docker.internal:18789` | OpenClaw WebSocket RPC endpoint |
| `EDITH_TOKEN` | (empty) | Token sent to OpenClaw via query param + header |
| `OPENCLAW_CHAT_METHOD` | `chat.completions` | RPC method name for chat requests |
| `BRIDGE_PORT` | `8787` | Bridge HTTP listen port |
| `REQUEST_TIMEOUT_MS` | `120000` | Per-request timeout for RPC calls |

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
| `PREMIUM_MONTHLY_CREDITS` | `50000` | Credits allocated per month (premium) |
| `TRIAL_DAYS` | `3` | Trial period length |
| `TRIAL_PREMIUM_CREDITS` | `10000` | Credits given during trial |

## Misc

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Request body size limit (1 MB) |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Pino log level |
| `SEED_DEMO_DATA` | `false` | Seed demo users/data on startup (dev only) |
