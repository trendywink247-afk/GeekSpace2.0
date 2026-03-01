# AI Handoff — Post-Phase 79 (Structured Memory Pipeline + Reminder Consistency)

**Date:** 2026-03-01
**Branch:** `main`
**Tests:** 79 server unit test files | 944 tests (all passing)
**CI:** Phase gate 7/7 ✅ | Smoke tests 11/11 ✅
**Brand Guard:** 0 violations
**Build:** Clean (frontend + server)

---

## Compaction Recovery Rule (MANDATORY)
If the conversation is compacted, before doing ANY work:
1. Re-read: `CLAUDE.md`, `ops/AI_HANDOFF.md`, `ops/AI_PHASE_PLAN.md`, `ops/AI_FEATURE_MATRIX.md`
2. Run: `git status && git branch --show-current && git log --oneline -5`
3. Print a brief "Rehydrated Context" summary (phase, branch, current tasks, constraints)
4. Only then continue implementation — never rely on memory from compacted context

---

## Post-Phase 79 — What Was Done

**Theme:** Structured Memory Pipeline + Reminder Consistency

### New Capabilities

**Ollama Memory Extraction (79.2)**
- Added `extractMemoriesWithOllama(userId, userMessage, assistantResponse)` to `services/memory.ts`
- Uses local Ollama (`config.ollamaBaseUrl`, `config.ollamaModel`) — NOT PicoClaw/edith
- Extracts up to 5 structured facts (category, key, value) per conversation turn
- Source tagged as `'ollama-extract'` in `agent_memory` table
- Falls back to regex `extractMemories()` if Ollama is unavailable or returns invalid JSON
- Fire-and-forget: called non-blocking after every AI reply in `message-router.ts`
- Strips markdown code fences from Ollama JSON output before parsing

**Memory Context in System Prompt (79.3 — verified pre-existing)**
- `buildMemoryContext(userId, userMessage)` already wired in both `message-router.ts` (line 113) and `agent.ts` (line 85)
- Injects top 8 relevant memories via keyword scoring before every AI response

**Memory Manager UI + API (79.4/79.5/79.6 — verified pre-existing)**
- `MemoryManagerPage.tsx` fully implemented at `src/dashboard/pages/MemoryManagerPage.tsx`
- `GET /api/agent/memory` with category + search filters
- `DELETE /api/agent/memory/:id` with 404 for missing entries
- `DELETE /api/agent/memory/bulk?category=` bulk clear
- `POST /api/agent/memory` create
- `PUT /api/agent/memory/:id` update
- All wired via `memoryService` in `src/services/api.ts`

**Reminder ↔ Memory Consistency (79.7)**
- `reminder-scheduler.ts` now imports `getRelevantMemories` from `memory.ts`
- `deliverReminder()` calls `getRelevantMemories(userId, reminderText, 2)` before sending
- Appends `💡 Context: [memory lines]` to Telegram/email reminder message when related memories found
- Skips 'summary' category memories (too general for context)
- Non-fatal: wrapped in try/catch; plain message used if lookup fails

**Weekly Memory Summary Cron (79.8)**
- Added `runWeeklyMemorySummary()` to `services/memory.ts`
- Runs Sunday 04:00–05:00 UTC (= Sunday 10:00–11:00 IST)
- Calls Ollama to summarize all memories (min 3) into a 1–2 sentence user profile
- Stores result as `agent_memory(category='summary', key='week_YYYY-MM-DD', value=<summary>, source='weekly-cron')`
- `startWeeklySummaryScheduler()` exported, checks hourly, started via `safeStart` in `index.ts`

### Files Changed
- `server/src/services/memory.ts` — added `extractMemoriesWithOllama`, `startWeeklySummaryScheduler`, `runWeeklyMemorySummary`; added `config` import
- `server/src/services/message-router.ts` — import `extractMemoriesWithOllama` + fire-and-forget call after assistant reply (line 371)
- `server/src/services/reminder-scheduler.ts` — import `getRelevantMemories` + context enrichment in `deliverReminder`
- `server/src/index.ts` — import `startWeeklySummaryScheduler` + `safeStart('memory-weekly-summary', ...)`
- `server/src/test/api/phase79.test.ts` (NEW) — 28 tests covering all Phase 79 changes

---

## Verification Status
- [x] Tests: 944/944 passed (79 test files)
- [x] Phase gate: 7/7 ✅
- [x] Brand guard: 0 violations
- [x] TypeScript: clean (frontend + server)
- [x] Staging: 11/11 smoke tests ✅
- [x] Merged to main

---

## Known Issues / Open Risks
- Pre-existing chunk size warning (index.js ~700kB) — bundle splitting partially done in Phase 74, further splitting deferred
- `job-queue.ts` handlers still not wired to actual voice/image routes
- Dead-letters only captures Telegram reminder failures — WhatsApp failures not yet tracked
- Ollama extraction requires Ollama to be running (port 32778 on VPS); if Ollama is down, falls back to regex
- Weekly summary uses same Ollama instance — if unavailable on Sunday, summary is skipped silently

---

## Architecture Notes
- `extractMemoriesWithOllama` writes to `agent_memory` (same table as regex extraction) — no separate `user_memory` table needed since existing schema supports all required types (category field serves as type)
- Ollama extraction uses `temperature: 0.1` for deterministic JSON output
- AbortSignal timeout: 15s for extraction, 20s for weekly summary
- Weekly scheduler uses hourly polling to check if it's Sunday 04:00–05:00 UTC (setInterval approach, no cron library needed)

---

## Next Steps (Phase 80 candidates)
- Bundle splitting: further code-split heavy components (deferred from 77/78/79)
- Wire job queue handlers to voice/image service calls
- Frontend job status polling (`GET /api/jobs/:id`)
- CSRF tokens (mentioned in phases 75–79 open risks — still open)
- Virtual scroll for long chat history
- WhatsApp dead-letter support (not just Telegram)
- Next release train candidate: Phase 80

## Merge Status
Merged `ai/phase-20260302-phase79` → `main`
Pushed to `origin/main`
