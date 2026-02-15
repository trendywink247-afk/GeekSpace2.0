# PicoClaw — Lightweight AI Sidecar Design

> Future feature. Partially implemented (health check + query interface exists).
> Last updated: 2026-02-15

---

## Overview

PicoClaw is a lightweight AI sidecar process designed for fast, low-resource tasks that don't need a full LLM. It handles heartbeat monitoring, quick automation execution, Telegram bot responses, and simple classification tasks.

## Current State

**Implemented** (`server/src/services/picoclaw.ts`):
- Health check with 30-second cache (`isPicoClawAvailable()`)
- Chat query endpoint (`queryPicoClaw()`)
- Health probe for status reporting (`picoClawProbe()`)
- Configured via `PICOCLAW_URL` and `PICOCLAW_TIMEOUT` in config

**Not yet implemented**:
- Actual PicoClaw binary/service
- Automation execution
- Telegram bot integration
- Heartbeat monitoring
- Task queue processing

## Architecture

```
GeekSpace API                  PicoClaw Sidecar
    |                              |
    +-- /api/chat  ------->  POST /api/chat    (quick Q&A)
    +-- /api/health ------->  GET /health       (liveness)
    +-- automation trigger -> POST /api/execute  (run automation)
    +-- heartbeat check ---> GET /api/heartbeat (system status)
    |                              |
    |                         Internal:
    |                         - TinyLlama/Phi-3 (< 1GB RAM)
    |                         - Task queue (in-memory)
    |                         - Webhook dispatcher
```

## Design Goals

1. **Tiny footprint**: < 50MB RAM, < 10MB binary
2. **Fast responses**: < 500ms for classification, < 2s for generation
3. **Offline-capable**: Works without internet (local model only)
4. **Fire-and-forget**: Automation tasks run asynchronously
5. **Complementary**: Handles tasks that don't warrant a full LLM call

## Proposed Capabilities

### 1. Quick Classification

Fast intent classification without calling the main LLM router:

```
POST /api/classify
{
  "text": "remind me to call mom tomorrow",
  "categories": ["reminder", "chat", "command", "automation"]
}

Response:
{
  "category": "reminder",
  "confidence": 0.92,
  "latencyMs": 45
}
```

Used for: pre-routing before the three-agent system, reducing unnecessary LLM calls for commands.

### 2. Automation Execution

Run automation actions triggered by the main app:

```
POST /api/execute
{
  "automationId": "abc123",
  "actionType": "telegram-message",
  "config": {
    "chatId": "123456",
    "message": "Your daily portfolio update: +15 views today"
  }
}

Response:
{
  "status": "queued",
  "taskId": "task-xyz"
}
```

Action types:
- `telegram-message` — Send via Telegram Bot API
- `webhook` — POST to external URL
- `n8n-trigger` — Trigger n8n workflow
- `email` — Send via SMTP (future)

### 3. Heartbeat Monitoring

Background health checks for connected integrations:

```
GET /api/heartbeat

Response:
{
  "checks": {
    "ollama": { "status": "up", "latencyMs": 12 },
    "edith-bridge": { "status": "up", "latencyMs": 45 },
    "redis": { "status": "up", "latencyMs": 3 },
    "telegram": { "status": "up", "latencyMs": 230 }
  },
  "uptimeSeconds": 86400
}
```

PicoClaw runs these checks every 60 seconds and updates the integrations table. The dashboard reads from the table instead of probing services on every page load.

### 4. Telegram Bot Handler

Process incoming Telegram messages without loading the full Express app:

```
POST /api/telegram/webhook
{
  "update_id": 123,
  "message": {
    "text": "/remind call dentist at 3pm",
    "chat": { "id": 456 }
  }
}
```

PicoClaw handles:
- `/remind` — Create reminder via GeekSpace API
- `/status` — Quick system status
- `/credits` — Credit balance check
- General messages — Forward to three-agent router

### 5. Quick Chat (existing)

Simple Q&A using a tiny local model (TinyLlama, Phi-3-mini):

```
POST /api/chat
{
  "message": "What's 15% tip on $45?",
  "system": "You are a helpful assistant. Be brief."
}

Response:
{
  "text": "$6.75",
  "tokens_in": 12,
  "tokens_out": 4
}
```

Used as a fallback when Ollama is down but the user needs a quick answer.

## Implementation Options

### Option A: Go Binary (Recommended)

- Single static binary, ~10MB
- Embed TinyLlama via llama.cpp bindings
- HTTP server via `net/http`
- In-memory task queue
- Pros: Tiny footprint, fast startup, no runtime deps
- Cons: Separate codebase from TypeScript

### Option B: Node.js Sidecar

- Shared codebase with GeekSpace
- Use `node-llama-cpp` for local inference
- Express-based HTTP server
- BullMQ for task queue (shares Redis)
- Pros: Code reuse, familiar tooling
- Cons: Higher memory (~100MB), slower startup

### Option C: Python Sidecar

- FastAPI server
- llama-cpp-python for inference
- Celery for task queue
- Pros: Best ML ecosystem
- Cons: Different language, higher memory

## Integration with Three-Agent System

PicoClaw sits alongside the three agents as a utility layer:

```
User Message
    |
    v
PicoClaw classifier (< 50ms)
    |
    +-- command? --> Terminal handler (no LLM needed)
    +-- reminder? --> Reminder CRUD (no LLM needed)
    +-- simple? --> Weebo (Ollama)
    +-- coding/planning? --> Jarvis (OpenRouter)
    +-- complex? --> Edith (OpenClaw/Moonshot)
```

PicoClaw reduces latency by intercepting messages that don't need an LLM at all (commands, reminders, status checks).

## Configuration

```env
# PicoClaw sidecar
PICOCLAW_ENABLED=true
PICOCLAW_URL=http://picoclaw:9090
PICOCLAW_TIMEOUT=5000
PICOCLAW_MODEL=tinyllama-1.1b
PICOCLAW_HEARTBEAT_INTERVAL=60000
```

## Docker Integration

```yaml
# In docker-compose.yml
picoclaw:
  build: ./sidecar/picoclaw
  restart: unless-stopped
  ports:
    - "9090"  # internal only
  environment:
    - PICOCLAW_MODEL=tinyllama-1.1b
    - GEEKSPACE_API_URL=http://geekspace:3001
  networks:
    - geekspace-net
  profiles:
    - picoclaw
  deploy:
    resources:
      limits:
        memory: 128M
```

## Open Questions

1. Should PicoClaw share Redis with GeekSpace or use its own in-memory queue?
2. Is TinyLlama good enough for classification, or do we need a fine-tuned model?
3. Should PicoClaw handle SSE streaming, or only return complete responses?
4. How to handle PicoClaw being unavailable — skip classification or use fallback heuristics?
