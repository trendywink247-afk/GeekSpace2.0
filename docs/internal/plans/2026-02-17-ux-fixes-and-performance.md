# UX Fixes & Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 critical UX/reliability issues: portfolio 404 on signup, Kimi-powered content generation, username endpoint errors, avatar sync across dashboard, memory page reliability, and Redis caching for API performance.

**Architecture:** Server-side fixes in Express/TypeScript routes + DB transaction safety; frontend fixes in React stores; Redis caching layer added via `ioredis` on already-running Redis container; Kimi (Moonshot via OpenRouter) replaces Ollama for content generation.

**Tech Stack:** TypeScript, Express, better-sqlite3, React, Zustand (authStore), ioredis, Kimi/Moonshot via OpenRouter (already wired as `forceProvider: 'edith'`)

---

## Context for Implementer

The live server runs in Docker. Key paths:
- **Server source:** `/root/GeekSpace2.0/server/src/`
- **Frontend source:** `/root/GeekSpace2.0/src/`
- **Build server:** `cd /root/GeekSpace2.0/server && npm run build`
- **Deploy:** `docker compose up -d --build` from `/root/GeekSpace2.0/`
- **Live DB:** `/app/data/geekspace.db` (Docker volume — direct SQLite queries won't affect live)
- **Restart without rebuild:** `docker compose restart geekspace`

Never skip `npm run build` before testing server changes — the server runs compiled JS from `dist/`.

---

## Task 1: Wrap Signup in a DB Transaction (Portfolio Not Found Fix)

**Problem:** `auth.ts` signup inserts records in sequence without a transaction. If `pico_agents` insert fails (UNIQUE constraint, table issue), the user row exists but signup returns 500 — the user can't log in and the portfolio row state is uncertain.

**Files:**
- Modify: `server/src/routes/auth.ts` (lines 22–65, the signup block)

### Step 1: Read the current signup code

Open `server/src/routes/auth.ts` and find the POST `/register` or `/signup` handler, lines 22–65. Identify every `db.prepare(...).run(...)` call in the signup block.

### Step 2: Wrap all inserts in a `db.transaction()`

Replace the sequential inserts with a single transaction. `better-sqlite3` transactions are synchronous and wrap with `db.transaction(() => { ... })()`.

```typescript
// server/src/routes/auth.ts — replace the insert block with:
const signupTransaction = db.transaction(() => {
  db.prepare(`INSERT INTO users (id, email, username, password_hash, name) VALUES (?, ?, ?, ?, ?)`)
    .run(id, email, username, passwordHash, name || username);

  db.prepare(`INSERT INTO agent_configs (user_id) VALUES (?)`)
    .run(id);

  db.prepare(`INSERT INTO features (user_id) VALUES (?)`)
    .run(id);

  db.prepare(`INSERT INTO subscriptions (id, user_id, plan, credits_remaining, credits_total) VALUES (?, ?, 'free', 5000, 5000)`)
    .run(uuid(), id);

  db.prepare(`INSERT INTO portfolios (user_id, username) VALUES (?, ?)`)
    .run(id, username);

  // Wrap pico_agents in try/catch inside the transaction — non-fatal if it fails
  try {
    db.prepare('INSERT INTO pico_agents (id, user_id, slot, name) VALUES (?, ?, 1, ?)')
      .run(uuid(), id, 'Weebo');
  } catch (e) {
    // pico_agents is optional — log but don't fail signup
    console.warn('[signup] pico_agents insert skipped:', (e as Error).message);
  }
});

try {
  signupTransaction();
} catch (err: any) {
  if (err.message?.includes('UNIQUE constraint')) {
    res.status(409).json({ error: 'Email or username already taken' });
    return;
  }
  throw err;
}
```

> **Note:** Read the exact existing code first — field names, column order, and uuid() call style may differ slightly. Match them. The key changes are: (1) wrap in `db.transaction()`, (2) try/catch inside for `pico_agents`, (3) outer catch for UNIQUE constraint → 409.

### Step 3: Build and verify

```bash
cd /root/GeekSpace2.0/server && npm run build
```
Expected: zero TypeScript errors.

### Step 4: Also fix `portfolios.username` sync on `PATCH /api/users/me`

In `server/src/routes/users.ts`, the PATCH handler updates `users.username` but never updates `portfolios.username`. Add the sync:

```typescript
// After the UPDATE users SET ... query runs, add:
if (updates.username) {
  db.prepare('UPDATE portfolios SET username = ? WHERE user_id = ?')
    .run(updates.username, req.userId);
}
```

Find the exact location: after the `db.prepare(...UPDATE users...).run(values)` line in the PATCH handler.

### Step 5: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
```
Expected: zero errors.

### Step 6: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/routes/auth.ts server/src/routes/users.ts
git commit -m "fix: wrap signup in transaction, sync portfolios on username update"
```

---

## Task 2: Switch Content Generation to Kimi (Fast AI Responses)

**Problem:** `POST /generate-content` hardcodes `forceProvider: 'ollama'`, causing 70+ second responses. The Kimi/Moonshot path is already wired as `forceProvider: 'edith'` in `llm.ts`.

**Files:**
- Modify: `server/src/routes/agent.ts` (line ~123, the `generate-content` handler)

### Step 1: Find the exact line

In `server/src/routes/agent.ts`, search for the `generate-content` route handler. Look for:
```typescript
{ forceProvider: 'ollama' as Provider }
```
It is inside a `routeChat()` call, approximately line 121–124.

### Step 2: Change the provider

```typescript
// Before:
const result = await routeChat(
  [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Generate it now.' }],
  { forceProvider: 'ollama' as Provider }
);

// After:
const result = await routeChat(
  [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Generate it now.' }],
  { forceProvider: 'edith' as Provider }
);
```

> **Why 'edith'?** The `'edith'` provider in `llm.ts` calls `callMoonshotReasoning()` which uses the Kimi/Moonshot model via OpenRouter. The VPS already has `OPENROUTER_API_KEY` configured. Cost is 10 credits minimum per call (vs 1 for Ollama) but response time drops from 70s to ~3s.

> **Alternative:** If credits are a concern, use `'openrouter-free'` for free-tier OpenRouter models (~3s, 2 credits). Only use `'edith'` if the response quality needs to be high. Check with the user which models are configured in `.env`.

### Step 3: Verify the env var is set

```bash
docker exec geekspace-geekspace-1 env | grep OPENROUTER_API_KEY
```
Expected: a non-empty key value. If blank, the key needs to be added to `.env` and the container rebuilt.

### Step 4: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts
git commit -m "feat: switch generate-content to Kimi (edith provider) for fast responses"
```

---

## Task 3: Fix Username Endpoint — Uniqueness Check + 409 Response

**Problem:** `PATCH /api/users/me` with a taken username causes SQLite to throw a raw UNIQUE constraint error → 500 response instead of a proper 409. Additionally, no validation prevents empty or invalid usernames.

**Files:**
- Modify: `server/src/routes/users.ts` (PATCH handler, lines ~38–65)

### Step 1: Read the current PATCH handler

Open `server/src/routes/users.ts` and find the PATCH `/me` route. Understand exactly how it builds the `UPDATE users SET ...` query.

### Step 2: Add uniqueness check before the UPDATE

Before the `db.prepare('UPDATE users SET ...')` call, if `updates.username` is present:

```typescript
if (updates.username) {
  // Validate format
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(updates.username)) {
    res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, underscores only' });
    return;
  }
  // Check uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
    .get(updates.username, req.userId);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }
}
```

### Step 3: Wrap the UPDATE in try/catch for any remaining constraint errors

```typescript
try {
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run([...values, req.userId]);
} catch (err: any) {
  if (err.message?.includes('UNIQUE constraint')) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }
  throw err;
}
```

### Step 4: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/routes/users.ts
git commit -m "fix: username uniqueness check returns 409 instead of 500"
```

---

## Task 4: Fix Avatar Sync — Dashboard Header + Store Update on Save

**Problem A:** `DashboardApp.tsx` header always shows a hardcoded `<User>` icon regardless of `user.avatar`.
**Problem B:** `SettingsPage.tsx` `handleSave()` calls `updateProfile()` but discards the response — `authStore` is never updated with the new avatar.

**Files:**
- Modify: `src/dashboard/DashboardApp.tsx` (header user button, lines ~362–370)
- Modify: `src/dashboard/pages/SettingsPage.tsx` (handleSave, lines ~101–110)
- Read: `src/stores/authStore.ts` (find the `setUser` action name)

### Step 1: Read authStore to find setUser

Open `src/stores/authStore.ts`. Find the action that updates the user object (likely `setUser` or `updateUser`). Note the exact function name.

### Step 2: Fix DashboardApp header to show avatar

In `DashboardApp.tsx`, find the header user button (the `<button>` that sets `currentPage` to `'settings'`). Replace the static icon with a conditional:

```tsx
// Before (hardcoded icon):
<div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center">
  <User className="w-4 h-4 text-white" />
</div>

// After (shows avatar or fallback to initials/icon):
<div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center">
  {user?.avatar ? (
    <img src={user.avatar} alt={user.name || user.username} className="w-full h-full object-cover" />
  ) : (
    <span className="text-white text-xs font-bold">
      {(user?.name || user?.username || '?').charAt(0).toUpperCase()}
    </span>
  )}
</div>
```

> The `User` icon import can be removed from this file if it's only used here — but first check if it's used elsewhere in `DashboardApp.tsx` to avoid a TypeScript `noUnusedLocals` error.

### Step 3: Fix SettingsPage to update the store after save

In `SettingsPage.tsx`, find `handleSave`. Identify:
1. The import of `userService` and how `updateProfile()` is called
2. The import/usage of `useAuthStore`

Update `handleSave` to capture the response and sync the store:

```typescript
// Find how authStore is imported and used. Add setUser to the destructure:
const setUser = useAuthStore((s) => s.setUser); // or whatever the action name is

const handleSave = async () => {
  setIsSaving(true);
  try {
    const updatedUser = await userService.updateProfile(profile);
    setUser(updatedUser);  // sync the auth store so header and sidebar update immediately
  } catch (err) {
    console.error('[settings] save failed:', err);
  } finally {
    setIsSaving(false);
  }
};
```

> **Important:** `userService.updateProfile()` likely returns the full updated user object from the API. Check `src/services/api.ts` to confirm the return type. The `setUser` call must receive the full user shape that `authStore` expects.

### Step 4: Build frontend

```bash
cd /root/GeekSpace2.0 && npm run build
```
Expected: zero TypeScript errors (watch for `noUnusedLocals` on removed `User` import).

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add src/dashboard/DashboardApp.tsx src/dashboard/pages/SettingsPage.tsx
git commit -m "fix: show user avatar in dashboard header, sync store after profile save"
```

---

## Task 5: Memory Page — Verify and Fix Blank State

**Problem:** New accounts see the memory page as blank. Investigation shows it's likely an empty-state rendering correctly ("No memories yet") OR a 401 redirect happening before render. Verify which case it is, then fix if needed.

**Files:**
- Read: `src/dashboard/pages/MemoryManagerPage.tsx` (empty state rendering, error handling)
- Read: `src/services/api.ts` (axios interceptor behavior on 401)
- Modify if needed: `src/dashboard/pages/MemoryManagerPage.tsx`

### Step 1: Verify the empty state renders correctly

Open `MemoryManagerPage.tsx`. Find the `if (memories.length === 0)` or equivalent empty state block (~lines 340–369). Confirm it renders a visible "No memories yet" UI with an Add button — not a blank white/dark div.

If the empty state renders correctly → no fix needed for the empty state itself.

### Step 2: Check for 401 redirect on page load

In `src/services/api.ts`, find the axios response interceptor. Check: when a 401 response is received, does it call `window.location.href = '/login'` or `router.push('/login')` immediately? If yes, new users with expired tokens will see a blank flash before redirect.

If the memory API returns 401 for valid sessions: the issue is token handling, not the memory page.

### Step 3: Add a loading skeleton to prevent perceived blank state

In `MemoryManagerPage.tsx`, if there's no loading state UI, add one:

```tsx
// In the render, before the empty state check:
if (isLoading) {
  return (
    <div className="p-8 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
```

> Only add this if the page currently shows nothing during load. If it already has a loading spinner/skeleton, skip.

### Step 4: Build and confirm

```bash
cd /root/GeekSpace2.0 && npm run build
```

### Step 5: Commit (only if changes were made)

```bash
cd /root/GeekSpace2.0
git add src/dashboard/pages/MemoryManagerPage.tsx
git commit -m "fix: memory page loading state prevents blank flash on new accounts"
```

---

## Task 6: Redis Caching Layer for Public API Endpoints

**Problem:** Redis is running in Docker but the server never uses it — no Redis client installed. High-traffic public endpoints (portfolio, personalities, billing plans, user directory) hammer SQLite on every request.

**Files:**
- Create: `server/src/services/cache.ts`
- Modify: `server/src/routes/portfolio.ts` (cache portfolio reads)
- Modify: `server/src/routes/agent.ts` (cache GET /personalities)
- Modify: `server/src/routes/billing.ts` (cache GET /plans)
- Modify: `server/package.json` (add ioredis)

### Step 1: Install ioredis

```bash
cd /root/GeekSpace2.0/server && npm install ioredis
npm install --save-dev @types/ioredis 2>/dev/null || true
```

Note: `ioredis` ships its own types — the second command is optional.

### Step 2: Create the cache service

Create `server/src/services/cache.ts`:

```typescript
import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null = null;

function getClient(): Redis | null {
  if (!config.redisUrl) return null;
  if (!client) {
    client = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    client.on('error', (err) => {
      console.warn('[cache] Redis error (non-fatal):', err.message);
    });
  }
  return client;
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await getClient()?.get(key) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getClient()?.set(key, value, 'EX', ttlSeconds);
  } catch {
    // Redis failure is non-fatal — serve from DB
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getClient()?.del(key);
  } catch {}
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const redis = getClient();
    if (!redis) return;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}
```

> **Design:** All Redis calls are wrapped in try/catch. If Redis is down, the server falls back to SQLite without any error. The `lazyConnect: true` and `maxRetriesPerRequest: 1` prevent connection hangs on startup.

### Step 3: Cache GET /api/billing/plans (indefinite — it's a constant)

In `server/src/routes/billing.ts`, find the `GET /plans` handler. Wrap it:

```typescript
import { cacheGet, cacheSet } from '../services/cache';

// Inside the GET /plans handler:
const cacheKey = 'billing:plans';
const cached = await cacheGet(cacheKey);
if (cached) {
  res.json(JSON.parse(cached));
  return;
}
const plans = PLAN_DEFINITIONS; // or however it's currently fetched
await cacheSet(cacheKey, JSON.stringify(plans), 3600); // 1 hour TTL
res.json(plans);
```

### Step 4: Cache GET /api/agent/personalities (indefinite — static data)

In `server/src/routes/agent.ts`, find `GET /personalities`. Wrap similarly with key `'agent:personalities'` and TTL 3600.

### Step 5: Cache GET /api/portfolio/:username (5 min TTL, invalidate on update)

In `server/src/routes/portfolio.ts`, find `GET /:username`. Wrap:

```typescript
import { cacheGet, cacheSet, cacheDel } from '../services/cache';

// GET /:username
const cacheKey = `portfolio:${req.params.username}`;
const cached = await cacheGet(cacheKey);
if (cached) {
  res.json(JSON.parse(cached));
  return;
}
// ... existing DB query ...
const data = { portfolio, projects, skills, experience }; // whatever is returned
await cacheSet(cacheKey, JSON.stringify(data), 300); // 5 min
res.json(data);
```

In the portfolio **update/save** handler (PATCH or POST), add cache invalidation:
```typescript
await cacheDel(`portfolio:${username}`);
```

### Step 6: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
```

Expected: zero TypeScript errors. `ioredis` types are bundled with the package so no `@types/` install needed.

### Step 7: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/services/cache.ts server/src/routes/portfolio.ts server/src/routes/agent.ts server/src/routes/billing.ts server/package.json server/package-lock.json
git commit -m "feat: Redis caching for public API endpoints (portfolio, personalities, plans)"
```

---

## Task 7: Deploy and Smoke Test

### Step 1: Deploy

```bash
cd /root/GeekSpace2.0
docker compose up -d --build
```

Watch logs:
```bash
docker compose logs -f geekspace
```
Expected: server starts, no crash, `[cache] Redis connected` or similar (or just no Redis error).

### Step 2: Test signup flow

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test_new@example.com","username":"testnewuser","password":"Test1234!","name":"Test User"}'
```
Expected: 201 with `token` in response body (not 500).

### Step 3: Test portfolio loads

```bash
curl http://localhost:3001/api/portfolio/testnewuser
```
Expected: 200 with portfolio data (not 404).

### Step 4: Test generate-content speed

```bash
time curl -X POST http://localhost:3001/api/agent/generate-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_from_step_2>" \
  -d '{"section":"bio"}'
```
Expected: response in under 10 seconds (was 76 seconds before).

### Step 5: Test username conflict returns 409

```bash
curl -X PATCH http://localhost:3001/api/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"username":"alex"}'  # "alex" is a seed user
```
Expected: `409 {"error":"Username already taken"}` (not 500).

### Step 6: Verify Redis caching

```bash
# First request — should hit DB
time curl http://localhost:3001/api/billing/plans
# Second request — should return from cache (faster)
time curl http://localhost:3001/api/billing/plans
```
Expected: both return same data; second request is faster.

### Step 7: Final commit if any hot-fixes needed, then tag

```bash
cd /root/GeekSpace2.0
git tag v2.1-ux-fixes
git push origin live-production --tags
```

---

## Testing Checklist

After full deployment, verify with the live account (trendywink24.7@gmail.com):

- [ ] Sign up as a new user → receives token (no 500)
- [ ] Portfolio URL for new user loads → shows empty portfolio (not 404)
- [ ] Generate-content responds in < 10s
- [ ] Update username to taken name → 409 error shown (not crash)
- [ ] Update avatar in Settings → avatar appears in dashboard header immediately
- [ ] Memory page shows empty state with "Add Memory" button (not blank)
- [ ] Navigate between pages quickly → API responses feel fast
- [ ] Billing /plans and /personalities responses are cached (check Redis with `docker exec geekspace-redis-1 redis-cli keys '*'`)

---

## Env Vars Checklist

Ensure these are set in `.env` for Kimi to work:

```
OPENROUTER_API_KEY=<your key>          # required for Kimi (edith provider)
OPENROUTER_MODEL=moonshotai/kimi-k2    # or kimi-k2-thinking — check what's available
REDIS_URL=redis://redis:6379           # already in docker-compose env
```

If `OPENROUTER_API_KEY` is missing, `generate-content` will fall back or error — add the key to `.env` before deploying.
