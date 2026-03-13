# AI Handoff — Phase 6
**Date:** 2026-03-13
**Branch:** main = live-production = 7bac442
**Status:** DEPLOYED | CI: green | Health: ok | v3.1.0 | Tests: 2223 pass

---

## What Was Done This Session (2026-03-13)

### Fixes Applied
1. **PicoClaw timeout 60s → 10s** — `.env` PICOCLAW_TIMEOUT_MS changed from 60000 to 10000. 5.5x latency improvement.
2. **Expense fast-path** — `message-router.ts` parseExpenseIntent() + guessCategory() — regex parser bypasses LLM, auto-categorizes (660ms, 0 credits)
3. **Focus fast-path** — `message-router.ts` parseFocusIntent() — regex parser for pomodoro/focus (700ms, 0 credits)
4. **Portfolio visitor Groq-first** — `agent.ts` — res.setTimeout(120000) + Groq-first with openrouter-free fallback (4.8s vs 30s+ timeout)
5. **hasToolTrigger gaps** — Added "spent NUMBER", "paid NUMBER" patterns without requiring "I" prefix
6. **Guest user FK guards** — memory.ts, token-budget.ts, llm.ts, agent.ts — skip DB writes for guest:* userIds

### Infrastructure
- Uptime Kuma deployed at status.agentin.chat (port 3100)
- Stopped unused: Windmill (670MB), staging (210MB), edith-bridge (30MB) — freed ~900MB
- RAM available: 6.1GB (was 4.6GB)

### Score
- 20/21 capabilities working (95%)
- 42 tools tested, 40 operational
- 2223 unit tests pass
- Only Video Generation blocked (FAL_KEY missing, providers unreachable from VPS)

## Current Containers
geekspace-app, geekspace-caddy, geekspace-redis, geekspace-picoclaw, geekspace-uptime-kuma, crawl4ai, cronicle, dozzle, healthchecks, ollama

## Start Commands (Next Session)
```bash
cd ~/GeekSpace2.0
git log --oneline -5
cat ops/AI_HANDOFF.md
curl -s localhost:3001/api/health | python3 -m json.tool
cd server && npm test
```

## Next Session Priorities
1. Deploy SearXNG (replace paid Tavily, ~250MB)
2. Deploy Qdrant (semantic memory search, ~200MB)
3. Deploy Meilisearch (typo-tolerant search, ~75MB)
4. More fast-paths (reminder parser, habit parser)
5. WhatsApp integration planning
