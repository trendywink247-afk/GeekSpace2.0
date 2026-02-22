# Master Audit, Branch Cleanup & Onboarding Overhaul — Design

**Date:** 2026-02-17
**Status:** Approved

---

## 1. Branch Strategy

**Current state:** `live-production` is source of truth (30+ commits ahead of `main`). 12+ stale branches exist locally and remotely.

**Target state:** `main` and `live-production` identical. All other branches deleted.

**Actions:**
- Merge `live-production` into `main`
- Delete local: `development-roadmap`, `fix/portfolio-chat-info-leak`, `release/integrity-merge-20260216`, `release/v3.0.0`
- Delete remote: `claude/ai-os-api-integration-yFb9T`, `claude/docker-edith-ollama-setup-Yt3Z1`, `claude/pico-kimi-integration-XdtIj`, `claude/whatsapp-ai-integration-vA0ey`, `development-roadmap`, `fix/portfolio-chat-info-leak`, `release/v3.0.0`, `update/2026-02-15-three-agent-architecture`
- Verify `git log main --oneline -5` and `git log live-production --oneline -5` are identical

## 2. Full Code Audit

Seven audit areas, each producing findings with file:line, severity, and fix.

### 2A — Routing & Navigation
- Map every route: path, component, auth required, redirects
- Find dead/duplicate/unprotected routes
- Audit every `navigate()` call for push vs replace
- Post-login redirects MUST use `replace: true`
- Auth guards on all protected routes must redirect to dashboard, not homepage

### 2B — Authentication & Session
- Trace: signup → login → token storage → token refresh → logout
- Check token storage (localStorage vs httpOnly cookie)
- Check every API endpoint for auth middleware
- Check token expiry and refresh logic

### 2C — Database & Data Integrity
- Read all migrations, schemas, models
- Check foreign keys, indexes, cascading deletes
- Verify onboarding fields write to existing columns

### 2D — API Wiring
- Trace every frontend action → API call → handler → DB query
- Find broken calls, wrong URLs, missing error handling
- Check CORS configuration

### 2E — Environment & Docker
- Cross-reference .env vars with docker-compose and config.ts
- Check Docker networking and health checks
- Check volume permissions

### 2F — Error Handling & Edge Cases
- Find empty catch blocks, unhandled rejections
- Check loading/error states in UI
- Check double-click, multi-tab, slow-connection scenarios

### 2G — Security
- SQL injection, XSS, exposed keys, IDOR
- Rate limiting on auth endpoints
- Input validation/sanitization

## 3. Onboarding Overhaul

### Current State
4-step wizard: Profile, Agent Mode, Integrations, Visibility. Single API call on final submit. No per-step persistence. No resume-on-return.

### New 6-Step Wizard

| Step | Fields | Required | API |
|------|--------|----------|-----|
| 1. Profile | name, username, avatar | Yes | `PATCH /api/auth/onboarding/1` |
| 2. Bio & Headline | bio, headline/tagline | Yes (min 10 chars) | `PATCH /api/auth/onboarding/2` |
| 3. Agent Preferences | personality, agent mode | Yes | `PATCH /api/auth/onboarding/3` |
| 4. Portfolio Setup | skills, headline, projects | Optional | `PATCH /api/auth/onboarding/4` |
| 5. Integrations | telegram, github, email | Optional | `PATCH /api/auth/onboarding/5` |
| 6. Review & Launch | read-only summary, confirm | Yes | `POST /api/auth/onboarding/complete` |

### Database Changes
- Add `onboarding_step INTEGER DEFAULT 0` column to `users` table
- Existing `onboarding_completed INTEGER DEFAULT 0` stays

### Backend Changes
- New endpoint: `PATCH /api/auth/onboarding/:step` — saves step data, updates `onboarding_step`
- Modify: `POST /api/auth/onboarding` → `POST /api/auth/onboarding/complete` — sets `onboarding_completed = 1`
- `GET /api/auth/me` returns `onboardingStep` in addition to `onboardingCompleted`

### Frontend Changes
- New: `src/onboarding/OnboardingWizard.tsx` — main wizard container with progress bar, step navigation, transitions
- New: `src/onboarding/steps/ProfileStep.tsx` (step 1)
- New: `src/onboarding/steps/BioStep.tsx` (step 2)
- New: `src/onboarding/steps/AgentStep.tsx` (step 3)
- New: `src/onboarding/steps/PortfolioStep.tsx` (step 4)
- New: `src/onboarding/steps/IntegrationsStep.tsx` (step 5)
- New: `src/onboarding/steps/ReviewStep.tsx` (step 6)
- Modify: `src/App.tsx` — onboarding route guard checks `onboardingCompleted`
- Modify: `src/stores/authStore.ts` — add `onboardingStep` to state, add per-step save actions

### UX Requirements
- Progress bar at top showing current step (1-6)
- Slide-left animation on forward, slide-right on back
- "Continue" button (primary) on every step
- "I'll do this later" (subtle text link) on optional steps only (4, 5)
- Back button within wizard goes to previous step
- Each step auto-saves on "Continue" so progress survives browser close
- Inline validation errors (not alerts)
- Step 6 "Review" shows editable summary; "Launch My Space" triggers confetti/celebration, then redirects to `/dashboard`

### Auth Guard Changes
- Every protected route: if `!onboardingCompleted`, redirect to `/onboarding`
- `/onboarding` route: if `onboardingCompleted`, redirect to `/dashboard`
- Login redirect uses `navigate('/dashboard', { replace: true })` — prevents back-to-login

## 4. Bug Fixes

All bugs found in Phase 2 audit, fixed in priority order: CRITICAL → HIGH → MEDIUM → LOW.

## 5. E2E Verification

Three test journeys verified via curl + Puppeteer:
1. New user: signup → onboarding (all 6 steps) → dashboard → back button correct
2. Returning user: login → dashboard (skips onboarding) → portfolio → back button correct
3. Edge cases: expired token, partial onboarding, rapid back/forward, multi-tab, slow connection

## 6. Cleanup & Final Sync

- Remove dead code, unused imports, console.logs
- Verify Docker builds: `docker compose build --no-cache`
- Commit to `live-production`, merge to `main`, push both
- Confirm branches are identical
