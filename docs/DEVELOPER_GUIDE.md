# Agentin Developer Guide

> From zero to first PR -- everything you need to build, test, and ship features on the Agentin platform.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repository Structure](#2-repository-structure)
3. [Local Development Setup](#3-local-development-setup)
4. [Build System](#4-build-system)
5. [Adding a New API Endpoint](#5-adding-a-new-api-endpoint)
6. [Adding a New Service](#6-adding-a-new-service)
7. [Adding a New Frontend Page](#7-adding-a-new-frontend-page)
8. [Database Schema Management](#8-database-schema-management)
9. [Testing](#9-testing)
10. [Debugging](#10-debugging)
11. [Code Conventions](#11-code-conventions)
12. [Common Patterns](#12-common-patterns)
13. [High-Risk Areas](#13-high-risk-areas)
14. [Related Documents](#14-related-documents)

---

## 1. Prerequisites

| Tool | Version | Required | Notes |
|------|---------|----------|-------|
| **Node.js** | 20 LTS+ | Yes | `node -v` to verify |
| **npm** | 10+ | Yes | Ships with Node 20 |
| **Docker & Docker Compose** | Latest | For staging/prod | Local dev works without Docker |
| **Ollama** | Latest | Optional | Local LLM engine; falls back to OpenRouter/Groq cloud APIs |
| **Redis** | 7+ | Optional | Job queue; server starts without it |
| **Git** | 2.40+ | Yes | Standard version control |

If you only plan to run the frontend, you need Node and npm. Backend work also requires a working SQLite setup (included via `better-sqlite3`, no separate install needed).

---

## 2. Repository Structure

```
GeekSpace2.0/
├── src/                        # Frontend (React + Vite + TailwindCSS)
│   ├── App.tsx                 # Root router — BrowserRouter with all top-level routes
│   ├── main.tsx                # Entry point
│   ├── dashboard/              # Authenticated dashboard shell
│   │   ├── DashboardApp.tsx    # Dashboard layout, sidebar, lazy-loaded pages
│   │   └── pages/              # ~40 dashboard page components (one per feature)
│   ├── landing/                # Public marketing / landing pages
│   ├── onboarding/             # Post-signup onboarding flow
│   ├── portfolio/              # Public portfolio viewer
│   ├── explore/                # Public explore / directory page
│   ├── components/             # Shared UI components (Radix + shadcn/ui)
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API client (axios-based)
│   ├── stores/                 # Zustand state stores
│   ├── i18n/                   # Internationalization (Hindi + English)
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Frontend utilities
│   ├── styles/                 # Global CSS
│   ├── logo-studio/            # Logo generator tool
│   └── image-tools/            # Image manipulation tools
│
├── server/                     # Backend (Express + TypeScript + SQLite)
│   ├── src/
│   │   ├── app.ts              # Express app factory (createApp)
│   │   ├── index.ts            # Server entry — starts HTTP listener
│   │   ├── config.ts           # Validated env config — crashes on missing required vars
│   │   ├── logger.ts           # Pino structured logger + request ID middleware
│   │   ├── routes/             # ~65 route files (one per domain)
│   │   ├── services/           # ~100 service modules (business logic)
│   │   ├── middleware/         # auth.ts, validate.ts, errors.ts, metrics.ts
│   │   ├── db/                 # SQLite schema (index.ts) + migrations/
│   │   ├── repositories/       # Data access layer (UserRepository, etc.)
│   │   ├── errors/             # AgentinError hierarchy
│   │   ├── prompts/            # LLM system prompts and templates
│   │   ├── skills/             # Agent skill definitions
│   │   ├── utils/              # Server utilities
│   │   ├── test/               # Test files + setup.ts
│   │   └── __tests__/          # Additional test files
│   ├── ecosystem.config.cjs    # PM2 production config
│   └── package.json            # Server deps + scripts
│
├── e2e/                        # Playwright end-to-end tests
├── ops/                        # DevOps scripts (brand_guard, deploy helpers)
├── docs/                       # Project documentation
├── infra/                      # Infrastructure configs
├── caddy/                      # Caddy reverse proxy config
├── scripts/                    # Build and utility scripts
├── agents/                     # Agent configuration files
├── picoclaw/                   # PicoClaw automation engine
├── bridge/                     # Pico-Kimi orchestration bridge
├── geekos/                     # GeekOS integration layer
├── browser-agent/              # Browser automation agent
├── searxng/                    # SearXNG search engine config
├── public/                     # Static assets (served by Vite)
├── dist/                       # Frontend build output
│
├── vite.config.ts              # Vite build config + dev proxy
├── eslint.config.js            # ESLint flat config
├── tailwind.config.js          # Tailwind CSS config
├── playwright.config.ts        # Playwright E2E config
├── tsconfig.json               # Root TypeScript config
├── docker-compose.yml          # Production Docker stack
├── docker-compose.staging.yml  # Staging Docker stack
├── Dockerfile                  # Multi-stage Docker build
└── package.json                # Root deps + scripts
```

---

## 3. Local Development Setup

### Step 1: Clone the repository

```bash
git clone <repo-url> GeekSpace2.0
cd GeekSpace2.0
```

### Step 2: Install frontend dependencies

```bash
npm install
```

### Step 3: Install server dependencies

```bash
cd server
npm install
cd ..
```

### Step 4: Configure environment variables

Create the server `.env` file from the config defaults. The server uses `dotenv` and `config.ts` provides sensible development defaults for most values, so a minimal `.env` is sufficient for local work:

```bash
cat > server/.env << 'EOF'
NODE_ENV=development
PORT=3001
JWT_SECRET=local-dev-secret-change-me
DB_PATH=./data/geekspace.db
CORS_ORIGINS=http://localhost:5173,http://localhost:4173
LOG_LEVEL=debug
SEED_DEMO_DATA=true
EOF
```

For full feature coverage (LLM, Telegram, Stripe, etc.), add the relevant API keys. See `server/src/config.ts` for every supported environment variable and its default.

### Step 5: Start the frontend dev server

```bash
npm run dev
```

The frontend starts at **http://localhost:5173**. Vite proxies all `/api/*` requests to the backend (see `vite.config.ts`).

### Step 6: Start the backend dev server

In a separate terminal:

```bash
cd server
npm run dev
```

The backend starts at **http://localhost:3001** using `tsx watch` (auto-reloads on file changes).

### Step 7: Verify the health endpoint

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","version":"3.1.0", ...}
```

Once both servers are running, open http://localhost:5173 in your browser. You should see the landing page and be able to sign up for a local account.

---

## 4. Build System

### Frontend (Vite)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 with HMR |
| `npm run build` | TypeScript check (`tsc -b`) then Vite production build to `dist/` |
| `npm run preview` | Serve the `dist/` build locally for pre-deploy verification |
| `npm run typecheck` | TypeScript check only (no emit) |
| `npm run lint` | ESLint across all `.ts`/`.tsx` files |

**Vite config highlights** (`vite.config.ts`):

- Path alias: `@/` maps to `./src/`
- Dev proxy: `/api` requests forwarded to `http://localhost:3001` (configurable via `VITE_API_TARGET`)
- Code splitting: manual chunks for `recharts`, `@radix-ui`, and `framer-motion` to optimize bundle size

### Backend (tsc + tsx)

| Command | Description |
|---------|-------------|
| `cd server && npm run dev` | Start with `tsx watch` (auto-reload on changes) |
| `cd server && npm run build` | Compile TypeScript to `server/dist/` |
| `cd server && npm start` | Run compiled JS from `server/dist/index.js` |
| `cd server && npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `cd server && npm run migrate` | Run database migrations (`tsx src/db/migrate.ts`) |

### Production (PM2)

In production, the server runs under PM2 with the config in `server/ecosystem.config.cjs`:

- **1 fork-mode worker** with 450MB memory restart limit
- **5s graceful shutdown** timeout for in-flight requests
- Schedulers (Telegram, cron jobs) guarded by `NODE_APP_INSTANCE` to run in worker 0 only

```bash
# Production start
pm2 start server/ecosystem.config.cjs
pm2 logs geekspace
pm2 restart geekspace
```

---

## 5. Adding a New API Endpoint

This recipe walks through adding a `GET /api/bookmarks` endpoint.

### Step 1: Define the Zod schema

Add validation schemas to `server/src/middleware/validate.ts` (or a new file if the domain is large):

```ts
// server/src/middleware/validate.ts

export const bookmarkCreateSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().min(1).max(200),
  tags: z.array(z.string().max(50)).max(10).optional(),
});
```

### Step 2: Create the route file

```ts
// server/src/routes/bookmarks.ts

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { bookmarkCreateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';

export const bookmarksRouter = Router();

// GET /api/bookmarks — list user's bookmarks
bookmarksRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare(
    'SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId);
  res.json({ bookmarks: rows });
});

// POST /api/bookmarks — create a bookmark
bookmarksRouter.post('/', requireAuth, validateBody(bookmarkCreateSchema), (req: AuthRequest, res) => {
  // ... insert logic
  res.status(201).json({ bookmark: { id: '...' } });
});
```

### Step 3: Wire the route into `app.ts`

```ts
// server/src/app.ts — add import at top
import { bookmarksRouter } from './routes/bookmarks.js';

// Inside createApp(), add with other route mounts:
app.use('/api/bookmarks', bookmarksRouter);
```

### Step 4: Add a test

```ts
// server/src/test/routes/bookmarks.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';

const app = createApp();

describe('GET /api/bookmarks', () => {
  let token: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser();
    token = generateTestToken(user.id);
  });

  it('returns 401 without auth', async () => {
    const res = await supertest(app).get('/api/bookmarks');
    expect(res.status).toBe(401);
  });

  it('returns empty list for new user', async () => {
    const res = await supertest(app)
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.bookmarks).toEqual([]);
  });
});
```

---

## 6. Adding a New Service

Services contain business logic and live in `server/src/services/`. They are plain TypeScript modules -- no class instantiation or DI framework.

### Recipe

```ts
// server/src/services/bookmark-service.ts

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';
import { NotFoundError } from '../errors/index.js';

/** Bookmark record as stored in SQLite. */
export interface Bookmark {
  id: string;
  user_id: string;
  url: string;
  title: string;
  tags: string; // JSON array stored as TEXT
  created_at: string;
}

/**
 * Create a new bookmark for a user.
 * @param userId - The authenticated user's ID
 * @param url - The URL to bookmark
 * @param title - Human-readable title
 * @param tags - Optional tag list
 * @returns The created bookmark record
 */
export function createBookmark(
  userId: string,
  url: string,
  title: string,
  tags: string[] = [],
): Bookmark {
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO bookmarks (id, user_id, url, title, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, url, title, JSON.stringify(tags), now);

  logger.info({ userId, bookmarkId: id }, 'Bookmark created');

  return { id, user_id: userId, url, title, tags: JSON.stringify(tags), created_at: now };
}

/**
 * Delete a bookmark. Throws NotFoundError if it does not exist
 * or does not belong to the user.
 */
export function deleteBookmark(userId: string, bookmarkId: string): void {
  const result = db.prepare(
    'DELETE FROM bookmarks WHERE id = ? AND user_id = ?'
  ).run(bookmarkId, userId);

  if (result.changes === 0) {
    throw new NotFoundError('Bookmark not found');
  }
}
```

**Key conventions:**

- Use `db.prepare()` with parameterized queries (never string interpolation)
- Add TSDoc comments on every exported function
- Use the `AgentinError` hierarchy for domain errors (see [Common Patterns](#12-common-patterns))
- Log meaningful events with structured context via `logger`
- For complex domains, consider a Repository class in `server/src/repositories/`

Existing repositories to reference:

| Repository | Purpose |
|-----------|---------|
| `UserRepository.ts` | User CRUD and profile queries |
| `AgentConfigRepository.ts` | Agent configuration management |
| `ArtifactRepository.ts` | Code artifact storage |
| `ConversationRepository.ts` | Chat history persistence |
| `SubscriptionRepository.ts` | Billing and plan management |

---

## 7. Adding a New Frontend Page

### Step 1: Create the page component

```tsx
// src/dashboard/pages/BookmarksPage.tsx

import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState([]);
  const { token } = useAuthStore();

  useEffect(() => {
    fetch('/api/bookmarks', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setBookmarks(data.bookmarks));
  }, [token]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Bookmark className="w-6 h-6" />
        Bookmarks
      </h1>
      {/* ... page content */}
    </div>
  );
}
```

### Step 2: Add the lazy import in `DashboardApp.tsx`

```tsx
// src/dashboard/DashboardApp.tsx — add with other lazy imports

const BookmarksPage = lazyRetry(() =>
  import('./pages/BookmarksPage').then(m => ({ default: m.BookmarksPage }))
);
```

### Step 3: Add the route case in the page renderer

In `DashboardApp.tsx`, find the page rendering switch/map and add:

```tsx
case 'bookmarks':
  return <BookmarksPage />;
```

### Step 4: Add the sidebar menu item

In the `menuGroups` array in `DashboardApp.tsx`, add an entry:

```tsx
{ id: 'bookmarks', label: 'Bookmarks', icon: Bookmark }
```

**Naming conventions:**
- File: `BookmarksPage.tsx` (PascalCase, matches the component name)
- Export: `export function BookmarksPage()` (named export, not default)
- PageType: add `'bookmarks'` to the `PageType` union type

---

## 8. Database Schema Management

### Inline schema (`server/src/db/index.ts`)

The primary schema is defined using `CREATE TABLE IF NOT EXISTS` statements that run on every server startup. This file is **2295 lines** and defines all tables inline.

```ts
// server/src/db/index.ts (simplified)

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');
db.pragma('foreign_keys = ON');

// Schema — runs on every startup
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    ...
  )
`);
```

### Migrations (`server/src/db/migrations/`)

For schema changes that cannot be expressed as `IF NOT EXISTS`, use SQL migration files:

| File | Purpose |
|------|---------|
| `000_init.sql` | Initial schema baseline |
| `001_contact_requests.sql` | Contact requests table |
| `002_password_reset.sql` | Password reset tokens |
| `sandbox-tables.ts` | Sandbox environment tables (TypeScript) |

**Running migrations:**

```bash
cd server && npm run migrate
# Internally runs: tsx src/db/migrate.ts
```

**Adding a new migration:**

1. Create `server/src/db/migrations/003_your_change.sql`
2. Write idempotent SQL (use `IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN` with error handling)
3. Run `cd server && npm run migrate`

**Important:** Since the schema uses `CREATE TABLE IF NOT EXISTS`, adding a new table is often done by adding it directly to `server/src/db/index.ts`. Migrations are for altering existing tables or data transformations.

---

## 9. Testing

### Unit / Integration Tests (Vitest)

The server uses **Vitest** with **Supertest** for HTTP-level integration tests.

```bash
# Run all server tests
cd server && npx vitest run

# Watch mode (re-runs on file change)
cd server && npx vitest

# With coverage report
cd server && npx vitest run --coverage
```

**Test location:** Tests live in two directories:

| Directory | Content |
|-----------|---------|
| `server/src/test/` | Phase-based tests (`phase84.test.ts` ... `phase102.test.ts`), route tests, service tests |
| `server/src/__tests__/` | Focused tests (`contact-router.test.ts`, `llm-router.test.ts`, `password-reset.test.ts`) |

**Test setup file** (`server/src/test/setup.ts`):

- Sets `TEST_MODE=true` before any imports
- Creates a temporary SQLite database per process (`/tmp/geekspace-test-<pid>.db`)
- Exports helpers: `resetDatabase()`, `createTestUser()`, `generateTestToken()`, `makeAuthHeader()`
- Suppresses logs unless `DEBUG_TESTS` is set

**Example test:**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';

const app = createApp();

describe('POST /api/reminders', () => {
  let token: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser();
    token = generateTestToken(user.id);
  });

  it('creates a reminder', async () => {
    const res = await supertest(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Buy groceries', category: 'personal' });
    expect(res.status).toBe(201);
  });
});
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# View HTML report
npx playwright show-report playwright-report
```

**Playwright config** (`playwright.config.ts`):

- Test directory: `e2e/`
- Global setup: `e2e/auth.setup.ts` (authenticates once, shares `storageState`)
- Projects: Desktop Chrome + Pixel 5 mobile
- Auto-starts both frontend and backend dev servers in local mode
- Traces, screenshots, and video captured on failure

---

## 10. Debugging

### Pino Log Levels

The server uses **Pino** for structured JSON logging. Set the level via `LOG_LEVEL` env var:

| Level | When to use | Default in |
|-------|-------------|------------|
| `trace` | Granular internal state | Never (set manually) |
| `debug` | Request details, DB queries, routing decisions | Development |
| `info` | Request lifecycle, startup, feature toggles | Production |
| `warn` | 4xx errors, slow requests (>500ms) | Always |
| `error` | 5xx errors, unhandled exceptions | Always |

```bash
# Override log level for a session
LOG_LEVEL=trace cd server && npm run dev

# Pretty-print logs in development (automatic via pino-pretty)
# JSON logs in production (no transport configured)
```

### Request ID Correlation (X-Request-Id)

Every request gets a unique ID, either from the incoming `X-Request-Id` header or auto-generated:

```
→ Request:  X-Request-Id: abc-123
← Response: X-Request-Id: abc-123
← Log:      { requestId: "abc-123", method: "POST", url: "/api/agent/chat", status: 200, durationMs: 342 }
```

Use this to trace a single request across all log lines. The error handler includes `requestId` in every error response:

```json
{
  "error": "Internal server error",
  "requestId": "abc-123",
  "hint": "If this persists, contact support with the requestId above."
}
```

### Routing Traces (debug-routing)

For debugging LLM message routing decisions, enable the debug routing endpoint:

```bash
# The routing debug endpoint is at /api/debug/routing
# It exposes getRoutingTraces() from the LLM service

curl -H "Authorization: Bearer <token>" \
     http://localhost:3001/api/debug/routing
```

The `getRoutingTraces()` function in `server/src/services/llm.ts` records which model was selected, why, and fallback decisions.

### TEST_MODE Environment Variable

Setting `TEST_MODE=true` or `TEST_MODE=1` activates test mode:

- Skips external API calls (LLM, Telegram, email)
- Returns mock/stub responses from services
- Uses an isolated temporary database
- Disables rate limiting and background workers

```bash
# Run server in test mode
TEST_MODE=true cd server && npm run dev

# Tests set this automatically via setup.ts
```

### Debug Tests

To see log output during test runs:

```bash
DEBUG_TESTS=true cd server && npx vitest run
```

---

## 11. Code Conventions

### ESLint Configuration

The project uses **ESLint flat config** (`eslint.config.js`) with:

- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` (flat recommended)
- `eslint-plugin-react-refresh` (Vite mode)

**Key rules:**

| Rule | Setting | Reason |
|------|---------|--------|
| `@typescript-eslint/no-unused-expressions` | `error` (allow short-circuit + ternary) | Prevents dead code |
| `@typescript-eslint/no-explicit-any` | `off` | Pragmatic -- tightening incrementally |
| `@typescript-eslint/no-unused-vars` | `off` | Pre-existing codebase issues |
| `react-hooks/purity` | `off` | Disabled for CI parity |

**Ignored directories:** `dist`, `.worktrees`, `server/dist`, `server/coverage`

```bash
# Run linter
npm run lint
```

### File Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Route files | `kebab-case.ts` | `agent-state.ts`, `social-media.ts` |
| Service files | `kebab-case.ts` | `credit-service.ts`, `message-router.ts` |
| React components | `PascalCase.tsx` | `BookmarksPage.tsx`, `AgentChatPanel.tsx` |
| Test files | `*.test.ts` | `phase84.test.ts`, `contact-router.test.ts` |
| Config files | `kebab-case` | `vite.config.ts`, `eslint.config.js` |

### Code Style

| Element | Convention |
|---------|-----------|
| Functions | `camelCase` -- `createBookmark()`, `getBalance()` |
| Components | `PascalCase` -- `BookmarksPage`, `AgentChatButton` |
| Types/Interfaces | `PascalCase` -- `CreditBalance`, `AuthRequest` |
| Constants | `UPPER_SNAKE_CASE` -- `APP_VERSION`, `DB_PATH` |
| CSS classes | Tailwind utility classes, no BEM |
| Imports | Named exports preferred over default exports |

---

## 12. Common Patterns

### `requireAuth` Middleware

Protects routes by verifying the JWT `Bearer` token. Adds `req.userId` to the request:

```ts
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  // req.userId is guaranteed to be set
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});
```

Other auth variants:

| Middleware | Purpose |
|-----------|---------|
| `requireAuth` | Rejects 401 if no valid JWT |
| `optionalAuth` | Sets `req.userId` if token present, continues otherwise |
| `requireAdmin` | Checks `X-Admin-Password` header against `ADMIN_TOKEN` |
| `requireAdminToken` | Checks `Authorization: Bearer <ADMIN_TOKEN>` |

### `validateBody` / `validateQuery` with Zod

Validates and sanitizes request input. Returns structured 400 errors on failure:

```ts
import { validateBody, validateQuery } from '../middleware/validate.js';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/', requireAuth, validateQuery(querySchema), (req, res) => {
  // req.query is now typed and validated
});

router.post('/', requireAuth, validateBody(bookmarkCreateSchema), (req, res) => {
  // req.body is parsed and safe
});
```

**Validation error response format:**

```json
{
  "error": "Validation failed",
  "details": [
    { "path": "email", "message": "Invalid email" },
    { "path": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

### AgentinError Hierarchy

Throw typed errors from services; the global error handler maps them to HTTP responses:

```ts
import { NotFoundError, QuotaExceededError, ValidationError } from '../errors/index.js';

// In a service:
throw new NotFoundError('Bookmark not found');       // → 404
throw new QuotaExceededError('Daily limit reached'); // → 429
throw new ValidationError('Invalid URL format');     // → 400
```

| Error Class | HTTP Status | Code |
|-------------|-------------|------|
| `AgentinError` | (base class) | Custom |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `QuotaExceededError` | 429 | `QUOTA_EXCEEDED` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `PaymentRequiredError` | 402 | `PAYMENT_REQUIRED` |

### Credit Deduction Pattern

When an endpoint consumes credits (LLM calls, image generation, etc.), use the credit service:

```ts
import { getBalance } from '../services/credit-service.js';

// 1. Check balance before expensive operation
const balance = getBalance(req.userId);
if (balance.creditsRemaining < estimatedCost) {
  throw new QuotaExceededError('Insufficient credits');
}

// 2. Perform the operation
const result = await callLLM(prompt);

// 3. Deduct credits
db.prepare('UPDATE subscriptions SET credits_remaining = credits_remaining - ? WHERE user_id = ?')
  .run(actualCost, req.userId);

// 4. Log usage event
db.prepare('INSERT INTO usage_events (id, user_id, event_type, credits, ...) VALUES (...)').run(...);
```

---

## 13. High-Risk Areas

These files are the largest and most critical in the codebase. Changes here require extra review and thorough testing.

| File | Lines | Risk | Notes |
|------|-------|------|-------|
| `server/src/db/index.ts` | **2295** | Schema changes affect everything | All tables defined inline. Adding/removing columns requires careful migration planning. |
| `server/src/services/message-router.ts` | **2050** | Core chat routing logic | Routes messages to correct LLM provider, handles fallbacks, context injection. A bug here breaks all AI chat. |
| `server/src/services/llm.ts` | **1351** | Multi-provider LLM abstraction | Manages Ollama, OpenRouter, Groq, Gemini, Moonshot, Together AI. Provider-specific quirks and retry logic live here. |

**Guidelines for high-risk changes:**

1. Always read the entire file before making changes
2. Write tests that cover the specific code path you are modifying
3. Test with `TEST_MODE=true` first, then verify with a real LLM provider
4. Get a second pair of eyes on the PR -- these files have the highest blast radius

---

## 14. Related Documents

| Document | Path | Description |
|----------|------|-------------|
| Solution Architecture | [`docs/SOLUTION_ARCHITECTURE.md`](./SOLUTION_ARCHITECTURE.md) | System design, component interactions, data flow diagrams |
| API Reference | [`docs/API.md`](./API.md) | REST API endpoints, request/response schemas |
| DevOps & Infrastructure | [`docs/DEVOPS.md`](./DEVOPS.md) | Docker, Caddy, CI/CD, deployment procedures |
| Environment Variables | [`docs/ENV_VARS.md`](./ENV_VARS.md) | Complete list of all env vars with descriptions |
| Troubleshooting | [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | Common issues and fixes |
| Runbook | [`docs/RUNBOOK.md`](./RUNBOOK.md) | Operational procedures for incidents |
| Architecture Decisions | [`docs/adr/`](./adr/) | Architecture Decision Records |
| Documentation Map | [`docs/DOC_MAP.md`](./DOC_MAP.md) | Index of all project documentation |
