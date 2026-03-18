# Agentin Master Audit — 2026-03-19
**Branch:** ai/agentin-overhaul-v2 (from main @ 6e138b2)
**Baseline:** 2466 tests | 0 TS errors | 12/12 health | Brand clean

---

## EXECUTIVE SUMMARY

The platform has 41 dashboard pages, 53 routes, 87 services, and a 2207-line DB schema with 50+ tables. Feature coverage is extensive but the **autonomous agent architecture** (Decisions 1-5) is fundamentally incomplete — agents are personality skins on a shared pipe, not independent employees.

### Critical Architecture Gaps vs. 9 Decisions

| Decision | Status | Gap |
|----------|--------|-----|
| 1. Autonomous Agents | **RED** | agent_configs is 1 row/user, not per-agent. No memory namespacing. |
| 2. Specialist Sub-Agents | **YELLOW** | Multi-agent orchestrator exists but only for explicit "launch mode" |
| 3. Full Agentic Experience | **RED** | No task queue, no inter-agent comms, no visible collaboration |
| 4. GeekOS Hybrid | **YELLOW** | Container exists but unhealthy. Bridge routes exist. |
| 5. PicoClaw Fleet | **YELLOW** | Simple Go sidecar, not distributed fleet runtime |
| 6. Multi-Persona Users | **GREEN** | Hinglish, Indian merchants, personas exist |
| 7. Smart Surface | **RED** | No recommendation engine, no page reorganization done |
| 8. Chat Upgrades | **RED** | No @mentions, no inline artifacts, no streaming tool steps in UI |
| 9. Infrastructure Scaling | **RED** | No DB adapter, state bus in-memory only, no Redis pub/sub |

---

## P0 — CRITICAL (Must fix before launch)

### P0-1: Agent Architecture is Cosmetic, Not Autonomous
- `agent_configs` table: ONE row per user (not per-agent)
- All 9 personalities defined in `personalities.ts` but they're just prompt text
- No per-agent memory namespace (all memories shared via `user_memories` + `agent_memory`)
- No per-agent task queue
- No inter-agent communication
- **Impact:** Core vision of "3 autonomous employees" is impossible without this

### P0-2: Chat Page Missing All 3 Upgrades
- No @mention parsing/autocomplete for agent routing
- No inline artifact rendering (split-pane)
- Tool steps appear as static cards, not real-time streaming UI
- ChatPage is 1567 lines (needs extraction into sub-components)

### P0-3: No Unified Agent Router
- 6 fragmented routing paths: agent.ts, message-router.ts, multi-agent-orchestrator.ts, pico-kimi-bridge.ts, react-loop.ts, picoclaw.ts
- No single entry point for all agent messages
- @mention routing doesn't exist

### P0-4: State Bus Not Scalable
- `agent-state-bus.ts` uses in-memory `Map<string, Set<Response>>` (128 lines)
- No Redis pub/sub — crashes lose all SSE clients
- No delegation events, no inter-agent comm events
- Cannot scale to multiple instances

### P0-5: No Database Adapter Layer
- All 87 services use `db.prepare()` directly
- No abstraction for future PostgreSQL migration
- No query logging or performance monitoring

---

## P1 — IMPORTANT (Should fix for quality launch)

### P1-1: Page Merges Not Done
- MemoryPage (305L) + MemoryManagerPage (1023L) → should merge to MemoryHubPage
- ImageGenPage (993L) + ImageGalleryPage (307L) → should merge to CreativeStudioPage
- VideoGenPage (1407L) + MediaGalleryPage (179L) → should merge to CreativeStudioPage
- CapabilitiesPage (992L) → should fold into OverviewPage
- ConversationRatingPage (190L) → should fold into ChatPage

### P1-2: Giant Pages Need Component Extraction
Pages over 1000 lines (risk: unmaintainable):
- RemindersPage: 2144L
- SettingsPage: 2003L
- PortfolioPage: 1579L
- ChatPage: 1567L
- SocialMediaPage: 1532L
- OverviewPage: 1519L
- OfficePage: 1509L
- PicoFleetPage: 1502L
- CalendarPage: 1472L
- VideoGenPage: 1407L
- AutomationsPage: 1398L
- FocusPage: 1221L
- RoadmapPage: 1138L
- AnalyticsPage: 1102L
- GmailPage: 1099L
- MemoryManagerPage: 1023L
- ProactivePage: 1016L

### P1-3: UI Consistency Incomplete
- PageShell/PageHeader/SectionCard primitives created but only applied to 3 pages
- Inconsistent breakpoints: some pages use `sm:` others use `md:`
- Inconsistent spacing: `space-y-4` vs `space-y-6`
- Loading states: Most use spinners, not skeleton loaders
- Empty states: Many pages have minimal empty states

### P1-4: Agent Settings Not Per-Agent
- AgentSettingsPage (790L) has ONE config for all agents
- Need tabs: Weebo | Edith | Jarvis with independent settings
- No autonomy level per-agent (only global)
- No agent assignment to features

### P1-5: Overview Page Missing Agent Status
- No agent status strip at top
- No smart recommendations section
- No "Discover" section from CapabilitiesPage merge

### P1-6: Agent Office Needs Mission Control Upgrade
- OfficePage (1509L) has canvas + health panel + activity feed
- Missing: real-time task board, inter-agent comm view, per-agent metrics
- Missing: control actions (pause/boost/reset agents)

### P1-7: LLM Cost Optimization Gaps
- Response caching exists (Redis) but not semantic dedup
- Token budget system exists but no per-model cost optimization
- No smart routing by complexity BEFORE calling LLM
- Prompt compression exists but may not be applied everywhere

### P1-8: GeekOS Container Unhealthy
- `geekspace-geekos` shows as unhealthy in Docker
- Character files and bridge need investigation
- Blocks long-running task architecture

---

## P2 — IMPROVEMENT NEEDED

### P2-1: Landing Page
- 13 sections exist but no interactive agent demo
- No real stats from API (hardcoded social proof)
- No geo-detected INR pricing

### P2-2: Login/Onboarding
- OAuth works but email/password form is first (should be OAuth-first)
- No agent greeting on login page
- Onboarding wizard exists but no agent selection step

### P2-3: Proactive Engine Limited
- 6 proactive types exist (daily_briefing, overdue_alert, idle_check_in, etc.)
- Not per-agent (all proactive messages come from generic source)
- No smart frequency adjustment

### P2-4: Voice Chat Basic
- Push-to-talk works, TTS works
- No waveform visualization
- No per-agent voice identity
- No wake word detection

### P2-5: Design Assistant Basic
- Style selector + chat-based generation
- No brand kit builder, no social templates
- No export to Website Builder

### P2-6: Docs Workspace
- BlockNote editor works
- AI toolbar added (improve/expand/summarize/translate/rephrase/fix)
- No version history, no templates, no PDF export

### P2-7: Inbox Basic
- AI-triaged inbox exists
- Not unified across all channels (Telegram, email, portfolio contacts)
- No snooze functionality

---

## P3 — NICE TO HAVE

### P3-1: Recipes Page
- 6 hardcoded recipes
- No recipe creation wizard
- No marketplace or sharing

### P3-2: Roadmap Page
- Hardcoded items, not API-driven
- No user voting
- No feature request submission

### P3-3: Terminal Page
- Basic commands work
- No syntax highlighting
- No autocomplete

### P3-4: Health Dashboard
- Shows service status
- No real-time metrics
- No alert configuration

---

## DATABASE TABLES INVENTORY (50+ tables)

### Core
users, agent_configs, api_keys, reminders, integrations, portfolios, automations, usage_events, features, contact_submissions, activity_log, premium_sessions, subscriptions

### Auth & Security
user_sessions, token_blocklist, security_events, password_reset_tokens, password_reset_rate_limits, password_reset_audit, link_codes

### Memory & AI
agent_memory, conversation_log, user_memories, training_examples, briefings

### Content
generated_artifacts, artifact_domains, artifact_deployments, templates, generated_outputs, user_images, user_videos, video_jobs, docs (external)

### Communication
channel_links, agent_messages, message_reactions, telegram_messages, telegram_onboarding, inbox_messages (external), portfolio_contacts

### Scheduling & Automation
automation_logs, webhook_dead_letters, reminder_dead_letters, snooze_log, proactive_messages, planner_blocks, installed_recipes, day_passes

### PicoClaw/Fleet
pico_agents, pico_tasks, pico_cron_jobs

### GeekOS
user_agents

### Analytics
portfolio_visits, token_usage, free_models, model_changelog

### Dev
dev_audit_log, user_connections

### MISSING (needed for Decisions 1-5)
- **agent_tasks** — per-agent task queue (Decision 3)
- **agent_comms** — inter-agent communication (Decision 3)
- **agent_namespace column** on user_memories/agent_memory (Decision 1)
- **per-agent agent_configs** — need 3 rows per user, not 1 (Decision 1)

---

## ROUTES SECURITY AUDIT

### All 53 routes:
activity, admin, agent-state, agent, analytics, apiKeys, artifacts, auth, automations, billing, briefings, calendar, contact, dashboard, debug-routing, dev, directory, docs, features, files, focus, gate, geekos-bridge, geekos-llm-proxy, gmail, health, image, images, inbox, integrations, jobs, memory, models, oauth, pico, planner, portfolio, proactive, recipes, reminders, report, routes-list, search, social-media, suggestions, templates, test, usage, users, videos, voice, webhooks, workflows

### Auth Coverage
- Most routes use `requireAuth` middleware
- Public routes (health, auth, contact, gate, portfolio public, directory) correctly skip auth
- Admin routes use `requireAdmin` or `ADMIN_TOKEN` header check

### Rate Limiting
- Global: 200 req/15min per IP (middleware)
- Chat: 60 req/15min per user (Redis-backed)
- Telegram: 20 req/60s per chatId
- Auth: login-guard.ts with progressive lockout
- **Gap:** Some routes may not have specific rate limits beyond global

### Validation
- Zod schemas on critical routes (auth, agent, planner, docs)
- **Gap:** Not all routes use Zod — some rely on manual checks

---

## SERVICE ARCHITECTURE SUMMARY

### LLM Pipeline (6-tier waterfall)
```
Tier 1+6: Race(OpenRouter-free, Ollama qwen3:8b) → first wins
Tier 2:   Groq Llama 3.3 70B
Tier 3:   Groq Kimi K2
Tier 4:   Together AI Maverick
Tier 5:   Edith/Kimi K2.5
Tier 0:   Builtin error message
```

### ReAct Loop
- Max 5 iterations
- Emits state bus events (thinking, tool_call, tool_result, responding, done)
- Supports onStep callback for SSE streaming

### Tools (30+)
create_reminder, web_search, generate_image, generate_video, send_email, check_calendar, find_free_slot, create_memory, list_inbox, screenshot, browse, create_note, create_habit, log_expense, and more

### Agent State Bus (128 lines)
- In-memory SSE client registry (Map<userId, Set<Response>>)
- Events: idle, thinking, typing, tool_call, tool_result, responding, done
- No Redis backing, no delegation events, no inter-agent events

---

## EXECUTION PRIORITY

Based on this audit, the recommended execution order is:

1. **Phase 2: Backend Foundation** — Build the missing tables + services (unified agent router, per-agent memory, task queue, comms)
2. **Phase 3: Agent State Bus Upgrade** — Redis pub/sub, new event types
3. **Phase 4: Chat Page Upgrades** — The most visible user-facing change
4. **Phase 5: Page Merges** — Reduce page count from 41 to ~35
5. **Phase 6: Core Page Polish** — Overview, Office, Settings, Landing
6. **Phases 7-13: Remaining pages + infrastructure**

This order builds foundation first, then visible features, then polish.
