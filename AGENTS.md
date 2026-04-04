# GeekSpace 2.0 — Agent Instructions

## Project overview
Modular monolith. 18 domain modules in `server/src/modules/`. React 19 frontend in `src/`.
Full architecture in `CLAUDE.md` — read it before touching any module.

## Multi-agent environment — READ THIS FIRST
This repo runs a hybrid master + specialist agent system.
- Master agent: plans, dispatches tasks, detects conflicts
- Specialist agents: each owns one domain, scoped to specific files
- Coordination files: `.pi/TASKS.md` (tasks), `.pi/STATUS.md` (progress), `.pi/HANDOFF.md` (ready-to-merge)

**If you are a specialist agent:**
1. Read your task description carefully — it tells you exactly what to do
2. ONLY touch files listed in your task's "Files in scope"
3. Never touch files another agent owns
4. After every code change: run the typecheck command for your domain
5. Report what you changed and any issues

**If you are the master agent:**
1. Read `.pi/TASKS.md` and `.pi/STATUS.md` before doing anything
2. Detect file conflicts before dispatching (two agents same file = blocked)
3. Your job is planning and coordination — not writing code yourself

## Hard rules (every agent, no exceptions)
- ES module imports MUST have `.js` extensions on the server
- SQLite (better-sqlite3) is SYNCHRONOUS — never async/await on DB calls
- Always `req.userId!` not `req.user.id`
- Goal ownership: always verify `goal.user_id === userId` before mutations
- Notifications: always route through `sendAgentNotification()`
- Frontend: unused imports break Docker builds (TS6133 is fatal) — always clean them
- Frontend: use CSS variables from agentin-tokens.css, never hardcode colors
- Frontend: min 44px touch targets on mobile

## After code changes
```bash
# Frontend
npx tsc -b --noEmit   # must pass — zero errors including TS6133
npx vite build         # must succeed

# Backend
cd server && npx tsc --noEmit   # must pass
cd server && npm test            # run relevant tests
```

## Key files
- `server/src/app.ts` — composition root
- `server/src/db/index.ts` — SQLite schema
- `server/src/config.ts` — all env vars
- `server/src/modules/agent/services/llm.ts` — 7-tier LLM router
- `server/src/modules/agent/services/react-loop.ts` — standard ReAct
- `server/src/modules/agent/services/deep-reasoning.ts` — deep ReAct
- `server/src/modules/agent/services/goal-service.ts` — goal system
- `server/src/modules/agent/services/delegation-pipeline.ts` — delegation
- `src/dashboard/DashboardApp.tsx` — dashboard shell (571 lines)
- `src/dashboard/DashboardRouter.tsx` — page routing switch
- `src/dashboard/DashboardSidebar.tsx` — sidebar navigation
- `src/dashboard/MobileTabBar.tsx` — mobile bottom tabs
- `src/dashboard/types.ts` — shared dashboard types
