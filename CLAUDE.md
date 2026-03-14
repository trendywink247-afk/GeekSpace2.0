# CLAUDE.md — Agentin Beast Mode Master (Phase 110+)
## ULTRATHINK MODE ACTIVE | Complete Platform Overhaul

---

## 🧠 ULTRATHINK DIRECTIVE
Engage maximum reasoning depth on every task. Research competitors before designing.
Read entire files before editing. Test every feature via Telegram. Never guess.
Ship perfection. Use all available plugins, tools, and agents.

---

## Compaction Recovery Rule (MANDATORY — run if conversation was compacted)
If the conversation was compacted (summarized), STOP and rehydrate first:
1. Read: `ops/DECISIONS.md`, `ops/AI_HANDOFF.md`, `ops/AI_PHASE_PLAN.md`
2. Run: `git status && git branch --show-current && git log --oneline -5`
3. Run: `curl -s localhost:3001/api/health | python3 -m json.tool`
4. Print a 10-line "Rehydrated Context" (phase, branch, current tasks, constraints)
5. Only then continue implementation

---

## Product Identity
- **Product name:** Agentin Chat (domain: ai.agentin.chat)
- **Agent personas:** Weebo, WeeboFleet, Edith, Jarvis
- **Brand rule:** ZERO user-visible references to PicoClaw/PicoFleet/Pico/GeekSpace
- Run `npm run brand-guard` every phase — no exceptions

---

## 🔥 BEAST MODE MISSION

Transform Agentin into the most compelling daily-use AI OS on the planet:
- Students open it instead of ChatGPT
- Entrepreneurs use it instead of Notion
- Professionals replace Superhuman with it
- Everyone recommends it to friends after first use

**North Star test:** "Would a stressed first-time user at 2am find what they need in 10 seconds and tell their friend about it next morning?"

---

## 🏗️ Tech Stack (Know Before You Touch)
```
Frontend: React 19 + TypeScript + Vite + Tailwind + shadcn/Radix + Zustand
Backend:  Express + TypeScript + better-sqlite3 + JWT + Pino
AI Stack: Ollama → Groq/Gemini Flash → OpenRouter → Together AI → Kimi K2
Auth:     JWT + Passport (Google/GitHub OAuth)
Infra:    Docker Compose + Caddy + PM2
Tests:    2253 passing (NEVER DROP) | Audit: 158/158 full (MAINTAIN)
Telegram: Primary test ground for ALL features
```

---

## 🚨 STARTUP SEQUENCE (Run Every Session)
```bash
git log --oneline -10 && git status
cat ops/AI_HANDOFF.md
curl -s localhost:3001/api/health | python3 -m json.tool
cd server && npm test -- --reporter=dot 2>&1 | tail -3
npm run brand-guard
npx tsc --noEmit && cd server && npx tsc --noEmit
```

---

## 🔒 Non-Negotiable Rules
1. **Never break:** agent routing, reminders, automations, integrations, auth, billing
2. **DB safety:** No DROP/TRUNCATE/reset. Additive migrations only. Verify before touching.
3. **No secrets:** Never print/commit tokens, .env, credentials
4. **Small changes:** No 20-file rewrites when 2 files solve it
5. **Merge to main:** Always. Deploy from main only.
6. **Test via Telegram:** Every feature verified with multiple user patterns in Aliya's Telegram

---

## 🗺️ COMPLETE OVERHAUL SCOPE

See `AGENTIN_BEAST_MODE_PROMPT.md` for full specifications on all 42 pages.

### Priority Order:
**SPRINT 1 (Public):** Landing → Login → Signup → Forgot Password → /api/stats/public
**SPRINT 2 (Core):** Overview → Chat (all features) → Memory → Agent Settings → Voice
**SPRINT 3 (Productivity):** Reminders → Habits → Calendar → Automations → Workflows → Docs
**SPRINT 4 (AI):** AI Specialist → Website Builder → Image Gen → Video Gen → Tools → Recipes
**SPRINT 5 (Social):** Inbox → Gmail → Social Media → Proactive AI → Fleet
**SPRINT 6 (Account):** Analytics → Portfolio → Settings → Connections → Billing → Usage
**SPRINT 7 (System):** Terminal → Health → Activity → Roadmap → Explore
**SPRINT 8 (QA):** Full regression, mobile QA, accessibility, performance, security

---

## 📐 Per-Phase Requirements (Beast Mode Standard)

Before implementing:
1. Research competitors for this feature (name which ones)
2. Read ENTIRE file being modified
3. List all edge cases and error states
4. Define test scenarios for Telegram

After implementing:
1. TypeScript: zero errors
2. Server tests: all passing
3. Test in Telegram: min 3 user patterns
4. Mobile: verify at 375px
5. Error states: empty, loading, network fail
6. Update AI_HANDOFF.md

---

## 🎨 Design System (NEVER DEVIATE)
```css
--bg-primary: #05050A      /* Deep space */
--bg-secondary: #0C0C18    /* Cards */
--bg-tertiary: #12121F     /* Elevated */
--accent-cyan: #00F0FF     /* Primary */
--accent-green: #ADFF2F    /* Success */
--accent-pink: #FF2D78     /* Warning */
--accent-purple: #8B5CF6   /* Premium */
--text-primary: #F4F6FF
--text-secondary: #8892A4
--border: rgba(0,240,255,0.1)
```

Mobile: ≥375px | Touch targets: ≥44px | Bottom nav on mobile | dvh units for iOS

---

## 🤖 Telegram Test Protocol

ALL features tested via Telegram before marking complete.

Test patterns (use ALL for each feature):
- English power user
- Hinglish casual
- Business professional
- Student
- First-time user
- Mobile-only user

Send results to Aliya's Telegram:
```
✅ [Feature] [Pattern] - PASS: [what happened]
❌ [Feature] [Pattern] - FAIL: [error details]
```

Full regression: `node ops/aliya-sim-v5.mjs --verbose` → must stay 158/158

---

## ✅ Definition of Done

A feature is DONE only when:
- [ ] Works: desktop + mobile + Telegram
- [ ] TypeScript: 0 errors
- [ ] Server tests: all passing (≥2253)
- [ ] Audit: 158/158 maintained
- [ ] Brand guard: clean
- [ ] No console errors
- [ ] Loads in <3s on 3G
- [ ] Accessible (keyboard + screen reader)
- [ ] Error states handled (empty, loading, network fail)
- [ ] Responsive 375px → 1920px
- [ ] Handoff updated

---

## 📦 Branch Policy
- Branch: `ai/beast-sprint-<N>-<topic>`
- PR → main
- Merge to main after verification
- Tag each sprint: `git tag -a "beast-sprint-N" -m "Sprint N complete"`

---

## 🛠️ Commands
```bash
# Frontend
npm run dev | npm run build | npm run lint | npx tsc --noEmit

# Server
cd server && npm run dev | npm test | npx tsc --noEmit

# Docker
docker compose up -d --build geekspace && docker compose ps

# Full audit (158/158 required)
JWT_SECRET=... WEBHOOK_SECRET=... ADMIN_TOKEN=... \
  node ops/aliya-sim-v5.mjs --verbose

# Brand guard (zero tolerance)
npm run brand-guard

# Deploy (always clean static dir first)
npm run build && rm -rf /var/www/geekspace/assets && cp -r dist/. /var/www/geekspace/

# Staging
./scripts/staging.sh && ./scripts/smoke-staging.sh
```

---

## Architecture

### Message Router Pipeline (architectural heart)
`server/src/services/message-router.ts` processes ALL incoming messages (Telegram, WhatsApp, web chat):

1. **Channel detection** — normalize from Telegram/WhatsApp/web
2. **User resolution** — resolve user from channel ID or JWT
3. **Credit check** — verify token budget before LLM calls
4. **Memory injection** — load user memories + conversation context
5. **Fast-path evaluation** — 12 regex-based fast-paths (0 credits, <700ms):
   - image, website, screenshot, links, expense, multi-expense, focus, reminder, habit, briefing, list-reminders, doc-capture
6. **Intent classification** — `detectTaskIntent()` + `hasToolTrigger()` for 17+ tool categories
7. **Provider routing** — 6-tier waterfall: Ollama → Groq → Gemini Flash → OpenRouter → Together AI → Kimi K2
8. **ReAct loop** — up to 5 iterations with tool execution (42+ tools)
9. **Response formatting** — channel-specific (sanitizeForTelegram, etc.)
10. **Delivery** — send response via appropriate channel
11. **Keyword triggers** — fire-and-forget automation triggers on message content

### Key server files:
- `server/src/services/message-router.ts` — multi-channel handler + 12 fast-paths
- `server/src/services/llm.ts` — LLM router (6-tier waterfall)
- `server/src/services/action-executor.ts` — 42+ tool actions
- `server/src/services/automations-engine.ts` — automation execution, scheduling, keyword triggers
- `server/src/services/persona-engine.ts` — 5 personas × 14 actions
- `server/src/services/telegram-cards.ts` — inline keyboard card builders
- `server/src/services/durable-scheduler.ts` — SQLite-backed restart-safe job queue
- `server/src/services/proactive-engine.ts` — morning brief, overdue alerts, habit nudges
- `server/src/services/search-index.ts` — Meilisearch (typo-tolerant search)
- `server/src/services/search-vector.ts` — Qdrant + nomic-embed-text (semantic search)
- `server/src/services/graph-memory.ts` — entity extraction + relationship graph
- `server/src/services/browser-agent.ts` — Playwright headless Chromium
- `server/src/routes/docs.ts` — Agentin Docs API (18 endpoints, 30 tests)
- `server/src/routes/oauth.ts` — Google + GitHub OAuth 2.0

### Key frontend files:
- `src/dashboard/DashboardApp.tsx` — dashboard shell, sidebar, page routing
- `src/dashboard/pages/DocsWorkspacePage.tsx` — BlockNote editor + AI actions
- `src/dashboard/pages/AutomationsPage.tsx` — full automation builder with templates
- `src/components/AgentChatPanel.tsx` — streaming chat with RAF buffer + AbortController
- `src/services/api.ts` — typed Axios wrapper

### Infrastructure:
- `docker-compose.yml` — 9 containers + external Ollama/OpenClaw
- `caddy/Caddyfile` — reverse proxy, SPA routing, gate page
- Deploy: always `rm -rf /var/www/geekspace/assets` before `cp -r dist/.` (prevents stale chunks)

---

## CI Pipeline (`.github/workflows/ci.yml`)
4-stage pipeline — all must pass:
1. **static-checks** — lint + `tsc --noEmit` (frontend + server)
2. **unit-tests** — Vitest (2253+ tests)
3. **e2e-tests** — Playwright (60s timeout)
4. **smoke-tests** — build + health endpoint check

---

## Critical Gotchas
- DB: Docker `/app/data/geekspace.db`; local dev `server/data/geekspace.db`
- TypeScript: `noUnusedLocals/noUnusedParameters` enforced — remove ALL unused code
- Caddy static: ALWAYS `rm -rf assets` before deploying (2000+ stale chunks otherwise)
- Ollama on VPS: port 32778, model: qwen3:8b + nomic-embed-text
- Telegram: `sanitizeForTelegram()` on ALL outbound messages
- JWT: `{ sub: userId, jti: uuid }` NOT `{ userId }`
- PicoClaw timeout: 5s (falls back to Groq)
- Persona buttons: old format `reminder:done:ID`, new format `rem_done:ID` — both supported
- DashboardApp `validPages` array: must include ALL page IDs (missed 'docs' before — caused blank page)
- Rate limiting: 200 req/15min global (in-memory), 20 req/60s per Telegram chatId (Redis)
- Meilisearch IDs: alphanumeric + hyphens + underscores ONLY (no colons)
- Frontend build chunks: immutable cache headers → browser caches for 1 year → must clean old assets

---

## Aliya (Test User)
- User ID: `6813ac58-98fc-438b-88bb-4a8ef96fda53`
- Telegram chatId: `5337185054`
- Email: trendywink24.7@gmail.com
- Username: aliyabhatt

---

## 🔁 Checkpoint Protocol (Run After Every Sprint)
```bash
git add -A && git commit -m "beast: sprint N — [what was done]"
git push origin main
# Wait for CI green
git checkout live-production && git merge main --no-edit && git push origin live-production && git checkout main
# Update ops/AI_HANDOFF.md
```

---

## 🚀 Let's Rock It

Maximum effort. Maximum quality. Every page picture-perfect.
Every feature working end-to-end. Every test green.
Never lose context. Ship it. 🔥
