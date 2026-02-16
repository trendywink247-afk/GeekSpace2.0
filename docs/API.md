# GeekSpace 2.0 — API Reference

Base URL: `http://localhost:3001/api` (dev) or `https://yourdomain.com/api` (prod)

All authenticated endpoints require `Authorization: Bearer <jwt_token>` header.

---

## Health

### `GET /api/health`

No auth required. Live-probes all components.

**Response:**
```json
{
  "ok": true,
  "status": "ok | degraded",
  "timestamp": "2026-02-16T12:00:00.000Z",
  "version": "2.2.0",
  "uptime": 3600,
  "ollama": true,
  "components": {
    "database": "ok | down",
    "ollama": "reachable | unreachable | not_configured",
    "openrouter": "configured | not_configured"
  }
}
```

Status code: 200 if database is ok, 503 if degraded.

---

## Auth

### `POST /api/auth/signup`

Rate limited: 10/15min. Creates account with free subscription (5,000 credits).

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
    "plan": "free",
    "credits": 5000
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

### `POST /api/auth/demo`

No auth. Demo login with seed data (dev only).

### `GET /api/auth/me`

Returns the authenticated user's profile.

---

## Agent

### `GET /api/agent/config`

Get the authenticated user's agent configuration.

**Response:**
```json
{
  "id": "agent-uuid",
  "user_id": "user-uuid",
  "name": "Geek",
  "display_name": "Geek's AI",
  "mode": "builder",
  "voice": "friendly",
  "personality": "jarvis",
  "system_prompt": "Custom instructions...",
  "creativity": 70,
  "formality": 50,
  "status": "online"
}
```

### `PATCH /api/agent/config`

Update agent configuration. Send only fields to change.

**Body (partial):**
```json
{
  "personality": "edith",
  "name": "My Agent",
  "mode": "operator",
  "voice": "professional"
}
```

Allowed fields: name, displayName, mode, voice, personality, systemPrompt, primaryModel, fallbackModel, creativity, formality, responseSpeed, monthlyBudgetUSD, avatarEmoji, accentColor, bubbleStyle, status.

### `GET /api/agent/personalities`

Public endpoint. Returns all available personality definitions.

**Response:**
```json
[
  {
    "id": "edith",
    "name": "Edith",
    "subtitle": "The Boss",
    "description": "Professional CTO energy. Gets things done.",
    "emoji": "👩‍💼",
    "greeting": "What do you need?"
  },
  {
    "id": "jarvis",
    "name": "Jarvis",
    "subtitle": "The Helper",
    "description": "Warm, capable butler. At your service.",
    "emoji": "🤵",
    "greeting": "Good day. How may I assist you?"
  },
  {
    "id": "weebo",
    "name": "Weebo",
    "subtitle": "The Darling",
    "description": "Cute, enthusiastic, excited to help!",
    "emoji": "🤖",
    "greeting": "Hi hi! What are we doing today?"
  }
]
```

### `POST /api/agent/chat`

Primary AI chat endpoint. Multi-engine routed with credit tracking.

**Body:**
```json
{
  "message": "Explain the trade-offs of microservices vs monolith"
}
```

Message max: 4000 characters.

**Prefix routing:**
- `"/premium analyze this code..."` — Forces Moonshot reasoning model (costs credits)
- `"/local what time is it?"` — Forces Ollama (free)
- No prefix — Auto-routes based on intent classification

**Response:**
```json
{
  "text": "The AI response text...",
  "route": "premium | local",
  "tier": "premium | local",
  "latencyMs": 1250,
  "provider": "ollama | openrouter | edith | builtin",
  "model": "llama3.1:8b",
  "creditsUsed": 0,
  "creditsRemaining": 4990
}
```

Returns 402 if credits exhausted:
```json
{
  "error": "You've used all your credits for this billing cycle..."
}
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

### `POST /api/agent/chat/public/:username`

Public portfolio chat. No auth required. Always routed to Ollama (free). Personality-aware — uses the portfolio owner's selected personality for greeting style and tone.

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

### `POST /api/agent/deploy-premium`

Deploy a specialist agent session. Requires paid plan. Costs 100 credits.

**Body:**
```json
{
  "task": "Review my authentication middleware for security vulnerabilities"
}
```

**Response (201):**
```json
{
  "session": {
    "id": "session-uuid",
    "agent_codename": "Agent-7",
    "task": "Review my authentication middleware...",
    "status": "active",
    "model_used": "kimi-k2-thinking"
  },
  "message": "Agent-7 has been deployed and is standing by.",
  "creditsUsed": 100
}
```

Returns 403 for free users. Returns 402 for insufficient credits.

### `POST /api/agent/premium-chat/:sessionId`

Chat within a premium specialist session. Uses Moonshot reasoning model.

**Body:**
```json
{
  "message": "What did you find in the auth middleware?"
}
```

**Response:**
```json
{
  "text": "I've analyzed the middleware and found...",
  "creditsUsed": 45,
  "creditsRemaining": 4855
}
```

### `DELETE /api/agent/premium-session/:sessionId`

End a premium specialist session.

---

## Billing

### `GET /api/billing/plans`

Public. Returns all available plans with pricing.

**Response:**
```json
[
  {
    "id": "free",
    "name": "Free",
    "credits": 5000,
    "priceUsd": 0,
    "priceInr": 0,
    "intervalDays": 0,
    "intervalLabel": "",
    "badge": ""
  },
  {
    "id": "monthly",
    "name": "Monthly",
    "credits": 100000,
    "priceUsd": 10,
    "priceInr": 999,
    "intervalDays": 30,
    "intervalLabel": "/mo",
    "badge": "Popular"
  }
]
```

### `GET /api/billing/plan`

Get the authenticated user's current subscription.

**Response:**
```json
{
  "plan": "monthly",
  "credits_remaining": 85000,
  "credits_total": 100000,
  "price_usd": 10,
  "price_inr": 999,
  "interval_days": 30,
  "cycle_start": "2026-01-16",
  "cycle_end": "2026-02-16"
}
```

### `POST /api/billing/upgrade`

Upgrade to a new plan.

**Body:**
```json
{
  "plan": "monthly",
  "currency": "usd"
}
```

`currency` accepts `"usd"` or `"inr"`.

### `GET /api/billing/usage`

Get 30-day usage history.

**Response:**
```json
{
  "daily": [
    { "date": "2026-02-15", "credits_used": 150, "messages": 12 }
  ]
}
```

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

### `PATCH /api/reminders/:id`

Update a reminder. Send only fields to change.

### `DELETE /api/reminders/:id`

---

## Automations

### `GET /api/automations`

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

Update portfolio. Accepts: headline, about, skills, projects, milestones, social, layout, agentEnabled, visibility.

---

## Usage

### `GET /api/usage`

Get usage statistics. **Query params:** `period` (today | week | month | all)

### `GET /api/usage/summary`

Aggregated usage summary (tokens, costs, messages).

### `GET /api/usage/billing`

Credits + billing info (alternative to `/api/billing/plan`).

---

## Dashboard

### `GET /api/dashboard`

Aggregated dashboard data: activity charts, task distribution, hourly activity, stats, recent activity.

---

## API Keys

### `GET /api/api-keys`

List stored API keys (masked versions only).

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

User discovery. Returns public profiles for the explore/constellation view.

---

## Features

### `GET /api/features`

Get feature flags for the authenticated user.

### `PATCH /api/features`

Toggle feature flags (social_discovery, portfolio_chat, automation_builder, etc.).

---

## Error Format

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
    { "path": "email", "message": "Invalid email" }
  ]
}
```

## Rate Limits

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| All `/api/*` | 15 min | 200 |
| `/api/auth/login` | 15 min | 10 |
| `/api/auth/signup` | 15 min | 10 |
| `/api/agent/chat` | 15 min | 30 |

Rate limit headers are included in responses (`RateLimit-*`).
