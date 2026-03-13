# DECISIONS.md — Permanent Rules & Architecture Decisions
# This file survives context compaction. Claude MUST read it at session start.

## PRODUCT IDENTITY
- Product name: **Agentin Chat** (domain: ai.agentin.chat)
- Agent personas: Weebo (primary), WeeboFleet (multi-agent), Edith (reasoning), Jarvis (voice)
- ❌ BANNED user-visible names: PicoClaw, PicoFleet, Pico (user-facing). Internal code identifiers (`picoService`, `PicoAgentFull`) are allowed.
- Run `npm run brand-guard` every phase to verify 0 violations

## PHASE STRUCTURE (CURRENT POLICY: 13 tasks)
- Tasks 1–11: normal phase improvements (reliability, UX, security, performance, dev/ops, feature)
- Task 12: Brand gate (run brand-guard, fix any violations)
- Task 13: Seedance Director Mode (recurring until complete end-to-end)
- Once Seedance is complete: remove Task 13, keep brand gate only (12-task phases)

## SEEDANCE DIRECTOR MODE STATUS
- Phase 55: First implementation phase
- fal.ai adapter + director packet generator + async job pipeline + multi-clip + ffmpeg stitch
- FAL_KEY env var required (never commit)
- In TEST_MODE: stub fal.ai to return deterministic fake video URLs

## MERGE POLICY
1. All code goes to feature branch: `ai/phase-YYYYMMDD-phaseNN-<topic>`
2. PR → CI green → merge to main
3. Verify main SHA is updated after merge
4. Production deploys from `main` only (every 20-30 phases or critical fixes)
5. NEVER auto-deploy to live-production without explicit user request

## AUTONOMOUS LOOP
- Never ask for user approval between phases
- After each phase: update ops files → commit to main → start next phase worktree automatically
- If CI fails: fix before moving on (don't skip)

## DB SAFETY
- ❌ No DROP/TRUNCATE/RESET operations
- ❌ No forced migrations
- ✅ Additive schema changes only (CREATE TABLE IF NOT EXISTS, ADD COLUMN)
- ✅ Test all DB changes locally before commit
- Docker path: `/app/data/geekspace.db`
- Local dev path: `server/data/geekspace.db`

## TEST REQUIREMENTS
- Run `cd server && npm test` for every phase (backend unit tests)
- Run `npx tsc --noEmit` (frontend) and `cd server && npx tsc --noEmit` (server)
- Target: all tests passing before PR
- New features need tests (at minimum: happy path + auth guard + error case)
- Phase test file naming: `server/src/test/api/phaseNN.test.ts`
- Test isolation: `resetDatabase()` in beforeAll; use timestamp emails: `phaseNN-${Date.now()}@example.com`
- `initAutomationsEngine()` must be called if tests use automation_logs table

## CACHING PATTERN
- Import: `import { cacheGet, cacheSet, cacheDel } from '../services/cache.js';`
- Keys: `user:me:{id}` (30-60s), `users:me:{id}` (30s), `automations:{id}` (30s), `portfolio:{username}` (300s)
- Always bust cache on mutation (fire-and-forget `.catch(() => {})`)
- Add `X-Cache: HIT/MISS` header on cached endpoints

## WORKTREE WORKFLOW
- Worktrees at `.worktrees/phase-NN`
- Create: `git worktree add .worktrees/phase-NN -b ai/phase-YYYYMMDD-phaseNN`
- Always `cd server && npm install` after creating worktree
- Git commands inside worktree: `git -C /root/GeekSpace2.0/.worktrees/phase-NN <cmd>`

## COMMON GOTCHAS
- TypeScript: frontend enforces `noUnusedLocals/noUnusedParameters`; server does not
- Bearer token format: `Authorization: Bearer ${token}` (not bare token)
- Radix dialogs: use `force:true` in E2E for submit buttons; `reducedMotion:'reduce'` in playwright config
- Telegram: sanitize with `sanitizeForTelegram()` before sending
- Port 3001 conflicts: `fuser -k 3001/tcp`
- Ollama on VPS: port 32778 (not 11434)
- JWT: tokens are stateless; revoking session record does NOT invalidate token

## VIDEO GENERATION STACK
- Existing: Pollinations (free), OpenRouter Veo 2, Premium (Kimi enhanced)
- Adding: fal.ai Seedance Fast + Seedance Quality
- DB table: `user_videos` (existing), `video_jobs` (new, Phase 55+)
- Route: `server/src/routes/videos.ts`
- Service: `server/src/services/media-generation.ts` (Pollinations adapter)
- New service: `server/src/services/fal-video.ts` (fal.ai adapter)
- Director Mode: `server/src/services/director-mode.ts`

## REHYDRATION COMMANDS (run after compaction)
```bash
cat CLAUDE.md
cat ops/DECISIONS.md
cat ops/AI_HANDOFF.md
cat ops/AI_PHASE_PLAN.md
git status && git branch --show-current && git log --oneline -5
cd server && npm test 2>&1 | tail -5
```

## DOMAIN MIGRATION (Phase 109+)
- Production domain: ai.agentin.chat (frontend), api.agentin.chat (API)
- Old domain: ai.geekspace.space → permanent 301 redirect (keep in CORS during transition)
- Keep geekspace.space in CORS_ORIGINS for months to avoid breaking bookmarked users
- Container names unchanged: geekspace-app, geekspace-caddy, geekspace-redis (they are internal)
- Static file path unchanged: /var/www/geekspace (internal Caddy path — don't rename)

## LLM WATERFALL (Phase 103+)
- FREE:  Ollama → Groq → Gemini Flash → OpenRouter Free → builtin
- PAID:  Ollama → Together AI → Gemini Flash → Edith/Kimi K2 → builtin
- AUTO:  sidecar → Ollama → builtin
- Tool normalizer: server/src/services/llm-tool-normalizer.ts
- Gemini uses functionDeclarations NOT OpenAI tools format (normalizer handles)

## CLAUDE CODE SECURITY (Phase 109+)
- .claude/settings.json: deny rules for .env, secrets, pipe-to-shell, destructive rm
- /root/.agentin-secrets: all API keys + secrets live here (chmod 600, outside repo)
- Never use --dangerously-skip-permissions on production VPS

## Voice Pipeline — 2026-03-11
TTS: edge-tts (not Kokoro/OpenAI) — RAM at 75%, swap at 2GB.
Kokoro would add 600MB container. OpenAI costs money. edge-tts is zero footprint.
STT: Groq Whisper Large v3 Turbo (not OpenAI Whisper) — free, uses existing GROQ_API_KEY round-robin.
Binary: /opt/tts-venv/bin/edge-tts (Python venv in Docker image)
Voice: en-US-AriaNeural (Microsoft neural TTS)
Output: MP3 → ffmpeg → OGG Opus (Telegram sendVoice format)
Redis cache: 24h TTL prefix tts: (avoids re-generating same phrases)
Revisit Kokoro after VPS upgrade or after first revenue.

## Multilingual Support — 2026-03-11
Root cause: Whisper auto-detection was already active (no language lock existed in Phase 110 implementation).
Language-match instruction added to all system prompts via buildChannelSystemPrompt() in message-router.ts.
Single insertion point covers all channels: Telegram text, Telegram voice, web chat.
Whisper Large v3 Turbo natively supports Hindi, Telugu, English and 99 other languages.
Voice handler in webhooks.ts also gets explicit per-request language-match instruction appended to systemPromptWithLang.

---

## V4 Sim Session Decisions — 2026-03-13

### Bug Fixes
- create_automation: Added isAutomationCreate guard in briefing fast-path. Read trigger || trigger_type in executor.
- portfolio_update_skills: Exposed tool to LLM via toolsBlock. Added hasToolTrigger patterns.
- portfolio visitor chat: Guest JWT now carries portfolioUsername. Agent serves portfolio-context Groq response.

### Architecture
- No new fast-paths added this session
- Guest JWT schema extended: added optional portfolioUsername field

### Deferred
- Video generation: FAL_KEY available but provider blocked from BOM datacenter — deferred
- Windmill: No WINDMILL_TOKEN — deferred
- Memory capture reliability: LLM tool-calling for store_memory is inconsistent — investigate prompt
- Rate limiter test mode: Consider DISABLE_RATE_LIMIT=test env var for harness runs

