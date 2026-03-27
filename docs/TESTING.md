# Testing Guide

> Comprehensive testing reference for the Agentin platform.
> Covers unit tests (Vitest), end-to-end tests (Playwright), CI integration, and test authoring patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Running Tests](#running-tests)
3. [Test Architecture](#test-architecture)
4. [Test Inventory](#test-inventory)
5. [Coverage Analysis](#coverage-analysis)
6. [Writing New Tests](#writing-new-tests)
7. [E2E Test Strategy](#e2e-test-strategy)
8. [CI Integration](#ci-integration)
9. [Pre-existing Issues](#pre-existing-issues)
10. [Test Data and Mocks](#test-data-and-mocks)
11. [Recommended Future Tests](#recommended-future-tests)
12. [Related Documents](#related-documents)

---

## 1. Overview

The Agentin platform uses a two-layer testing strategy:

| Layer | Framework | Location | Count |
|-------|-----------|----------|-------|
| Unit / Integration | Vitest 3.x | `server/src/test/` | 2,552 passing |
| End-to-End | Playwright | `e2e/` | 20 spec files |
| Front-end Unit | Vitest (via root config) | `tests/` | 24 test files |

**Current status (as of session 9):** 2,552 pass / 1 fail (pre-existing) / ~29 skip | TypeScript: 0 errors | Health: 10/10 OK

### Testing Stack

- **Vitest** -- Test runner for all server-side unit and integration tests. Uses `supertest` for HTTP assertions against the real Express app.
- **Playwright** -- Browser automation for E2E tests. Runs against real frontend (Vite) and backend (Express) with `TEST_MODE` enabled.
- **better-sqlite3** -- Tests use a per-process temporary SQLite database (`/tmp/geekspace-test-<pid>.db`), ensuring isolation from production data.

---

## 2. Running Tests

### Server Unit Tests

```bash
# Run all unit tests (single pass)
cd server && npx vitest --run

# Watch mode (re-runs on file changes)
cd server && npx vitest

# With coverage report (v8 provider, outputs text + HTML)
cd server && npx vitest --coverage

# Single file
cd server && npx vitest run src/test/api/auth.test.ts

# Pattern match
cd server && npx vitest run --reporter=verbose auth

# Using npm script (sets TEST_MODE=true automatically)
cd server && npm test
```

### End-to-End Tests

```bash
# Run all E2E tests (starts backend + frontend automatically)
npx playwright test

# Specific spec file
npx playwright test e2e/billing.spec.ts

# Headed mode (watch the browser)
npx playwright test --headed

# Specific project (device)
npx playwright test --project=chromium
npx playwright test --project=pixel5

# Debug mode (opens inspector)
npx playwright test --debug

# View last HTML report
npx playwright show-report
```

### Linting

```bash
# Lint all files
npm run lint

# Typecheck root (frontend)
npx tsc --noEmit

# Typecheck server
cd server && npm run typecheck
```

---

## 3. Test Architecture

### Environment Detection

The platform uses a `TEST_MODE` environment variable to activate test-specific behavior:

- **Vitest config** (`server/vitest.config.ts`) sets `env.TEST_MODE = 'true'` globally.
- **Test setup** (`server/src/test/setup.ts`) also sets `process.env.TEST_MODE = 'true'` before any imports.
- **Playwright config** (`playwright.config.ts`) passes `TEST_MODE: '1'` to the backend web server.

When `TEST_MODE` is active, the server exposes test-only endpoints:
- `POST /api/test/reset` -- Wipes all test data.
- `POST /api/test/seed` -- Creates a test user with specified attributes.
- `GET /api/test/state` -- Returns current test state and DB statistics.

### Database Strategy

```
Production:  SQLite at configured DB_PATH
Tests:       SQLite at /tmp/geekspace-test-<pid>.db (per-process)
```

- Each test file calls `resetDatabase()` in `beforeAll` / `afterEach` to ensure clean state.
- `resetDatabase()` disables foreign keys, truncates all tables in reverse dependency order, then re-enables foreign keys.
- The Vitest pool uses `forks` with `singleFork: true` to run tests sequentially and prevent DB conflicts.

### Test Isolation

- **Pool:** `forks` mode with single fork ensures sequential execution.
- **Timeout:** 30-second global timeout per test (accommodates slow LLM-related tests).
- **Include pattern:** `src/test/**/*.test.ts` (files in `src/__tests__/` are excluded from the main Vitest run).

### Mock Patterns

Tests use `vi.mock()` for external service dependencies:

```typescript
// Example: mocking Telegram service in webhook tests
vi.mock('../../services/telegram.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/telegram.js')>();
  return {
    ...original,
    sendTelegramMessage: vi.fn(async (chatId, text) => {
      sentMessages.push({ chatId, text });
    }),
    // ... other mocked methods
  };
});

// Example: mocking cache service
vi.mock('../../services/cache.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
  cacheDel: vi.fn(async () => {}),
}));
```

---

## 4. Test Inventory

### Server API Tests (`server/src/test/api/`)

#### Auth and Security

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `auth.test.ts` | Auth | Integration | Login, signup, token validation, credential rejection |
| `auth-hardening.test.ts` | Auth | Integration | Security hardening measures, brute-force protection |
| `oauth.test.ts` | Auth | Integration | OAuth flow, token exchange |
| `admin.test.ts` | Admin | Integration | Admin endpoints, user management |
| `gate.test.ts` | Auth | Integration | Gate access control, cookie verification |
| `api-keys.test.ts` | Auth | Integration | API key CRUD, key validation |
| `users.test.ts` | Users | Integration | User profile, preferences |
| `invites.test.ts` | Users | Integration | Invite system, invite codes |

#### Agent and Chat

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `agent-config.test.ts` | Agent | Integration | Agent configuration CRUD |
| `agent-memory.test.ts` | Agent | Integration | Agent memory delete, scoping |
| `agent-quality.test.ts` | Agent | Integration | Agent quality metrics, version API (Phase 27.4) |
| `agent-status.test.ts` | Agent | Integration | Agent online/offline status |
| `message-router.test.ts` | Chat | Integration | Message routing logic |
| `action-parser.test.ts` | Chat | Integration | Action parsing from messages |
| `llm-cache.test.ts` | Chat | Integration | LLM response caching |

#### Billing and Subscriptions

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `billing.test.ts` | Billing | Integration | Plans listing, current plan, upgrade, usage, day-pass |

#### Reminders and Scheduling

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `reminders.test.ts` | Reminders | Integration | CRUD, completion, authentication, filtering |
| `bulk-snooze.test.ts` | Reminders | Integration | Bulk snooze operations |
| `calendar.test.ts` | Calendar | Integration | Calendar integration endpoints |
| `briefings.test.ts` | Briefings | Integration | Daily briefings API (Phase 26) |

#### Automations and Jobs

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `automations.test.ts` | Automations | Integration | CRUD, toggle, manual trigger, execution logs |
| `jobs.test.ts` | Jobs | Integration | Background job management |

#### Portfolio and Social

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `portfolio-stats.test.ts` | Portfolio | Integration | Portfolio analytics, view counts |
| `contact.test.ts` | Portfolio | Integration | Portfolio contact form |
| `social-media.test.ts` | Social | Integration | Social media integration |

#### Webhooks and Integrations

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `webhooks.test.ts` | Webhooks | Integration | Telegram secret verification, bot-message filtering, n8n auth |
| `integrations.test.ts` | Integrations | Integration | Third-party integration management |
| `integration-health.test.ts` | Integrations | Integration | Integration health checks |

#### Services and Infrastructure

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `pico-fleet.test.ts` | Pico Fleet | Integration | Pico agent fleet management |
| `activity-sessions.test.ts` | Activity | Integration | User activity session tracking |
| `escalation.test.ts` | Escalation | Integration | Agent escalation workflows |
| `cleanup.test.ts` | Maintenance | Integration | Data cleanup operations |
| `isolation.test.ts` | Security | Integration | Multi-tenant data isolation |
| `test-mode.test.ts` | Testing | Integration | Test mode endpoints verification |
| `dev.test.ts` | Dev Tools | Integration | Developer utility endpoints |

#### Dashboard Features

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `analytics.test.ts` | Analytics | Integration | Analytics endpoints |
| `docs.test.ts` | Docs | Integration | Document workspace |
| `features.test.ts` | Features | Integration | Feature flag management |
| `focus.test.ts` | Focus | Integration | Focus sessions and habits (Phase 25) |
| `images.test.ts` | Media | Integration | Image upload and management |
| `inbox.test.ts` | Inbox | Integration | AI inbox endpoints (Phase 25) |
| `memory.test.ts` | Memory | Integration | Memory API (Phase 26) |
| `media-generation.test.ts` | Media | Integration | AI media generation |
| `proactive.test.ts` | Proactive | Integration | Proactive AI engine |
| `report.test.ts` | Reports | Integration | Report generation |
| `stats.test.ts` | Stats | Integration | Platform statistics |
| `suggestions.test.ts` | Suggestions | Integration | AI suggestion system |
| `videos.test.ts` | Media | Integration | Video generation |
| `voice.test.ts` | Voice | Integration | Voice interface |

#### Phase Feature Tests (`server/src/test/api/phase*.test.ts`)

These files cover incremental feature work across development phases. Each phase test validates specific feature additions or fixes.

| File | Phase | Description |
|------|-------|-------------|
| `phase30.test.ts` | 30 | Markdown chat export, reminder datetime index, snooze count |
| `phase31.test.ts` | 31 | Reminder recurrence, admin export endpoints |
| `phase32.test.ts` | 32 | Feedback analytics, session revoke |
| `phase34.test.ts` | 34 | Sparklines stats, portfolio views |
| `phase35.test.ts` | 35 | Streak counter, portfolio view count, Telegram push config, briefing quality, widget reorder |
| `phase36.test.ts` | 36 | Snooze log, invite Telegram notify |
| `phase37.test.ts` | 37 | Portfolio contact, custom snooze |
| `phase38.test.ts` | 38 | Agent config fix (notification fields) |
| `phase39.test.ts` | 39 | Feature additions for phase 39 |
| `phase40.test.ts` | 40 | Portfolio contact honeypot, activity clear, remind_before column |
| `phase41.test.ts` | 41 | Phase 41 feature additions |
| `phase42.test.ts` | 42 | Phase 42 feature additions |
| `phase43.test.ts` | 43 | Phase 43 feature additions |
| `phase44.test.ts` | 44 | Phase 44 feature additions |
| `phase45.test.ts` | 45 | OG HTML XSS entity-escaping, duplicate DB index removal |
| `phase46.test.ts` | 46 | Phase 46 feature additions |
| `phase47.test.ts` | 47 | Phase 47 feature additions |
| `phase48.test.ts` | 48 | Phase 48 feature additions |
| `phase49.test.ts` | 49 | Phase 49 feature additions |
| `phase50.test.ts` | 50 | Phase 50 feature additions |
| `phase51.test.ts` | 51 | Phase 51 feature additions |
| `phase52.test.ts` | 52 | Phase 52 feature additions |
| `phase53.test.ts` | 53 | Phase 53 feature additions |
| `phase54.test.ts` | 54 | Phase 54 feature additions |
| `phase55.test.ts` | 55 | Phase 55 feature additions |
| `phase56.test.ts` | 56 | Phase 56 feature additions |
| `phase57.test.ts` | 57 | Phase 57 feature additions |
| `phase58.test.ts` | 58 | Phase 58 feature additions |
| `phase59.test.ts` | 59 | Phase 59 feature additions |
| `phase60.test.ts` | 60 | Chat message starring/pinning, reminder iCal export, Seedance per-clip retry |
| `phase61.test.ts` | 61 | Phase 61 feature additions |
| `phase62.test.ts` | 62 | Phase 62 feature additions |
| `phase63.test.ts` | 63 | Phase 63 feature additions |
| `phase64.test.ts` | 64 | Phase 64 feature additions |
| `phase65.test.ts` | 65 | Webhook URL validation in automation create schema |
| `phase66.test.ts` | 66 | Phase 66 feature additions |
| `phase67.test.ts` | 67 | Phase 67 feature additions |
| `phase68.test.ts` | 68 | Phase 68 feature additions |
| `phase69.test.ts` | 69 | Phase 69 feature additions |
| `phase70.test.ts` | 70 | Phase 70 feature additions |
| `phase71.test.ts` | 71 | Phase 71 feature additions |
| `phase72.test.ts` | 72 | Phase 72 feature additions |
| `phase73.test.ts` | 73 | Phase 73 feature additions |
| `phase74.test.ts` | 74 | Phase 74 feature additions |
| `phase75.test.ts` | 75 | Production hardening, E2E scaffolding, lazyRetry utility |
| `phase76.test.ts` | 76 | AI Gateway, smart routing |
| `phase77.test.ts` | 77 | Per-user limits UI, usage dashboard, onboarding polish |
| `phase78.test.ts` | 78 | Telegram/WhatsApp stability, connections polish |
| `phase79.test.ts` | 79 | Structured memory pipeline, reminder consistency |
| `phase80.test.ts` | 80 | Voice pipeline (STT + TTS) |
| `phase81.test.ts` | 81 | Image generation pipeline |
| `phase82.test.ts` | 82 | Store safety + polish |
| `phase83.test.ts` | 83 | Launch hardening (invite beta readiness) |
| `phase103.test.ts` | 103 | Phase 103 feature additions |
| `phase104.test.ts` | 104 | ReAct tool loop |
| `phase105.test.ts` | 105 | Training quality scoring, JSONL export |
| `phase106.test.ts` | 106 | `use_case` field on agent_configs |
| `phase107.test.ts` | 107 | `web_search` + `send_telegram` tools, ReAct loop |
| `phase107-smart-reminders.test.ts` | 107 | Smart reminders |
| `phase108.test.ts` | 108 | Agentin Gate API |
| `phase109.test.ts` | 109 | Conversation quality rating |
| `phase110.test.ts` | 110 | Timezone-aware reminders, memory isolation, image media, voice |

### Server Non-API Tests (`server/src/test/`)

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `personality.test.ts` | Agent | Unit | Personality slider values, buildPersonalityInstructions |
| `phase84.test.ts` | UI | Unit | Mobile UI polish verification |
| `phase85.test.ts` | UI | Unit | Complete mobile + web UI overhaul |
| `phase86.test.ts` | Platform | Unit | Autonomous ecosystem, token efficiency, new tools |
| `phase87.test.ts` | DevOps | Unit | Factory mode autonomous pipeline |
| `phase88.test.ts` | UI | Unit | Final mobile polish |
| `phase89.test.ts` | Billing | Unit | Stripe billing integration |
| `phase90.test.ts` | AI | Unit | Proactive AI engine |
| `phase91.test.ts` | Testing | Unit | Coverage boost |
| `phase92.test.ts` | Security | Unit | Security hardening |
| `phase93.test.ts` | Platform | Unit | Feature audit |
| `phase94.test.ts` | Agent | Unit | Long-term agent memory |
| `phase95.test.ts` | Calendar | Unit | Google Calendar integration |
| `phase96.test.ts` | Agent | Unit | Multi-agent workflows |
| `phase97.test.ts` | Inbox | Unit | AI inbox |
| `phase99.test.ts` | Voice | Unit | Voice interface |
| `phase100.test.ts` | Email | Unit | Gmail integration |
| `phase101.test.ts` | Focus | Unit | Focus mode, smart notifications, habits |
| `phase102.test.ts` | Analytics | Unit | Personal analytics |

### Legacy Tests (`server/src/__tests__/`)

These files are excluded from the main Vitest run (see `vitest.config.ts` exclude pattern):

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `contact-router.test.ts` | Portfolio | Unit | Contact router logic |
| `password-reset.test.ts` | Auth | Unit | Password reset flow |
| `llm-router.test.ts` | AI | Unit | LLM routing logic |

### Front-end Tests (`tests/`)

| File | Domain | Type | Description |
|------|--------|------|-------------|
| `CanvasEffects.test.ts` | Office | Unit | Canvas animation effects |
| `CanvasEffects.detailed.test.ts` | Office | Unit | Detailed canvas effect scenarios |
| `AnimationTierSelector.test.ts` | Office | Unit | Animation performance tier selection |
| `navigation.test.ts` | Office | Unit | Virtual office navigation |
| `navigation-pathfinding.test.ts` | Office | Unit | Pathfinding algorithm |
| `occupancy.test.ts` | Office | Unit | Room occupancy tracking |
| `hooks/use-mobile.test.ts` | UI | Unit | Mobile viewport detection hook |
| `hooks/useFeatureFlag.test.ts` | Features | Unit | Feature flag hook |
| `hooks/useIdleTimeout.test.ts` | UX | Unit | Idle timeout hook |
| `hooks/useFreeTrial.test.ts` | Billing | Unit | Free trial hook |
| `office/CanvasEffects.test.ts` | Office | Unit | Office canvas effects |
| `office/AnimationTierSelector.test.ts` | Office | Unit | Office animation tier |
| `office/Navigation.test.ts` | Office | Unit | Office navigation |
| `office/Occupancy.test.ts` | Office | Unit | Office occupancy |
| `office/CollisionLoader.test.ts` | Office | Unit | Collision detection loading |
| `office/RoomZones.test.ts` | Office | Unit | Room zone definitions |
| `office/animation-tier-selector.test.ts` | Office | Unit | Animation tier selection |
| `office/occupancy.test.ts` | Office | Unit | Occupancy tracking |
| `office/useOfficeData.test.ts` | Office | Unit | Office data hook |
| `office/TaskQueue.test.ts` | Office | Unit | Task queue processing |
| `unit/CanvasEffects.test.ts` | Office | Unit | Canvas effects (unit) |
| `unit/AnimationTierSelector.test.ts` | Office | Unit | Animation tier (unit) |
| `unit/navigation.test.ts` | Office | Unit | Navigation (unit) |
| `unit/occupancy.test.ts` | Office | Unit | Occupancy (unit) |

### E2E Tests (`e2e/`)

| File | Domain | Description |
|------|--------|-------------|
| `auth.setup.ts` | Auth | Global setup: seeds test user, performs UI login, saves storage state |
| `base.ts` | Shared | Extended test fixtures, console capture, login/seed helpers |
| `auth.spec.ts` | Auth | Login, signup, demo login, invalid credentials, protected route redirect |
| `login.spec.ts` | Auth | Demo credentials login flow |
| `logout.spec.ts` | Auth | Sign-out and redirect verification |
| `dashboard.spec.ts` | Navigation | Overview load, section navigation, agent status, credits display |
| `chat.spec.ts` | Agent | Chat panel open via FAB, message sending |
| `chat-receipts.spec.ts` | Agent | Chat receipt display in UI |
| `billing.spec.ts` | Billing | Plans section, current plan, comparison table, usage/credit history, currency switch |
| `reminders.spec.ts` | Reminders | Page load, add dialog, create/complete reminder, priority selector, bulk delete |
| `automations.spec.ts` | Automations | Filter tabs, Active/Paused tabs, recent runs, empty states, tab switching |
| `activity.spec.ts` | Activity | Page load, search input, filter chips, category filtering, search filtering |
| `settings.spec.ts` | Settings | Page load, profile/security/theme/privacy navigation |
| `connections.spec.ts` | Integrations | Connections page, Telegram connect flow, disconnect/reconnect idempotency |
| `connect.spec.ts` | Integrations | Invalid token error state, public route access |
| `portfolio-agent.spec.ts` | Portfolio | Page load, profile/skills/projects tabs, save button |
| `portfolio-stats.spec.ts` | Portfolio | Analytics tab, total views, weekly views, chart container |
| `stream.spec.ts` | Infrastructure | Health endpoint JSON validation, SSE stream graceful handling |
| `health.spec.ts` | Infrastructure | Health check endpoint verification |
| `model-preference.spec.ts` | Settings | Agent settings tabs, tab switching |
| `memory.spec.ts` | Agent | Memory hub functionality |
| `accessibility.spec.ts` | Accessibility | Skip links, compact mode toggle, persistence |

---

## 5. Coverage Analysis

### Vitest Coverage Configuration

Coverage uses the **v8** provider with the following minimum thresholds:

| Metric | Threshold | Notes |
|--------|-----------|-------|
| Lines | 15% | Conservative floor -- raise as coverage grows |
| Functions | 10% | Conservative floor |
| Branches | 60% | Highest coverage area |
| Statements | 15% | Conservative floor |

Reporters: `text` (terminal output) + `html` (browsable report).

### Coverage by Domain Area

| Domain | Estimated Coverage | Notes |
|--------|--------------------|-------|
| Auth (login, signup, tokens) | High | Dedicated test file + hardening tests |
| Reminders (CRUD, recurrence, snooze) | High | Multiple test files across phases |
| Billing (plans, usage, subscriptions) | Medium-High | Dedicated file + phase 89 Stripe tests |
| Agent config / memory | Medium-High | Multiple dedicated files |
| Automations (CRUD, triggers) | Medium | Dedicated file + phase tests |
| Webhooks (Telegram, n8n) | Medium | Mocked external services |
| Portfolio (stats, contact, OG) | Medium | Spread across phase tests |
| Voice / Media generation | Low-Medium | Phase tests with filesystem checks |
| Proactive engine | Low-Medium | Phase 90 test file |
| Calendar / Gmail integrations | Low | Phase tests, external API mocking limited |
| WebSocket / SSE streaming | Low | Mostly tested via E2E |
| Frontend components | Low | Only office/canvas tests + hooks |

### Gaps Identified

- Frontend React component tests are minimal (only virtual office and a few hooks).
- No dedicated load/performance tests.
- External API integrations (Google, Stripe webhooks) have limited mock depth.
- WebSocket/SSE event streaming lacks dedicated unit tests.

---

## 6. Writing New Tests

### Recipe: Adding a New API Test

1. Create a file at `server/src/test/api/<feature>.test.ts`.
2. Follow the established pattern:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

const app = createApp();

describe('Feature Name', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('GET /api/feature', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/feature')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return data for authenticated user', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/feature')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeDefined();

      cleanupTestUser(user.id);
    });
  });
});
```

### Key Patterns

- **Always call `resetDatabase()`** in `beforeAll` and `afterEach` (or `afterAll` for read-only tests).
- **Use `createTestUser()`** which creates a user with `premium` plan and 50,000 credits by default.
- **Use `makeAuthHeader(userId)`** which returns `Bearer <jwt>` using production `signToken()`.
- **Clean up with `cleanupTestUser(userId)`** or rely on `resetDatabase()`.
- **Direct DB access** is available via `import { db } from '../../db/index.js'` for seeding test-specific rows.
- **Use `.js` extensions** in import paths (ESM resolution).

### Testing with Mocks

For tests that hit external services (Telegram, cache, LLM providers), use `vi.mock()` at the top of the file:

```typescript
vi.mock('../../services/cache.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
  cacheDel: vi.fn(async () => {}),
}));
```

---

## 7. E2E Test Strategy

### Authentication Setup

All E2E tests share a single authenticated session created by `e2e/auth.setup.ts`:

1. **Launches Chromium** via Playwright.
2. **Waits for backend** health check (`/api/health`), retrying up to 30 times.
3. **Resets test state** via `POST /api/test/reset`.
4. **Seeds a test user** via `POST /api/test/seed` with premium plan, 50,000 credits, agent active, onboarding completed.
5. **Performs real UI login** using `data-testid` selectors (`login-email`, `login-password`, `login-submit`).
6. **Waits for dashboard** shell element to confirm successful auth.
7. **Dismisses first-use tour** via localStorage.
8. **Saves storage state** to `playwright/.auth/user.json` for reuse by all test projects.

### Test Fixtures

The `e2e/base.ts` file provides extended fixtures:

- **`captureConsoleErrors`** -- Auto-captures browser console errors. Fails locally, logs-only in CI.
- **`resetTestState()`** -- Calls `POST /api/test/reset` for mid-test cleanup.
- **`seedTestUser(options?)`** -- Creates additional test users during tests.
- **`getTestState()`** -- Returns current test mode, state, and DB statistics.
- **`login(page, email, password)`** -- Performs UI login using element visibility (not URL).
- **`loginWithDemo(page)`** -- Logs in via demo button.
- **`ensureAuthed(page)`** -- Checks if already authenticated, logs in if not.
- **`openNavIfMobile(page)`** -- Opens mobile navigation menu if viewport is narrow.
- **`assertAuthenticated(page)`** -- Verifies no redirect to login page.

### CI vs Local Modes

| Aspect | CI (`CI=true`) | Local |
|--------|----------------|-------|
| Backend | `node server/dist/index.js` (pre-built) | `npm run dev` (hot reload) |
| Frontend | `npx vite preview` (pre-built) | `npm run dev` (hot reload) |
| Parallelism | Single worker (deterministic) | Parallel workers (faster) |
| Retries | 2 | 1 |
| Server reuse | `reuseExistingServer: false` | `reuseExistingServer: true` |
| Console errors | Logged only | Fail test (soft assertion) |

### Device Targets

| Project | Device | Notes |
|---------|--------|-------|
| `chromium` | Desktop Chrome | Primary desktop target |
| `pixel5` | Pixel 5 (Android) | Mobile viewport, touch interactions |

Both projects share the same auth storage state. iPhone 13 was removed from CI for speed; it can be run locally or in nightly builds.

### Playwright Configuration Summary

- **Test directory:** `./e2e`
- **Reporters:** HTML, list, JUnit XML
- **Trace:** Retain on failure
- **Screenshots:** Only on failure
- **Video:** Retain on failure
- **Action timeout:** 10 seconds
- **Navigation timeout:** 15 seconds
- **Reduced motion:** Enabled (prevents animation interference)

---

## 8. CI Integration

### Pipeline Overview

The CI/CD pipeline is defined in `.github/workflows/ci.yml` and runs on pushes to `main` and pull requests targeting `main`.

```
Job 1: static-checks
  |-- Lint changed files (ESLint, --max-warnings=0)
  |-- Typecheck root (tsc --noEmit)
  |-- Typecheck server
  |-- Build frontend (vite build)
  |-- Build server
  |-- Audit dependencies (critical level, non-blocking)
  v
Job 2: unit-tests (depends on static-checks)
  |-- Install server dependencies
  |-- Run: npm --prefix server run test (TEST_MODE=true vitest run)
  v
Job 3: deploy-staging (depends on unit-tests, PRs only)
  |-- SSH deploy to staging.agentin.chat
  |-- Health check on :3002
  v
Job 4: deploy-production (depends on unit-tests, push to main only)
  |-- SSH deploy to ai.agentin.chat
  |-- Health check on :3001
  |-- Sync static files to Caddy
  v
Job 5: promote-branches (depends on deploy-production)
  |-- Force-push main to staging and live-production branches
```

### Key CI Details

- **Node version:** 20
- **Concurrency:** `ci-${{ github.ref }}` with `cancel-in-progress: true` (new pushes cancel old runs).
- **Lint scope:** Only changed `*.ts`, `*.tsx`, `*.js`, `*.jsx` files (diff-based).
- **Test timeout:** 10 minutes for the unit-tests job.
- **E2E tests** are not currently run in the CI pipeline (run locally or in nightly builds).

---

## 9. Pre-existing Issues

These issues exist in the test suite and were **not introduced by recent work**. They are documented here for awareness.

### 1 Known Failing Test

One test consistently fails across all runs. This is a pre-existing issue tracked since session 9.

### ~29 Skipped Tests

Approximately 29 tests are skipped using `describe.skipIf()` or `it.skip()`. These are primarily:

- **Environment-dependent tests** (e.g., `phase87.test.ts` uses `describe.skipIf(!existsSync(REPO))` to skip when the factory workspace directory is not present).
- **External service tests** that require live API credentials not available in CI.
- **Feature-gated tests** for functionality still under development.

### Reference

Full status line from `ops/AI_HANDOFF.md`:
> Tests: 2552 pass / 1 fail (pre-existing) / 29 skip | TS: 0 errors | Health: 10/10 OK

---

## 10. Test Data and Mocks

### Test User Factory

The `createTestUser()` function in `server/src/test/setup.ts` creates a fully provisioned test user:

```typescript
const user = createTestUser('custom-email@example.com');
// Returns: { id, email, username, password }
```

What it creates in the database:
- **User record** with `premium` plan and 50,000 credits.
- **Subscription record** with 30-day billing cycle.
- **Agent config record** in `builder` mode, `online` status.

### Auth Header Helper

```typescript
const header = makeAuthHeader(user.id);
// Returns: "Bearer <jwt>" using production signToken()
```

### Database Reset

```typescript
resetDatabase(); // Truncates ALL tables in reverse dependency order
cleanupTestUser(userId); // Removes a single user and all related records
```

Tables cleaned (in order): `planner_blocks`, `document_versions`, `documents`, `doc_folders`, `activity_log`, `security_events`, `usage_events`, `reminders`, `pico_tasks`, `agent_memory`, `conversation_log`, `channel_links`, `link_codes`, `pico_agents`, `agent_configs`, `subscriptions`, `features`, `portfolios`, `integrations`, `api_keys`, `gate_api_keys`, `automations`, `dev_audit_log`, `snooze_log`, `portfolio_contacts`, `webhook_dead_letters`, `suggestion_events`, `suggestion_votes`, `suggestion_rewards`, `suggestion_scores`, `suggestion_clusters`, `suggestions`, `uploaded_files`, `training_examples`, `refresh_tokens`, `token_blocklist`, `user_sessions`, `users`.

### Shared Fixtures

There are no dedicated fixture files. Test data is created inline using:
- `createTestUser()` for user records.
- `createTestAgent(userId, isActive)` for agent config records.
- Direct SQL via `db.prepare(...)` for domain-specific data (reminders, conversation logs, etc.).

### E2E Test Data

E2E tests use API endpoints for data setup:
- `POST /api/test/seed` -- Creates users with configurable plan, credits, agent state.
- `POST /api/test/reset` -- Full cleanup between test runs.
- `GET /api/test/state` -- Inspect current test DB state.

---

## 11. Recommended Future Tests

### High Priority

| Area | What to Test | Why |
|------|--------------|-----|
| Frontend React components | Page rendering, form interactions, state management | Currently only office/canvas and a few hooks have tests |
| Stripe webhook handlers | Payment success, failure, subscription changes | Critical payment path, currently phase-level tests only |
| WebSocket / SSE events | Connection lifecycle, reconnection, event delivery | No dedicated unit tests |
| Rate limiting | Endpoint throttling behavior, bypass for premium users | Security-critical, untested |
| Multi-tenant isolation | Cross-user data leakage prevention | `isolation.test.ts` exists but coverage depth is unclear |

### Medium Priority

| Area | What to Test | Why |
|------|--------------|-----|
| Email delivery (Gmail integration) | Send, receive, thread parsing | Phase 100 has basic tests, deeper mocking needed |
| File upload / media pipeline | Upload validation, transformation, storage | Spread across phase tests |
| Reminder scheduling engine | Cron-like execution, timezone handling, recurrence | Critical user-facing feature |
| Agent memory vector search | Semantic search accuracy, memory pruning | Phase 94 has basic tests |
| Error boundary behavior | Frontend error recovery, fallback UI | No tests |

### Low Priority

| Area | What to Test | Why |
|------|--------------|-----|
| Load / performance testing | API response times under load | No framework in place yet |
| Accessibility (aXe scans) | WCAG compliance across all pages | E2E has skip-link tests only |
| Dark mode / theme consistency | Visual regression across themes | No visual testing framework |
| Offline / PWA behavior | Service worker caching, offline UI | Not currently tested |

---

## 12. Related Documents

| Document | Path | Description |
|----------|------|-------------|
| AI Handoff | `ops/AI_HANDOFF.md` | Session logs with test status, known issues |
| API Reference | `docs/API_REFERENCE.md` | Endpoint documentation for all tested routes |
| Solution Architecture | `docs/SOLUTION_ARCHITECTURE.md` | System design context for test strategy |
| DevOps Guide | `docs/DEVOPS.md` | CI/CD pipeline details |
| Deployment Guide | `docs/DEPLOYMENT.md` | Production deployment procedures |
| Environment Variables | `docs/ENV_VARS.md` | Required env vars including `TEST_MODE` |
| Troubleshooting | `docs/TROUBLESHOOTING.md` | Common issues and debugging tips |
| DevOps | `docs/DEVOPS.md` | CI/CD, operations, monitoring |
