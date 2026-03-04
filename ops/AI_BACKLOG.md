# AI Backlog — Agentin (GeekSpace 2.0)

> **Vision:** Agentin is an AI OS ecosystem — a personal intelligence layer that knows you,
> manages your attention, connects your tools, and acts on your behalf. Every feature should
> make daily life measurably better without requiring manual effort from the user.
>
> **This file is the planner's brain.** When the factory queue is empty, the planner agent
> reads this file, picks the 5 highest-impact uncompleted items, writes detailed phase prompts
> (80-120 lines each with DB schemas + service specs + route specs + frontend spec + 30+ tests),
> appends them to phase-queue.txt, commits, pushes, and prints QUEUE_UPDATED.
>
> **Planner rule:** Always pick features that compound — each new feature should make existing
> ones more useful. Voice + notes + inbox + habits together > any one alone.

---

## ✅ Already Built (do NOT re-implement)

| Phase | Feature | Key tables/files |
|-------|---------|-----------------|
| 88 | Mobile dashboard | DashboardApp.tsx |
| 89 | Stripe payments + credits | user_credits, stripe_customers |
| 90 | Proactive AI engine | proactive-engine.ts, proactive_messages |
| 91 | Test coverage (1400+ tests) | server/src/test/* |
| 92 | Security hardening | rate limits, CSP, input sanitisation |
| 93 | Feature audit | all stubs fixed |
| 94 | Agent memory | user_memories, memory-service.ts |
| 95 | Google Calendar sync | calendar_events, calendar-sync.ts |
| 96 | Multi-agent workflows | workflows, workflow_runs, workflow-engine.ts |
| 97 | AI Inbox | inbox_messages, inbox.ts, InboxPage.tsx |
| 98 | AI Knowledge Base | notes, notes_fts, notes.ts, NotesPage.tsx |
| 99 | Voice Interface | useVoice.ts, useTTS.ts, VoiceButton.tsx |
| 100 | Gmail integration | gmail_messages, gmail-sync.ts, GmailPage.tsx |
| 101 | Focus Mode + Habits | focus_sessions, habits, habit_logs, FocusPage.tsx |
| 102 | Personal Analytics | analytics.ts, AnalyticsPage.tsx, Sunday Telegram report |

---

## 🔴 High Priority — Next Up

### phase-103-smart-search
**Global Ctrl+K command palette that searches everything.**
- Single search bar searches: notes, reminders, memories, inbox messages, chat history, habits, workflows
- SQLite FTS5 across all tables, results union-ed and ranked by recency + relevance
- AI re-ranks top 10 results by relevance to query intent (single LLM call)
- SearchPage: grouped results (Notes / Reminders / Messages / Memories / Habits) with keyboard navigation
- Ctrl+K anywhere in app: opens floating search modal (like VS Code command palette)
- Recent searches persisted to localStorage (last 10)
- Result click navigates to correct page and highlights item
- Tests: 35+ (cross-table FTS, ranking, auth isolation, keyboard shortcuts)

### phase-104-telegram-command-center
**Full Agentin control from Telegram — no browser needed.**
- /remind "call dentist Friday 3pm" → creates reminder, confirms with snooze options
- /note "idea: ..." → saves to knowledge base, AI tags it, confirms
- /focus 45 → starts 45-min focus session, notifies when done
- /habit log morning-workout → logs habit, shows current streak
- /brief → sends daily summary on demand
- /search keyword → searches all data, returns top 5 hits with links
- /memory "I prefer dark mode" → saves to user_memories
- /workflow list → shows available workflows, /workflow run <id> to trigger
- Natural language fallback: unrecognised messages routed to Weebo agent
- Handle inline keyboard buttons for confirm/snooze/cancel in Telegram
- Tests: 35+ (each command creates correct DB records, auth via telegram_user_id, inline buttons)

### phase-105-personality-customisation
**Users shape their agents' personality and communication style.**
- Per-agent personality profiles: tone (formal/casual/playful/terse), verbosity (brief/balanced/detailed), emoji usage (none/some/many), language (en-US/en-GB/hi/es)
- Stored in agent_personalities table (user_id, agent, tone, verbosity, emoji_level, language, custom_instructions TEXT)
- All LLM system prompts inject personality: "You are Weebo. Personality: casual, brief, use emojis. User custom: always use bullet points."
- Preview API: POST /api/agents/:agent/preview { message } → responds in configured personality
- AgentsSettingsPage (or Settings > Agents tab): per-agent sliders and dropdowns + live preview chat
- Tests: 30+ (personality injected into system prompt, overrides stored per user, preview API returns different tone)

### phase-106-file-attachments
**Send and receive files through agents.**
- Users upload images/PDFs/text files in ChatPage (paperclip icon)
- Images: pass to vision-capable model (describe, extract text, answer questions about)
- PDFs: extract text with pdfparse npm package, pass to Jarvis for Q&A
- Plain text/markdown/CSV: read and include in context
- Files stored at /data/uploads/{userId}/{uuid}.{ext}, 30-day TTL cleanup cron
- File size limit: 10MB, allowed types: jpg/png/gif/webp/pdf/txt/md/csv
- Attachment preview in ChatPage: thumbnail for images, icon for docs, progress bar during upload
- Files saved as notes in knowledge base (source=upload tag) after processing
- Routes: POST /api/files/upload, GET /api/files/:id, DELETE /api/files/:id, GET /api/files (list)
- Tests: 30+ (upload, type validation, TTL cleanup, auth isolation, PDF text extraction mock)

### phase-107-smart-reminders
**Reminders that learn from your patterns and support rich recurrence.**
- Snooze pattern detection: if same reminder snoozed 3+ times → AI suggests better time via Telegram
- Smart recurrence engine: "every weekday", "every 2nd Tuesday", "last Friday of month", "every N days"
- Batch create: user writes list of items separated by newlines → AI creates one reminder per item
- Reminder templates: Morning Routine, Weekly Review, Bill Payment, Medication, Gym Day (pre-built)
- Due-soon summary: 15min before each reminder fires, add to AI Inbox as urgent message
- Recurring reminder calendar view: show next 4 occurrences in ReminderPage
- Tests: 35+ (recurrence calculation for all types, snooze pattern detection, batch create, due-soon inbox)

---

## 🟡 Medium Priority

### phase-108-expense-tracker
**AI that categorises and analyses your spending.**
- expenses table: (id, user_id, amount REAL, currency TEXT, category TEXT, description TEXT, merchant TEXT, date INTEGER, source TEXT)
- budget_limits table: (user_id, category, monthly_limit REAL)
- AI auto-categorises on insert: "Uber Eats → food", "Netflix → entertainment", "AWS → tech"
- Overspend alert: when 80% of budget used, send Telegram warning
- ExpensePage: monthly bar chart (CSS only, no library), category breakdown, recent transactions list
- CSV export: GET /api/expenses/export?month=2026-03
- Add expense summary to weekly Telegram analytics report (from phase-102)
- Tests: 30+ (categorisation, budget threshold alerts, CSV export, overspend detection)

### phase-109-widget-dashboard
**Customisable home screen with drag-and-drop widgets.**
- user_dashboard_layout table: (user_id, layout TEXT) — JSON array of { widget_id, size, position }
- Available widgets: TodayReminders, InboxUnread, FocusStatus, HabitStreaks, AnalyticsSparkline, QuickChat, CalendarEvents, ExpenseSummary, NotesRecent, WorkflowsRecent
- Drag to reorder (react-beautiful-dnd or simple pointer events), size toggle (sm/md/lg)
- Layout saved to DB on change (debounced 2s)
- Dark/light/auto theme toggle (system preference detection)
- Mobile: vertical stack, no drag, settings screen for widget toggle
- Tests: 25+ (layout save/load, widget visibility, theme preference, auth isolation)

### phase-110-ai-email-composer
**Draft full emails from bullet points using Jarvis.**
- User writes bullets: "confirm Thursday meeting, 3pm, be brief and professional"
- Jarvis drafts subject + body in chosen tone: Professional / Friendly / Formal / Casual
- One-click: copy to clipboard or send directly via connected Gmail
- Template save: user marks good drafts as templates (saved to notes with tag=email-template)
- Template browser: list saved email templates, one-click load into composer
- EmailComposerPage under Communication group
- Tests: 25+ (tone modes produce different output, template save/load, Gmail send integration)

### phase-111-social-digest
**Morning digest of social activity from connected platforms.**
- Twitter/X: show recent mentions + DM count (via OAuth if available, else warn)
- Reddit: user's saved posts + hot posts in subscribed subreddits (OAuth)
- Show in AI Inbox as 'social' source type
- Morning briefing (proactive-engine.ts): include "You have 3 Twitter mentions, 2 Reddit replies"
- SocialPage: connection status per platform, recent activity feed
- AI daily digest: summarise social activity in one paragraph, send via Telegram at morning briefing time
- Tests: 25+ (mock API responses, auth per platform, digest format, inbox integration)

### phase-112-document-qa
**Ask questions about uploaded documents.**
- Extends phase-106 file attachments: adds Q&A chat per document
- Each uploaded document gets its own chat thread
- Chunked text extraction for large PDFs (split into 2000-char chunks, store in notes_fts)
- Q&A: user asks question → retrieve most relevant chunks via FTS → LLM answers from chunks only
- DocumentsPage: list uploads, per-document Q&A chat panel, "Add to Notes" button
- Tests: 25+ (text extraction, chunk storage, Q&A retrieval, auth isolation)

---

## 🟢 Lower Priority (Queue When Medium Done)

### phase-113-habit-social
- Share habit streaks to Telegram group
- Challenge a friend (via Telegram username) to a habit

### phase-114-api-developer-dashboard
- API key management (create/revoke/name keys)
- Rate limit dashboard per key
- OpenAPI spec viewer
- Webhook tester

### phase-115-pwa-push-notifications
- Full PWA manifest + service worker
- Web Push API notifications (not just Telegram)
- Installable on iOS/Android home screen

### phase-116-ai-coaching
- 90-day goal setting with Jarvis
- Weekly check-in conversation
- Progress tracking against goals
- Integrates with habits + focus + analytics

### phase-117-team-workspace
- Invite members to shared workspace
- Shared reminders, notes, workflows
- Role-based permissions (owner/editor/viewer)

### phase-118-live-translation
- Auto-detect user language
- All agent responses in user's preferred language
- Translate inbox messages on the fly

### phase-119-browser-extension
- Chrome/Firefox extension
- Highlight text → save to notes
- One-click reminder from any tab

### phase-120-health-integration
- Google Fit / Apple Health (web API)
- Steps + sleep in analytics dashboard
- AI correlates health with productivity

---

## Quality Bar for Phase Prompts (Planner Must Follow)

Every .txt phase prompt file MUST include all of these sections:
1. **Step 1 — Rehydrate**: cd /root/GeekSpace2.0, checkout, pull, read AI_HANDOFF.md + 2 relevant existing files
2. **Step 2 — DB schema**: exact SQL with all columns, types, indexes, foreign keys
3. **Step 3 — Service**: function signatures with TypeScript types, LLM call details, error cases
4. **Step 4 — Routes**: HTTP method + path + params + response shape for every endpoint
5. **Step 5 — Frontend**: component name, user interactions, nav group placement, empty state
6. **Step 6 — Tests**: 30-40 tests with specific scenarios listed by name
7. **Step 7 — Branch, commit, push**: exact bash commands
8. Last line: `Print: PHASE_COMPLETE: $BRANCH <test_count>`

Target prompt length: 80-120 lines. Vague prompts produce vague code. Be specific.

---

## Planner Decision Criteria

When choosing next 5 phases, prefer:
1. Features that **compound with already-built features** (search across notes + inbox + reminders > search alone)
2. Features users interact with **daily** (reminders, focus, habits > one-time setup features)
3. Features with **no missing env vars** — avoid Google OAuth features unless GOOGLE_CLIENT_ID is set
4. Features that make the **Telegram experience** richer (users should be able to do everything from phone)
5. Pick from 🔴 High Priority first, then 🟡 Medium, then 🟢 Lower

Current env vars confirmed available: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, JWT_SECRET, ENCRYPTION_KEY, STRIPE_SECRET_KEY
Env vars requiring user action first: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (for Calendar + Gmail)
