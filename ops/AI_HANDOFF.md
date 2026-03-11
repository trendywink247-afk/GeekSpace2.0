# AI Handoff — Domain Migration + Security + Docs Sync
**Date:** 2026-03-09
**Branch:** ai/master-migration-20260309 — open PR to main when ready
**Status:** Complete — all 10 tasks done, 7/7 smoke tests passing

## What Was Done This Run

### Domain Migration
- caddy/Caddyfile: ai/api.geekspace.space → permanent 301 redirect ✅
- 3 server files: hardcoded geekspace.space removed (message-router, portfolio, integrations) ✅
- .env: CORS/PUBLIC_URL/API_URL updated to agentin.chat; geekspace.space kept in CORS ✅

### Security Hardening
- .claude/settings.json: Claude Code deny rules (no .env reads, no pipe-to-shell) ✅
- .claude/hooks/security-precheck.sh: PreToolUse gate active ✅
- .claudeignore: .env, keys, secrets blocked from Claude Code context ✅
- /root/.agentin-secrets: real secrets moved outside repo (chmod 600) ✅

### New LLM Providers (config.ts only — routing wiring still pending in Phase 103)
- Groq: groqApiKey, groqModel, groqBaseUrl + 2 more fields ✅
- Gemini Flash: geminiApiKey + 4 fields ✅
- Together AI: togetherApiKey + 4 fields ✅
- llm-tool-normalizer.ts: created — handles functionDeclarations vs OpenAI tools ✅

### Docs
- README, CLAUDE.md, ARCHITECTURE.md, DEPLOYMENT.md, ENV_VARS.md ✅
- .env.example, API.md, DECISIONS.md ✅
- All: Agentin brand, agentin.chat domain, new LLM waterfall, secrets management ✅

### MCP Servers
- github: ✓ Connected
- memory: ✓ Connected
- redis: ✗ Not host-exposed (expected — Redis is Docker-only)

## MANUAL STEPS STILL NEEDED (only you can do these)

1. **Google Cloud Console** (console.cloud.google.com)
   APIs & Services → Credentials → OAuth 2.0 Client
   ADD redirect URI: https://api.agentin.chat/api/auth/google/callback
   ADD origin: https://ai.agentin.chat
   KEEP old geekspace.space entries until traffic fully migrated

2. **GitHub Developer Settings** (github.com/settings/developers → OAuth Apps)
   Homepage URL: https://ai.agentin.chat
   ADD callback URL: https://api.agentin.chat/api/auth/github/callback

3. **Telegram webhook** — auto-registers on restart. Already verified ✅
   (smoke test confirmed: agentin.chat in webhook URL)

4. **Stripe** (if active) — update webhook to api.agentin.chat/api/webhooks/stripe

5. **Resend** — only change RESEND_FROM_EMAIL to agent@agentin.chat after
   verifying agentin.chat is an approved sender domain in Resend dashboard

6. **Phase 103 wiring** — config.ts has Groq/Gemini/Together keys ready.
   Next: add callGroq(), callGemini(), callTogether() to llm.ts and update
   routeChat() waterfall. See ops/DECISIONS.md for routing spec.

## Next Command
```bash
cd ~/GeekSpace2.0
gh pr create --title "feat(migration): domain → agentin.chat + security + docs + LLM providers" \
  --body "See ops/AI_HANDOFF.md for details" \
  --base main
cat ops/AI_BACKLOG.md | head -30
```

---

# AI Handoff -- Post-Phase 109 (Conversation Quality Rating)

**Date:** 2026-03-07
**Branch:** `ai/phase-20260307-phase109-conversation-rating`
**Status:** Complete — pending merge to main
**Tests:** 106 server unit test files | 1896 tests (1867 passing + 29 phase87 env-specific skips)
**Phase 109 tests:** 9/9

---

## Completed This Phase

### Phase 109 -- Conversation Quality Rating

1. `server/src/db/index.ts` -- DB migration: additive `ALTER TABLE conversation_log ADD COLUMN quality_score INTEGER` (runs on startup, idempotent, skips if column exists)
2. `server/src/routes/agent.ts` -- NEW: `GET /api/agent/conversations/ratings` (paginated conversation pairs with quality_score), `POST /api/agent/conversations/:id/rating` (1-5 star scoring with validation)
3. `src/dashboard/pages/ConversationRatingPage.tsx` -- NEW: interactive 5-star rating UI at `/dashboard/training`; loads paginated conversation list, renders user prompt + assistant reply, inline star rating with optimistic update and toast feedback
4. `src/dashboard/DashboardApp.tsx` -- lazy import + route wiring for ConversationRatingPage, 'conversationRating' PageType, "Conversation Ratings" nav item
5. `server/src/test/api/phase109.test.ts` -- NEW: 9 tests covering migration, list endpoint pagination/auth, rating validation (1-5, invalid, missing), and 404 for unknown conversations

---

## Files Changed

```
server/src/db/index.ts                              -- additive quality_score migration
server/src/routes/agent.ts                          -- GET /conversations/ratings + POST /conversations/:id/rating
src/dashboard/pages/ConversationRatingPage.tsx      -- NEW: 5-star rating UI page
src/dashboard/DashboardApp.tsx                      -- route + nav wiring
server/src/test/api/phase109.test.ts               -- NEW: 9 tests
ops/AI_HANDOFF.md                                   -- this file
ops/AI_RELEASE_NOTES.md                             -- Phase 109 entry
```

---

## API Architecture

### GET /api/agent/conversations/ratings
- Auth required (JWT)
- Query params: `page` (default 1), `limit` (default 20, max 100)
- Returns: `{ conversations: [{id, userMessage, assistantMessage, quality_score, created_at}], total, page, limit }`
- Filters to authenticated user's conversations only

### POST /api/agent/conversations/:id/rating
- Auth required (JWT)
- Body: `{ score: number }` — must be integer 1–5
- Returns: `{ success: true, id, score }`
- 400 on invalid score, 404 on unknown conversation (user-isolated)

---

## Test / Gate Status

- **Phase 109 tests:** 9/9
- **Total tests:** 1896 (1867 passing + 29 phase87 env-specific skips)
- **TypeScript:** 0 errors (frontend + server)
- **Lint:** clean (0 warnings)
- **Frontend build:** successful
- **Server build:** successful
- **Branch:** `ai/phase-20260307-phase109-conversation-rating` (pushed)

---

## Next Steps

1. Merge PRs in order: #125 (phase107) → #126 (phase108) → phase109 PR (new)
2. After all merged to main, deploy to production with standard flow

## Next Command

```bash
cd ~/GeekSpace2.0
git checkout main && git pull origin main
cat ops/AI_BACKLOG.md | head -40
```

---

# AI Handoff — Voice Notes Pipeline
**Date:** 2026-03-11
**Branch:** main (e9b4de7)
**Status:** ✅ Complete — live in production

## What Was Done

### Voice Notes Pipeline (fully implemented, no OPENAI_API_KEY needed)
- **STT:** Groq Whisper Large v3 Turbo via GROQ_API_KEY round-robin (free)
- **TTS:** edge-tts v7.2.7 local binary at /opt/tts-venv/bin/edge-tts → OGG Opus via ffmpeg
- **Cache:** Redis key prefix `tts:` — 24h TTL (avoids re-TTS same phrases)

### Files Changed
- `Dockerfile` — python3-venv + edge-tts + ffmpeg in Stage 2
- `server/src/config.ts` — edgeTtsBin, ttsVoice config fields
- `server/src/services/voice.ts` — replaced OpenAI with Groq Whisper + edge-tts
- `server/src/services/message-router.ts` — export buildChannelSystemPrompt
- `server/src/routes/webhooks.ts` — complete handleVoiceMessage pipeline
- `server/src/test/api/phase103.test.ts` — updated tests to match real implementation
- `server/src/test/api/phase110.test.ts` — updated tests to match real implementation

### Voice Pipeline Flow
1. Telegram voice note received → handleVoiceMessage()
2. isVoiceEnabled() check (Groq key present → true)
3. downloadTelegramVoice(file_id) → Buffer
4. transcribeVoice(buffer) → Groq Whisper → transcript string
5. getConversationContext + buildChannelSystemPrompt → LLM via routeChat
6. logConversation (user + assistant)
7. textToSpeech(reply) → edge-tts → ffmpeg → OGG Opus buffer
8. sendTelegramVoice(chatId, buffer, replyToId, caption)
9. deductSubscriptionCredits (flat 2 credits per exchange)

### Verification
- isVoiceEnabled(): true (Groq keys present) ✅
- edge-tts in Docker image: /opt/tts-venv/bin/edge-tts 7.2.7 ✅
- ffmpeg in Docker image: /usr/bin/ffmpeg ✅
- TTS standalone test: 18535 bytes in 1512ms ✅
- CI: ✅ green | live-production: ✅ synced

## Capabilities Score
15 ✅ / 3 ⚠️ / 1 🔲 / 0 ❌

## Remaining Blockers
- TAVILY_API_KEY: keyword web search (URL-based search works via crawl4ai)
- OPENAI_API_KEY: no longer needed for voice (now using Groq)

## Next Recommended
- Live Telegram voice test: send voice note to bot, confirm OGG reply received
- Check /api/agent/voice endpoint (web voice notes from dashboard) if it exists

---

## Multilingual Fix — 2026-03-11
Removed English language lock from Whisper STT (was already absent; auto-detection confirmed active).
Agent now replies in Hindi/Telugu/English automatically.
Affects: voice notes + text chat on all channels.

Files changed:
- `server/src/routes/webhooks.ts` — added `systemPromptWithLang` with language-match instruction for voice
- `server/src/services/message-router.ts:162` — appended language-match to `buildChannelSystemPrompt` (covers all text channels)
- `server/src/services/voice.ts` — no change needed (Whisper auto-detection was already active)

Tests: 2207 passing ✅ | Build: 0 errors ✅ | Hot-patched to production ✅
