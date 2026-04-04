# Backend Skill — Express 4.21 + TypeScript + SQLite

## Stack
- **Express 4.21** with TypeScript
- **SQLite** with better-sqlite3 (SYNCHRONOUS operations only)
- **Redis** for caching and sessions
- **Modular architecture** — 18 domain modules
- **JWT auth** with Passport.js (Google + GitHub OAuth)
- **Stripe + Razorpay** for payments

## Module Map (18 modules)
```
server/src/modules/
├── admin/              # Admin dashboard, system metrics
├── agent/              # LLM router, ReAct loops, goals, delegation  
├── auth/               # JWT, OAuth, sessions, password reset
├── automation/         # Cron jobs, triggers, webhooks
├── billing/            # Stripe, Razorpay, credits system
├── comms/              # Email, SMS, Telegram notifications
├── content/            # Blog, docs, markdown processing
├── dashboard/          # Dashboard API endpoints
├── focus/              # Focus mode, pomodoro, time tracking
├── geekos/             # GeekOS virtual assistant features
├── health/             # Health checks, monitoring, metrics
├── integrations/       # Third-party APIs (Google, GitHub, etc.)
├── media/              # File uploads, image processing
├── memory/             # Long-term memory, embeddings, RAG
├── office/             # Document processing, templates
├── portfolio/          # Portfolio management, projects
├── reminders/          # Notifications, scheduling
└── users/              # User CRUD, profiles, preferences
```

## Core Files
- `server/src/app.ts` — Express app composition root
- `server/src/db/index.ts` — SQLite schema + migrations
- `server/src/config.ts` — Environment variables
- `server/src/modules/*/routes.ts` — Express routes per module
- `server/src/modules/*/services/*.ts` — Business logic
- `server/src/modules/*/types.ts` — Module-specific types

## API Endpoint Pattern
```typescript
// GET /api/v1/module/resource
router.get('/resource', authenticateToken, async (req, res) => {
  const userId = req.userId!; // Always req.userId!, never req.user.id
  
  // Verify ownership for user-scoped resources
  if (resource.user_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  res.json(resource);
});
```

## Development Commands
```bash
cd server
npm run dev                  # tsx watch with hot reload
npm run typecheck           # TypeScript check (MUST pass)  
npm run build              # Compile to dist/
npm run test               # Vitest tests with TEST_MODE=true
npm run migrate            # Run database migrations
```

## Critical Rules
- **ES module imports** — MUST have `.js` extensions
- **SQLite is SYNCHRONOUS** — never use async/await on DB calls
- **Always `req.userId!`** — never `req.user.id`
- **Goal ownership** — verify `goal.user_id === userId` before mutations  
- **Notifications** — route through `sendAgentNotification()`
- **TEST_MODE** — mocks all external APIs during testing

## Database Operations
```typescript
import db from '../../../db/index.js';  // Note .js extension

// GOOD: Synchronous SQLite operations
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
const goals = db.prepare('SELECT * FROM goals WHERE user_id = ?').all(userId);

// BAD: Never use async/await
const user = await db.prepare(...).get(userId);  // ❌ Wrong
```

## Module Structure
```
modules/example/
├── routes.ts           # Express router definition
├── services/           # Business logic
│   ├── example-service.ts
│   └── validation.ts
├── types.ts           # Module-specific TypeScript types
└── README.md          # Module documentation
```