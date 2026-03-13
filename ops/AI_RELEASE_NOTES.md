# Release Notes — Agentin Chat

> User-facing changes by phase. Written before each merge to live-production.

---

## Phase 7 (2026-03-13) — Infrastructure + Fast-Paths + 9 Bug Fixes

*Status: Deployed to live-production (a792abe)*

### What's New
- **SearXNG self-hosted search**: Free metasearch engine replaces paid Tavily as primary search provider. Redis caching (1h TTL)
- **Meilisearch**: Typo-tolerant instant search engine deployed for future notes/reminders/habits search
- **Qdrant vector DB**: Semantic memory search deployed for future conversation context retrieval
- **Reminder fast-path**: "remind me to X at Y", "yaad dila dena kal 9 baje meeting" — all work instantly, 0 credits, <700ms
- **Habit fast-path**: "gym done", "yoga kiya aaj", "log meditation" — instant logging, 0 credits
- **10 total fast-paths**: image, website, screenshot, links, expense, focus, reminder, habit, briefing, list-reminders — all bypass LLM
- **Telegram typing indicator**: Shows "typing..." while processing every message
- **/reminders slash command**: Lists all pending reminders in Telegram

### What's Fixed (9 bugs from 75+ pattern testing)
- **Reminder fast-path now works**: detectTaskIntent() was intercepting reminder messages before they reached the fast-path — patterns removed
- **No more false web searches**: Habit messages like "did my running today" no longer trigger SearXNG searches
- **Hinglish reminders work**: "yaad dila dena" (two separate words) now correctly parsed — was expecting concatenated "diladena"
- **"Show me my agenda" works**: Briefing regex fixed for optional daily/weekly prefix
- **Better Hinglish detection**: 20 new common words added (aaj, kal, kaisa, mausam, etc.) — prevents Chinese PicoClaw routing
- **Reminder deletion works**: FK constraint error resolved — inbox_messages references cleared before delete
- **Launch mode not hijacked**: "launch mode: create a blog outline" no longer triggers website builder
- **Telegram rate limit spacing**: Test patterns spaced 8-10s apart to avoid Telegram API limits

### Under the Hood
- 3 commits: 4a63370, 36cc8d6, a792abe
- 5 parallel test agents verified 75+ patterns across all capabilities
- Search pipeline: SearXNG (free) → Tavily (paid fallback) → crawl4ai smart search
- Health endpoint: 12 services monitored (added searxng, meilisearch, qdrant)
- All 2223 tests passing, CI green on every commit

---

## Bug Fix Run (2026-03-12) — Context + Notes Fixes

*Status: Deployed to live-production (7b53142)*

### What's Fixed
- **Notes now show full content**: When you ask Agentin to write a detailed note (e.g. "make notes on the President of India"), the full content is now shown immediately in the reply — no more "Done." responses
- **"Send me my notes" now works**: Phrases like "send the notes here", "show me my notes", "give me my notes" now correctly fetch and display your saved notes
- **Follow-up questions work after long replies**: Asking follow-up questions after Agentin gives a long answer (e.g. detailed notes, research summaries) now correctly understands the context. Previously, the conversation history was silently dropped, causing nonsensical replies

---

## Phase 4 Completion Run (2026-03-12) — Brand + Hinglish + Habit V2 + Proactive V3

*Status: Deployed to live-production (19aa040)*

### What's New
- **Hinglish support**: You can now chat in mixed Hindi-English naturally — "kal 9 baje reminder set karo", "aaj gym kiya", "Swiggy pe 200 spent" all work correctly
- **Indian merchant auto-categories**: Swiggy, Zomato, Ola, Uber, Amazon, Flipkart, Netflix, Hotstar expenses are auto-categorized
- **Habit Intelligence V2**: `/habits` now shows streak status with icons (🔥 on track, ⚠️ at risk, ❌ broken, 🆕 new) and personalized nudges
- **Habit insights in daily briefing**: Active streaks and at-risk habits appear in your morning briefing
- **30-min reminder preview**: You get a preview message 30 minutes before any reminder fires
- **Habit idle nudge**: If you haven't logged a habit in 2+ days, Agentin nudges you at 11:00 AM IST
- **Brand refresh**: All UI strings now say "Agentin" — no more GeekSpace/PicoClaw references anywhere

### Under the Hood
- `preview_sent` column added to reminders (additive migration, safe on existing data)
- Redis dedup for all proactive messages (no spam)
- `/search` bug fixed: was looking for wrong column name in memories table

---

## Phase 4+5+8 (2026-03-12) — Multi-Agent, Inline Keyboards, File Handling

*Status: Deployed to live-production (2b9facd)*

### What's New
- **Multi-Agent Orchestrator**: Say "launch mode — help me plan X" or "brainstorm with all agents" to fan out to 3 parallel specialists (Forge+Aria+Pulse for content, Nova+Pulse+Echo for research, Echo+Forge+Cal for career)
- **Reminder action buttons**: When Agentin sets a reminder via Telegram, you get ✅ Done / 💤 Snooze 1h / 🗑️ Delete buttons inline
- **Focus session buttons**: Starting a focus session gives ✅ Done early / ⏸️ Pause buttons
- **Photo analysis**: Send any photo to Agentin on Telegram — it analyses it with vision AI and offers to save as a note
- **Document handling**: Send PDF or text files — Agentin extracts the content and saves it as a note

---

## Phase 3 (2026-03-12) — Expense Tracker + Smart Reminders + Global Search

*Status: Deployed to live-production (3f99c73)*

### What's New
- **Expense Tracker**: "I spent ₹200 on Swiggy" → logs automatically. `/expenses` shows your spending. Set budget limits and get alerts at 90%
- **Recurring reminders**: "Remind me every day at 9am" / "weekly Monday reminder" — Agentin detects recurrence automatically
- **Global search**: `/search <query>` searches across notes, reminders, habits, and memories
- **Budget alerts**: Get notified on Telegram when you hit 90% of any budget category

---

## Phase 2 (2026-03-12) — 17 New Tools + 9 Personalities

*Status: Deployed to live-production (2bce2d8)*

### What's New
- **17 new tools**: create_note, track_habit, start_focus, create_flashcards, meeting_notes, code_review, github_pr, seo_audit, generate_social_post, create_automation, youtube_summarize, get_briefing, list_workflows, run_workflow, generate_video_story, summarize_url, search_notes
- **6 new personalities**: Aria (creative strategist), Forge (senior engineer), Pulse (growth marketer), Echo (research analyst), Cal (career coach), Nova (data scientist). Plus existing Weebo, Edith, Jarvis
- **Named agent routing**: "@Nova what's the data?" or "hey Forge, review this code" switches agent mid-conversation
- **Slash commands**: /proactive, /study, /habits, /notes, /expenses, /search
- **Health alerts**: State-transition Telegram alerts for admin users

---

## Phase 109 (2026-03-07) — Conversation Quality Rating

*Status: Complete, pending merge to main*

### What's New
- **Rate AI conversations**: New "Conversation Ratings" page at `/dashboard/training` lets you review your past AI conversations and rate them 1-5 stars for quality.
- **Interactive star rating**: Click any star on a conversation to score it — the rating saves instantly with a confirmation toast and persists across sessions.
- **Paginated history**: Conversations load in pages of 20, showing your message and the AI's reply side by side for easy review.

### Under the Hood
- `quality_score INTEGER` column added to `conversation_log` via additive, idempotent ALTER TABLE migration (safe on existing data)
- `GET /api/agent/conversations/ratings` — paginated conversation pairs with current quality_score
- `POST /api/agent/conversations/:id/rating` — stores 1-5 star score; validates range, returns 404 for unknown/other-user conversations
- 9/9 new tests in `phase109.test.ts`

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

