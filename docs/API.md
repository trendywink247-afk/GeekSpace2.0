# GeekSpace 2.0 — API Reference

Base URL: `http://localhost:3001/api` (dev) or `https://yourdomain.com/api` (prod)

All authenticated endpoints require `Authorization: Bearer <jwt_token>` header.

## Health

### `GET /api/health`

No auth required. Live-probes Ollama and EDITH.

**Response:**
```json
{
  "ok": true,
  "status": "ok | degraded",
  "timestamp": "2026-02-15T12:00:00.000Z",
  "version": "2.2.0",
  "uptime": 3600,
  "edith": true,
  "ollama": true,
  "components": {
    "database": "ok | down",
    "ollama": "reachable | unreachable | not_configured",
    "openrouter": "configured | not_configured",
    "edith": "reachable | unreachable | not_configured"
  }
}
```

Status code: 200 if database is ok, 503 if degraded.

---

## Auth

### `POST /api/auth/signup`

Rate limited: 10/15min.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "username": "alphanumeric_and-dashes",
  "name": "Optional Display Name"
}
```

**Response (201):**
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "name": "Display Name",
    "plan": "starter",
    "credits": 15000
  }
}
```

### `POST /api/auth/login`

Rate limited: 10/15min.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "token": "eyJhbG...",
  "user": { ... }
}
```

---

## Agent

### `GET /api/agent/config`

Get the authenticated user's agent personality configuration.

**Response:**
```json
{
  "id": "agent-uuid",
  "user_id": "user-uuid",
  "name": "Geek",
  "display_name": "Alex's AI",
  "mode": "builder",
  "voice": "friendly",
  "system_prompt": "Custom instructions...",
  "primary_model": "geekspace-default",
  "fallback_model": "ollama-qwen2.5",
  "creativity": 70,
  "formality": 50,
  "response_speed": "balanced",
  "monthly_budget_usd": 5.0,
  "avatar_emoji": "bot-icon",
  "accent_color": "#7B61FF",
  "bubble_style": "modern",
  "status": "online"
}
```

### `PATCH /api/agent/config`

Update agent personality. Send only fields to change.

**Body (partial):**
```json
{
  "name": "Edith",
  "mode": "operator",
  "voice": "professional",
  "creativity": 85
}
```

Allowed fields: name, displayName, mode, voice, systemPrompt, primaryModel, fallbackModel, creativity, formality, responseSpeed, monthlyBudgetUSD, avatarEmoji, accentColor, bubbleStyle, status.

### `POST /api/agent/chat`

The primary AI chat endpoint. Three-agent routed with force-routing support.

**Body:**
```json
{
  "message": "Explain the trade-offs of microservices vs monolith"
}
```

Message max: 4000 characters.

**Force-routing prefixes:**
- `"/edith analyze this code..."` — Forces Edith (premium reasoning)
- `"/premium analyze this code..."` — Alias for /edith
- `"/jarvis help me plan..."` — Forces Jarvis (cloud assistant)
- `"/weebo what time is it?"` — Forces Weebo (local)
- `"/local what time is it?"` — Alias for /weebo
- No prefix — Auto-routes based on intent classification

**Response:**
```json
{
  "text": "The AI response text...",
  "agent": "edith",
  "tier": "premium",
  "route": "premium",
  "provider": "openclaw",
  "model": "openclaw",
  "latencyMs": 1250,
  "creditsUsed": 45,
  "creditsRemaining": 14955
}
```

**Agent values:** `edith`, `jarvis`, `weebo`
**Provider values:** `openclaw`, `moonshot`, `openrouter`, `ollama`, `builtin`
**Route values:** `premium` (Edith), `cloud` (Jarvis), `local` (Weebo)

### `POST /api/agent/chat/stream`

SSE streaming chat. Same routing as `/api/agent/chat`.

**Body:**
```json
{
  "message": "Write a React component",
  "forceAgent": "jarvis"
}
```

**SSE events:**
```
data: {"token": "Here", "agent": "jarvis"}
data: {"token": " is", "agent": "jarvis"}
data: {"token": " the", "agent": "jarvis"}
data: [DONE]
```

### `POST /api/agent/command`

Execute a terminal command.

**Body:**
```json
{
  "command": "gs reminders list"
}
```

**Response:**
```json
{
  "output": "ID  | Reminder  | When\n--- | --------- | ----\na1b2 | Call mom  | 2026-02-15",
  "isError": false
}
```

For `ai` commands:
```json
{
  "output": "[Geek] Here is the AI response...",
  "isError": false,
  "meta": {
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b",
    "latencyMs": 800
  }
}
```

### `POST /api/agent/chat/public/:username`

Public portfolio chat. No auth required.

**Body:**
```json
{
  "message": "Tell me about this developer's projects"
}
```

**Response:**
```json
{
  "reply": "Hi! Alex has worked on several projects including...",
  "agentName": "Geek",
  "ownerName": "Alex Chen"
}
```

Routes to Jarvis (cloud) with 512 max tokens. Enriched with the portfolio owner's bio, skills, projects, and social links.

---

## Reminders

### `GET /api/reminders`

List all reminders for the authenticated user.

**Query params:** `status` (all | pending | completed), `category` (personal | work | health | other | general)

### `POST /api/reminders`

**Body:**
```json
{
  "text": "Call dentist",
  "datetime": "2026-02-20T14:00",
  "channel": "push",
  "category": "health",
  "recurring": "monthly"
}
```

Channel options: `telegram`, `email`, `push`
Category options: `personal`, `work`, `health`, `other`, `general`
Recurring options: `""` (none), `daily`, `weekly`, `monthly`

### `PATCH /api/reminders/:id`

Update a reminder. Send only fields to change.

### `DELETE /api/reminders/:id`

Delete a reminder.

---

## Automations

### `GET /api/automations`

List all automations for the authenticated user.

### `POST /api/automations`

**Body:**
```json
{
  "name": "Daily Portfolio Sync",
  "description": "Syncs GitHub repos to portfolio",
  "triggerType": "time",
  "actionType": "portfolio-update",
  "config": { "cron": "0 9 * * *" },
  "enabled": true
}
```

Trigger types: `time`, `event`, `webhook`
Action types: `n8n-webhook`, `telegram-message`, `portfolio-update`, `manychat-broadcast`

### `PATCH /api/automations/:id`

### `DELETE /api/automations/:id`

---

## Integrations

### `GET /api/integrations`

List all integrations (connected and disconnected) for the user.

### `PATCH /api/integrations/:id`

Update integration settings (status, config, etc.).

---

## Portfolio

### `GET /api/portfolio`

Get authenticated user's portfolio.

### `GET /api/portfolio/:username`

Get any user's public portfolio (no auth).

### `PATCH /api/portfolio`

Update portfolio. Accepts: headline, about, skills (JSON array), projects (JSON array), milestones, social (JSON object), layout, agentEnabled, visibility.

---

## Usage

### `GET /api/usage/summary`

Get usage statistics for the authenticated user.

**Query params:** `period` (today | week | month | all)

Returns token counts, costs, and breakdown by provider/channel.

### `GET /api/usage/billing`

Get credit balance and billing information.

---

## Dashboard

### `GET /api/dashboard`

Aggregated dashboard data: activity charts, task distribution, hourly activity, stats, recent activity.

---

## API Keys

### `GET /api/api-keys`

List stored API keys (returns masked versions only).

### `POST /api/api-keys`

**Body:**
```json
{
  "provider": "openrouter",
  "key": "sk-or-...",
  "label": "Main key",
  "isDefault": true
}
```

Keys are AES-256-GCM encrypted at rest.

### `DELETE /api/api-keys/:id`

---

## Directory

### `GET /api/directory`

User discovery. Returns public profiles for the constellation view.

---

## Features

### `GET /api/features`

Get feature flags for the authenticated user.

### `PATCH /api/features`

Toggle feature flags (social_discovery, portfolio_chat, automation_builder, etc.).

---

## Error Format

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

Validation errors:
```json
{
  "error": "Validation failed",
  "details": [
    { "path": "email", "message": "Invalid email" },
    { "path": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

## Rate Limits

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| All `/api/*` | 15 min | 200 |
| `/api/auth/login` | 15 min | 10 (failed only) |
| `/api/auth/signup` | 15 min | 10 (failed only) |

Rate limit headers are included in responses (`RateLimit-*`).
