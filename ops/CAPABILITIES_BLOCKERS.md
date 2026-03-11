# Capabilities Blockers — Agentin Audit
**Date:** 2026-03-11
**Auditor:** Claude Code (autonomous audit pass)

---

## P0 — LAUNCH BLOCKERS (fix before public launch)

### BLOCKER-01: isPremiumPlan() missing 'pro' plan
- **File:** `server/src/services/llm.ts` line 272
- **Bug:** `isPremiumPlan()` checks `['monthly', 'pilot', 'halfyear', 'yearly']` — missing `'pro'`
- **DB Reality:** Plan values in production: `free`, `pro`, `monthly`
- **Impact:** All `pro` plan users treated as free users — get free-tier routing (T1+T6 race, not T4/T5 premium). Billing is wrong.
- **Also:** `pickProvider()` at line 1198 also misses `'pro'` in its `isPaidPlan` check
- **Status:** FIX APPLIED ✅ (see commit)

### BLOCKER-02: PicoClaw/picofleet calls llama3.1:8b — model not in Ollama
- **Log:** `PicoClaw returned 502: {"error":"Ollama request failed","status":404,"detail":"{\"error\":\"model 'llama3.1:8b' not found\"}"}`
- **Ollama reality:** `qwen3:8b` (5.2GB) is the only model present
- **Impact:** PicoClaw fails on EVERY request, falls through to cloud LLM waterfall. Automation routing broken for all users.
- **Root cause:** PicoClaw container still configured to use llama3.1:8b (the old default)
- **Status:** FIX APPLIED ✅ — updated PICO_OLLAMA_MODEL env var

### BLOCKER-03: proactive-engine crashes on every user — "no such column: last_active"
- **Log:** `SqliteError: no such column: last_active` repeated for every user in logs
- **File:** `server/src/services/proactive-engine.ts` line 113
- **Impact:** Proactive nudges/check-ins never fire; error spam in logs
- **Status:** FIX APPLIED ✅

---

## P1 — HIGH PRIORITY (fix soon)

### BLOCKER-04: Voice Notes (Cap. 14) — OPENAI_API_KEY missing
- **Impact:** Voice transcription (Whisper) and TTS are disabled. Telegram voice messages can't be transcribed.
- **isVoiceEnabled() returns false**
- **Status:** Code ready, just needs key. ⚠️ PARTIAL

### BLOCKER-05: Web Research (Cap. 2) — TAVILY_API_KEY missing
- **Impact:** `web_search` tool will always fail. LLM cannot do real web research.
- **Status:** ⚠️ PARTIAL — code exists, key missing

### BLOCKER-06: Portfolio Visitor Chat — requireAuth breaks public access
- **File:** `server/src/routes/portfolio.ts` line 363
- **Bug:** `/:username/chat` requires auth (JWT). Public visitors can't chat without an account.
- **Status:** 🔲 NOT FIXED (would need auth change + visitor session logic)

---

## NOT BUILT

### CAPABILITY-11: Weebo Fleet (parallel agents)
- DB has `pico_tasks` table (73 tasks found) and `pico_agents` table — fleet infrastructure exists
- But no user-facing "fleet" UI or API beyond pico-fleet task queuing
- **Status:** ⚠️ PARTIAL (backend queuing exists, no fleet management UI)

### CAPABILITY-13: Windmill Workflows
- `WINDMILL_TOKEN` and `WINDMILL_URL` both MISSING
- `trigger_workflow` tool exists in code but cannot call Windmill
- **Status:** 🔲 NOT WIRED

### CAPABILITY-18: Social Media Publisher
- `social_accounts` table exists, content_plans table exists
- But no social API keys (Twitter Bearer, LinkedIn OAuth) in .env
- Posting is via webhook (manual config required per user)
- **Status:** ⚠️ PARTIAL (infrastructure exists, no platform API keys)

---

## MONITORING NOTES
- Redis shows `NOAUTH` from host CLI — Redis has password. Container uses REDIS_URL with credentials. Redis IS working (health API shows cache service up).
- `ollama_available: true` in routing logs — Ollama reachable from container via Docker network
- Telegram webhook correctly set to `https://api.agentin.chat/api/webhooks/telegram`
