# Agentin — Master Brief

**Generated:** 2026-03-26 01:30 UTC
**Swarm agents:** Agent A (Security Auditor), Agent B (Repo Explorer), Agent C (Product Researcher)
**Topology:** Hierarchical, 3 parallel clusters, QueenCoordinator synthesis

---

## 1. VPS Health — AMBER

**System:** Ubuntu 24.04, kernel 6.8.0-106, 8-core CPU, 31 GiB RAM, 261 GiB free disk
**Uptime:** 4h15m since last reboot | **Load:** 10.51 (over-saturated)

### Critical Fixes (do before anything else)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| C1 | CRITICAL | **69+ orphaned node processes** (claude-flow, ruv-swarm, flow-nexus, playwright-mcp) consuming all 8 cores. Load avg 10.51. | `pkill -f 'ruv-swarm mcp start'; pkill -f 'flow-nexus mcp start'; pkill -f 'playwright-mcp'` — then ensure single supervised daemon |
| C2 | CRITICAL | **Redis password in process argv** — 11 `mcp-server-redis` processes expose `geekspace-redis-2026` in `/proc/*/cmdline` | Pass via `REDIS_URL` env var, not command-line arg |
| H1 | HIGH | **UFW inactive** — no kernel firewall. Any container binding to `0.0.0.0` is immediately public | `ufw default deny incoming && ufw allow 22,80,443/tcp && ufw enable` |
| H2 | HIGH | **Fail2ban not banning** — active SSH dictionary attacks from Vietnam IPs, 0 bans ever | Check `backend = systemd` in jail config; test with manual ban |
| H3 | HIGH | **Backup files world-readable** (644) — SQLite DB with user data exposed | `chmod 600 /root/backups/*.db /root/backups/*.tar.gz` + `umask 077` in backup script |
| H4 | HIGH | **No off-site backup** — all backups on same disk as production | Configure `rclone` remote + `GPG_PASSPHRASE` for encrypted off-site |
| H5 | HIGH | **CSP `connect-src` too broad** — `wss:` and `https:` allow XSS exfiltration to any domain | Tighten to explicit allowlist in Caddyfile |

### What's Working Well
- All backend ports bound to `127.0.0.1` (only 22, 80, 443 public)
- Key-only SSH for root, `.env` files are mode 600
- Daily backups at 03:00 with integrity checks (7-day retention)
- Caddy ACME auto-cert, strong security headers on main domains
- earlyoom protection, unattended-upgrades active
- PM2 in-container process supervision

### Resilience Score: 7/10
Strong fundamentals, weakened by missing firewall, no off-site backups, and process proliferation.

---

## 2. Codebase State — 92% Feature Complete

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind + shadcn/ui + Zustand |
| Backend | Express 4 + TypeScript + better-sqlite3 (WAL, 256MB mmap) |
| AI | OpenAI SDK → OpenRouter + Ollama + Groq + Kimi K2 |
| Infrastructure | Docker Compose (15 services) + Caddy + Redis + Qdrant + Meilisearch |
| Testing | Vitest (2552 tests) + Playwright E2E |

### Feature Completeness

**38 of 41 dashboard pages are COMPLETE with both UI and backend.**

| Status | Count | Details |
|--------|-------|---------|
| COMPLETE | 35 | Chat, Reminders, Automations, Calendar, Images, Videos, Fleet, Planner, Memory, Inbox, Gmail, Voice, Analytics, Portfolio, Billing, Usage, Settings, Connections, Workflows, Docs, Focus, Social Media, Proactive AI, Recipes, Capabilities, Health, Activity, Terminal, Roadmap, Agent Settings, Agent Office, Overview, Design Assistant, Creative Studio, Conversation Ratings |
| PARTIAL | 3 | AI Specialist (no dedicated backend), Video Gen (provider dependency), Connections (some "Coming Soon") |
| DEAD CODE | 5 files | MemoryPage.tsx, MemoryManagerPage.tsx, MediaGalleryPage.tsx, SkillsPage.tsx, OfficePage.old.tsx.bak |

### API Surface
- **50+ route files** with full CRUD implementations
- **96 database tables** (no ORM — raw `db.prepare()`)
- **Unauthenticated security hole:** `/api/logo/*` endpoints (AI generation) have NO `requireAuth` — unbounded credit spending

### Biggest Technical Risks

| # | Risk | Impact |
|---|------|--------|
| 1 | **`agent.ts` is 2,593 lines** — god route with 113 `db.prepare()` calls, chat, streaming, credits, memory, moderation all mixed | Every change risks regression; untestable at unit level |
| 2 | **No migration versioning** — 1,800-line `db/index.ts` with inline try/catch ALTER TABLE blocks; duplicate CREATE TABLE statements found | No rollback path; schema corruption = total data loss |
| 3 | **No repository layer** — all 50+ route files call `db.prepare()` directly | Cannot unit test routes; cannot refactor schema without touching every file |
| 4 | **SQLite single-file** — cannot scale horizontally for multi-container | Write contention if staging + prod share volumes |
| 5 | **No typed error hierarchy** — generic `Error` objects; credit/rate-limit logic duplicated across agent.ts, images.ts, videos.ts, voice.ts | Inconsistent error handling; hard to add new billing features |

### What to Build Next (ordered)
1. Fix logo API auth (5 min — add `requireAuth` middleware)
2. Add Workflows and Gmail to sidebar (10 min — they're fully built but invisible)
3. Split `agent.ts` into sub-routers (chat, config, memory, premium, streaming)
4. Extract repository layer for top 5 tables (users, conversations, reminders, images, subscriptions)
5. Implement proper migration runner (drizzle-orm or node-migrate)

---

## 3. Product Architecture

### New Navigation Grouping (6 Zones)

```
Zone 1 — HOME (pinned)
  Home (OfficeHomePage)    Chat

Zone 2 — MY AGENT
  Agent Office    Agent Settings    Memory
  Recipes    What Can I Do?    Conversation Ratings

Zone 3 — CREATE
  Images (gen + gallery unified)    Video Generator
  Website Builder    Design Assistant    AI Specialist

Zone 4 — WORK
  Reminders    Calendar    Workflows*    Automations
  Focus & Habits    Docs    Social Media    Proactive AI

Zone 5 — CONNECT
  Inbox (AI + Gmail unified)*    Voice Chat
  Fleet    Planner

Zone 6 — CONTROL
  Portfolio    Connections    Settings
  Account (Usage + Billing unified)    Health
  Activity Log    Roadmap

* = currently missing from sidebar despite being fully built
```

**Reduces sidebar from 9 groups → 6 groups.** Adds 2 invisible features (Workflows, Gmail). Merges 6 redundant entries.

### Feature Unification Decisions

| Merge | Canonical Name | Entry Point | Effort |
|-------|---------------|-------------|--------|
| Image Generator + Image Gallery | **Images** | `/dashboard/images` with Generate/Gallery tabs | Small — add tab bar to ImageGenPage |
| Gmail + AI Inbox | **Inbox** | `/dashboard/inbox` with AI/Gmail source tabs | Medium — create shell component |
| Fleet + Weebo Fleet + Planner | **Agent Office** subsection | `/dashboard/office` with tabs | Small — move sidebar entries |
| Personal Memory + Memory | **Memory** | `/dashboard/memory` (already merged in code) | None — just clean up route alias |
| Account + Settings + Connections | **Settings** | Add Account tab to SettingsPage | Small |
| Usage + Billing | **Account** | `/dashboard/account` with Plan/Usage tabs | Small — tab wrapper |

### Dashboard Revamp Spec

**Hero element:** The OfficeHomePage pixel-art canvas IS the hero — 9 animated agents at desks, aurora gradients + noise texture matching the landing page aesthetic. Already built and working.

**Dashboard HOME content area should show:**
1. Office canvas (60% width) — agent activity, clickable agent profiles
2. Sidebar panel (40%) — today's reminders, calendar, habits, weekly stats
3. **Add:** Quick action cards (Generate Image, New Reminder, Open Chat)
4. **Add:** Recent generations (last 3 images/videos as thumbnails)
5. **Add:** Streak/Focus status (one prominent number)
6. **Add:** Inbox unread count card (already polled every 60s)

**Design language continuity:** AtmosphericBackground in OfficeHomePage already matches landing page (noise overlay 0.035 opacity, aurora blobs, dot grid). Visual continuity is present — extend to all dashboard pages.

**Mobile:** Desktop-first with strong mobile support (swipe nav, pull-to-refresh, 44px tap targets, bottom tab bar for 5 key routes). The office canvas degrades gracefully.

### Onboarding Flow (Current → Proposed)

**Current (6 steps):** Profile → Bio → Portfolio → Integrations → Agent → Review

**Issues found:**
- No avatar selection
- Only 3 of 9 agents introduced (Edith/Jarvis/Weebo — missing Aria, Forge, Pulse, Echo, Cal, Nova)
- No guided first action after launch
- Free tier limits never communicated
- Telegram setup buried as optional despite being primary mobile channel

**Proposed (6 steps):**
1. **Profile** — Name + Username + Avatar picker (3 presets + upload)
2. **Agent** — Personality choice (all 3 core agents with descriptions)
3. **Focus** — "What do you want to do?" → Work / Create / Learn / Manage
4. **Connect** — Telegram (emphasized as primary) + Google Calendar
5. **First Task** — Guided: pre-filled prompt based on use_case selection
6. **Launch** — Plan overview (free tier limits) + enter dashboard

### Open Questions (Must Resolve)

| # | Question | Answer from Codebase |
|---|----------|---------------------|
| 1 | Is "Weebo" the product name? | **No.** Weebo is 1 of 9 agent personalities. Product = Agentin. Telegram bot = @agentinchatbot |
| 2 | Is Design Assistant separate? | **No.** It's a dashboard feature using `agent.ts` streaming. No dedicated backend. Could become standalone free tool |
| 3 | Is Voice Chat browser-based? | **Yes.** Web Speech API (STT) + server TTS via `execFile()`. Daily cap per plan (5 free, 30 pilot) |
| 4 | What does Proactive AI do? | AI-initiated messages on schedule. Categories: urgent/upcoming/insights/suggestions/celebrations. Autonomy levels: manual → autonomous. Quiet hours configurable |
| 5 | Is Fleet multi-agent? | **Yes.** PicoClaw local LLM fleet — spawn/configure parallel agent slots. Plan-gated: free=0, pilot=2, yearly=3 |
| 6 | Pricing model? | Credit-based, not feature-gated. Free=5K/mo, Pilot=₹299/mo (100K), Intro=₹999/2mo, Half-year=₹2,999/6mo, Yearly=₹4,999/yr (1.5M) |
| 7 | Target user? | Indian professionals — INR pricing, Telegram-first mobile, 9 domain-specialist agents for tech/creative/ops workers |

### Unresolved Decisions Needed

1. Should `OfficeHomePage` be permanent homepage or restore `OverviewPage`? (Currently controlled by a boolean flag, not a feature flag)
2. Is `Creative Studio` an official product feature or experimental? (Has sidebar entry + 744L implementation but not in product spec)
3. Should `Workflows` be promoted to sidebar or kept as power-user feature?
4. Confirm dead code files are safe to delete: MemoryPage, MemoryManagerPage, SkillsPage, MediaGalleryPage, TemplateGalleryPage
5. Telegram bot renamed from @Weebo_gs_bot to @agentinchatbot (done)

---

## 4. Sprint 1 Recommendation — This Week

| # | Task | Depends On | Scope |
|---|------|-----------|-------|
| 1 | **Fix critical security issues** — Kill orphan processes, enable UFW, fix Redis credential exposure, chmod backups | Nothing | 1 hour |
| 2 | **Fix logo API auth hole** — Add `requireAuth` to all `/api/logo/*` routes | Nothing | 5 minutes |
| 3 | **Add missing sidebar entries** — Workflows (Zone 4), Gmail→Inbox unified (Zone 5), Conversation Ratings (Zone 2) | Nothing | 30 min |
| 4 | **Implement new 6-zone sidebar grouping** — restructure `menuGroups` in DashboardApp.tsx | #3 | 2 hours |
| 5 | **Delete dead code** — 5 dead page files, clean up route aliases | #4 confirms which are safe | 15 min |

**After Sprint 1:**
- Sprint 2: Split `agent.ts` god route (2-3 days)
- Sprint 3: Dashboard quick-action cards + recent generations widget (1-2 days)
- Sprint 4: Onboarding flow revision (2-3 days)
- Sprint 5: Migration runner + repository layer extraction (3-5 days)

---

## 5. What "Done" Looks Like — Agentin v1

### Shippable Criteria

- [ ] All 41 features accessible from sidebar (no hidden pages)
- [ ] 6-zone navigation implemented and consistent
- [ ] Zero unauthenticated AI endpoints (logo API fixed)
- [ ] UFW enabled, fail2ban working, off-site backups configured
- [ ] Dashboard homepage shows: office canvas + quick actions + recent activity + stats
- [ ] Onboarding introduces agent personality + guided first task
- [ ] Dead code removed, no unused page files
- [ ] `agent.ts` split into <500-line sub-routers
- [ ] Free tier limits communicated during onboarding
- [ ] Telegram bot renamed to match Agentin brand

### What's Already Done (92%)
The codebase is remarkably complete. 38 of 41 features have full UI + backend implementations. The database has 96 tables. 2,552 tests pass. 15 Docker services run. The landing page, auth flow, and onboarding wizard are production-ready. The main gaps are organizational (sidebar structure, dead code) and architectural (god routes, no migration runner) — not feature gaps.

### Estimated Path to v1
With the security fixes done in Sprint 1 and the sidebar reorganization, Agentin is **~2 weeks from a shippable v1** for the Indian professional market. The product is built — it needs to be organized, secured, and polished.

---

*Generated by RuFlo swarm — 3 agents, 185 tool calls, 248K tokens, ~6 minutes wall time*
