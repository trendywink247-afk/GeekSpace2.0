# GeekSpace 2.0 / Agentin Chat — Full Site Audit
**Date:** 2026-03-05
**Site:** ai.geekspace.space
**Pages audited:** 42
**Method:** Source code analysis (TSX + server routes) + mobile/desktop view inspection

---

## Status Overview

| # | Page | Route | Status | Mobile | Top Issue |
|---|------|-------|--------|--------|-----------|
| 00 | Landing Page | `/` | WORKING | ISSUES | Fake "Live Activity" data; /docs + /status links 404; famous names as placeholder data |
| 01 | Login | `/login` | WORKING | OK | OAuth buttons disabled in UI despite backend being fully implemented |
| 02 | Forgot Password | `/forgot-password` | WORKING | OK | Server response format mismatch (works accidentally); no OTP resend cooldown |
| 03 | Explore | `/explore` | WORKING | OK | Decorative Filter icon implies functionality; stale closure hides fetch errors |
| 04 | Portfolio Public | `/portfolio/:username` | WORKING | OK | Social link double-protocol bug; chat panel duplicated in JSX (150 lines × 2) |
| 05 | Privacy Policy | `/privacy` | WORKING | ISSUES | Contact email not tappable (span not mailto); navigate(-1) exits app from direct link |
| 06 | Terms of Service | `/terms` | WORKING | ISSUES | No governing law clause; same navigate(-1) issue; billing terms premature |
| 07 | Onboarding | `/onboarding` | WORKING | OK | OpenRouter API key silently discarded; server errors swallowed; Back hidden on Review |
| 08 | Status | `/status` | WORKING | ISSUES | CSS typo `h10` (missing dash); no auto-refresh; header overflows on narrow mobile |
| 09 | Docs | `/docs` | PLACEHOLDER | OK | All 18 articles are non-clickable stubs; no real documentation content |
| 10 | Connect | `/connect/:token` | WORKING | OK | Brand leak "GeekSpace" logo (not "Agentin Chat"); success CTA routes to /login not /signup |
| 11 | Invite | `/invite` | WORKING | OK | No pre-validation of invite code; signup redirects to /dashboard not /onboarding |
| 12 | Dashboard Overview | `/dashboard` | WORKING | ISSUES | Response Time stat card unreachable; onboarding checklist is localStorage-only; stat drag broken on mobile |
| 13 | Chat | `/dashboard/chat` | PARTIAL | ISSUES | No streaming (50-70s sync wait); no chat history persistence; code blocks render as plain text |
| 14 | Connections | `/dashboard/connections` | PARTIAL | ISSUES | GitHub/Google/Twitter/LinkedIn/Location are fake connects; Telegram dialog not a modal (missed on mobile) |
| 15 | Agent Settings | `/dashboard/agent` | WORKING | OK | Mixed auto-save vs button-save with no labeling; form clobbering on store refresh; wrong icon on System Instructions |
| 16 | Memory Manager | `/dashboard/memory` | WORKING | OK | No Add/Edit Memory UI despite endpoints existing; window.confirm broken in PWA/WebView |
| 17 | Image Generator | `/dashboard/image-gen` | WORKING | ISSUES | Assigned Agent is decorative (not used in generation); Edit mode does not do real img2img |
| 18 | Video Generator | `/dashboard/video-gen` | BROKEN | ISSUES | ALL free video generation paths broken (Pollinations blocked from Hostinger); credits deducted on failure |
| 19 | Image Gallery | `/dashboard/gallery` | PARTIAL | OK | Uses different API endpoint than Image Gen — images from /image-gen never appear here |
| 20 | Website Builder | `/dashboard/website-builder` | WORKING | ISSUES | iframe has no sandbox attribute; dev mode unusable on mobile; Weebo slot assignments not server-persisted |
| 21 | AI Tools | `/dashboard/tools` | PARTIAL | OK | Only one tool (JSON Formatter) implemented despite "Specialist Tools" branding |
| 22 | Capabilities | `/dashboard/capabilities` | WORKING | OK | Video Generation listed as working (it is broken); slot count inconsistency (3 vs 6) |
| 23 | Reminders | `/dashboard/reminders` | WORKING | OK | isOverdue lookup by datetime string (not ID) can false-positive; no bulk-active-delete confirmation |
| 24 | Automations | `/dashboard/automations` | WORKING | ISSUES | Action configuration absent from UI — telegram-message, create_reminder, etc. create non-functional automations |
| 25 | Recipes | `/dashboard/recipes` | PARTIAL | OK | No pre-install integration check; no preview of what recipe will do before installing |
| 26 | Planner | `/dashboard/planner` | PLACEHOLDER | OK | Pure static "Coming Soon" card — no functionality whatsoever |
| 27 | Social Media | `/dashboard/social-media` | PARTIAL | ISSUES | Posts tab loads O(n) sequential API calls; no edit on accounts; only Instagram/Facebook supported |
| 28 | Proactive AI | `/dashboard/proactive` | WORKING | OK | Schedule hardcoded IST times; en-IN locale hardcoded for all users; single global toggle only |
| 29 | Focus & Habits | `/dashboard/focus` | WORKING | OK | All API failure catch blocks are empty (silent failures); "View deferred" clears count but doesn't show messages |
| 30 | AI Inbox | `/dashboard/inbox` | WORKING | ISSUES | Action buttons ~28px touch target (below 44px); no polling — new messages invisible without refresh |
| 31 | Gmail | `/dashboard/gmail` | PARTIAL | ISSUES | CSS typo renders broken icon; reply silently disabled when inbox_id missing; possible double /api prefix bug |
| 32 | Personal Analytics | `/dashboard/analytics` | WORKING | ISSUES | Heatmap tooltip hover-only (invisible on touch); API paths missing leading slash |
| 33 | Usage Analytics | `/dashboard/usage` | WORKING | OK | Partial API failures shown as $0 data with no warning; pull-to-refresh doesn't reset pagination |
| 34 | Billing | `/dashboard/billing` | WORKING | OK | Two billing systems (credits + Stripe) unexplained; no downgrade/cancel button; no payment method management |
| 35 | Settings | `/dashboard/settings` | WORKING | ISSUES | Privacy toggles are UI-only (not saved); default name shows "Alex Chen" for new users; tabs overflow on mobile |
| 36 | Terminal | `/dashboard/terminal` | WORKING | ISSUES | `gs usage today` divides monthly by 30 (wrong); `gs deploy` simulates fake deployment; copy hover-only on mobile |
| 37 | Health Dashboard | `/dashboard/health` | WORKING | ISSUES | Retry button 24px (too small); SSE may silently fail if auth header required; REST fallback shows "Disconnected" even when working |
| 38 | Activity Log | `/dashboard/activity` | WORKING | ISSUES | Pull-to-refresh fires but doesn't update state; individual delete hover-only (inaccessible on mobile); category filter is client-side over paginated data |
| 39 | Roadmap | `/dashboard/roadmap` | PARTIAL | OK | All roadmap items hardcoded; release notes stuck at phases 70-72 (months old); window.confirm for delete |
| 40 | Weebo Fleet | `/dashboard/pico` | WORKING | OK | Tasks tab doesn't auto-refresh; cron config JSON not validated before submit |
| 41 | Portfolio Management | `/dashboard/portfolio` | WORKING | ISSUES | No unsaved-changes warning; drag-to-reorder broken on mobile; meta_description uses unsafe TypeScript cast |

---

## Summary Stats
- **WORKING:** 26 pages
- **PARTIAL:** 9 pages
- **BROKEN:** 1 page (Video Generator — all free providers blocked)
- **PLACEHOLDER / UI-ONLY:** 2 pages (Docs, Planner)
- **Total critical bugs identified:** 47
- **Total mobile-specific issues:** 19

---

## Top 20 Critical Issues (Cross-App)

1. **Video Generator** — All free video generation is broken. Pollinations video endpoint is blocked from Hostinger IPs (530/timeout). "Seedance Lite" and "Veo 2" silently map to Pollinations. No warning shown to users. Credits may be deducted on failed openrouter-video attempts. — **Severity: CRITICAL**

2. **Image Gallery vs Image Generator** — Two completely separate data sources. `/dashboard/gallery` calls `GET /api/image/gallery` (old async route); `/dashboard/image-gen` calls `GET /api/images` (new sync route, different table). Images generated on Image Gen page are invisible in Gallery and vice versa. Empty state in Gallery misleads users who have images in Image Gen. — **Severity: CRITICAL**

3. **Chat — No Streaming** — All LLM responses are synchronous (POST + wait). Ollama (llama3.1:8b) takes 50-70 seconds. Users see only a spinner for this entire duration. `POST /api/agent/chat/stream` (SSE endpoint) exists on server but is never called by ChatPage. — **Severity: CRITICAL**

4. **Chat — No History Persistence** — Every navigation to `/dashboard/chat` resets the message array to empty. `GET /api/agent/conversations` endpoint exists but is never called on mount. Users lose all conversation context on every page change. — **Severity: CRITICAL**

5. **Automations — Action Configuration Missing** — The Create/Edit automation dialog has no fields for action payloads. Telegram-message automations have no message text field. Create-reminder automations have no reminder text field. Call-API automations lose their webhook URL on re-edit. Result: most automation action types create silent no-ops. — **Severity: CRITICAL**

6. **OAuth Buttons Disabled** — Google and GitHub OAuth buttons are disabled in the Login UI with "OAuth coming soon" text, but the backend OAuth routes in `oauth.ts` are fully implemented (Google Strategy, GitHub Strategy, callback handlers, session management). Feature is built server-side but blocked client-side. — **Severity: HIGH**

7. **Settings — Privacy Toggles Not Saved** — Five privacy toggles (showInDirectory, showAvatar, showLocation, showProjects, showActivity) are rendered and interactive but have no save handler. Changes appear to work but are silently discarded. Users cannot actually control their privacy settings from this UI. — **Severity: HIGH**

8. **Memory Manager — No Add/Edit UI** — Users cannot manually add memories or correct AI-extracted ones. `POST /api/agent/memory` and `PUT /api/agent/memory/:id` endpoints exist on the server but have no frontend UI. The agent uses these memories in every chat response via system prompt injection. — **Severity: HIGH**

9. **Onboarding — OpenRouter API Key Silently Discarded** — Step 2 (Agent) has a visible "Have your own API key?" section with an input for OpenRouter credentials. The value is never included in `getStepData(2)`. Users who enter their key see no error — it is simply lost on Continue. — **Severity: HIGH**

10. **Connect Page Brand Leak** — The `/connect/:token` page (public-facing, first thing external users see) shows "GeekSpace" logo text instead of "Agentin Chat". This is a public page visited by non-users accepting invitations. — **Severity: HIGH**

11. **Docs Page — Non-Functional Articles** — The Docs page has 6 sections with 3 articles each, all styled with hover effects implying interactivity. All 18 articles are non-clickable divs that navigate nowhere. No real documentation content exists. Security button on landing page and footer Docs link both route to this broken page. — **Severity: HIGH**

12. **Portfolio Social Links — Double Protocol Bug** — Social links are constructed as `https://${portfolio.social.github}`. If the stored value already includes `https://`, the resulting URL is `https://https://...` — a broken link. No protocol check is performed before prepending. — **Severity: HIGH**

13. **Invite Page — Post-Signup Redirect Wrong** — After successful signup via `/invite`, the user is navigated to `/dashboard` instead of `/onboarding`. Newly created users have `onboardingCompleted = false` but bypass the onboarding flow entirely. — **Severity: HIGH**

14. **Video Generator — Misleading Model Names** — "Seedance Lite" maps to Pollinations (blocked). "Veo 2 (via OpenRouter)" sends a chat-completions request, ignores the response, then calls Pollinations (blocked). Neither model works as advertised, and no UI warning is shown. — **Severity: HIGH**

15. **Agent Settings — Form Clobbering** — The settings sync `useEffect` has a large dependency array including all `agent.*` fields. Any background store update (e.g., another component calling `updateAgent`) will overwrite unsaved local edits in the form without warning. — **Severity: HIGH**

16. **Dashboard — Stat Drag Broken on Mobile** — The bento stat cards use HTML5 drag API which does not fire on mobile touch devices. No `onTouchStart/Move/End` handler is provided. Mobile users cannot reorder their stat cards. — **Severity: HIGH**

17. **Activity Log — Pull-to-Refresh Does Not Update** — `handlePullRefresh` fires the API call but does not update the `entries` state from the response. The refresh gesture provides haptic/visual feedback but data does not reload. — **Severity: HIGH**

18. **Gmail — CSS Typo Breaks Icon** — Line 145: `<Mail className="w-ztext-[#00F0FF]" />` — invalid Tailwind class. The Mail icon in the Gmail connection card header renders with no width or color. — **Severity: HIGH**

19. **Connections — Telegram Polling Has No Max Attempts** — Telegram linking polls with exponential backoff but `telegramPollAttempts` increments indefinitely with no ceiling. If a user leaves the dialog open without completing the link, polling runs forever until the dialog is closed. — **Severity: HIGH**

20. **Settings — Default Profile Shows Demo Data** — Profile form initializes `name` from `user?.name || 'Alex Chen'`. A new user whose `user.name` is null sees "Alex Chen" and "alex@example.com" as pre-filled form values — demo credentials visible to real users. — **Severity: MEDIUM**

---

## Mobile-Specific Issues

- **Inbox Action Buttons** — Mark-read, archive, delete buttons are ~28px (p-1.5). Well below the 44px minimum touch target (WCAG 2.5.5). Critical: these are the primary interaction buttons on the Inbox page.
- **Activity Log Delete** — Individual entry delete is hover-only (`group-hover:opacity-100`). Touch devices have no hover state. Mobile users cannot delete individual activity entries.
- **Terminal Copy Button** — Copy button on command output blocks is hover-only. Completely inaccessible on mobile.
- **Health Dashboard Retry Button** — 24px height (h-6). Well below 44px minimum touch target. Hard to hit on mobile when the SSE stream fails.
- **Portfolio Management Drag-to-Reorder** — Uses HTML5 drag events on project cards. Standard HTML5 drag/drop does not fire on touch. Mobile users cannot reorder projects.
- **Dashboard Stat Card Drag** — Same issue as Portfolio: HTML5 drag-only, no touch fallback.
- **Automations Action Buttons** — Action buttons are h-10 w-10 (40px), 4px short of the 44px recommendation.
- **Status Page Header Overflow** — On 320px screens, "Last checked: HH:MM:SS · v3.1.0 · Xh Ym" overflows or crashes into the Refresh button with no flex-wrap.
- **Settings Tab Bar** — Horizontal TabsList with 6 tabs may overflow on narrow screens. No dropdown or scrollable tab bar alternative provided.
- **Portfolio Management Tab Bar** — Same issue as Settings: 5+ tabs without horizontal scroll or dropdown fallback.
- **Gmail Sync/Disconnect Buttons** — min-h-[32px] — below 44px minimum.
- **Connect Page Submit Button** — No explicit min-h set; relies on Button component default (~40px).
- **Analytics Heatmap Tooltip** — Fixed-position hover tooltip. Zero functionality on touch devices. Mobile users cannot inspect individual day data.
- **Forgot Password OTP Inputs** — Six w-11 boxes at 320px screen: 6×44px + 5×8px gaps = 304px. May be too tight on very narrow screens.
- **Website Builder Dev Mode** — Three code textareas for HTML/CSS/JS with no syntax highlighting. Essentially unusable on mobile. No "desktop-only" warning shown.
- **Social Media Account Buttons** — h-8 w-8 (32px) action buttons on account cards.
- **Proactive AI Refresh Button** — Ghost icon-only button with no explicit min-h. Likely under 44px on mobile.
- **Focus Add Habit Button** — min-h-[36px] — slightly below 44px recommendation.
- **Connections Status Filter Chips** — No `overflow-x:auto` wrapper on mobile. May clip on narrow screens.

---

## Placeholder / Stub Pages (No Real Functionality)

### Docs (`/docs`)
- 6 accordion sections with 3 stub articles each
- All 18 article cards have hover effects but are non-interactive divs
- No links to actual documentation, no code examples, no real content
- Rate limit value hardcoded (may not match actual server config)
- This page is linked from the landing page footer, the Security section CTA, and the Status page footer

### Planner (`/dashboard/planner`)
- Pure static "Coming Soon" card with a CalendarCheck icon and description text
- Zero interactive elements, zero API calls, zero backend routes
- Accessible to all authenticated users
- Description references "Weebo fleet" — brand-correct but feature is entirely absent

### Partial Stubs (Functional Shell, Missing Core Feature)

- **AI Tools (`/dashboard/tools`)** — Only JSON Formatter implemented. The page is presented as "AI Specialist Tools" (plural) with a tab container ready for more tools, but only one tab exists.
- **Capabilities (`/dashboard/capabilities`)** — Static page; Video Generation listed as working when it is broken; all content is hardcoded with no CMS backing.
- **Roadmap (`/dashboard/roadmap`)** — Roadmap items and release notes are hardcoded in component. Release notes show only phases 70-72 (months old). Requires code deploy to update.

---

## Security & Data Issues

1. **Invite Endpoint — No Pre-Validation Rate Limiting** — `GET /api/integrations/invite/:token/info` has no rate limiting. A malicious actor can enumerate tokens. The accept endpoint also has no rate limit on the public path.

2. **Website Builder Iframe — No Sandbox Attribute** — `getPreviewHtml()` injects raw user-provided HTML/CSS/JS into an iframe via `contentDocument.write()`. The iframe has no `sandbox` attribute. User-authored JavaScript can call `parent.location.href` or access `parent` context, potentially escaping the sandboxed preview.

3. **Health Dashboard — Publicly Visible Server Internals** — The Health page is accessible to all authenticated users (no admin gating) and exposes: request counts, error rates, endpoint paths (top endpoints table), memory usage, and all service component statuses. This may expose server architecture and traffic patterns to users.

4. **Telegram Polling — Potential Resource Exhaustion** — Telegram link polling on the Connections page has no maximum attempt cap. If many users leave the dialog open without completing the link, the server receives continuous `/api/integrations/telegram/status` polling requests indefinitely.

5. **Agent Settings — Silent Save Failure** — When `updateAgent()` fails, the catch block does nothing. The store is already optimistically updated. The user sees no error, and the client shows data that differs from the server until the next page reload.

6. **Memory Manager — Silent Delete on Error** — `handleDelete` removes the memory from local state before the API call completes. If the server rejects the delete, the item disappears from the UI but persists on the server. On next page load, it reappears — data inconsistency.

7. **Contact Form Nonce — Redis Failure Degrades Silently** — Portfolio contact form fetches a nonce for rate limiting. If Redis is down, the nonce fetch fails silently and the form submits without nonce validation. Intentional graceful degradation, but worth noting.

8. **Telegram Notification Permission** — In the Connect page server route, owner notification is sent when `agentCfg.notif_connections !== 0`. A NULL value in the DB also passes this check (enables notifications). Should check `=== 1` for explicit opt-in.

9. **API Key Storage** — API keys tab in Settings allows users to store third-party keys (OpenRouter, etc.). Keys are stored encrypted server-side (AES-256 per MEMORY.md), which is correct, but the UI shows a plain password input with no guidance on key rotation policy or expiry.

10. **Forgot Password — Response Format Mismatch** — Frontend checks `res.data.success && res.data.error` but server returns `{ message: "..." }` with no `success` field. Code advances to OTP step by accident (both conditions are falsy → falls through). Works but is fragile: any server response format change could break the flow.

---

## Brand Inconsistencies

1. **Connect Page (`/connect/:token`)** — Logo text reads "GeekSpace" (not "Agentin Chat"). This is a public-facing page visible to external users. Should read "Agentin Chat" or "Agentin".

2. **Onboarding Step 2** — Agent personality cards show labels "Weebo", "Edith", "Jarvis" which are agent persona names — brand-correct. However, the collapsible "Have your own API key?" section references "OpenRouter" which is an external brand name — this is acceptable as it is the actual provider.

3. **Username Preview on Signup** — Login page signup mode shows subdomain preview as `username.agentin.chat`. The actual deployed domain is `ai.geekspace.space` or `ai.agentin.chat`. Preview may not match the user's actual subdomain.

4. **Status Page** — `COMPONENT_LABELS` maps the internal key `'picoclaw'` to the label `'Weebo Engine'`. This is brand-correct in terms of what users see, but the internal key leaks in code comments and server responses.

5. **Capabilities Page** — Correctly uses "Weebo" for the fleet agent persona. References "Weebo Fleet" which aligns with brand rules.

6. **Website Builder** — Tab is labeled "Weebos" (for fleet agent management). Consistent with branding.

7. **Terminal** — Command prefix is `gs` (GeekSpace), not `agentin`. The `gs deploy` fake command outputs "GeekSpace deployment" flavor text. Low visibility but technically a brand inconsistency.

8. **SEO — Portfolio Page Title** — Portfolio page sets `document.title = "${name} | GeekSpace"`. Should be `"${name} | Agentin Chat"` or `"${name} | Agentin"`.

---

## Recommended Fix Priority

### P0 — Fix Immediately (broken core user flows / data loss / security)

1. **Video Generator** — Show a prominent banner: "Video generation is temporarily unavailable — no working free provider is reachable from this server." Block Generate button for known-broken models (pollinations, seedance-lite). Prevent credit deduction on generation requests that will certainly fail.

2. **Image Gallery vs Image Generator data split** — Unify both pages to use the same `GET /api/images` endpoint. Remove or redirect the old `GET /api/image/gallery` endpoint, or synchronize the two tables. Update empty state messaging.

3. **Chat — Implement streaming** — Wire `POST /api/agent/chat/stream` (SSE endpoint already exists on server) in ChatPage. Replace the synchronous `agentService.chat()` call with an SSE consumer. This is the single highest-impact UX fix for the core product.

4. **Automations — Action configuration** — Add action-specific config fields to the create/edit dialog: message text for telegram-message/whatsapp-message, reminder text for create_reminder, payload editor for call_api. Also fix edit form to restore existing webhookUrl from actionConfig.

5. **Settings — Privacy toggles** — Either wire the five privacy toggles to a `PATCH /api/me` or `PATCH /api/portfolio` endpoint, or remove them from the UI. Currently they appear functional but save nothing.

6. **Chat — Load conversation history** — Call `GET /api/agent/conversations` on ChatPage mount to restore the last N messages. Users lose full context on every navigation.

7. **Memory Manager — Add/Edit UI** — Add an "Add Memory" modal (POST /api/agent/memory) and an inline edit mode (PUT /api/agent/memory/:id). Users need to be able to correct wrong AI-extracted facts.

8. **Website Builder iframe sandbox** — Add `sandbox="allow-scripts allow-modals"` attribute to the preview iframe to prevent user-authored JavaScript from escaping the preview context.

### P1 — Fix Soon (degraded experience / misleading UI)

9. **Enable OAuth buttons** — Remove the `disabled` prop and "OAuth coming soon" text from Google and GitHub login buttons. The backend is fully implemented. Add the redirect links to `/auth/google` and `/auth/github`.

10. **Connect Page brand** — Change the logo text from "GeekSpace" to "Agentin Chat" in `/connect/:token`.

11. **Onboarding — Save OpenRouter API key** — Include the `apiKey` field in `getStepData(2)` and persist it via the onboarding PATCH endpoint.

12. **Onboarding — Redirect after signup** — Change `navigate('/dashboard')` in InvitePage to `navigate('/onboarding')` for newly created users.

13. **Portfolio social links — protocol check** — Before constructing social link URLs, check if the stored value already starts with `http://` or `https://` and don't prepend `https://` if so.

14. **Capabilities — Mark Video Gen as broken** — Add a "Temporarily Unavailable" overlay or badge to the Video Generation capability card. Remove it from the "working" capabilities list until a provider is available.

15. **Docs page — Fix article interactivity** — Either add real article content (even basic markdown text) or remove the hover affordances on article cards. Do not present non-clickable UI elements that look clickable.

16. **Activity Log — Fix pull-to-refresh** — Update `handlePullRefresh` to assign the API response to `entries` state: `const res = await userService.getActivity(50); setEntries(res.data.entries || [])`.

17. **Activity Log — Mobile delete access** — Change individual entry delete from hover-only to always-visible on mobile (or add a long-press / swipe gesture).

18. **Agent Settings — Fix form clobbering** — Use a `isDirty` ref to skip the sync `useEffect` when the user has made unsaved changes. Only sync from store on initial load.

19. **Inbox — Real-time updates** — Poll `GET /api/inbox/count` every 60 seconds (endpoint exists but is never called) to keep the unread badge current.

20. **Gmail — Fix className typo** — Change `w-ztext-[#00F0FF]` to `w-5 h-5 text-[#00F0FF]` on the Mail icon at line 145 of GmailPage.tsx.

21. **Status page — Fix CSS typo** — Change `h10` to `h-10` on the CheckCircle2 icon in the "All Systems Operational" banner (missing dash causes icon to have no height).

22. **Telegram polling — Add max attempts** — Cap `telegramPollAttempts` at 30 (approximately 2.5 minutes with exponential backoff) and show a "Still waiting..." message with a manual refresh button after timeout.

23. **Agent Settings — Fix System Instructions icon** — Replace the Image icon with a Terminal, Brain, or Code icon in the System Instructions section header.

24. **Forgot Password — Fix response contract** — Update server to return `{ success: true, channel: 'email' }` or update client to check `res.data.message` instead of `res.data.success`. Currently works by coincidence.

### P2 — Improve (missing features / polish / UX gaps)

25. **Reminders — isOverdue fix** — Rewrite `isOverdue` helper to look up by reminder ID instead of datetime string comparison. Current approach can false-positive when two reminders share the same datetime.

26. **Connections — Convert dialogs to modals** — Make Telegram and Email connection dialogs proper modal overlays (fixed inset-0 backdrop) so they are always in view and focus-locked.

27. **Explore — Fix stale closure in error handling** — Either include `profiles` in the `fetchProfiles` dependency array or use a ref, so error states are properly shown when subsequent fetches fail.

28. **Dashboard — Fix "View All" navigation** — The "View All" button in the Recent Activity card navigates to `'terminal'`. Should navigate to `'activity'`.

29. **Proactive AI — Locale fix** — Change `formatDate` to use `navigator.language` instead of hardcoded `'en-IN'` so timestamps reflect the user's actual locale.

30. **Focus & Habits — Surface errors** — All API call `catch {}` blocks in FocusPage are empty. Add at minimum a brief error toast for start focus, end focus, log habit, add habit, and delete habit failures.

31. **Social Media — Aggregate posts endpoint** — Replace the O(n) sequential per-plan item loading in the Posts tab with a server-side aggregated endpoint: `GET /api/social-media/posts?status=&limit=`.

32. **Billing — Clarify two billing systems** — Add a clear explanation of the relationship between credit-based plans (AI usage) and Stripe plans (feature unlocks). Users currently see both on one page with no explanation.

33. **Usage Analytics — Partial failure warning** — Show a warning when some (not all) API endpoints fail. Currently 1-5 failures show as $0 data with no indication of error.

34. **Roadmap — Dynamic roadmap items** — Replace hardcoded roadmap items and release notes with an admin-editable API endpoint. Current approach requires a full code deploy to change a phase status.

35. **Settings — Fix mobile tab overflow** — Replace horizontal TabsList with a scrollable tab bar or a dropdown select on mobile to prevent tab overflow on narrow screens.

36. **Memory Manager — Add pagination** — Add `limit` and `offset` params to `GET /api/agent/memory` calls. Load memories in pages of 25-50 rather than all at once.

37. **Portfolio Management — Unsaved changes warning** — Add a `beforeunload` event guard (same pattern as SettingsPage) to warn users before navigating away from the Portfolio tab with unsaved changes.

38. **Automations — Restore webhookUrl on edit** — Fix the edit form to read `auto.actionConfig.webhookUrl` (or the already-parsed equivalent) when opening the edit dialog, instead of defaulting to empty string.

39. **Recipes — Pre-install integration check** — Before allowing a recipe to be installed, verify the user has connected the required integrations. Show a warning or redirect to Connections if not.

40. **Analytics — Mobile tooltip** — Replace the hover-only heatmap tooltip with a tap-to-show approach on mobile.

### P3 — Future (nice to have / new features)

41. **Planner** — Implement the Planner page. At minimum: a calendar grid view of existing reminders (reusing the reminders DB), with a second phase for kanban board and task management.

42. **AI Tools** — Add more tools to justify the "AI Specialist Tools" branding: Base64 encode/decode, JWT decoder, UUID generator, timestamp converter, URL encoder — all pure client-side with no API calls needed.

43. **Chat — Message reactions** — Add thumbs up/down reactions to chat messages. `POST /api/agent/conversations/reactions` endpoint already exists.

44. **Chat — Code block rendering** — Add syntax highlighting for code blocks in chat messages (react-syntax-highlighter or similar). Agent frequently returns code in responses.

45. **Chat — Image attachments** — Add file input for image uploads, routing to vision-capable LLM paths.

46. **Explore — Pagination** — Add "Load more" button or infinite scroll. Currently returns a fixed set with no way to browse beyond.

47. **Social Media — Add Twitter/LinkedIn/TikTok** — Expand the platform selector beyond Instagram and Facebook.

48. **Billing — Stripe customer portal** — Add a link to the Stripe customer portal so users can manage payment methods, view invoices, and cancel subscriptions without contacting support.

49. **Portfolio Management — Mobile drag-to-reorder** — Replace HTML5 drag events with a touch-compatible library (@dnd-kit or react-beautiful-dnd) for the project reorder feature.

50. **Health Dashboard — Admin gating** — Consider restricting the Health Dashboard to admin users only, as it exposes endpoint paths, error rates, and service topology to any authenticated user.

---

## Per-Page Quick Reference

| Route | Status | Top Issue |
|-------|--------|-----------|
| `/` | WORKING | Hardcoded fake "Live" activity; /docs + /status 404 from footer |
| `/login` | WORKING | OAuth buttons disabled despite backend being ready |
| `/forgot-password` | WORKING | Server/client response format mismatch (works by coincidence) |
| `/explore` | WORKING | Decorative filter icon implies nonexistent functionality |
| `/portfolio/:username` | WORKING | Social links may produce double-protocol URLs |
| `/privacy` | WORKING | Contact email not tappable on mobile (span, not mailto link) |
| `/terms` | WORKING | No governing law clause; premature billing terms |
| `/onboarding` | WORKING | API key field silently discarded; server errors not surfaced |
| `/status` | WORKING | CSS typo breaks checkmark icon size; no auto-refresh |
| `/docs` | PLACEHOLDER | 18 article stubs all non-clickable; no real content |
| `/connect/:token` | WORKING | "GeekSpace" brand in logo on public-facing page |
| `/invite` | WORKING | Post-signup routes to /dashboard instead of /onboarding |
| `/dashboard` | WORKING | Response Time stat unreachable; mobile stat drag broken |
| `/dashboard/chat` | PARTIAL | No streaming; no history; 50-70s blocking wait |
| `/dashboard/connections` | PARTIAL | 6 of 9 integrations are fake connects with no real auth |
| `/dashboard/agent` | WORKING | Auto-save vs button-save mixed with no labeling; form clobbering |
| `/dashboard/memory` | WORKING | No Add/Edit UI despite server endpoints existing |
| `/dashboard/image-gen` | WORKING | Assigned Agent decorative; Edit mode fakes img2img |
| `/dashboard/video-gen` | BROKEN | All free paths broken; credits deducted on failure; no warning shown |
| `/dashboard/gallery` | PARTIAL | Reads different table than Image Gen — cross-page data split |
| `/dashboard/website-builder` | WORKING | No sandbox on preview iframe; dev mode unusable on mobile |
| `/dashboard/tools` | PARTIAL | Only JSON Formatter; billed as plural "Specialist Tools" |
| `/dashboard/capabilities` | WORKING | Video Gen listed as working (it's broken); slot count wrong |
| `/dashboard/reminders` | WORKING | isOverdue lookup by datetime (not ID) can false-positive |
| `/dashboard/automations` | WORKING | Action payloads completely absent from create/edit UI |
| `/dashboard/recipes` | PARTIAL | No pre-install check; no preview of what recipe creates |
| `/dashboard/planner` | PLACEHOLDER | Pure static "Coming Soon" — zero functionality |
| `/dashboard/social-media` | PARTIAL | O(n) sequential API calls in Posts tab; no Twitter/LinkedIn |
| `/dashboard/proactive` | WORKING | Hardcoded IST locale for all users |
| `/dashboard/focus` | WORKING | All catch blocks empty; deferred "View now" doesn't show messages |
| `/dashboard/inbox` | WORKING | Action buttons 28px (below 44px); no polling for new messages |
| `/dashboard/gmail` | PARTIAL | CSS typo breaks icon; reply silently disabled for some emails |
| `/dashboard/analytics` | WORKING | Heatmap tooltip invisible on mobile |
| `/dashboard/usage` | WORKING | Partial failures show $0 with no warning |
| `/dashboard/billing` | WORKING | Two billing systems unexplained; no cancel/downgrade button |
| `/dashboard/settings` | WORKING | Privacy toggles save nothing; mobile tab bar overflows |
| `/dashboard/terminal` | WORKING | `gs usage today` uses wrong math; `gs deploy` simulates fake deploy |
| `/dashboard/health` | WORKING | Retry button 24px; SSE silently fails if auth header required |
| `/dashboard/activity` | WORKING | Pull-to-refresh fires but doesn't update state |
| `/dashboard/roadmap` | PARTIAL | Roadmap and release notes hardcoded and months stale |
| `/dashboard/pico` | WORKING | Tasks tab doesn't auto-refresh; cron config JSON not validated |
| `/dashboard/portfolio` | WORKING | No unsaved-changes guard; mobile drag-to-reorder broken |
