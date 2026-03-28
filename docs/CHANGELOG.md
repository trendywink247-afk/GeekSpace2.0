# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [3.3.0] — 2026-03-28

### Added
- Goal system — AI-driven goal decomposition with autonomous step execution
- Inter-agent delegation pipeline with full audit trail
- Deep Reasoning Engine — 10-iteration ReAct with self-reflection and plan-then-execute
- Proactive Goal Engine — 30-min cycle auto-execution, stale goal nudges, daily summaries
- Agent notifications — SSE + Telegram + in-app bell with quiet hours (timezone-aware)
- Workspace artifacts for inter-agent collaboration
- Goals page + Notification bell in frontend
- Goals summary card on overview page
- Onboarding wizard revamp with agentic features
- Markdown rendering in chat
- Per-module focus workflow for Claude Code (`scripts/focus-module.sh`)
- Module-level integration tests (54+ test files)
- Dependabot configuration for automated dependency updates
- CODEOWNERS for PR review routing
- Prettier for automated code formatting
- CHANGELOG documentation

### Changed
- Modular monolith architecture: 8 new modules extracted, all routes now modularized
- Docker deploy improvements: rollback support, BuildKit caching, image pruning
- CI pipeline: staging auto-deploys on push to main, production manual-only
- 34 TypeScript errors resolved (zero errors remaining)
- Removed 13 unused re-export shims from app.ts and index.ts
- Consolidated scattered audit docs into `docs/internal/`

### Fixed
- Container startup crashes (package.json + img-cache dir)
- `test-mode.ts` moved out of test/ for tsc build inclusion
- Summary status check + devDependencies in CI
- NotificationBell dropdown max-width

### Security
- Removed hardcoded default Redis password from `docker-compose.staging.yml`
- Deleted stale analysis artifacts from source tree

### Removed
- 6 stale gap analysis markdown files from `src/dashboard/pages/office/__tests__/`
- 4 duplicate test files from `tests/office/` (kept larger versions in `tests/unit/`)
- 78+ stale docs, 56 stale files, 30 stale ops docs (prior cleanup sprints)

---

## [3.1.0] — 2026-02-XX

### Added
- Enterprise documentation suite (11 phases): Solution Architecture, Developer Guide, API Reference, Business Features, Testing Guide, DevOps Guide, Microservices Roadmap
- OpenAPI 3.1 specification (`openapi/openapi.yaml`)
- TSDoc comments on core backend services and repositories
- Documentation map (`docs/DOC_MAP.md`)
- Domain-Driven Design bounded context map (`docs/ddd/domains.md`)
- ADR-001: 7-tier LLM waterfall with intent-based routing
- Modular monolith barrel exports for wave-1 domains

### Changed
- Comprehensive README overhaul with badges, hero section, and documentation links

---

## [3.0.0] — 2026-01-XX

### Added
- Full site revamp — 42 pages, agent autonomy, mobile-first design
- India launch: Razorpay payments, Hindi/Hinglish support, Indian festivals, Telegram custom bot
- 5-agent audit with all 50 pages revamped
- Mobile audit and responsive fixes
- Live agent activity feed
- Create zone — image merge, video fix, visual revamp
- Work zone — automations fix, planner week view, docs content
- Connect zone — inbox polish, Gmail fix, voice, fleet management
- Chat + Overview — streaming, history, visual revamp
- Branding unification — PNG logo across dashboard and connect pages
- PageShell + design token migration across all 44 dashboard pages

### Fixed
- 8-agent swarm audit: 5 critical + 5 high severity fixes
- Strict TypeScript: resolved `noUnusedLocals` + Card rebase artifacts
- Bottom-nav test assertions updated for current CSS
- Tests updated for deleted/moved pages

---

## Related Documents

- [README.md](../README.md) — Project overview and quick start
- [docs/DOC_MAP.md](DOC_MAP.md) — Documentation navigation map
- [docs/SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) — System architecture
