# EDITH/OpenClaw -- Internal Developer Reference

> Internal reference for the EDITH premium reasoning layer. Not user-facing.
> Last updated: 2026-02-15

---

## Overview

EDITH is the premium reasoning agent in GeekSpace's three-agent architecture. It routes through the **EDITH Bridge** (HTTP-to-WebSocket translator) to reach an OpenClaw container, with a direct Moonshot API call as fallback.

### Agent Architecture

```
User message
    |
    v
Intent Classifier (llm.ts)
    |
    +-- simple/greeting/meta --> Weebo (Ollama local)
    +-- coding/planning     --> Jarvis (OpenRouter cloud)
    +-- complex/analysis    --> Edith (OpenClaw/Moonshot)
    |
    v
Agent resolves provider:
    Edith  --> callOpenClaw() via bridge --> callMoonshotDirect() fallback
    Jarvis --> callOpenRouter() free tier --> callOllama() fallback
    Weebo  --> callOllama() --> callOpenRouter() fallback
```

### Three Personas

| Agent | Personality | Provider | Credit Cost |
|-------|------------|----------|-------------|
| **Edith** | Competent, direct, efficient. "Consider it handled." | OpenClaw via bridge / Moonshot | 10 cr/1K tokens |
| **Jarvis** | Formal but warm, like a butler. "At your service." | OpenRouter free tier | 5 cr/1K tokens |
| **Weebo** | Playful, enthusiastic. "On it!" | Ollama local | Included |

---

## EDITH Bridge Protocol

The bridge (`bridge/edith-bridge/index.js`) translates between HTTP and OpenClaw's WebSocket JSON-RPC:

```
HTTP Request                           WS Frame Sent
POST /v1/chat/completions    -->   {"id":"<uuid>","method":"chat.completions",
{                                   "params":{"messages":[...],"max_tokens":4096}}
  "messages": [...],
  "max_tokens": 4096            WS Frame Received
}                              <--  {"id":"<uuid>","ok":true,"result":{...}}

HTTP Response                      Returned to caller
{                                  (OpenAI-compatible JSON)
  "choices": [{
    "message": {"content": "..."}
  }],
  "usage": {...}
}
```

### Bridge Endpoints
- `POST /v1/chat/completions` -- Chat completion (OpenAI format)
- `GET /v1/models` -- List available models
- `GET /health` -- Returns `{ws_connected, rpc_ok, uptime}`

### Connection Flow
1. Bridge connects to OpenClaw via WebSocket (`EDITH_OPENCLAW_WS`)
2. Auth handshake: sends `{"type":"auth","token":"..."}`, receives challenge
3. Bridge completes challenge, OpenClaw sends scopes
4. Health probe: `skills.status` RPC (1.5s timeout)
5. Reconnection with exponential backoff (max 30s)

---

## Key Files

| File | Purpose |
|------|---------|
| `server/src/services/edith.ts` | EDITH client -- bridge first, Moonshot fallback |
| `server/src/services/llm.ts` | Three-agent router, intent classification, fallbacks |
| `server/src/prompts/openclaw-system.ts` | Persona definitions, portfolio builder, sanitizer |
| `server/src/routes/agent.ts` | Chat endpoint, streaming, force-routing |
| `bridge/edith-bridge/index.js` | WS-RPC to HTTP bridge (409 lines) |
| `server/src/config.ts` | EDITH_GATEWAY_URL, EDITH_TOKEN config |

---

## OpenClaw Container

- Image: `ghcr.io/hostinger/hvps-openclaw:latest`
- Compose: `/docker/openclaw-1xzv/docker-compose.yml`
- Internal gateway: port 18789 (localhost only)
- External proxy: port 55550 (Docker-mapped)
- Config: `/docker/openclaw-1xzv/data/.openclaw/openclaw.json`

### Known Issues

1. **Crash-loop on restart**: Race condition between internal proxy (55550) and gateway (18789). Proxy starts first and fails to connect. Docker restart policy recovers it after 1-2 attempts.

2. **Trusted proxies**: OpenClaw config must include the `geekspace-shared` network subnet (172.20.0.0/16) in `trustedProxies`, otherwise bridge connections get rejected after auth.

3. **Network isolation**: OpenClaw runs on its own compose network. Must be manually connected to `geekspace-shared`:
   ```bash
   docker network connect geekspace-shared openclaw-1xzv-openclaw-1
   ```

4. **Auto-injection**: OpenClaw's `server.mjs` injects model aliases on startup based on env vars. Setting `OPENAI_API_KEY` triggers GPT model injection. Fix: hardcode API keys in config files, not env vars.

---

## Environment Variables

```env
# Bridge HTTP endpoint (GeekSpace calls this)
EDITH_GATEWAY_URL=http://edith-bridge:8787

# OpenClaw WebSocket URL (bridge connects to this)
EDITH_OPENCLAW_WS=ws://openclaw-1xzv-openclaw-1:55550

# Auth token (shared by bridge and GeekSpace)
EDITH_TOKEN=<from openclaw.json>

# RPC method name
OPENCLAW_CHAT_METHOD=chat.completions

# Moonshot fallback (direct API)
MOONSHOT_REASONING_MODEL=kimi-k2-thinking
MOONSHOT_TIMEOUT_MS=120000
MOONSHOT_MAX_TOKENS=8192
```

---

## Response Sanitization

All AI responses pass through `sanitizeResponse()` which strips:
- OpenClaw, codename EDITH, Brain 1-4, Tri-Brain, Quad-Brain
- Ollama, qwen2.5-*, OpenRouter, Moonshot, kimi-k2-*, PicoClaw

Users never see internal provider names or architecture details.
