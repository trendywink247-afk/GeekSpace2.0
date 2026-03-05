# Full Site Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit every page of ai.geekspace.space (42 pages) documenting what works, what's broken, what's placeholder, mobile vs desktop issues, logic gaps, and improvement suggestions — one txt file per page plus a master summary.

**Architecture:** 6 parallel agents each own a group of pages. Each agent reads the TSX source, cross-references server routes, checks mobile responsiveness markup, and writes findings to `GeekSpace2.0/audit/pages/<N>-<page>.txt`. A final aggregation step produces `audit/AUDIT_SUMMARY.md`.

**Tech Stack:** React 19 + TypeScript + Express + SQLite. Source analysis only for protected pages; WebFetch for public pages.

---

## Per-Page File Format (ALL agents must follow this exactly)

```
PAGE: <name>
ROUTE: <url path>
STATUS: WORKING | PARTIAL | BROKEN | PLACEHOLDER | UI-ONLY

=== DESKTOP VIEW ===
[Layout structure, elements present, what's visible]

=== MOBILE VIEW ===
[Responsive classes, bottom nav, touch targets, overflow, scroll]

=== FUNCTIONALITY CHECK ===
[Each feature: WORKING / PARTIAL / BROKEN / MISSING]

=== LOGIC ISSUES ===
[Race conditions, missing validation, broken flows, bad UX patterns]

=== IMPROVEMENTS ===
[Priority HIGH/MED/LOW — specific actionable suggestions]

=== SERVER ROUTES USED ===
[API endpoints this page calls, missing routes, unused routes]
```

---

### Task 1: Agent 1 — Public Pages (Landing, Login, Explore, Portfolio, Privacy, Terms, ForgotPassword)

**Files to write:**
- `GeekSpace2.0/audit/pages/00-landing.txt`
- `GeekSpace2.0/audit/pages/01-login.txt`
- `GeekSpace2.0/audit/pages/02-forgot-password.txt`
- `GeekSpace2.0/audit/pages/03-explore.txt`
- `GeekSpace2.0/audit/pages/04-portfolio-public.txt`
- `GeekSpace2.0/audit/pages/05-privacy.txt`
- `GeekSpace2.0/audit/pages/06-terms.txt`

**Source files to read:**
- `src/landing/LandingPage.tsx`
- `src/landing/sections/HeroSection.tsx`
- `src/landing/sections/ActivitySection.tsx`
- `src/landing/sections/ConstellationSection.tsx`
- `src/landing/sections/ContactSection.tsx`
- `src/landing/sections/EngineSection.tsx`
- `src/landing/sections/PersonaSection.tsx`
- `src/landing/sections/SecuritySection.tsx`
- `src/landing/sections/PromptTemplatesSection.tsx`
- `src/onboarding/LoginPage.tsx`
- `src/onboarding/ForgotPasswordPage.tsx`
- `src/explore/ExplorePage.tsx`
- `src/portfolio/PortfolioView.tsx`
- `src/pages/PrivacyPage.tsx`
- `src/pages/TermsPage.tsx`

**Server routes to check:**
- `server/src/routes/auth.ts` (login, forgot password)
- `server/src/routes/portfolio.ts` (public portfolio view)
- `server/src/routes/oauth.ts` (Google/GitHub login buttons)

**Step 1: Read all source files listed above**

**Step 2: For each page, analyze and write the audit file using the standard format**

Check specifically:
- Landing: All 8 sections present? CTA buttons linked? Mobile hero layout? Animations work on mobile? Any broken links?
- Login: Form validation, OAuth buttons (Google/GitHub), error states, redirect after login, mobile keyboard handling
- ForgotPassword: Email input, submit flow, success/error state, back to login link
- Explore: Agent cards loading from API or hardcoded? Search/filter working? Mobile grid layout?
- Portfolio public: Dynamic data loading, contact button, social links, 404 handling, OG meta tags
- Privacy/Terms: Static content present? Last updated date? Mobile readable? Navigation back?

**Step 3: Write all 7 audit files**

---

### Task 2: Agent 2 — Onboarding Flow + Utility Pages (Status, Docs, Connect, Invite)

**Files to write:**
- `GeekSpace2.0/audit/pages/07-onboarding.txt`
- `GeekSpace2.0/audit/pages/08-status.txt`
- `GeekSpace2.0/audit/pages/09-docs.txt`
- `GeekSpace2.0/audit/pages/10-connect.txt`
- `GeekSpace2.0/audit/pages/11-invite.txt`

**Source files to read:**
- `src/onboarding/OnboardingPage.tsx`
- `src/onboarding/OnboardingWizard.tsx`
- `src/onboarding/steps/ProfileStep.tsx`
- `src/onboarding/steps/BioStep.tsx`
- `src/onboarding/steps/AgentStep.tsx`
- `src/onboarding/steps/PortfolioStep.tsx`
- `src/onboarding/steps/IntegrationsStep.tsx`
- `src/onboarding/steps/ReviewStep.tsx`
- `src/pages/StatusPage.tsx`
- `src/pages/DocsPage.tsx`
- `src/pages/ConnectPage.tsx`
- `src/pages/InvitePage.tsx`

**Server routes to check:**
- `server/src/routes/auth.ts` (register, onboarding complete)
- `server/src/routes/integrations.ts` (connect/invite tokens)

**Step 1: Read all source files**

**Step 2: For each page, analyze and write audit file**

Check specifically:
- Onboarding: All 6 steps present? Step validation? Can user skip steps? Data persisted between steps? Mobile progress bar? Back button?
- Status: Real health endpoints or hardcoded? Auto-refresh? Shows actual service status?
- Docs: Real content or placeholder? Searchable? Mobile readable?
- Connect: Token validation? What happens with invalid/expired token? Success state?
- Invite: Invite code entry? What does it unlock? Mobile layout?

**Step 3: Write all 5 audit files**

---

### Task 3: Agent 3 — Dashboard Core (Overview, Chat/Voice, Connections, Agent Settings, Memory)

**Files to write:**
- `GeekSpace2.0/audit/pages/12-dashboard-overview.txt`
- `GeekSpace2.0/audit/pages/13-dashboard-chat.txt`
- `GeekSpace2.0/audit/pages/14-dashboard-connections.txt`
- `GeekSpace2.0/audit/pages/15-dashboard-agent-settings.txt`
- `GeekSpace2.0/audit/pages/16-dashboard-memory.txt`

**Source files to read:**
- `src/dashboard/pages/OverviewPage.tsx`
- `src/dashboard/pages/ChatPage.tsx`
- `src/dashboard/pages/ConnectionsPage.tsx`
- `src/dashboard/pages/AgentSettingsPage.tsx`
- `src/dashboard/pages/MemoryManagerPage.tsx`
- `src/dashboard/DashboardApp.tsx` (nav, sidebar, mobile tabs)
- `src/components/AgentChatPanel.tsx`
- `src/components/AgentChatButton.tsx`
- `src/components/Navigation.tsx`

**Server routes to check:**
- `server/src/routes/chat.ts`
- `server/src/routes/integrations.ts`
- `server/src/routes/agent.ts`
- `server/src/routes/memory.ts`
- `server/src/services/llm.ts`

**Step 1: Read all source files**

**Step 2: Analyze and write audit files**

Check specifically:
- Overview: What widgets are shown? Are sparklines live data? Quick actions wired? Reminder badges? Mobile widget stack order?
- Chat/Voice: Voice input working (Web Speech API)? Message streaming? History loading? Model selector? Mobile keyboard pushes layout?
- Connections: Telegram ✅, WhatsApp "Coming Soon", others fake-connect? Status indicators accurate? OAuth flows?
- Agent Settings: Personality selector, name, system prompt — all save to DB? Accent color synced? Mobile layout?
- Memory: CRUD working? Search? Import/export? Memory type filters? Mobile scroll?

**Step 3: Write all 5 audit files**

---

### Task 4: Agent 4 — AI Features (Image Gen, Video Gen, Gallery, Website Builder, AI Tools, Capabilities)

**Files to write:**
- `GeekSpace2.0/audit/pages/17-dashboard-image-gen.txt`
- `GeekSpace2.0/audit/pages/18-dashboard-video-gen.txt`
- `GeekSpace2.0/audit/pages/19-dashboard-image-gallery.txt`
- `GeekSpace2.0/audit/pages/20-dashboard-website-builder.txt`
- `GeekSpace2.0/audit/pages/21-dashboard-ai-tools.txt`
- `GeekSpace2.0/audit/pages/22-dashboard-capabilities.txt`

**Source files to read:**
- `src/dashboard/pages/ImageGenPage.tsx`
- `src/dashboard/pages/VideoGenPage.tsx`
- `src/dashboard/pages/ImageGalleryPage.tsx`
- `src/dashboard/pages/WebsiteBuilderPage.tsx`
- `src/dashboard/pages/AISpecialistPage.tsx`
- `src/dashboard/pages/CapabilitiesPage.tsx`
- `src/dashboard/pages/tools/JsonFormatterPage.tsx`
- `src/components/MediaGallery.tsx`
- `src/components/CodePreviewCard.tsx`

**Server routes to check:**
- `server/src/routes/` (image-gen, video-gen, media, website-builder routes)
- `server/src/services/` (HuggingFace FLUX integration)

**Step 1: Read all source files**

**Step 2: Analyze and write audit files**

Check specifically:
- Image Gen: HuggingFace FLUX working? Model selector (preferred_image_model)? Prompt input? Download? Mobile portrait? Progress indicator?
- Video Gen: Any working provider? Pollinations blocked? Status shown to user? Fallback message?
- Gallery: Images loading from /app/data/img-cache? Pagination? Download/delete? Mobile grid?
- Website Builder: AI generation working? Preview rendering? Edit flow? channel:builder? Save/export? Mobile?
- AI Tools: JSON Formatter and others — fully functional? More tools planned/missing?
- Capabilities: Static content or dynamic? Accurate description of what agent can do?

**Step 3: Write all 6 audit files**

---

### Task 5: Agent 5 — Productivity (Reminders, Automations, Recipes, Planner, Social Media, Proactive AI, Focus)

**Files to write:**
- `GeekSpace2.0/audit/pages/23-dashboard-reminders.txt`
- `GeekSpace2.0/audit/pages/24-dashboard-automations.txt`
- `GeekSpace2.0/audit/pages/25-dashboard-recipes.txt`
- `GeekSpace2.0/audit/pages/26-dashboard-planner.txt`
- `GeekSpace2.0/audit/pages/27-dashboard-social-media.txt`
- `GeekSpace2.0/audit/pages/28-dashboard-proactive-ai.txt`
- `GeekSpace2.0/audit/pages/29-dashboard-focus-habits.txt`

**Source files to read:**
- `src/dashboard/pages/RemindersPage.tsx`
- `src/dashboard/pages/AutomationsPage.tsx`
- `src/dashboard/pages/RecipesPage.tsx`
- `src/dashboard/pages/PlannerPage.tsx`
- `src/dashboard/pages/SocialMediaPage.tsx`
- `src/dashboard/pages/ProactivePage.tsx`
- `src/dashboard/pages/FocusPage.tsx`

**Server routes to check:**
- `server/src/routes/reminders.ts`
- `server/src/routes/automations.ts`
- `server/src/services/automations-engine.ts`

**Step 1: Read all source files**

**Step 2: Analyze and write audit files**

Check specifically:
- Reminders: Create/edit/delete/snooze/complete all working? Overdue highlighting? Recurring reminders? Mobile add button?
- Automations: Create/trigger/run-log/enable-disable/delete? Webhook setup? Real cron? Test trigger?
- Recipes: What are recipes? Pre-built AI prompt templates? CRUD working? Categories?
- Planner: Calendar view? Task creation? Drag-and-drop? Integration with reminders?
- Social Media: Post scheduling? Which platforms connected? Real or fake posting?
- Proactive AI: What does this do? Scheduled suggestions? Based on what data?
- Focus & Habits: Habit tracking? Pomodoro? Session logging? Data persistence?

**Step 3: Write all 7 audit files**

---

### Task 6: Agent 6 — Communication + Insights + Account (Inbox, Gmail, Analytics, Usage, Billing, Settings, Terminal, Health, Activity, Roadmap, Fleet)

**Files to write:**
- `GeekSpace2.0/audit/pages/30-dashboard-inbox.txt`
- `GeekSpace2.0/audit/pages/31-dashboard-gmail.txt`
- `GeekSpace2.0/audit/pages/32-dashboard-analytics.txt`
- `GeekSpace2.0/audit/pages/33-dashboard-usage.txt`
- `GeekSpace2.0/audit/pages/34-dashboard-billing.txt`
- `GeekSpace2.0/audit/pages/35-dashboard-settings.txt`
- `GeekSpace2.0/audit/pages/36-dashboard-terminal.txt`
- `GeekSpace2.0/audit/pages/37-dashboard-health.txt`
- `GeekSpace2.0/audit/pages/38-dashboard-activity-log.txt`
- `GeekSpace2.0/audit/pages/39-dashboard-roadmap.txt`
- `GeekSpace2.0/audit/pages/40-dashboard-fleet.txt`

**Source files to read:**
- `src/dashboard/pages/InboxPage.tsx`
- `src/dashboard/pages/GmailPage.tsx`
- `src/dashboard/pages/AnalyticsPage.tsx`
- `src/dashboard/pages/UsageAnalyticsPage.tsx`
- `src/dashboard/pages/BillingPage.tsx`
- `src/dashboard/pages/SettingsPage.tsx`
- `src/dashboard/pages/TerminalPage.tsx`
- `src/dashboard/pages/HealthDashboardPage.tsx`
- `src/dashboard/pages/ActivityPage.tsx`
- `src/dashboard/pages/RoadmapPage.tsx`
- `src/dashboard/pages/PicoFleetPage.tsx`
- `src/dashboard/pages/PortfolioPage.tsx`

**Server routes to check:**
- `server/src/routes/inbox.ts` or equivalent
- `server/src/routes/billing.ts`
- `server/src/routes/activity.ts`
- `server/src/routes/health.ts`

**Step 1: Read all source files**

**Step 2: Analyze and write audit files**

Check specifically:
- Inbox: /inbox/count polled every 60s — what populates inbox? Telegram messages? Unread badge? Mark read?
- Gmail: Real Gmail OAuth connected? Or placeholder? If placeholder, what's shown?
- Analytics: Real usage data charts? Time range selector? Which metrics shown?
- Usage: Token usage, API call counts — live from DB? Chart types?
- Billing: Placeholder only (known gap from feature matrix)? Plans shown? Payment flow?
- Settings: Profile, theme, notifications, API keys, sessions — all tabs working? Data saves?
- Terminal: What commands does it support? Real shell or simulated? Safety guards?
- Health: Real SSE stream from /health/stream? Service status cards? Auto-refresh?
- Activity Log: Paginated? Filterable? Delete entries? Real data?
- Roadmap: Static or dynamic? Voting? Admin-editable?
- Fleet (PicoFleet): Agent fleet management? Sub-agent spawning? Status monitoring?

**Step 3: Write all 11 audit files**

---

### Task 7: Aggregate — Write AUDIT_SUMMARY.md

**File to write:** `GeekSpace2.0/audit/AUDIT_SUMMARY.md`

**Step 1: Read all audit txt files from Tasks 1–6**

**Step 2: Build the master summary with these sections:**

```markdown
# GeekSpace 2.0 / Agentin Chat — Full Site Audit
Date: 2026-03-05

## Status Overview Table
| # | Page | Route | Status | Mobile | Top Issue |
|---|------|-------|--------|--------|-----------|
...

## Summary Stats
- Total pages audited: 42
- WORKING: X
- PARTIAL: X
- PLACEHOLDER: X
- BROKEN: X
- UI-ONLY: X

## Top 10 Critical Issues (across all pages)
[Ranked by severity and user impact]

## Mobile-Specific Issues
[Issues that only appear on mobile viewports]

## Placeholder / Stub Pages (no real functionality)
[List of pages that are UI-only with no backend wiring]

## Recommended Fix Priority
### P0 — Fix Immediately (broken core flows)
### P1 — Fix Soon (degraded experience)
### P2 — Improve (missing features / polish)
### P3 — Future (nice to have)
```

**Step 3: Write `GeekSpace2.0/audit/AUDIT_SUMMARY.md`**

---

## Execution Notes

- Tasks 1–6 are fully independent and MUST be run in parallel
- Task 7 depends on Tasks 1–6 completing
- No code changes — this is read-only analysis
- If a server route file doesn't exist where expected, note it as "route not found / may be inline in index.ts"
- For mobile analysis: look for `sm:`, `md:`, `lg:` Tailwind breakpoints, `hidden md:flex` patterns, bottom nav presence, `overflow-x-hidden`, touch-action
- Brand check: flag any user-visible "picoclaw", "pico" references that aren't behind brand guard
