# Phase 43 — 10-Item Launch Plan (New Policy Baseline)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade GeekSpace 2.0 to the new 10-item-per-phase policy by updating CLAUDE.md, creating foundation ops docs, and implementing 10 meaningful improvements covering reliability, UX, security, performance, and feature work.

**Architecture:** Phase 43 runs on a new worktree off `main` (Phase 41 merged, Phase 42 needs PR/merge first as a prerequisite). All changes land in `main` only. No production deploy happens automatically.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind + shadcn/Radix + Express + SQLite + Vitest + Playwright

**Baseline:** 385 unit tests (phase-42 worktree), 381 on main (phase-41). Phase 42 must be merged first.

---

## Prerequisites (do these before Phase 43 coding)

### Pre-1: Merge Phase 42 to main

Phase 42 worktree (`/root/GeekSpace2.0/.worktrees/phase-42`) has one unmerged commit:
`feat(phase-42): celebration banner, view count badge, code copy, portfolio stats API, last-sync display, turns indicator`

```bash
cd /root/GeekSpace2.0/.worktrees/phase-42
git push origin ai/phase-20260225-phase42
gh pr create --title "feat(phase-42): celebration banner, view count badge, code copy, portfolio stats API, last-sync display, turns indicator" --body "Phase 42 — 6 improvements. Adds celebration banner on milestones, portfolio view count badge, code block copy button in chat, portfolio stats API (GET /portfolio/me/stats), last-sync display in ConnectionsPage, turns indicator in AgentChatPanel. 385/385 tests passing." --base main
# Merge after CI passes
gh pr merge --squash --auto
```

### Pre-2: Create Phase 43 worktree (from updated main)

```bash
cd /root/GeekSpace2.0
git pull origin main   # ensures phase-42 is included
git worktree add .worktrees/phase-43 -b ai/phase-20260225-phase43-10item-baseline
cd .worktrees/phase-43
cd server && npm test  # confirm 385/385
```

---

## Phase 43 — 10 Improvements

| # | Item | Category | Risk |
|---|------|----------|------|
| 43.1 | Update CLAUDE.md + create ops foundation docs | Dev/Ops | Low |
| 43.2 | Fix 401 token-expiry auth loop (Axios interceptor) | Reliability | Low |
| 43.3 | Fix remind_before_sent_at reset on reminder reschedule | Reliability | Low |
| 43.4 | Reminder date grouping (Today/Tomorrow/This Week/Later) | UX | Low |
| 43.5 | ActivityPage relative timestamps ("2 min ago") | UX | Low |
| 43.6 | Automations run_count + last_run_at wired to frontend | State-sync | Low |
| 43.7 | Portfolio visit session dedup (same-session double-count fix) | Edge-case | Low |
| 43.8 | XSS hardening: strip HTML in portfolio bio + project descriptions | Security | Low |
| 43.9 | DB performance indexes (5 missing indexes) | Performance | Low |
| 43.10 | Phase 43 unit tests (10 new tests) | Dev/Ops | Low |

---

## Task 1: Update CLAUDE.md + Create Foundation Ops Docs

**Files:**
- Modify: `CLAUDE.md` (project root)
- Create: `ops/AI_FEATURE_MATRIX.md`
- Create: `ops/AI_RISK_REGISTER.md`
- Create: `ops/AI_RELEASE_TRAIN.md`

### Step 1: Replace CLAUDE.md with new content

Replace the contents of `/root/GeekSpace2.0/CLAUDE.md` with the new Autonomous Master Prompt (Phase 43+ policy). The new content was provided by the user in the session.

Key changes:
- Target 10 improvements per phase (was 4-5)
- To-and-fro functionality verification rule (new)
- Feature Integrity Matrix (new)
- Release train cadence (every 20-30 phases)
- Risk register (new)
- 4-hour session time budget (new)

### Step 2: Create ops/AI_FEATURE_MATRIX.md

Content to write — tracks each major feature domain, round-trip status, test coverage, last verified:

```markdown
# AI Feature Matrix — GeekSpace 2.0

> Living document. Updated each phase. Tracks to-and-fro verification status.
> Last updated: Phase 43 (2026-02-25)

## Legend
- ✅ Verified this phase
- ⚠️  Partial / known gap
- ❌ Unverified / broken
- — Not applicable

| Feature Domain | Core Routes/APIs | Happy Path | Round-Trip | Mobile | Unit | E2E | Known Issues | Last Verified |
|---|---|---|---|---|---|---|---|---|
| **Auth / JWT / OAuth** | POST /auth/login, /auth/register, /auth/refresh, /auth/google, /auth/github | ✅ | ⚠️ 401 loop fix needed (43.2) | ✅ | ✅ | ✅ | Stale token may hang UI on expiry | Phase 43 |
| **AI Chat / LLM Routing** | POST /chat, GET /chat/history, GET /conversations/export | ✅ | ✅ | ✅ | ⚠️ mocked | ⚠️ partial | None known | Phase 42 |
| **Reminders (all variants)** | GET/POST/PATCH/DELETE /reminders, /reminders/:id/snooze, /reminders/stats | ✅ | ⚠️ remind_before reset bug (43.3) | ✅ | ✅ | ✅ | remind_before_sent_at not reset on reschedule | Phase 43 |
| **Automations / Webhooks** | GET/POST/PATCH/DELETE /automations, /webhooks, GET /automations/:id/runs | ✅ | ⚠️ run_count not shown in UI (43.6) | ⚠️ | ✅ | ⚠️ | run_count + last_run_at not wired to frontend | Phase 43 |
| **Connections (Telegram/WA)** | GET/POST /integrations, /webhooks/telegram, /webhooks/whatsapp | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 41 |
| **Portfolio / Public Pages** | GET/PUT /portfolio, GET /portfolio/:username, POST /portfolio/:username/contact | ✅ | ⚠️ visit dedup (43.7) | ✅ | ✅ | ✅ | Same-session double-counts view_count | Phase 43 |
| **Dashboard / Activity / Analytics** | GET /activity, DELETE /activity, GET /activity sparklines | ✅ | ✅ | ⚠️ timestamps raw ISO | ✅ | ⚠️ | Relative timestamps missing (43.5) | Phase 43 |
| **Billing / Usage / Credits** | GET /billing, GET /usage, GET /credits | ✅ | ⚠️ | ✅ | ⚠️ partial | ⚠️ | Billing history UI minimal | Phase 22 |
| **Admin Endpoints / Audit** | GET /admin/users, /admin/usage, /admin/export | ✅ | ⚠️ | — | ⚠️ | ⚠️ | Admin UI minimal; no rate-limit on admin routes | Phase 31 |
| **Health / Observability** | GET /api/health, SSE /health/stream | ✅ | ✅ | — | ✅ | ⚠️ | None known | Phase 34 |
| **Session Management** | GET/DELETE /auth/sessions | ✅ | ✅ | ✅ | ✅ | ⚠️ | Revoke is DB-only (token still valid until expiry) | Phase 32 |
| **Memory / Agent Config** | GET/POST/DELETE /memory, GET/PATCH /agent/config | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 38 |
```

### Step 3: Create ops/AI_RISK_REGISTER.md

```markdown
# AI Risk Register — GeekSpace 2.0

> Updated each phase. Tracks medium/high risks and mitigation status.
> Last updated: Phase 43 (2026-02-25)

## Risk Levels
- 🔴 High — may break production or user data
- 🟠 Medium — degrades user experience or reliability
- 🟡 Low — minor impact, acceptable short-term

| ID | Risk | Level | Area | Mitigation | Status | Raised Phase |
|---|---|---|---|---|---|---|
| R01 | JWT token not invalidated on session revoke (only DB record deleted) | 🟠 | Auth | Accept: document limitation; Redis blacklist needed for true revocation | Open | Phase 32 |
| R02 | Ollama cold-start 50-70s causes chat 500s on VPS | 🟡 | AI | Accept: known timeout; retry once after 5s delay | Open | Phase 1 |
| R03 | SQLite write contention under PM2 cluster (2 workers) | 🟠 | DB | Mitigated: WAL mode + sequential test runner; monitor in prod | Monitored | Phase 3 |
| R04 | Telegram webhook secret not validated in dev (WEBHOOK_SECRET not set) | 🟡 | Security | Mitigated: warned in logs; enforced in prod config | Mitigated | Phase 2 |
| R05 | Portfolio bio/project descriptions not HTML-sanitized | 🟠 | Security | Fix: Phase 43.8 (strip HTML tags before DB write) | In Progress | Phase 43 |
| R06 | remind_before_sent_at not reset on reminder reschedule | 🟠 | Reliability | Fix: Phase 43.3 | In Progress | Phase 43 |
| R07 | 401 token expiry may leave UI in broken/hanging state | 🟠 | UX/Auth | Fix: Phase 43.2 (Axios interceptor → redirect to login) | In Progress | Phase 43 |
| R08 | Portfolio view_count double-counts same browser session | 🟡 | Accuracy | Fix: Phase 43.7 (session key dedup in portfolio_visits) | In Progress | Phase 43 |
| R09 | Large number of worktrees (30+) consuming disk space | 🟡 | Ops | Action: prune old merged worktrees; keep only current active phase | Open | Phase 43 |
| R10 | WhatsApp integration is a stub (WA Business API keys not set) | 🟡 | Feature | Accept: documented as stub; not advertised as working | Open | Phase 1 |
| R11 | CSP still uses unsafe-inline for scripts | 🟠 | Security | Plan: nonce-based policy in a dedicated security phase | Open | Phase 3 |
| R12 | No rate limiting on admin endpoints (/admin/*) | 🟠 | Security | Plan: add rate limit middleware to admin router | Open | Phase 43 |
```

### Step 4: Create ops/AI_RELEASE_TRAIN.md

```markdown
# Release Train — GeekSpace 2.0

> Tracks main→production deploy cadence. Production deploys happen from main only.

## Release Train Policy
- Deploy to production every **20–30 phases** OR for critical fixes
- Each train must pass: lint + typecheck + build + unit tests + critical E2E + smoke tests
- Tag commits: `release/R<N>-start` and `release/R<N>-end`
- Monitor logs 30 min post-deploy

## R1 — Phases 1–20 (2026-02-24 to 2026-02-25)
- **Status:** Deployed ✅
- **Merged to live-production:** Yes (after Phase 20 cumulative deploy)
- **Key features shipped:** Image/video gen, snooze, escalation, OAuth, recurring reminders, portfolio themes, session management, NLP reminders, activity log, command palette, invite system, accessibility, compact mode
- **Known issues at deploy:** None critical
- **Tests at deploy:** ~245 unit tests

## R2 — Phases 21–42 (2026-02-25)
- **Status:** In main, NOT yet deployed to live-production
- **Phases merged:** 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, (42 pending)
- **Tests at R2 start:** 385
- **Key features:** Activity search, webhook dashboard, sparklines, memory search, weekly report, bulk reminders, reminder priorities, invite flow, snooze log, portfolio contact form, CSV export, category/priority filters, bulk-complete, portfolio stats API
- **Deploy prerequisites:** Phase 42 merged, all CI green, smoke tests pass
- **Target deploy:** User explicit request or after Phase ~60

## R3 — Phases 43–60/70 (upcoming)
- **Status:** Planning
- **Target:** ~20-25 phases of hardening, feature parity, production readiness
- **Goals:** Multi-user safety, mobile-first polish, integration reliability, go-live readiness
```

### Step 5: Commit ops changes

```bash
cd /root/GeekSpace2.0/.worktrees/phase-43
git add CLAUDE.md ops/AI_FEATURE_MATRIX.md ops/AI_RISK_REGISTER.md ops/AI_RELEASE_TRAIN.md
git commit -m "docs(ops): new CLAUDE.md 10-item policy + feature matrix + risk register + release train"
```

---

## Task 2: Fix 401 Token-Expiry Auth Loop (Reliability)

**Files:**
- Modify: `src/services/api.ts` (Axios interceptor section)

**Problem:** When JWT expires, the Axios response interceptor returns a rejected promise but doesn't clear localStorage or redirect. The user sees a broken UI or repeated 401 errors.

**Step 1: Read the current interceptor**

Read `src/services/api.ts` and find the response interceptor (look for `.interceptors.response.use`).

**Step 2: Write the failing test**

This is frontend code — no unit test needed. Manual verification: let a token expire (set expiry to 1s in .env.test) and confirm redirect. Document in phase43.test.ts as a comment.

**Step 3: Implement the fix**

In the Axios response interceptor's error handler, add:

```typescript
if (error.response?.status === 401) {
  // Clear stale auth state and redirect to login
  localStorage.removeItem('auth-storage'); // Zustand persisted key
  window.location.href = '/login';
  return Promise.reject(error);
}
```

The key name `auth-storage` comes from how Zustand persist is configured in `src/stores/authStore.ts` — verify it before hardcoding.

**Step 4: Verify no regression**

- Normal API calls still work (no intercept on 200)
- 403 responses (forbidden) must NOT redirect to login (only 401)
- Run `npm run lint && npx tsc --noEmit && npm run build` from project root

**Step 5: Commit**

```bash
git add src/services/api.ts
git commit -m "fix(auth): clear stale token + redirect on 401 in Axios interceptor"
```

---

## Task 3: Fix remind_before_sent_at Reset on Reschedule (Reliability)

**Files:**
- Modify: `server/src/routes/reminders.ts` (PATCH /:id handler)

**Problem:** When a user edits a reminder's `due_at` (reschedules it), `remind_before_sent_at` remains set from the previous schedule. The "heads up" Telegram alert won't fire again.

**Step 1: Read the PATCH /:id handler**

Read `server/src/routes/reminders.ts`. Find the PATCH /:id endpoint. Look for what columns it updates.

**Step 2: Write the failing test** (add to phase43.test.ts)

```typescript
it('resets remind_before_sent_at when due_at changes', async () => {
  const user = createTestUser();
  // create reminder with remind_before_sent_at already set
  const reminderId = db.prepare(
    `INSERT INTO reminders (id, user_id, text, due_at, status, remind_before_sent_at)
     VALUES (?, ?, ?, ?, 'active', ?)`
  ).run(uuid(), user.id, 'Test', Date.now() + 3600000, Date.now()).lastInsertRowid;
  // not how SQLite works for id - adjust to the actual insert approach

  const res = await request(app)
    .patch(`/api/reminders/${reminderId}`)
    .set(makeAuthHeader(user))
    .send({ due_at: Date.now() + 7200000 }); // reschedule 2h later

  expect(res.status).toBe(200);
  const updated = db.prepare('SELECT remind_before_sent_at FROM reminders WHERE id = ?').get(reminderId);
  expect(updated.remind_before_sent_at).toBeNull();
});
```

**Step 3: Run test to verify it fails**

```bash
cd server && npx vitest run src/test/api/phase43.test.ts -t "resets remind_before_sent_at"
```

**Step 4: Implement the fix**

In `PATCH /:id` handler, when `due_at` is being updated, also reset `remind_before_sent_at = NULL`:

```typescript
// In the UPDATE statement for reminders PATCH handler, add:
if (body.due_at !== undefined) {
  // Reset the remind_before alert so it fires again for the new time
  updates.push('remind_before_sent_at = NULL');
}
```

The exact pattern depends on how the PATCH handler builds its UPDATE statement. Read the file first and adapt.

**Step 5: Run test to verify it passes**

```bash
cd server && npx vitest run src/test/api/phase43.test.ts -t "resets remind_before_sent_at"
```

**Step 6: Commit**

```bash
git add server/src/routes/reminders.ts server/src/test/api/phase43.test.ts
git commit -m "fix(reminders): reset remind_before_sent_at when due_at is rescheduled"
```

---

## Task 4: Reminder Date Grouping (UX)

**Files:**
- Modify: `src/dashboard/pages/RemindersPage.tsx`

**Goal:** Instead of a flat list, group active reminders into sections: **Today**, **Tomorrow**, **This Week**, **Later**, **Overdue**. Each section is collapsible with a header showing the count.

**Step 1: Read RemindersPage.tsx**

Understand how `filteredReminders` is built and rendered. Find the `.map()` that renders reminder cards.

**Step 2: Add grouping helper function**

Add before the return statement:

```typescript
function groupRemindersByDate(reminders: Reminder[]) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1);
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setDate(tomorrowStart.getDate() + 1);
  const weekEnd = new Date(todayStart); weekEnd.setDate(todayStart.getDate() + 7);

  const groups: Record<string, Reminder[]> = {
    Overdue: [],
    Today: [],
    Tomorrow: [],
    'This Week': [],
    Later: [],
  };

  for (const r of reminders) {
    const due = new Date(r.due_at);
    if (due < now) groups['Overdue'].push(r);
    else if (due < tomorrowStart) groups['Today'].push(r);
    else if (due < tomorrowEnd) groups['Tomorrow'].push(r);
    else if (due < weekEnd) groups['This Week'].push(r);
    else groups['Later'].push(r);
  }
  return groups;
}
```

**Step 3: Replace flat list with grouped sections**

Instead of `filteredReminders.map(r => <ReminderCard .../>)`, render:

```tsx
{Object.entries(groupRemindersByDate(filteredReminders))
  .filter(([, items]) => items.length > 0)
  .map(([label, items]) => (
    <div key={label} className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8888AA] mb-2 px-1">
        {label} <span className="ml-1 text-[#BF5FFF]">({items.length})</span>
      </h3>
      <div className="space-y-2">
        {items.map(r => <ReminderCard key={r.id} ... />)}
      </div>
    </div>
  ))
}
```

Only apply grouping when `activeTab === 'upcoming'` or the active filter is 'active'. For 'completed'/'all', keep flat list.

**Step 4: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/dashboard/pages/RemindersPage.tsx
git commit -m "feat(reminders): group reminders by date (Today/Tomorrow/This Week/Later/Overdue)"
```

---

## Task 5: ActivityPage Relative Timestamps (UX)

**Files:**
- Modify: `src/dashboard/pages/ActivityPage.tsx`

**Goal:** Replace raw ISO date strings in activity log with human-friendly relative time ("2 min ago", "3 hours ago", "yesterday").

**Step 1: Read ActivityPage.tsx**

Find where activity timestamps are rendered. Look for `created_at` display.

**Step 2: Add a `timeAgo` helper**

Add at the top of the file (or in a shared utils location if one exists):

```typescript
function timeAgo(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}
```

**Step 3: Replace static timestamp display**

Find the timestamp render (likely `new Date(entry.created_at).toLocaleString()` or similar) and replace with `timeAgo(entry.created_at)`. Keep the full ISO string in a `title` attribute for hover tooltip.

```tsx
<span title={new Date(entry.created_at).toLocaleString()}>
  {timeAgo(entry.created_at)}
</span>
```

**Step 4: Verify build**

```bash
npm run lint && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/dashboard/pages/ActivityPage.tsx
git commit -m "feat(activity): show relative timestamps ('2 min ago') in activity log"
```

---

## Task 6: Automations run_count + last_run_at Wired to Frontend (State-sync)

**Files:**
- Read: `server/src/routes/automations.ts` (verify run_count/last_run_at are returned)
- Modify: `src/dashboard/pages/AutomationsPage.tsx`
- Modify: `src/types/index.ts` (add fields to Automation type)

**Goal:** Show "Ran N times · Last run: 2h ago" on each automation card. Closes the round-trip gap where run_count and last_run_at are tracked in the DB but not displayed.

**Step 1: Verify backend returns the fields**

```bash
# check that GET /automations response includes run_count and last_run_at
grep -n "run_count\|last_run_at" server/src/routes/automations.ts
```

If not present, add them to the SELECT query.

**Step 2: Update Automation type in src/types/index.ts**

Add to the `Automation` interface:
```typescript
run_count?: number;
last_run_at?: number | null;
```

**Step 3: Display in AutomationsPage.tsx**

In the automation card, below the status badge, add:

```tsx
{(automation.run_count ?? 0) > 0 && (
  <p className="text-xs text-[#8888AA] mt-1">
    Ran {automation.run_count} time{automation.run_count !== 1 ? 's' : ''}
    {automation.last_run_at ? ` · Last: ${timeAgo(automation.last_run_at)}` : ''}
  </p>
)}
```

Reuse the `timeAgo` helper (consider moving it to `src/utils/time.ts` if used in multiple pages).

**Step 4: Verify build**

```bash
npm run lint && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/types/index.ts src/dashboard/pages/AutomationsPage.tsx
git commit -m "feat(automations): show run_count and last_run_at on automation cards"
```

---

## Task 7: Portfolio Visit Session Dedup (Edge-case)

**Files:**
- Read: `server/src/routes/portfolio.ts` (find view count increment logic)
- Modify: `server/src/routes/portfolio.ts`

**Problem:** Every `GET /portfolio/:username` call increments `view_count`. A page refresh counts as 2 views.

**Fix:** Use a `session_key` cookie (or `X-Forwarded-For` + date-based hash) to deduplicate within a session. Since the portfolio_visits table doesn't exist or is minimal, implement a simple in-memory LRU for the session period (60 min window per IP+date key).

**Step 1: Read the view count increment code**

Read `server/src/routes/portfolio.ts`. Find where `view_count` is incremented.

**Step 2: Add a session-based dedup guard**

Since we don't want to add a new dependency, use an in-memory Set with a TTL-style pattern:

```typescript
// At module level (simple in-memory dedup, resets on restart — acceptable for view count accuracy)
const recentViewers = new Map<string, number>(); // key → expires_at
const VIEW_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isDuplicateView(ip: string, username: string): boolean {
  const key = `${ip}:${username}`;
  const expires = recentViewers.get(key);
  if (expires && expires > Date.now()) return true;
  recentViewers.set(key, Date.now() + VIEW_DEDUP_WINDOW_MS);
  // Cleanup old entries every ~1000 checks
  if (recentViewers.size > 1000) {
    const now = Date.now();
    for (const [k, exp] of recentViewers.entries()) {
      if (exp < now) recentViewers.delete(k);
    }
  }
  return false;
}
```

In the GET /:username handler, before incrementing view_count:
```typescript
const ip = req.ip || req.socket.remoteAddress || 'unknown';
if (!isDuplicateView(ip, username)) {
  db.prepare('UPDATE portfolios SET view_count = view_count + 1 WHERE username = ?').run(username);
}
```

**Step 3: Write test** (in phase43.test.ts)

```typescript
it('does not double-count the same IP+username within 1 hour', async () => {
  // Create portfolio, GET twice from same IP, check view_count = 1
  // Note: supertest uses same internal IP, so second request should be deduped
});
```

**Step 4: Run tests**

```bash
cd server && npx vitest run src/test/api/phase43.test.ts
```

**Step 5: Commit**

```bash
git add server/src/routes/portfolio.ts server/src/test/api/phase43.test.ts
git commit -m "fix(portfolio): deduplicate view_count within 1h per IP to prevent refresh inflation"
```

---

## Task 8: XSS Hardening — Strip HTML in Portfolio Fields (Security)

**Files:**
- Modify: `server/src/routes/portfolio.ts` (PUT /portfolio handler for bio + projects)
- Modify: `server/src/routes/portfolio.ts` (POST /:username/contact for message field)

**Goal:** Strip dangerous HTML (script tags, event handlers, iframe) from user-controlled text before saving to DB. No new library needed — use a tight regex allowlist.

**Step 1: Add a sanitization helper**

Add near the top of `server/src/routes/portfolio.ts`:

```typescript
/** Strip HTML tags and dangerous attributes from user-controlled text. */
function stripDangerousHtml(input: string): string {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '') // strip script blocks
    .replace(/<iframe[\s\S]*?>/gi, '')           // strip iframes
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // strip event handlers
    .replace(/<(?!\/?(b|i|em|strong|p|br|ul|ol|li|a)\b)[^>]*>/gi, ''); // strip non-allowlisted tags
}
```

**Step 2: Apply to bio and project descriptions**

In `PUT /portfolio` (or equivalent update endpoint), wrap bio and each project's title/description:

```typescript
if (body.bio) body.bio = stripDangerousHtml(body.bio);
if (body.projects) {
  body.projects = body.projects.map((p: Record<string, string>) => ({
    ...p,
    title: p.title ? stripDangerousHtml(p.title) : p.title,
    description: p.description ? stripDangerousHtml(p.description) : p.description,
  }));
}
```

In `POST /:username/contact`, sanitize message:
```typescript
if (body.message) body.message = stripDangerousHtml(body.message);
```

**Step 3: Write test** (in phase43.test.ts)

```typescript
it('strips script tags from portfolio bio on update', async () => {
  const user = createTestUser();
  const xssBio = 'Hello <script>alert(1)</script> World';
  const res = await request(app)
    .put('/api/portfolio')
    .set(makeAuthHeader(user))
    .send({ bio: xssBio });
  expect(res.status).toBe(200);
  const portfolio = db.prepare('SELECT bio FROM portfolios WHERE user_id = ?').get(user.id);
  expect(portfolio?.bio).not.toContain('<script>');
  expect(portfolio?.bio).toContain('Hello');
  expect(portfolio?.bio).toContain('World');
});
```

**Step 4: Run tests**

```bash
cd server && npx vitest run src/test/api/phase43.test.ts -t "strips script tags"
```

**Step 5: Commit**

```bash
git add server/src/routes/portfolio.ts server/src/test/api/phase43.test.ts
git commit -m "security(portfolio): strip dangerous HTML from bio, project descriptions, and contact messages"
```

---

## Task 9: DB Performance Indexes (Performance)

**Files:**
- Modify: `server/src/db/index.ts` (migrations section)

**Goal:** Add 5 missing indexes to speed up the most frequent query patterns. All additions are idempotent (`CREATE INDEX IF NOT EXISTS`).

**Step 1: Read current indexes**

```bash
grep -n "CREATE INDEX" server/src/db/index.ts
```

Note which indexes already exist. Only add the ones that are missing.

**Step 2: Add missing indexes**

In the migrations section of `db/index.ts`, add (using `db.exec()` or `db.prepare().run()` pattern matching existing code):

```typescript
// Phase 43 — Performance indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders(user_id, due_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON activity_log(user_id, created_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_snooze_log_reminder ON snooze_log(reminder_id, snoozed_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_automations_user_active ON automations(user_id, is_active)`);
```

**Step 3: Write test** (in phase43.test.ts)

```typescript
import { db } from '../../db/index.js';

it('performance indexes exist', () => {
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all() as { name: string }[];
  const names = indexes.map(i => i.name);
  expect(names).toContain('idx_reminders_user_due');
  expect(names).toContain('idx_activity_log_user_created');
  expect(names).toContain('idx_snooze_log_reminder');
  expect(names).toContain('idx_conversations_user_updated');
  expect(names).toContain('idx_automations_user_active');
});
```

**Step 4: Run test to confirm pass**

```bash
cd server && npx vitest run src/test/api/phase43.test.ts -t "performance indexes exist"
```

**Step 5: Commit**

```bash
git add server/src/db/index.ts server/src/test/api/phase43.test.ts
git commit -m "perf(db): add 5 missing indexes for reminders, activity, snooze, conversations, automations"
```

---

## Task 10: Phase 43 Unit Tests + Full Verification Gate (Dev/Ops)

**Files:**
- Create: `server/src/test/api/phase43.test.ts` (consolidate tests from tasks 3, 7, 8, 9 above)
- Run: full verification commands

**Step 1: Verify test file has 10+ tests**

The phase43 test file should contain at minimum:
- 1: `remind_before_sent_at` reset on reschedule
- 2: visit count dedup (same IP, 1h window)
- 3: visit count increment for new IP
- 4: XSS strip from portfolio bio
- 5: XSS strip from project description
- 6: XSS: benign HTML (bold tags) preserved after sanitization
- 7: XSS: strip contact form message
- 8: Performance indexes exist (5 assertions in 1 test)
- 9: automations run_count present in GET /automations response
- 10: DELETE /reminders/:id returns 200 and removes from list (round-trip regression)

**Step 2: Run all unit tests**

```bash
cd server && npm test
```

Expected: 395+ passing (385 baseline + 10 new)

**Step 3: Run full frontend verification**

```bash
cd /root/GeekSpace2.0/.worktrees/phase-43
npm run lint && npx tsc --noEmit && npm run build
```

Expected: 0 errors, 0 warnings on changed files

**Step 4: Run server typecheck + build**

```bash
cd server && npx tsc --noEmit && npm run build
```

**Step 5: Update ops/AI_HANDOFF.md + ops/AI_PHASE_PLAN.md**

Update with Phase 43 completion status, test counts, and Phase 44 proposal.

**Step 6: Final commit**

```bash
git add ops/ server/src/test/api/phase43.test.ts
git commit -m "chore(ops): Phase 43 complete — update handoff, phase plan, feature matrix"
```

---

## Phase 43 Merge + PR

```bash
cd /root/GeekSpace2.0/.worktrees/phase-43
git push origin ai/phase-20260225-phase43-10item-baseline

gh pr create \
  --title "feat(phase-43): auth fix, remind_before reset, date grouping, relative timestamps, automations wiring, XSS hardening, DB indexes" \
  --body "$(cat <<'EOF'
## Phase 43 — 10 improvements (new 10-item-per-phase policy)

### Items
43.1 Updated CLAUDE.md to new 10-item-per-phase autonomous policy
43.2 Fix 401 token-expiry: Axios interceptor now clears token + redirects to login
43.3 Fix remind_before_sent_at reset when reminder is rescheduled
43.4 Reminder date grouping: Today / Tomorrow / This Week / Later / Overdue sections
43.5 ActivityPage relative timestamps ("2 min ago" instead of raw ISO)
43.6 Automations run_count + last_run_at wired to frontend card display
43.7 Portfolio view_count session dedup (same IP deduplicated within 1h)
43.8 XSS hardening: strip script tags + event handlers from portfolio bio, projects, contact form
43.9 DB performance indexes: 5 new indexes on reminders, activity, snooze, conversations, automations
43.10 Phase 43 unit tests (10 new tests)

### Verification
- Unit tests: 395+/395+ passing
- Frontend: lint + typecheck + build clean
- Server: typecheck + build clean
- All touched flows verified to-and-fro

### Risk
Low — all changes are additive. DB indexes are idempotent (IF NOT EXISTS). No schema rewrites.
EOF
)" \
  --base main
```

---

## Phase 44 Proposal (10 items)

| # | Item | Category |
|---|------|----------|
| 44.1 | Fix: webhook delivery retry on 5xx (exponential backoff, max 3 retries) | Reliability |
| 44.2 | Fix: recurrence_rule respected after snooze (snoozed recurring reminders re-schedule correctly) | Reliability |
| 44.3 | Portfolio: "skills" section rendered on public page (currently stored but not displayed) | UX |
| 44.4 | Dashboard: notification bell shows unread count badge (activity-based) | UX |
| 44.5 | Automations: wire is_active toggle to actually enable/disable cron/webhook trigger | State-sync |
| 44.6 | Auth: OAuth error page (handle /auth/google/callback?error=access_denied gracefully) | Edge-case |
| 44.7 | Rate limit admin endpoints (/admin/*) — add separate rate limiter (10 req/min) | Security |
| 44.8 | Structured log output for all critical service operations (LLM routing, action execution) | Dev/Ops |
| 44.9 | Lazy-load heavy pages (PortfolioPage, AutomationsPage) with Suspense skeleton | Performance |
| 44.10 | Phase 44 unit tests (10 new tests) | Dev/Ops |
