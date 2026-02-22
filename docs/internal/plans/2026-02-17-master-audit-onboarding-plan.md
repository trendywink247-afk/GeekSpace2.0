# Master Audit, Branch Cleanup & Onboarding Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up all git branches, perform a full 7-area code audit, rebuild the onboarding wizard as a 6-step flow with per-step persistence, fix all bugs found, and verify end-to-end.

**Architecture:** Express + better-sqlite3 backend serves React 19 SPA. Auth is JWT in localStorage. Onboarding state persisted server-side via new per-step PATCH endpoint. Frontend uses Zustand with localStorage persistence. Caddy reverse proxies on host.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Zustand, Express 4, better-sqlite3, Zod 4, Tailwind CSS, shadcn/ui, Lucide Icons.

---

## Phase 1: Git Branch Cleanup

### Task 1: Merge live-production into main and delete stale branches

**Files:**
- None (git operations only)

**Step 1: Merge live-production into main**

```bash
cd /root/GeekSpace2.0
git checkout main
git merge live-production --no-edit
git push origin main
git checkout live-production
```

Verify: `git log main --oneline -5` and `git log live-production --oneline -5` must show identical commits.

**Step 2: Delete local stale branches**

```bash
git branch -D development-roadmap
git branch -D fix/portfolio-chat-info-leak
git branch -D release/integrity-merge-20260216
git branch -D release/v3.0.0
```

**Step 3: Delete remote stale branches**

```bash
git push origin --delete claude/ai-os-api-integration-yFb9T
git push origin --delete claude/docker-edith-ollama-setup-Yt3Z1
git push origin --delete claude/pico-kimi-integration-XdtIj
git push origin --delete claude/whatsapp-ai-integration-vA0ey
git push origin --delete development-roadmap
git push origin --delete fix/portfolio-chat-info-leak
git push origin --delete release/v3.0.0
git push origin --delete update/2026-02-15-three-agent-architecture
```

Note: `remotes/geekbase/*` is a separate remote — skip those unless user confirms.

**Step 4: Verify**

```bash
git branch -a
```

Expected: only `main`, `* live-production`, `remotes/origin/main`, `remotes/origin/live-production`, `remotes/origin/HEAD`, and any `remotes/geekbase/*`.

**Step 5: Commit summary**

No commit needed — this is branch management only. Output summary of deleted branches.

---

## Phase 2: Full Code Audit

### Task 2: Routing & Navigation Audit (2A)

**Files:**
- Read: `src/App.tsx` (lines 21-54)
- Read: `src/onboarding/LoginPage.tsx` (lines 36, 39, 50)
- Read: `src/dashboard/DashboardApp.tsx` (route definitions inside dashboard)
- Read: all files in `src/pages/`

**Step 1: Map every route**

Read `src/App.tsx` and `src/dashboard/DashboardApp.tsx`. Create a table:

| Path | Component | Auth Required | Onboarding Required | Redirect |
|------|-----------|---------------|---------------------|----------|

**Step 2: Audit navigate() calls**

```bash
grep -rn "navigate(" src/ --include="*.tsx" --include="*.ts"
```

For each `navigate()` call, check:
- Post-login/signup: must use `{ replace: true }`
- Post-onboarding: must use `{ replace: true }`
- Normal navigation: `push` is fine

**Step 3: Fix post-auth navigations**

Modify: `src/onboarding/LoginPage.tsx`

```typescript
// Line 36: after signup
navigate('/onboarding', { replace: true });

// Line 39: after login
navigate('/dashboard', { replace: true });

// Line 50: after demo login
navigate('/dashboard', { replace: true });
```

Modify: `src/onboarding/OnboardingPage.tsx`

```typescript
// Line 54: after completing onboarding
navigate('/dashboard', { replace: true });
```

**Step 4: Verify TypeScript compiles**

```bash
cd /root/GeekSpace2.0 && npx tsc --noEmit
```

Expected: exit 0, no errors.

**Step 5: Commit**

```bash
git add src/onboarding/LoginPage.tsx src/onboarding/OnboardingPage.tsx
git commit -m "fix: use replace navigation after login/signup to prevent back-to-login"
```

### Task 3: Authentication & Session Audit (2B)

**Files:**
- Read: `server/src/routes/auth.ts` (full file)
- Read: `server/src/middleware/auth.ts` (full file)
- Read: `src/stores/authStore.ts` (full file)
- Read: `src/services/api.ts` (interceptors, lines 45-63)

**Step 1: Trace auth flow**

Document: signup → token creation → localStorage → interceptor attaches to requests → 401 handling → logout.

**Step 2: Check every API endpoint for auth middleware**

```bash
grep -rn "Router\.\|router\." server/src/routes/ --include="*.ts" | grep -v "requireAuth"
```

Cross-reference with routes that SHOULD be protected. Log any unprotected endpoints.

**Step 3: Check token expiry handling**

Read the 401 interceptor in `src/services/api.ts` (lines 55-63). Verify it calls `logout()` and redirects.

**Step 4: Log findings**

Create a findings list with severity and file:line for each issue.

### Task 4: Database & Data Integrity Audit (2C)

**Files:**
- Read: `server/src/db/index.ts` (full schema, lines 28-266)

**Step 1: Check foreign keys and cascading**

Verify all REFERENCES have ON DELETE CASCADE. Check for orphan-prone tables.

**Step 2: Check indexes**

```bash
grep -n "CREATE INDEX" server/src/db/index.ts
```

Check if frequently queried columns (user_id, email, username) have indexes.

**Step 3: Verify onboarding fields exist in schema**

Confirm `onboarding_completed` exists at line 45. Confirm there's no `onboarding_step` column yet (needed for Phase 3).

**Step 4: Log findings**

### Task 5: API Wiring Audit (2D)

**Files:**
- Read: `src/services/api.ts` (all service objects)
- Read: all files in `server/src/routes/`

**Step 1: Map frontend services to backend routes**

For each method in `authService`, `agentService`, `billingService`, etc., verify the URL, method, and payload match the backend route definition.

**Step 2: Check error handling**

```bash
grep -rn "\.catch\|catch (" src/ --include="*.tsx" --include="*.ts" | head -30
```

Find empty catch blocks or swallowed errors.

**Step 3: Check CORS**

Read CORS config in `server/src/index.ts`. Verify it matches `CORS_ORIGINS` env var.

**Step 4: Log findings**

### Task 6: Environment & Docker Audit (2E)

**Files:**
- Read: `.env.example`
- Read: `docker-compose.yml`
- Read: `server/src/config.ts`

**Step 1: Cross-reference env vars**

Compare every var in `config.ts` with `docker-compose.yml` environment section and `.env.example`. Flag any that exist in code but not in `.env.example`.

**Step 2: Check Docker networking**

```bash
docker network inspect geekspace-shared --format='{{range .Containers}}{{.Name}} {{end}}'
docker exec geekspace-app wget -qO- http://redis:6379 2>&1 || echo "check redis connectivity"
```

**Step 3: Log findings**

### Task 7: Error Handling & Security Audit (2F + 2G)

**Files:**
- Search across: `src/`, `server/src/`

**Step 1: Find empty catch blocks**

```bash
grep -rn "catch.*{" server/src/ src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Review each for swallowed errors.

**Step 2: Check for exposed secrets in client code**

```bash
grep -rn "sk-\|api_key\|secret\|password" src/ --include="*.ts" --include="*.tsx" | grep -v "type\|interface\|placeholder\|label"
```

**Step 3: Check rate limiting**

Read rate limiter setup in `server/src/index.ts`. Verify auth endpoints have stricter limits.

**Step 4: Check input validation**

Verify every POST/PATCH route uses `validateBody()` middleware from `server/src/middleware/validate.ts`.

**Step 5: Log all findings, commit audit report**

```bash
git add docs/
git commit -m "docs: full code audit findings report"
```

---

## Phase 3: Onboarding Overhaul

### Task 8: Add onboarding_step column to database

**Files:**
- Modify: `server/src/db/index.ts` (after line 362, in migrations section)

**Step 1: Add migration**

Add after the last `try { ALTER TABLE } catch {}` block (around line 365):

```typescript
try {
  db.exec(`ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 0`);
} catch { /* column already exists */ }
```

**Step 2: Update GET /auth/me response**

Modify: `server/src/routes/auth.ts` — find the `/me` endpoint response object. Add `onboardingStep`:

```typescript
onboardingStep: user.onboarding_step ?? 0,
```

**Step 3: Verify server compiles**

```bash
cd /root/GeekSpace2.0/server && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add server/src/db/index.ts server/src/routes/auth.ts
git commit -m "feat: add onboarding_step column and return in /me"
```

### Task 9: Create per-step onboarding API endpoint

**Files:**
- Modify: `server/src/routes/auth.ts` (add new route after existing onboarding endpoint)
- Modify: `server/src/middleware/validate.ts` (add step-specific schemas)

**Step 1: Add step validation schemas**

Add to `server/src/middleware/validate.ts` after `onboardingSchema`:

```typescript
export const onboardingStepSchema = z.object({
  step: z.number().int().min(1).max(6),
  data: z.record(z.unknown()),
});
```

**Step 2: Add PATCH /auth/onboarding/:step endpoint**

Add to `server/src/routes/auth.ts`:

```typescript
authRouter.patch('/onboarding/:step', requireAuth, async (req: Request, res: Response) => {
  const step = parseInt(req.params.step, 10);
  if (step < 1 || step > 6) return res.status(400).json({ error: 'Invalid step' });

  const data = req.body;

  switch (step) {
    case 1: { // Profile
      const { name, username } = data;
      if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId);
      if (username) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.userId);
      break;
    }
    case 2: { // Bio & Headline
      const { bio, headline } = data;
      if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.userId);
      if (headline !== undefined) db.prepare('UPDATE portfolios SET headline = ? WHERE user_id = ?').run(headline, req.userId);
      break;
    }
    case 3: { // Agent Preferences
      const { personality, agentMode } = data;
      if (personality) db.prepare('UPDATE agent_configs SET personality = ? WHERE user_id = ?').run(personality, req.userId);
      if (agentMode) db.prepare('UPDATE agent_configs SET mode = ? WHERE user_id = ?').run(agentMode, req.userId);
      break;
    }
    case 4: { // Portfolio Setup
      const { skills, headline: portfolioHeadline, about } = data;
      if (skills) db.prepare('UPDATE portfolios SET skills = ? WHERE user_id = ?').run(JSON.stringify(skills), req.userId);
      if (portfolioHeadline) db.prepare('UPDATE portfolios SET headline = ? WHERE user_id = ?').run(portfolioHeadline, req.userId);
      if (about) db.prepare('UPDATE portfolios SET about = ? WHERE user_id = ?').run(about, req.userId);
      break;
    }
    case 5: { // Integrations — just persist step progress (integrations connected via separate API)
      break;
    }
    case 6: { // Review — no data to save
      break;
    }
  }

  // Update step progress
  db.prepare('UPDATE users SET onboarding_step = ? WHERE id = ?').run(step, req.userId);
  res.json({ success: true, step });
});
```

**Step 3: Modify existing POST /onboarding to POST /onboarding/complete**

Keep the existing endpoint but also add an alias:

```typescript
authRouter.post('/onboarding/complete', requireAuth, async (req: Request, res: Response) => {
  db.prepare('UPDATE users SET onboarding_completed = 1, onboarding_step = 6 WHERE id = ?').run(req.userId);
  logActivity(db, req.userId, 'onboarding_complete', 'Completed onboarding', 'rocket');
  res.json({ success: true });
});
```

**Step 4: Verify server compiles**

```bash
cd /root/GeekSpace2.0/server && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/src/middleware/validate.ts
git commit -m "feat: add per-step onboarding API with PATCH /auth/onboarding/:step"
```

### Task 10: Update OnboardingState type and authStore

**Files:**
- Modify: `src/types/index.ts` (lines 478-491)
- Modify: `src/stores/authStore.ts` (lines 27-35, 102-117)
- Modify: `src/services/api.ts` (lines 83-84)

**Step 1: Update OnboardingState type**

Replace the existing `OnboardingState` interface in `src/types/index.ts`:

```typescript
export interface OnboardingState {
  step: number;
  completed: boolean;
  profile: {
    name: string;
    username: string;
    bio: string;
    headline: string;
    tags: string[];
  };
  agentPreferences: {
    personality: 'edith' | 'jarvis' | 'weebo';
    agentMode: AgentMode;
  };
  portfolio: {
    skills: string[];
    headline: string;
    about: string;
  };
  integrations: IntegrationType[];
  visibility: 'public' | 'private';
}
```

**Step 2: Update defaultOnboarding in authStore**

Update `src/stores/authStore.ts` defaultOnboarding:

```typescript
const defaultOnboarding: OnboardingState = {
  step: 0,
  completed: false,
  profile: { name: '', username: '', bio: '', headline: '', tags: [] },
  agentPreferences: { personality: 'jarvis', agentMode: 'builder' },
  portfolio: { skills: [], headline: '', about: '' },
  integrations: [],
  visibility: 'public',
};
```

**Step 3: Add saveOnboardingStep action to authStore**

Add new action to the store:

```typescript
saveOnboardingStep: async (step: number, data: Record<string, unknown>) => {
  await api.patch(`/auth/onboarding/${step}`, data);
  set((s) => ({ onboarding: { ...s.onboarding, step } }));
},
```

**Step 4: Update completeOnboarding action**

```typescript
completeOnboarding: async () => {
  await api.post('/auth/onboarding/complete');
  set((s) => ({ onboarding: { ...s.onboarding, completed: true, step: 6 } }));
},
```

**Step 5: Update api.ts**

Add to `authService`:

```typescript
saveOnboardingStep: (step: number, data: Record<string, unknown>) =>
  api.patch(`/auth/onboarding/${step}`, data),
completeOnboarding: () =>
  api.post('/auth/onboarding/complete'),
```

**Step 6: Fix TypeScript errors**

```bash
npx tsc --noEmit
```

Fix any type errors from the interface change.

**Step 7: Commit**

```bash
git add src/types/index.ts src/stores/authStore.ts src/services/api.ts
git commit -m "feat: update onboarding types, store actions, and API for 6-step flow"
```

### Task 11: Build the 6-step OnboardingWizard component

**Files:**
- Create: `src/onboarding/OnboardingWizard.tsx` (main wizard container)
- Create: `src/onboarding/steps/ProfileStep.tsx`
- Create: `src/onboarding/steps/BioStep.tsx`
- Create: `src/onboarding/steps/AgentStep.tsx`
- Create: `src/onboarding/steps/PortfolioStep.tsx`
- Create: `src/onboarding/steps/IntegrationsStep.tsx`
- Create: `src/onboarding/steps/ReviewStep.tsx`
- Modify: `src/onboarding/OnboardingPage.tsx` (replace body with OnboardingWizard)

This is the largest task. Build each step component with:
- Form fields matching the OnboardingState type
- Inline validation (required fields show red border + error text)
- "Continue" button calls `saveOnboardingStep(stepNumber, data)` then advances
- Optional steps (4, 5) have subtle "I'll do this later" text link
- Each step receives `onboarding` state from store and `onNext`/`onBack` callbacks

The wizard container (`OnboardingWizard.tsx`) handles:
- Progress bar (6 dots/steps with active state)
- Step transitions (CSS slide animation via `animate-in` classes)
- Back/forward navigation between steps
- Calling `completeOnboarding()` on step 6 confirm

**Step 1: Create step components (one per file)**

Each step is a form with controlled inputs bound to the onboarding store.

**Step 2: Create OnboardingWizard container**

Manages current step, animation direction, progress bar rendering.

**Step 3: Replace OnboardingPage body**

Modify `src/onboarding/OnboardingPage.tsx` to render `<OnboardingWizard />` instead of the current inline step UI.

**Step 4: Verify TypeScript and visual**

```bash
npx tsc --noEmit
```

Build and check visually via Docker rebuild.

**Step 5: Commit**

```bash
git add src/onboarding/
git commit -m "feat: 6-step onboarding wizard with per-step persistence and animations"
```

### Task 12: Update route guards for onboarding

**Files:**
- Modify: `src/App.tsx` (lines 33-50)
- Modify: `src/stores/authStore.ts` (fetchUser to populate onboardingStep from /me)

**Step 1: Update fetchUser to set onboardingStep**

In `authStore.ts` `fetchUser()`, after getting `/auth/me` response:

```typescript
onboarding: {
  ...get().onboarding,
  completed: !!data.onboardingCompleted,
  step: data.onboardingStep ?? 0,
},
```

**Step 2: Update App.tsx guards**

Ensure the onboarding route shows the wizard at the user's last step, not always step 1.

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/App.tsx src/stores/authStore.ts
git commit -m "feat: route guards resume onboarding at last saved step"
```

---

## Phase 4: Fix All Bugs Found in Audit

### Task 13: Fix all CRITICAL and HIGH severity bugs

For each bug found in Tasks 2-7, apply the fix. Group related fixes into logical commits.

**Step 1: Fix each bug, test compilation**

**Step 2: Commit per logical group**

```bash
git commit -m "fix: [description of bug group]"
```

### Task 14: Fix MEDIUM and LOW severity bugs

Same pattern. Group, fix, compile-check, commit.

---

## Phase 5: E2E Verification

### Task 15: Verify new user signup → onboarding → dashboard

**Step 1: Rebuild and deploy**

```bash
docker compose build geekspace --no-cache
docker compose up -d geekspace
rm -rf /var/www/geekspace/* && docker cp geekspace-app:/app/dist/. /var/www/geekspace/
```

**Step 2: Test signup**

```bash
curl -s -X POST https://ai.geekspace.space/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e-test@test.com","password":"Test12345","username":"e2e_test"}' | python3 -m json.tool
```

Verify: returns user with `onboardingCompleted: false`, `onboardingStep: 0`.

**Step 3: Test per-step save**

```bash
TOKEN="<token from signup>"
curl -s -X PATCH https://ai.geekspace.space/api/auth/onboarding/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"E2E User","username":"e2e_test"}' | python3 -m json.tool
```

Verify: returns `{ success: true, step: 1 }`.

**Step 4: Test onboarding completion**

```bash
curl -s -X POST https://ai.geekspace.space/api/auth/onboarding/complete \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Verify: returns `{ success: true }`.

**Step 5: Verify /me returns completed state**

```bash
curl -s https://ai.geekspace.space/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Verify: `onboardingCompleted: true`, `onboardingStep: 6`.

**Step 6: Clean up test user**

```bash
sqlite3 /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db \
  "DELETE FROM users WHERE email='e2e-test@test.com';"
```

### Task 16: Verify returning user and edge cases

**Step 1: Test login with existing user**

```bash
curl -s -X POST https://ai.geekspace.space/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","password":"demo123"}' | python3 -m json.tool
```

Verify: `onboardingCompleted: true` (demo user).

**Step 2: Verify Puppeteer navigation test (if time permits)**

Test back-button behavior with headless browser.

**Step 3: Log PASS/FAIL for each journey**

---

## Phase 6: Cleanup & Final Sync

### Task 17: Code cleanup

**Files:**
- Search: all `src/`, `server/src/`

**Step 1: Remove dead code**

```bash
grep -rn "console.log\|// TODO\|// HACK\|debugger" src/ server/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Remove or address each finding.

**Step 2: Verify Docker build**

```bash
docker compose build --no-cache 2>&1 | tail -10
```

Expected: builds successfully.

**Step 3: Deploy and verify**

```bash
docker compose up -d
rm -rf /var/www/geekspace/* && docker cp geekspace-app:/app/dist/. /var/www/geekspace/
curl -s https://ai.geekspace.space/api/health | python3 -m json.tool
```

### Task 18: Sync branches and final commit

**Step 1: Push live-production**

```bash
git push origin live-production
```

**Step 2: Sync main**

```bash
git checkout main && git merge live-production --no-edit && git push origin main
git checkout live-production
```

**Step 3: Final verification**

```bash
git log main --oneline -5
git log live-production --oneline -5
```

Both must be identical.

**Step 4: Output final audit summary**

Print the complete `AUDIT COMPLETE` formatted summary as specified in the original prompt.
