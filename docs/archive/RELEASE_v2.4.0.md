# GeekSpace 2.0 — Release v2.4.0

**Date**: 2026-02-16
**Branch**: `release/integrity-merge-20260216` → `main`
**Merges**: PR #14 (Telegram + n8n) + PR #15 (Pico-Kimi Bridge)

---

## What Changed

Two feature branches merged as one validated release:

1. **Pico-Kimi Bridge Orchestration** — A multi-agent intelligence layer between PicoClaw (fast local dispatcher) and Kimi (deep reasoning). 6 specialist agents (analyst, coder, planner, researcher, executor, reviewer), complexity classification, automatic workflow decomposition.

2. **Telegram Bot + n8n Workflow Automation** — Bidirectional Telegram messaging linked to user accounts, unified message router across channels, n8n workflow engine for agentic automation pipelines.

All new features ship **disabled by default** behind feature flags.

---

## Infrastructure Map (v2.4.0)

```
                        Internet
                           |
                      +---------+
                      |  Caddy  |  :443 (TLS termination)
                      |  Proxy  |  ai.geekspace.space
                      +---------+
                           |
              +------------+-------------+
              |                          |
        /api/* routes             /* (SPA assets)
              |                   /var/www/geekspace/
              v
     +------------------+
     |  GeekSpace API   |  :3001 (Express + JWT)
     |  (Node.js)       |
     +------------------+
       |    |    |    |
       |    |    |    +-----> SQLite (better-sqlite3)
       |    |    |            server/data/geekspace.db
       |    |    |
       |    |    +---------> Redis :6379
       |    |                 (session cache, job queue)
       |    |
       |    +--------------> Ollama :32778 (host)
       |                      llama3.1:8b (local LLM)
       |                      [geekspace-shared network]
       |
       +------ LLM Router ----+------+------+------+
               |               |      |      |      |
           OpenRouter     OpenClaw  Edith  PicoClaw  Bridge
           (cloud)        (WS)     (Kimi)  :8080    (orchestrator)
           free/paid      legacy   premium  Go bin   multi-agent
                                                     workflows

     +------------------+     +------------------+
     |  Telegram Bot    |     |  n8n             |  :5678
     |  (in-process)    |     |  (Docker profile)|  [optional]
     |  webhook: /api/  |     |  workflow engine  |
     |  webhooks/tg     |     +------------------+
     +------------------+

     +------------------+
     |  EDITH Bridge    |  (Docker profile, deprecated)
     |  WebSocket proxy |
     +------------------+
```

**Networks**:
- `geekspace-net` — internal bridge (API + Redis + n8n)
- `geekspace-shared` — external (Ollama container, managed by Hostinger)

**Docker Services**:
| Service | Profile | Port | Memory | Status |
|---------|---------|------|--------|--------|
| geekspace | *(default)* | 3001 | 512M | Always runs |
| redis | *(default)* | 6379 | 256M | Always runs |
| edith-bridge | `edith` | — | 128M | Deprecated, profile-gated |
| n8n | `n8n` | 5678 | 512M | **New**, profile-gated |

---

## Feature Flags and Defaults

| Flag | Env Var | Default | Effect When Disabled |
|------|---------|---------|---------------------|
| Bridge orchestration | `BRIDGE_ENABLED` | `false` | `/bridge`, `/workflow`, `/agent:` prefixes fall through to standard local router |
| PicoClaw automation | `PICOCLAW_ENABLED` | `false` | PicoClaw health checks skip, bridge can't dispatch to local haiku model |
| Bridge auto-escalate | `BRIDGE_AUTO_ESCALATE` | `true` | Only explicit `/bridge` prefix triggers bridge; auto-detection disabled when `false` |
| Bridge max steps | `BRIDGE_MAX_WORKFLOW_STEPS` | `6` | Caps multi-agent workflow pipeline depth |
| Telegram bot | `TELEGRAM_BOT_TOKEN` | *(empty)* | Bot doesn't initialize, webhook endpoint rejects all requests |
| Telegram webhook secret | `TELEGRAM_WEBHOOK_SECRET` | *(empty)* | **Required** — empty = reject all webhooks (secure by default) |
| n8n integration | `N8N_BASE_URL` | `http://n8n:5678` | Only active when n8n Docker profile is running |
| n8n webhook secret | `N8N_WEBHOOK_SECRET` | *(empty)* | When set, n8n callbacks must include matching `x-n8n-secret` header |

**Key principle**: Every new subsystem is OFF unless explicitly configured. Zero flags needed for existing behavior to continue unchanged.

---

## New API Endpoints

### Bridge Orchestration (PR #15) — requires `BRIDGE_ENABLED=true`

**GET /api/agent/agents** — List specialist agent definitions *(public, no auth)*
```bash
curl https://ai.geekspace.space/api/agent/agents
```

**GET /api/agent/workflows?limit=20** — User's workflow history *(auth required)*

**GET /api/agent/workflows/:workflowId** — Single workflow status *(auth required)*

**GET /api/agent/workflows-analytics** — Workflow success rate, avg duration *(auth required)*

**GET /api/agent/bridge-events?limit=20** — Recent bridge routing decisions *(auth required)*

**POST /api/agent/bridge-preview** — Dry-run: what would the bridge do? *(auth required)*
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"compare React vs Vue for a startup"}' \
  https://ai.geekspace.space/api/agent/bridge-preview
```

**Chat prefix commands** (via existing POST /api/agent/chat):
| Prefix | Example | Effect |
|--------|---------|--------|
| `/bridge <msg>` | `/bridge compare React vs Vue` | Force bridge routing (auto-selects agents) |
| `/workflow <msg>` | `/workflow build a dashboard` | Force multi-agent workflow pipeline |
| `/agent:<role> <msg>` | `/agent:coder fix my CSS grid` | Force single specialist agent |

### Telegram Integration (PR #14) — requires `TELEGRAM_BOT_TOKEN`

**POST /api/integrations/telegram/link** — Generate Telegram link code *(auth required)*

**GET /api/integrations/telegram/status** — Check link status *(auth required)*

**DELETE /api/integrations/telegram/link** — Unlink Telegram *(auth required)*

**POST /api/webhooks/telegram** — Telegram update receiver *(webhook secret required)*

**POST /api/webhooks/n8n/callback** — n8n automation callback *(x-n8n-secret header required when configured)*

---

## Operational Runbook

### Kill Bridge Instantly

```bash
# 1. Edit .env
echo "BRIDGE_ENABLED=false" >> /root/GeekSpace2.0/.env

# 2. Restart
fuser -k 3001/tcp
cd /root/GeekSpace2.0 && BRIDGE_ENABLED=false \
  OLLAMA_BASE_URL=http://localhost:32778 OLLAMA_MODEL=llama3.1:8b \
  OLLAMA_TIMEOUT_MS=120000 node server/dist/index.js &

# 3. Verify
curl -s http://localhost:3001/api/health | python3 -c \
  "import sys,json; print('bridge:', json.load(sys.stdin)['components']['bridge'])"
# Expected: bridge: disabled
```

**What happens**: All `/bridge`, `/workflow`, `/agent:` prefixes silently fall through to the standard Ollama local router. Users see no error.

### Kill PicoClaw

```bash
# In .env:
PICOCLAW_ENABLED=false
# Restart server
```

### Kill Telegram Bot

```bash
# In .env — clear the token:
TELEGRAM_BOT_TOKEN=
# Restart server
# Webhook endpoint rejects all requests with 401.
```

### Kill n8n

```bash
docker compose --profile n8n down
# No impact on core API.
```

### Emergency: Kill Everything New, Restore v2.3.0 Behavior

```bash
# .env:
BRIDGE_ENABLED=false
PICOCLAW_ENABLED=false
TELEGRAM_BOT_TOKEN=
N8N_BASE_URL=

# Restart
fuser -k 3001/tcp
cd /root/GeekSpace2.0 && \
  OLLAMA_BASE_URL=http://localhost:32778 OLLAMA_MODEL=llama3.1:8b \
  OLLAMA_TIMEOUT_MS=120000 node server/dist/index.js &

# Stop optional Docker services
docker compose --profile n8n --profile edith down
```

---

## Integrity Fixes Applied

| # | Fix | Impact |
|---|-----|--------|
| F1 | `BRIDGE_ENABLED` defaults to `false` | New feature opt-in only |
| F2 | `/agent:<role>` overrides `forceWorkflow` heuristic | 3-5x cost savings, user intent preserved |
| F3 | Invalid agent roles return 400 with valid role list | Prevents 500 errors from undefined roles |
| F4 | Workflow step cap uses `config.bridgeMaxWorkflowSteps` | Configurable, not hardcoded |
| F5 | `BRIDGE_AUTO_ESCALATE` wired into escalation logic | Auto-detection is a real kill-switch |
| F6 | Memory caveat restored in system prompt | Prevents user confusion |
| F7 | n8n webhook verifies `x-n8n-secret` header | Prevents unauthorized callback injection |
| F8 | `/link <email>` removed, link code flow required | Prevents account takeover via email guess |
| F9 | Empty Telegram webhook secret rejects all requests | Secure by default |
| F10 | n8n pinned to v1.78.1 | Reproducible builds |
| F11 | `APP_VERSION` constant unifies health + startup log | Single source of truth |
| F12 | `whatsapp-message` added to AutomationsPage maps | Frontend build fix |

---

## Database Changes

New tables (auto-created, `IF NOT EXISTS`):

| Table | Source | Purpose |
|-------|--------|---------|
| `workflows` | PR #15 | Multi-agent workflow records |
| `workflow_steps` | PR #15 | Individual agent steps within a workflow |
| `bridge_events` | PR #15 | Bridge routing decision log |
| `channel_links` | PR #14 | Telegram/WhatsApp account links |
| `link_codes` | PR #14 | Temporary link codes for account binding |

No migration required. Safe for existing databases.

---

## Credit Cost Impact

| Route | Cost | When Used |
|-------|------|-----------|
| Standard chat (Ollama) | 1 credit | Default, no prefix |
| `/agent:<role>` (single specialist) | 1 LLM call | Explicit agent request |
| `/bridge` (auto-routed) | 1-2 LLM calls | Bridge classifies + dispatches |
| `/workflow` (multi-agent) | 3-5 LLM calls | Planner + delegates + reviewer |
| Telegram message | Same as web chat | Via message-router |
| PicoClaw direct | 1 credit flat | Trivial requests |
