# Release Train — GeekSpace 2.0

> Tracks main→production deploy cadence. Production deploys from main only.

## Release Train Policy
- Deploy to production every **20–30 phases** OR for critical fixes
- Each train must pass: lint + typecheck + build + unit tests + critical E2E + smoke tests
- Tag commits: `release/R<N>-start` and `release/R<N>-end`
- Monitor logs 30 min post-deploy

## R1 — Phases 1–20 (2026-02-24)
- **Status:** Deployed ✅ (pushed to live-production after Phase 20)
- **Key features shipped:** Image/video gen, snooze, escalation, OAuth, recurring reminders, portfolio themes, session management, activity log, command palette, invite system, accessibility, compact mode
- **Tests at deploy:** ~245 unit tests
- **Known issues at deploy:** None critical

## R2 — Phases 21–42 (2026-02-25)
- **Status:** In main ✅ — NOT yet deployed to live-production
- **Phases merged:** 21 through 42
- **Tests at R2 baseline:** 385
- **Key features:** Activity search, webhook dashboard, sparklines, memory search, bulk reminders, reminder priorities, invite flow, snooze log, portfolio contact form, CSV export, category/priority filters, bulk-complete, portfolio stats API, celebration banner, code copy button
- **Deploy prerequisites:** All CI green, smoke tests pass, user explicit request
- **Target deploy:** User request or after Phase ~60–65

## R3 — Phases 43–70 (Deployed ✅)
- **Status:** Deployed ✅
- **Started:** Phase 43 (2026-02-25)
- **Goals:** Multi-user safety, mobile-first polish, integration reliability, XSS hardening, DB performance, feature parity, go-live readiness
- **Phase 43 complete:** 396/396 tests. 401 loop fix, remind_before reset, date grouping, relative timestamps, automations run_count wiring, XSS hardening, DB indexes.
- **Phase 44 complete:** 414/414 tests. Webhook retry, recurring reminder fix, notification badge, OAuth error handling, admin rate limit, structured logs, page skeleton.
- **Phase 45 complete:** 422/422 tests. OG entity-encode, duplicate index removal, mobile FAB, auth logout localStorage fix, UTC sparklines, CSP hardening.
- **Phase 46 complete:** 437/437 tests. Admin auth audit, webhook URL validation, connections empty state, settings unsaved changes warning.
- **Phase 70 complete:** 728/728 tests. Release train candidate. Version 3.1.0.
- **Version at train:** 3.1.0

---

## R4 — Phases 71–110+ (Deployed ✅)
- **Status:** Deployed ✅ | main = live-production = 7b53142
- **Started:** Phase 71 (2026-03-09)
- **Goals:** Full-stack AI capabilities, Telegram integration deepening, Indian market (Hinglish), habit/productivity engine, proactive intelligence, multi-agent orchestration
- **Key ships:**
  - Google OAuth + GitHub OAuth end-to-end (6 bugs fixed)
  - Domain migration: geekspace.space → ai.agentin.chat (full rebrand)
  - Back-nav logout dialog + history sentinel (useLayoutEffect)
  - Resend email live (agent@agentin.chat, all 4 flows)
  - Together AI wired (Llama 4 Maverick 17B×128E)
  - 6-tier LLM waterfall (Ollama → Groq → Kimi → Together → Edith → OR-free)
  - Full capabilities audit: 15✅/3⚠️/1❌/1🔲
  - crawl4ai web research + Tavily search + screenshot fast-path
  - Voice notes: Groq Whisper STT + edge-tts TTS (multilingual)
  - Phase 2 master prompt: 17 new tools + 6 new personalities
  - Expense Tracker (track_expense, list_expenses, set_budget)
  - Smart Reminders V2 (recurrence detection)
  - Global Search (/search across notes/reminders/habits/memories)
  - Multi-Agent Orchestrator (launch mode → Promise.all fan-out)
  - Telegram Inline Keyboards (Done/Snooze/Delete on reminders)
  - Telegram File Handling (photo vision + document extraction)
  - Brand purge: zero PicoClaw/GeekSpace refs in UI
  - Hinglish routing: hasToolTrigger + hinglishToEnglish() + Indian merchants
  - Habit Intelligence V2: getHabitInsights() + /habits V2
  - Proactive Engine V3: 30-min previews + 11:00 IST habit nudges
  - Bug fixes: create_note content, notes routing, context wipeout after long replies
- **Tests at deploy:** 2223 passed (127 test files)
- **Version:** 3.1.0

---

## R5 — Phase 5+ (Planned)
- **Status:** Planning
- **Goals:** Voice Intelligence V2, Smart Scheduling, AI Email Composer, Smart Search UI, Seedance Director Mode
- **Prerequisites:** CI green, smoke tests pass, user approval
