# Phase 75 — Production Hardening + E2E Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix deployment fragility (Caddy desync, stale static files, stale SW cache), add frontend resilience (error boundary, chunk retry), and add E2E tests for agent chat and logout flows.

**Architecture:** Unify the host-level and Docker Caddyfiles so `caddy/Caddyfile` is the single source of truth. Harden `prod.sh` to sync static files, bump the service worker cache, and reload Caddy. Wrap `App.tsx` in an error boundary and add lazy-import retry logic. Add two Playwright E2E specs covering critical untested flows.

**Tech Stack:** Bash (prod.sh), Caddy, React (ErrorBoundary), Playwright (E2E), Vitest (meta test)

---

### Task 1: CI Baseline + Create Branch

**Files:**
- None modified

**Step 1: Verify baseline**

Run:
```bash
cd ~/GeekSpace2.0/server && npm test
```
Expected: 811/811 passing

**Step 2: Verify lint + typecheck + build + brand guard**

Run:
```bash
cd ~/GeekSpace2.0 && npm run lint && npx tsc --noEmit && npm run build && cd server && npx tsc --noEmit && npm run build && cd .. && npm run brand-guard
```
Expected: All clean

**Step 3: Create branch**

```bash
git checkout main && git pull origin main
git checkout -b ai/phase-20260226-phase75
```

---

### Task 2: Unify Caddy Configs

**Files:**
- Modify: `caddy/Caddyfile` (Docker source of truth)
- Modify: `/etc/caddy/Caddyfile` (host — sync target)

**Context:** Currently two divergent Caddyfiles exist. The Docker one (`caddy/Caddyfile`) uses Docker hostnames like `geekspace:3001` and `openclaw-tnq7-openclaw-1:58049`. The host one (`/etc/caddy/Caddyfile`) uses `127.0.0.1:3001` and `localhost:55550`. Per AI_LESSONS.md, the host Caddy is what actually serves external traffic on Hostinger.

The host Caddyfile must use `127.0.0.1:3001` (since the geekspace container maps port 3001 to localhost). The Docker Caddyfile keeps its Docker-internal hostnames for container-to-container routing.

**Step 1: Update host Caddyfile to match Docker Caddyfile structure**

The host `/etc/caddy/Caddyfile` must:
- Use `(common_headers)` snippet (DRY, matches Docker version)
- Include `dev.geekspace.space` domain (currently missing)
- Remove the legacy `edith.geekspace.space` stanza (replaced by `dev.geekspace.space`)
- Remove the `redir / /admin permanent` from `api.geekspace.space` (not in Docker version)
- Use `127.0.0.1:3001` for reverse_proxy (since Docker maps `3001` to localhost)

Write to `/etc/caddy/Caddyfile`:

```caddyfile
{
	email admin@geekspace.space
}

(common_headers) {
	header {
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
	}
}

ai.geekspace.space {
	import common_headers

	# API calls always pass through (they have their own JWT auth)
	handle /api/* {
		reverse_proxy 127.0.0.1:3001
	}

	# Artifact preview (public, served by Express)
	handle /preview/* {
		reverse_proxy 127.0.0.1:3001
	}

	# Assets always pass through
	handle /assets/* {
		root * /var/www/geekspace
		header Cache-Control "public, max-age=31536000, immutable"
		file_server
	}

	# Gate page is always accessible
	handle /gate.html {
		root * /var/www/geekspace
		file_server
	}

	# Authenticated users (cookie set by gate page) get the SPA
	@authed expression `{http.request.cookie.gs_auth} == "{$GATE_COOKIE_VALUE}"`
	handle @authed {
		root * /var/www/geekspace
		header Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}

	# Everyone else → gate
	handle {
		redir * /gate.html
	}
}

api.geekspace.space {
	import common_headers

	reverse_proxy 127.0.0.1:3001
}

dev.geekspace.space {
	import common_headers

	reverse_proxy localhost:55550
}
```

Note: The host Caddyfile uses `/var/www/geekspace` as root (NOT `/srv`), and uses `127.0.0.1:3001` (NOT Docker hostname `geekspace:3001`).

**Step 2: Reload host Caddy**

```bash
sudo systemctl start caddy
sudo caddy reload --config /etc/caddy/Caddyfile
```

**Step 3: Verify**

```bash
curl -sI https://ai.geekspace.space | head -5
curl -s https://api.geekspace.space/api/health | head -1
```
Expected: 302 for ai.geekspace.space, `{"ok":true` for api health.

---

### Task 3: Harden prod.sh (Static Sync + SW Bump + Caddy Reload)

**Files:**
- Modify: `scripts/prod.sh`

**Step 1: Add Caddy config sync, SW cache bump, and file validation to prod.sh**

Replace the contents of `scripts/prod.sh` with:

```bash
#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Production deployment
# Usage: ./scripts/prod.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "========================================"
echo " GeekSpace Production Deploy"
echo "========================================"
echo ""

# ── 1. Pull latest code ──────────────────
echo ">> Pulling latest code..."
git pull --ff-only
echo ""

# ── 2. Build Docker images ───────────────
echo ">> Building Docker images..."
docker compose build
echo ""

# ── 3. Deploy ────────────────────────────
echo ">> Starting containers..."
docker compose up -d
echo ""

# ── 4. Sync frontend to Caddy serve dir ─
echo ">> Syncing frontend assets to host..."
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
# Validate critical files exist
for f in index.html assets; do
    if [ ! -e "/var/www/geekspace/$f" ]; then
        echo "ERROR: /var/www/geekspace/$f missing after sync!"
        exit 1
    fi
done
echo "   Frontend synced to /var/www/geekspace/"
echo ""

# ── 5. Bump service worker cache name ────
echo ">> Bumping service worker cache..."
SHORT_SHA=$(git rev-parse --short HEAD)
SW_FILE="/var/www/geekspace/sw.js"
if [ -f "$SW_FILE" ]; then
    sed -i "s/const CACHE_NAME = '.*'/const CACHE_NAME = 'agentin-${SHORT_SHA}'/" "$SW_FILE"
    echo "   SW cache: agentin-${SHORT_SHA}"
fi
echo ""

# ── 6. Sync Caddy config + reload ────────
echo ">> Syncing Caddy config..."
if [ -f /etc/caddy/Caddyfile ]; then
    # Host Caddy is the production reverse proxy on Hostinger
    # Don't overwrite — host config uses 127.0.0.1, Docker config uses container names
    # Just reload to pick up any manual changes
    sudo caddy reload --config /etc/caddy/Caddyfile 2>/dev/null && echo "   Host Caddy reloaded" || echo "   Host Caddy reload skipped (not running?)"
fi
echo ""

# ── 7. Wait for startup ─────────────────
echo ">> Waiting for services to start..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "   API ready after ${i}s"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "   API not ready after 30s — continuing with healthcheck"
    fi
    sleep 1
done
echo ""

# ── 8. Health check ──────────────────────
echo ">> Running health check..."
echo ""
if bash "$SCRIPT_DIR/healthcheck.sh"; then
    echo ""
    echo "Deploy successful."
else
    echo ""
    echo "Deploy completed with issues."
    echo "Check logs: docker compose logs --tail=50"
fi

# ── 9. Container status ─────────────────
echo ""
echo "-- Container Status --"
docker compose ps
```

**Step 2: Verify script is executable**

```bash
chmod +x scripts/prod.sh
```

---

### Task 4: Root Error Boundary in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Context:** `DashboardApp.tsx` already wraps lazy pages in `<ErrorBoundary>`, but `App.tsx` (the root) has no error boundary. If `LandingPage`, `LoginPage`, or the router itself crashes, users see a white screen.

**Step 1: Add ErrorBoundary wrap to App.tsx**

Add import at top of `src/App.tsx`:

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';
```

Wrap the `<BrowserRouter>` content in `<ErrorBoundary>`:

```tsx
return (
    <BrowserRouter>
      {/* Skip to main content — accessibility for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-md focus:bg-[#00F0FF] focus:text-[#05050A] focus:font-semibold focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
        <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
          <Routes>
            {/* ... all routes unchanged ... */}
          </Routes>
        </div>
      </ErrorBoundary>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0C0C18',
            border: '1px solid rgba(0,240,255,0.2)',
            color: '#F4F6FF',
          },
        }}
      />
    </BrowserRouter>
  );
```

**Step 2: Verify**

```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit && npm run build
```
Expected: Clean

---

### Task 5: Chunk Load Retry (lazyRetry helper)

**Files:**
- Create: `src/utils/lazyRetry.ts`
- Modify: `src/dashboard/DashboardApp.tsx` (update lazy imports to use lazyRetry)

**Context:** When Vite deploys new hashed chunks, users with stale HTML may request old chunk URLs that 404. The dynamic `import()` fails and Suspense shows `<PageSkeleton />` forever with no recovery. A retry wrapper catches the error, reloads once, and gives up with a message if it still fails.

**Step 1: Create `src/utils/lazyRetry.ts`**

```typescript
import { lazy } from 'react';
import type { ComponentType } from 'react';

/**
 * Wraps React.lazy with a single retry + page reload on chunk load failure.
 * When a deploy ships new hashed chunks, stale HTML may reference old URLs.
 * This catches the import error, reloads the page once, and gives up if it
 * still fails (to avoid infinite reload loops).
 */
export function lazyRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const key = 'chunk-retry-reloaded';
    try {
      const component = await factory();
      // Success — clear the reload flag
      sessionStorage.removeItem(key);
      return component;
    } catch (error) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Return a never-resolving promise so React doesn't try to render
        return new Promise(() => {});
      }
      // Already reloaded once — let the error propagate to ErrorBoundary
      throw error;
    }
  });
}
```

**Step 2: Update DashboardApp.tsx lazy imports**

Find the block of `const XxxPage = lazy(() => import(...))` calls in `DashboardApp.tsx` and replace `lazy` with `lazyRetry` for all page imports. Add the import:

```typescript
import { lazyRetry } from '@/utils/lazyRetry';
```

Then replace every `lazy(` with `lazyRetry(` for page components. For example:

```typescript
// Before:
const RemindersPage = lazy(() => import('../dashboard/pages/RemindersPage'));
// After:
const RemindersPage = lazyRetry(() => import('../dashboard/pages/RemindersPage'));
```

Do this for ALL lazy page imports in DashboardApp.tsx.

**Step 3: Verify**

```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit && npm run build
```
Expected: Clean

---

### Task 6: Add test-id attributes for E2E anchors

**Files:**
- Modify: `src/components/AgentChatPanel.tsx` (add testids to chat input + send button)
- Modify: `src/dashboard/DashboardApp.tsx` (add testid to logout button + chat FAB)
- Modify: `src/components/AgentChatButton.tsx` (add testid to FAB button)

**Step 1: Add data-testid to chat input and send button in AgentChatPanel.tsx**

In `AgentChatPanel.tsx` around line 1221, the `<Input>` component — add `data-testid="chat-input"`:

```tsx
<Input
  ref={inputRef}
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder={premiumSession ? `Ask ${premiumSession.codename}...` : 'Ask anything...'}
  className="flex-1 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] rounded-xl"
  data-testid="chat-input"
/>
```

Around line 1238, the send `<Button>` — add `data-testid="chat-send"`:

```tsx
<Button
  onClick={() => sendMessage()}
  disabled={!input.trim() || isTyping}
  className={`rounded-xl px-3 press-scale ${
    premiumSession
      ? 'bg-[#F59E0B] hover:bg-[#D97706]'
      : 'bg-[#00F0FF] hover:bg-[#00D4B0]'
  }`}
  data-testid="chat-send"
>
```

**Step 2: Add data-testid to logout button in DashboardApp.tsx**

Around line 588, the logout `<button>` — add `data-testid="logout-button"`:

```tsx
<button
  onClick={handleLogout}
  data-testid="logout-button"
  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#6B7280] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0] transition-all min-h-[44px]"
>
```

**Step 3: Add data-testid to AgentChatButton.tsx**

Around line 56, the FAB `<button>` — add `data-testid="chat-fab"`:

```tsx
<button
  onClick={handleClick}
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  className="alex-orb group"
  aria-label="Talk to AI Agent"
  data-testid="chat-fab"
>
```

**Step 4: Verify**

```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit && npm run build
```

---

### Task 7: E2E — Agent Chat Flow

**Files:**
- Create: `e2e/chat.spec.ts`

**Context:** The chat panel is the core feature. This E2E test opens the chat via the FAB button, sends a message, and verifies it appears in the chat thread. Uses the seed API from `auth.setup.ts` pattern.

**Step 1: Create `e2e/chat.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

/**
 * Agent Chat E2E Tests
 * Tests the chat panel: open → type → send → message appears
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Agent Chat', () => {
  test('should open chat, send message, and see it in thread', async ({ page, request }) => {
    // Seed a test user
    const apiURL = process.env.API_URL || 'http://localhost:3001';
    const uniqueId = Date.now();
    const seedRes = await request.post(`${apiURL}/api/test/seed`, {
      data: {
        email: `chat-e2e-${uniqueId}@example.com`,
        name: 'Chat Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
        onboardingCompleted: true,
      },
    });
    expect(seedRes.ok()).toBeTruthy();
    const { credentials } = await seedRes.json() as { credentials: { email: string; password: string } };

    // Login
    await page.goto('/login');
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 30000 });

    // Open chat via FAB
    await page.getByTestId('chat-fab').click();

    // Wait for chat panel to be visible (the input should appear)
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 });

    // Type a message
    const testMessage = `E2E test message ${uniqueId}`;
    await page.getByTestId('chat-input').fill(testMessage);

    // Send
    await page.getByTestId('chat-send').click();

    // Verify the user message appears in the chat thread
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });
  });
});
```

**Step 2: Run to verify (requires dev servers running)**

```bash
cd ~/GeekSpace2.0 && npx playwright test e2e/chat.spec.ts --headed
```

Note: E2E tests require both frontend dev server (port 5173) and backend (port 3001) running. If not available in CI, the test will skip gracefully (Playwright config handles this).

---

### Task 8: E2E — Logout + Re-login Flow

**Files:**
- Create: `e2e/logout.spec.ts`

**Step 1: Create `e2e/logout.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

/**
 * Logout + Re-login E2E Tests
 * Tests: login → logout → redirect to / → re-login → dashboard loads
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Logout Flow', () => {
  test('should logout and redirect, then re-login successfully', async ({ page, request }, testInfo) => {
    // Seed a test user
    const apiURL = process.env.API_URL || 'http://localhost:3001';
    const uniqueId = Date.now();
    const seedRes = await request.post(`${apiURL}/api/test/seed`, {
      data: {
        email: `logout-e2e-${uniqueId}@example.com`,
        name: 'Logout Test User',
        plan: 'free',
        credits: 100,
        agentActive: true,
        onboardingCompleted: true,
      },
    });
    expect(seedRes.ok()).toBeTruthy();
    const { credentials } = await seedRes.json() as { credentials: { email: string; password: string } };

    // Login
    await page.goto('/login');
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 30000 });

    // Click logout — desktop sidebar has the logout button
    if (testInfo.project.name === 'chromium') {
      await page.getByTestId('logout-button').click();
    } else {
      // Mobile: open nav first
      await page.getByTestId('mobile-nav-toggle').click();
      await page.getByTestId('logout-button').click();
    }

    // Should redirect away from dashboard
    await page.waitForURL(/^\/$|\/login/, { timeout: 10000 });
    // Confirm we're no longer on dashboard
    expect(page.url()).not.toContain('/dashboard');

    // Re-login
    await page.goto('/login');
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();

    // Verify dashboard loads again
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await expect(page.getByTestId('dashboard-shell')).toBeVisible({ timeout: 30000 });
  });
});
```

---

### Task 9: Phase 75 Meta Test

**Files:**
- Create: `server/src/test/api/phase75.test.ts`

**Step 1: Write the meta test**

```typescript
/**
 * Phase 75 Tests
 * Verify production hardening deliverables exist:
 * - lazyRetry utility
 * - ErrorBoundary in App.tsx
 * - E2E spec files
 * - prod.sh has sync + SW bump steps
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../../..');

describe('Phase 75 — Production Hardening', () => {
  it('lazyRetry utility exists', () => {
    expect(existsSync(resolve(ROOT, 'src/utils/lazyRetry.ts'))).toBe(true);
  });

  it('App.tsx imports ErrorBoundary', () => {
    const content = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
    expect(content).toContain('ErrorBoundary');
  });

  it('DashboardApp.tsx uses lazyRetry', () => {
    const content = readFileSync(resolve(ROOT, 'src/dashboard/DashboardApp.tsx'), 'utf-8');
    expect(content).toContain('lazyRetry');
  });

  it('E2E chat spec exists', () => {
    expect(existsSync(resolve(ROOT, 'e2e/chat.spec.ts'))).toBe(true);
  });

  it('E2E logout spec exists', () => {
    expect(existsSync(resolve(ROOT, 'e2e/logout.spec.ts'))).toBe(true);
  });

  it('prod.sh contains SW cache bump logic', () => {
    const content = readFileSync(resolve(ROOT, 'scripts/prod.sh'), 'utf-8');
    expect(content).toContain('CACHE_NAME');
    expect(content).toContain('docker cp');
  });
});
```

**Step 2: Run**

```bash
cd ~/GeekSpace2.0/server && npx vitest run src/test/api/phase75.test.ts
```
Expected: 6/6 passing

---

### Task 10: Full Verification + Brand Guard

**Step 1: Run full test suite**

```bash
cd ~/GeekSpace2.0/server && npm test
```
Expected: 817/817 passing (811 + 6 new)

**Step 2: Lint + typecheck + build**

```bash
cd ~/GeekSpace2.0 && npm run lint && npx tsc --noEmit && npm run build && cd server && npx tsc --noEmit && npm run build
```

**Step 3: Brand guard**

```bash
cd ~/GeekSpace2.0 && npm run brand-guard
```
Expected: 0 violations

---

### Task 11: Update Ops Files + Commit + PR + Merge

**Files:**
- Modify: `ops/AI_HANDOFF.md`
- Modify: `ops/AI_PHASE_PLAN.md`
- Modify: `ops/AI_FEATURE_MATRIX.md`
- Modify: `ops/AI_LESSONS.md`

**Step 1: Update ops files**

- `AI_PHASE_PLAN.md`: Add Phase 75 table
- `AI_HANDOFF.md`: Update with Phase 75 state
- `AI_FEATURE_MATRIX.md`: Update E2E columns for Chat and Auth
- `AI_LESSONS.md`: Add lesson about host Caddy vs Docker Caddy static file sync

**Step 2: Stage + commit**

```bash
git add \
  scripts/prod.sh \
  src/App.tsx \
  src/utils/lazyRetry.ts \
  src/dashboard/DashboardApp.tsx \
  src/components/AgentChatPanel.tsx \
  src/components/AgentChatButton.tsx \
  e2e/chat.spec.ts \
  e2e/logout.spec.ts \
  server/src/test/api/phase75.test.ts \
  ops/AI_HANDOFF.md \
  ops/AI_PHASE_PLAN.md \
  ops/AI_FEATURE_MATRIX.md \
  ops/AI_LESSONS.md \
  docs/plans/2026-02-26-phase75-production-hardening.md \
  docs/plans/2026-02-26-phase75-production-hardening-design.md
```

```bash
git commit -m "feat(phase75): production hardening + E2E coverage

Unify Caddy configs, harden prod.sh (static sync + SW bump),
add root error boundary, chunk load retry, E2E for chat + logout.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Step 3: Push + PR + merge**

```bash
git push -u origin ai/phase-20260226-phase75
gh pr create --title "Phase 75: Production hardening + E2E coverage" --body "..."
gh pr merge --merge --delete-branch
```
