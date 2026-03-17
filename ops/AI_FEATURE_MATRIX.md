# AI Feature Matrix — GeekSpace 2.0

> Living document. Updated each phase. Tracks to-and-fro verification status.
> Last updated: 2026-03-18 (Session 5 — Mobile/Web Consistency Overhaul)

## Legend
- ✅ Verified this phase
- ⚠️  Partial / known gap
- ❌ Unverified / broken
- — Not applicable

| Feature Domain | Core Routes/APIs | Happy Path | Round-Trip | Mobile | Unit Tests | E2E | Known Issues | Last Verified |
|---|---|---|---|---|---|---|---|---|
| **Auth / JWT / OAuth** | POST /auth/login, /register, /auth/google, /auth/github | ✅ | ✅ | ✅ | ✅ | ✅ | None known (OAuth error page added Ph44, 401 loop fixed Ph43, logout gs-auth fixed Ph45, oauth.test.ts Ph74) | Phase 74 |
| **AI Chat / LLM Routing** | POST /chat, GET /chat/history, GET /conversations/export | ✅ | ✅ | ✅ | ⚠️ mocked | ⚠️ partial | None known | Phase 42 |
| **Reminders (all variants)** | GET/POST/PATCH/DELETE /reminders, /reminders/:id/snooze, /reminders/stats | ✅ | ✅ | ✅ | ✅ | ✅ | None known (E2E mark-complete isolation fixed post-Ph75, data-testid on cards) | Post-Ph75 |
| **Automations / Webhooks** | GET/POST/PATCH/DELETE /automations, /webhooks, GET /automations/:id/runs | ✅ | ✅ | ✅ | ✅ | ⚠️ | None known (webhook retry Ph44, enabled toggle verified Ph44) | Phase 44 |
| **Connections (Telegram/WA)** | GET/POST /integrations, /webhooks/telegram, /webhooks/whatsapp | ✅ | ✅ | ✅ | ✅ | ✅ | None known (webhooks.test.ts + integrations.test.ts Ph74) | Phase 74 |
| **Portfolio / Public Pages** | GET/PUT /portfolio, GET /portfolio/:username, POST /portfolio/:username/contact | ✅ | ✅ | ✅ | ✅ | ✅ | None known (XSS fixed Ph43, OG entity-encode Ph45, view dedup Ph43) | Phase 45 |
| **Dashboard / Activity / Analytics** | GET /activity, DELETE /activity, sparklines | ✅ | ✅ | ✅ | ✅ | ⚠️ | None known (notification badge Ph44, sparklines UTC-bucketed Ph45) | Phase 45 |
| **Billing / Usage / Credits** | GET /billing, /usage, /credits | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | Billing history UI minimal | Phase 22 |
| **Admin Endpoints / Audit** | GET /admin/users, /admin/usage, /admin/export | ✅ | ✅ | — | ⚠️ | ⚠️ | None known | Phase 44 |
| **Health / Observability** | GET /api/health, SSE /health/stream | ✅ | ✅ | — | ✅ | ⚠️ | None known | Phase 34 |
| **Session Management** | GET/DELETE /auth/sessions | ✅ | ✅ | ✅ | ✅ | ⚠️ | Revoke is DB-only; token valid until expiry. Logout E2E fixed post-Ph75. | Post-Ph75 |
| **Memory / Agent Config** | GET/POST/DELETE /memory, GET/PATCH /agent/config | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 38 |
| **Snooze / Reminders UX** | POST /reminders/:id/snooze, GET /reminders/:id/snooze-history | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 40 |
| **Invite System** | POST /integrations/invite, accept flow | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 29 |
| **API Keys** | GET/POST/DELETE /api-keys, rotate, default | ✅ | ✅ | — | ✅ | ⚠️ | None known (api-keys.test.ts Ph74) | Phase 74 |
| **Contact Requests** | POST /contact/request, accept/decline, preferences | ✅ | ✅ | — | ✅ | ⚠️ | Rate-limit SQL bug fixed Ph74 (contact.test.ts) | Phase 74 |

| **Expense Tracker** | POST/GET /expenses, /budget | ✅ | ✅ | ✅ | ✅ | ⚠️ | Budget alert at 90% via Telegram | 2026-03-12 |
| **Habit Intelligence V2** | /habits slash, getHabitInsights() | ✅ | ✅ | ✅ | ✅ | ⚠️ | Streaks, status icons, briefing integration | 2026-03-12 |
| **Notes (create + search)** | create_note, search_notes tools | ✅ | ✅ | ✅ | ✅ | ⚠️ | Full content in reply; retrieval routing fixed | 2026-03-12 |
| **Focus Sessions** | start_focus tool, Telegram buttons | ✅ | ✅ | ✅ | ✅ | ⚠️ | Done early / Pause inline keyboard | 2026-03-12 |
| **Multi-Agent Orchestrator** | isLaunchModeRequest, runMultiAgentOrchestration | ✅ | ✅ | — | ✅ | ⚠️ | 3 parallel agents, 6 credits | 2026-03-12 |
| **Telegram Inline Keyboards** | callback_query handler | ✅ | ✅ | — | ✅ | ⚠️ | Reminder + focus buttons | 2026-03-12 |
| **Telegram File Handling** | handlePhotoMessage, handleDocumentMessage | ✅ | ✅ | — | ✅ | ⚠️ | Photo vision (Groq) + doc extraction | 2026-03-12 |
| **Voice Notes** | Groq Whisper STT + edge-tts TTS | ✅ | ✅ | — | ✅ | ⚠️ | Multilingual Hindi/Telugu/English | 2026-03-12 |
| **Web Research** | Tavily + crawl4ai + fetchAndExtract | ✅ | ✅ | — | ✅ | ⚠️ | Screenshot fast-path, links fast-path | 2026-03-12 |
| **Proactive Engine V3** | sendReminderPreviews, sendHabitNudges | ✅ | ✅ | — | ✅ | ⚠️ | IST-aware, Redis dedup | 2026-03-12 |
| **Daily Briefing** | generateBriefing, habit insights | ✅ | ✅ | — | ✅ | ⚠️ | Active streaks + at-risk in LLM prompt | 2026-03-12 |
| **Hinglish Routing** | hasToolTrigger + hinglishToEnglish | ✅ | ✅ | — | ✅ | ⚠️ | Indian merchants auto-categorized | 2026-03-12 |
| **Google/GitHub OAuth** | /api/oauth/google, /api/oauth/github | ✅ | ✅ | ✅ | ✅ | ✅ | Passport.js, JWT-only, no sessions | 2026-03-12 |
| **Context Preservation** | getConversationContext(16K), trimConversationHistory | ✅ | ✅ | — | ✅ | ⚠️ | Truncates instead of drops long messages | 2026-03-12 |
| **Global Search** | /search slash command | ✅ | ✅ | — | ✅ | ⚠️ | notes/reminders/habits/memories | 2026-03-12 |

## To-and-Fro Gap Summary (Open Items)
| Gap | Fix Phase | Priority |
|-----|-----------|----------|
| Billing history UI is placeholder only | Future | Low |
| Telegram file handling E2E needs real Telegram | Future | Medium |
| Health monitor Telegram alerts | ✅ Done Session 5 | — |
| Image/video gen rate limits | ✅ Done Session 5 | — |
| Mobile bottom nav safe area (iPhone X+) | ✅ Done Session 5 | — |
| pb-24 padding on all 30+ dashboard pages | ✅ Done Session 5 | — |
| iOS PWA install guide | ✅ Done Session 5 | — |
| Voice Intelligence V2 (multi-lang TTS responses) | Future | High |
| Smart Scheduling (calendar conflict detection) | Future | High |
| Seedance Director Mode (FAL_KEY needed) | Future | Low |
