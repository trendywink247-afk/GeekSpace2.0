# Release Notes — GeekSpace 2.0

> User-facing changes by phase. Written before each merge to live-production.

---

## Post-Phase 82 (2026-03-02) — Store Safety + Polish

*Status: Committed to main*

### What's New
- **Flag AI responses**: Click the ⚑ Flag button (appears on hover) on any AI message to report it. Reports are reviewed by the team.
- **AI safety notice**: A dismissable banner "AI can make mistakes — always verify important information" now appears in the chat panel (dismissed once per session).
- **Delete account**: Settings → Security → Danger Zone now has a "Delete My Account" button with password confirmation. All data is permanently erased immediately.
- **User blocking**: Backend infrastructure for blocking/unblocking users is in place (messaging feature coming in a future phase).

### Under the Hood
- `POST /api/report` — flag AI responses (reason: harmful/inaccurate/inappropriate/other)
- `POST|DELETE /api/users/:id/block` + `GET /api/users/blocked` — block infrastructure
- `POST /api/auth/delete-account` — password-verified full data cascade deletion
- Content filter service: word-list + regex safety check on all chat messages (non-blocking — only logs, never stops messages)
- 3 new DB tables: `reports`, `blocked_users`, `moderation_log`
- 34 new server-side tests — 1043 total

---

## Post-Phase 81 (2026-03-01) — Image Generation Pipeline

*Status: Committed to main*

### What's New
- **Chat image generation**: Type `/image [your prompt]` in any chat to generate an image — result appears inline as a chat bubble with a download link
- **Image gallery**: New "Image Gallery" section in the dashboard shows your last 30 generated images in a responsive grid with prompts, timestamps, and download links
- **Daily image cap**: Free users get 5 image generations/day. Paid plans get 20/day. Cap-hit users see a clear upgrade prompt inline in chat.
- **Async generation**: Images generate in the background — chat stays responsive while Pollinations AI creates your image (10–20 seconds)

### Under the Hood
- `POST /api/image/generate` — enqueues `image:generate` job, returns `{jobId}`
- `GET /api/image/gallery` — last 30 images from `user_images` table
- `GET /api/image/file/:id` — user-isolated redirect to stored image URL
- Cap tracked via `usage_events` table with `tool='image.generate'`
- TODO stub for local Stable Diffusion / Ollama vision model when available on VPS

---

## Post-Phase 80 (2026-03-01) — Voice Pipeline (STT + TTS)

*Status: Committed to main*

### What's New
- **Voice recording**: Tap the microphone button to record audio — your voice is transcribed and sent as a chat message using OpenAI Whisper (async job, non-blocking)
- **Text-to-speech**: Every agent message has a speaker icon — tap it to hear the response read aloud via OpenAI TTS (async job, plays automatically when ready)
- **Daily voice cap**: Free users get 5 voice calls/day (STT + TTS combined). Paid plans get 30–100/day. Cap-hit users see a clear upgrade prompt.
- **Async job polling**: All voice operations run in the background — never blocks the chat UI. Status tracked via `GET /api/jobs/:id`.

### Under the Hood
- `POST /api/voice/transcribe` — raw audio upload (up to 10MB), per-route body parsing, returns `{ jobId }`
- `POST /api/voice/speak` — JSON `{ text }`, returns `{ jobId }`
- `GET /api/jobs/:id` — polls job status; user-isolated (403 masqueraded as 404)
- Voice cap enforced via `usage_events` table; `voice.stt` and `voice.tts` tools logged per call
- TODO stubs for local Whisper / piper-tts when VPS audio deps are available

---

## Post-Phase 79 (2026-03-01) — Structured Memory Pipeline + Reminder Consistency

*Status: Committed to main*

### What's New
- **Smarter reminders**: Reminders now include related memory context — if the agent knows your timezone, project name, or preferences, it includes relevant facts in the notification message
- **Ollama memory extraction**: After every AI chat response, the local Ollama model extracts and remembers facts, goals, and preferences — goes beyond simple keyword matching
- **Weekly memory summary**: Every Sunday the agent auto-summarizes everything it knows about each user into a concise profile, stored as a searchable memory entry

### Under the Hood
- Ollama extraction uses `temperature: 0.1` for deterministic JSON output; strips markdown code fences before parsing
- Extraction is fire-and-forget (non-blocking): never slows down chat responses; falls back to regex if Ollama is unavailable
- Weekly summary cron runs at 10:00 IST (04:30 UTC) on Sundays via hourly check
- Reminder delivery enriched with up to 2 related memories (non-fatal, falls back to plain message on error)

---

## Post-Phase 78 (2026-03-01) — Telegram/WhatsApp Stability + Connections Polish

*Status: Committed to main*

### What's New
- **WhatsApp disclaimer**: Dialog now shows "Utility flows only — reminders, OTP, notifications" with link to Agentin web app
- **Telegram connection polish**: Connection card now shows "Last message: X ago" from actual Telegram activity
- **Reminder dead-letter monitoring**: Failed Telegram reminder deliveries are now logged to `reminder_dead_letters` table; viewable via admin dashboard
- **Telegram status API**: `/api/integrations/telegram/status` now returns `connected`, `lastPing`, and `botConfigured` fields

### What's Fixed
- **Telegram disconnect atomicity**: Unlinking Telegram now uses a DB transaction — no more orphaned state if any of the 3 DB ops fail
- **Connection activity tracking**: `integrations.last_sync` now updates on every incoming Telegram/WhatsApp message (previously only updated on link)
- **Auth rate limits verified**: Login (10 req/15min) and signup (5 req/15min) limits confirmed working

---

## Post-Phase 75 (2026-02-28) — Infrastructure + CI Hardening

*Status: Committed to main*

### What's New
- **Staging environment**: Isolated staging on `staging.agentin.chat` with separate DB/Redis, shares AI services with production
- **Autonomy audit system**: 12-check automated audit (production health, staging, containers, disk, memory, OpenClaw, git, tests, SSL) runs daily via Cronicle
- **Scheduled monitoring**: Daily staging smoke tests and weekly Docker space reports via Cronicle

### What's Fixed
- **E2E test suite fully green**: Fixed 2 failing tests (logout strict mode violation, reminders test ordering interference) — CI now passes all 79 E2E tests
- **CI pipeline cleanup**: Removed redundant `test.yml` workflow that duplicated `ci.yml`
- **OpenClaw resilience**: Systemd watchdog timer ensures OpenClaw container alias survives Hostinger container recreation

### Under the Hood
- Added `data-testid="reminder-card-{id}"` to reminder cards for reliable E2E targeting
- Cronicle connected to geekspace network for direct staging container access
- Tracked Cronicle config reference in `ops/cronicle/` for reproducibility
- Autonomy loop tooling: orchestrator script, deploy script, smoke tests, rules document

---

## Phase 1 (2026-02-24) — Reliability + Image Generation

*Status: In Progress*

### What's New
- **Image generation**: Ask your agent to generate any image — "draw a cyberpunk city at night", "create a logo for my SaaS" — and get a live image back instantly. Powered by Pollinations.AI (free, no limits).

### What's Fixed
- **Cleaner Telegram/WhatsApp replies**: Action confirmations (like "Reminder set!" or "Site generated!") now only appear when an action actually ran. Previously they appeared on every message.
- **Connections page responsiveness**: Clicking "Connect" no longer freezes all other buttons on the page. Each integration now has its own loading state.
- **More stable server startup**: Scheduler failures are now logged with clear error messages instead of being silently swallowed.

### Under the Hood
- Health monitoring now supports up to 25 concurrent SSE connections (was 5)
- Server startup logs cluster/worker information for easier debugging
- Exponential backoff on connection status polling (reduces unnecessary API calls)

---

## Previous Phases

### Smart Escalation + Capabilities (2026-02-24)
- Telegram now uses native swipe-reply detection to route answers to the right visitor question
- Added "What Can I Do?" page showing all 20+ agent capabilities
- First-use guided tour walks new users through key features
- Generated websites now send a direct preview link in chat instead of "open your dashboard"


---

## Post-Phase 102 (2026-03-05) — Full Site Audit + 4 Webview Layout Fixes

*Status: Merged to main · Deployed to production*

### What's New
- **Site-wide bug sweep**: 36 bugs fixed across 42 pages — chat SSE streaming, automations config, memory CRUD, OAuth display, gallery unification, brand fixes, mobile touch targets (44px minimum), privacy toggles, and video generation warning banner
- **Image generation**: Now using HuggingFace FLUX via `router.huggingface.co` — fully working in production
- **Video generation**: Warning banner shown + Generate disabled (no free provider available from Hostinger BOM datacenter)
- **Chat page**: SSE streaming now correctly handled; conversation history loads on mount

### Layout & UX Fixes (Webview)
- **Portfolio page**: Header now wraps on medium viewports with sidebar open — no more content clipped by `overflow-x: hidden`
- **Website Builder → Templates tab**: Fixed double-heading when `TemplateGalleryPage` embedded inside tab (`embedded` prop added)
- **Capabilities → "What can I do"**: Pipeline layout now uses `lg:` breakpoint (1024px+) instead of `md:` — correct with sidebar open
- **Health tab**: Loads immediately via parallel REST fallback; reduced SSE retry wait from ~225s to ~14s; loading state shows error + Retry button

---

## Post-Phase 96 (2026-03-05) — Multi-Agent Workflows

*Status: Merged to main*

### What's New
- **Workflows page** (`/dashboard/workflows`): Build multi-agent chains — connect Weebo, Jarvis, and Edith in sequence. Each node passes its output as context to the next.
- **Pre-built workflow templates**: Morning Briefing + Research pipeline + Code Review chain included out of the box
- **Workflow builder UI**: Visual drag-style node list with agent picker, step descriptions, and run history

### Under the Hood
- `GET/POST /api/workflows` — CRUD for user workflows
- `POST /api/workflows/:id/run` — execute a workflow chain synchronously, returns full step log
- `workflow_runner.ts` — orchestrates sequential agent calls, captures per-step output and error state
- `user_workflows` + `user_workflow_runs` DB tables

---

## Post-Phase 95 (2026-03-05) — Google Calendar Sync

*Status: Merged to main*

### What's New
- **Calendar page** (`/dashboard/calendar`): Connect your Google Calendar — events sync automatically and appear in a weekly/monthly view
- **Schedule-aware briefings**: Weebo's morning briefing now includes today's calendar events when Google Calendar is connected
- **OAuth token storage**: Per-user Google Calendar tokens stored encrypted in DB

### Under the Hood
- `GET/POST /api/calendar/events` — list + sync calendar events
- `GET /api/calendar/connect` + `/callback` — Google OAuth 2.0 flow
- `calendar-sync.ts` — fetches upcoming events, stores in `calendar_events` table
- `proactive-engine.ts` updated to inject calendar context into briefings

---

## Post-Phase 94 (2026-03-05) — Long-Term Agent Memory

*Status: Merged to main*

### What's New
- **Memory page** (`/dashboard/memory`): View, search, and delete your AI's long-term memory — facts the agent has extracted from your conversations
- **Context injection**: Agent now injects relevant memories into each prompt (top 5 by recency + relevance)
- **Personal memory store**: Per-user, fully isolated memory entries with timestamps

### Under the Hood
- `GET/POST/DELETE /api/memory` — CRUD for memory entries
- `memory.ts` service — extract facts from chat, inject into prompt context
- `user_memory` DB table

---

## Post-Phase 93 (2026-03-05) — Feature Audit + Automation Stub Fixes

*Status: Merged to main*

### What's New
- Automation stubs wired to real trigger engine — previously no-op stubs now actually schedule/fire
- 19 new server-side tests covering previously untested automation flows
- Proactive engine integration verified end-to-end

