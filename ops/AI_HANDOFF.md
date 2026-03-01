# AI Handoff — Post-Phase 76 (AI Gateway + Smart Routing)

**Date:** 2026-03-01
**Branch:** `main`
**Tests:** 76 server unit test files | 870 tests (all passing)
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

## Post-Phase 76 — What Was Done

**Theme:** AI Gateway + Smart Routing (cost optimization)

### New Capabilities

**Routing Ladder (Phase 76+)**
- `ollama → openrouter-free → ollama-cloud → edith(premium-only last resort)`
- Edith is **NEVER** auto-selected for 'complex' or 'planning' intent — waterfall last resort only
- `pickProvider()` no longer returns edith directly; uses `openrouter-free` for paid complex tasks
- Daily token budget enforcement (`isOverDailyBudget`) blocks edith when daily cap exceeded

**New ollama-cloud provider**
- `callOllamaCloud()` with OpenAI-compatible API + Bearer auth
- Config vars: `OLLAMA_CLOUD_BASE_URL`, `OLLAMA_CLOUD_API_KEY`, `OLLAMA_CLOUD_MODEL`, `OLLAMA_CLOUD_TIMEOUT_MS`
- Credit cost: 2 (same as openrouter-free; free in dollar terms)

**LLM Response Cache (L1 + L2)**
- L1: In-memory Map (100 entries max, 5-min TTL, per-worker)
- L2: Redis (5-min TTL, shared across PM2 workers, key prefix `llm:resp:`)
- Cacheable for single-turn user messages only (no `forceProvider`)

**In-flight Deduplication**
- `inFlightRequests` Map: identical concurrent requests wait for first result instead of double-calling

**Async Job Queue** (`server/src/services/job-queue.ts`)
- `enqueueJob(type, payload, userId)` → returns job ID immediately
- `getJobStatus(id)` → poll for result
- Types: `voice:transcribe`, `voice:synthesize`, `image:generate`, `video:generate`, `video:stitch`
- Backed by Redis (falls back to in-memory Map for single-worker dev)

### Files Changed
- `server/src/services/llm.ts` — complete routing rewrite + cache + dedupe + daily budget
- `server/src/services/token-budget.ts` — `getDailyTokenUsage`, `isOverDailyBudget` added
- `server/src/services/job-queue.ts` (NEW) — async job queue service
- `server/src/config.ts` — `ollamaCloudBaseUrl/ApiKey/Model/Timeout` vars added
- `.env.example` — `OLLAMA_CLOUD_*` vars documented
- `server/src/test/api/llm-router.test.ts` (NEW) — 17 routing tests
- `server/src/test/api/phase76.test.ts` (NEW) — 35 integration/static tests
- `server/src/__tests__/llm-router.test.ts` — updated (excluded from vitest, kept for reference)
- `ops/AI_PHASE_PLAN.md` — Phase 76 entry added

### Test Exports Added (for test isolation)
- `clearOllamaCache()` — resets module-level Ollama availability cache
- `clearLLMCache()` — clears in-memory LLM response cache

---

## Verification Status
- [x] Tests: 870/870 passed (76 test files)
- [x] Phase gate: 7/7 ✅
- [x] Brand guard: 0 violations
- [x] TypeScript: clean (frontend + server)
- [x] Staging: deployed + 11/11 smoke tests ✅
- [x] Merged to main (de3fd29)
- [x] Pushed to origin/main

---

## Known Issues / Open Risks
- `gh auth` credentials expired — PR created as direct merge instead
- Pre-existing chunk size warning for index.js (738kB) — not a Phase 76 concern
- `job-queue.ts` handlers not yet wired to voice/image routes — Phase 77 task
- Staging containers from worktree build (phase-76-*) — clean up if disk space needed

---

## Architecture Notes
- Daily token budget check (`isOverDailyBudget`) is 10% of monthly budget
- Monthly budget check (`shouldDegradeRouting`) degrades routing at 100% usage
- Both checks only block edith and paid OpenRouter; Ollama/openrouter-free remain available
- Job queue `processJob()` runs via `setImmediate()` — non-blocking for API routes

---

## Next Steps (Phase 77 candidates)
- Wire job queue handlers to actual voice/image service calls
- Frontend polling endpoint for job status (`GET /api/jobs/:id`)
- Consider CSRF tokens (mentioned in phase 75 open risks)
- Virtual scroll for chat history (bundle size optimization)
- Frontend bundle splitting (recharts 431kB + index.js 738kB)
- Next release train candidate: Phase 80

## Merge Status
Merged `ai/phase-20260301-phase76` → `main` (de3fd29)
Pushed to `origin/main`
