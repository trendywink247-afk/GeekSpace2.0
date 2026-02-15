# GeekSpace 2.0 -- Handoff Prompt

> Use this file to onboard another AI or human engineer onto this repo.
> Last updated: 2026-02-15

---

## What Changed (this session)

### 1. Three-Agent Architecture (replaces Two-Tier / Tri-Brain)
- **Before**: "Two-Tier" (Ollama free + Moonshot premium) or "Tri-Brain" (Ollama/OpenRouter/EDITH) -- naming was inconsistent
- **After**: Three named agents with distinct personalities:
  - **Edith** (premium) -- OpenClaw via bridge, Moonshot fallback. Complex reasoning, architecture, deep analysis.
  - **Jarvis** (cloud) -- OpenRouter free-tier models. Daily tasks, writing, planning, coding.
  - **Weebo** (local) -- Ollama. Quick answers, brainstorming, casual chat.
- Intent classifier routes messages to the best agent automatically
- Force-routing: `/edith`, `/jarvis`, `/weebo`, `/premium`, `/local`

### 2. Rewrote `server/src/services/edith.ts`
- Routes through EDITH Bridge (HTTP) first, with Moonshot direct as fallback
- `edithProbe()` checks bridge `/health` endpoint with 15s TTL cache
- 2 retries on transient failure, then Moonshot fallback as last resort

### 3. Rewrote `server/src/services/llm.ts`
- New types: `AgentName = 'edith' | 'jarvis' | 'weebo'`
- `resolveAgent(intent, forceAgent)` maps intents to agents
- `routeChat()` dispatches to provider based on agent
- `attemptFallback()` with proper chains: Edith->Jarvis->Weebo, Jarvis->Weebo, Weebo->Jarvis
- All responses sanitized via `sanitizeResponse()` -- strips internal terms
- Credit rates: openclaw=10, openrouter=5, ollama/picoclaw=0 (labeled "included in plan")

### 4. Rewrote `server/src/prompts/openclaw-system.ts`
- Three built-in personas: EDITH_PERSONA, JARVIS_PERSONA, WEEBO_PERSONA
- `getPersonaPrompt(agentName, voice)` resolver
- `buildPortfolioPersona(agentName, ownerName, ownerData)` with rich owner data (bio, skills, projects, social)
- `sanitizeResponse(text)` strips OpenClaw, Brain, Ollama, OpenRouter, Moonshot, PicoClaw from output
- `FORMATTING_RULES` constant appended to all prompts

### 5. Rewrote `server/src/routes/agent.ts`
- `parseRoutePrefix()` supports /edith, /jarvis, /weebo, /premium, /local
- Chat response includes `agent` field
- Tier labeled "included" (never "free")
- Portfolio chat routes to Jarvis with 512 max tokens and rich owner context
- Streaming endpoint supports `forceAgent`
- Terminal `gs credits` shows "Credits Used" not dollar amounts

### 6. Frontend -- persona-aware chat + settings
- **AgentChatPanel.tsx**: Per-persona greetings, suggested prompts, typing indicator with agent name, agent badges on responses, "GeekSpace AI" footer
- **AgentSettingsPage.tsx**: New persona picker (Edith/Jarvis/Weebo cards with colors), kept style/voice/behavior settings
- **PortfolioView.tsx**: Uses `agentName` from API, dynamic chat header, DRY'd desktop/mobile rendering
- **TerminalPage.tsx**: "GeekSpace AI Engine" (was "OpenClaw"), plan shows "Starter" (was "free")

### 7. Dead code cleanup
- Removed `nginx/` directory (Caddy is the reverse proxy)
- Removed 37 unused shadcn/ui components (kept 16 actually used)
- Removed orphaned `use-mobile.ts` hook
- Fixed "Brain 1-4" references in server comments and .env.example

### 8. Updated all documentation
- README.md -- three-agent architecture, new routing table, updated project structure
- OPENCLAW.md -- internal dev reference, three-agent context
- HANDOFF.md -- this file
- RELEASE_NOTES.md -- v2.2.0 entry
- docs/* -- updated for new terminology

---

## Key Files Modified

```
server/src/services/edith.ts          # EDITH bridge client + Moonshot fallback
server/src/services/llm.ts            # Three-agent LLM router
server/src/prompts/openclaw-system.ts # Persona system (Edith/Jarvis/Weebo)
server/src/routes/agent.ts            # Chat routing, streaming, portfolio
server/src/config.ts                  # EDITH gateway default updated
server/src/index.ts                   # Comment cleanup
server/src/services/picoclaw.ts       # Comment cleanup
src/components/AgentChatPanel.tsx      # Persona-aware chat UI
src/dashboard/pages/AgentSettingsPage.tsx  # Persona picker
src/portfolio/PortfolioView.tsx        # Agent name from API
src/dashboard/pages/TerminalPage.tsx   # Branding cleanup
.env.example                          # Comment cleanup
```

---

## Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| OpenClaw container crash-loops on restart | Known | Race condition: proxy connects before gateway ready. Recovers after 1-2 restarts. |
| EDITH bridge auth rejection | Partial fix | OpenClaw `trustedProxies` needs `172.20.0.0/16` (geekspace-shared network) added |
| OpenClaw must be connected to `geekspace-shared` network | Manual step | Run `docker network connect geekspace-shared openclaw-1xzv-openclaw-1` after container recreation |

---

## Verification After Deploy

```bash
# 1. Health check
curl -s http://localhost:3001/api/health | jq .

# 2. EDITH bridge
curl -s http://localhost:8787/health | jq .

# 3. End-to-end chat
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","password":"demo123"}' | jq -r .token)
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"/edith Explain what GeekSpace is"}' | jq .
```
