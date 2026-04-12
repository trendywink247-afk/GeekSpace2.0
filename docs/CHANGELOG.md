# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — 2026-04

### Added
- **Agentic v2**: conversation threading, human-in-the-loop `ConfirmActionCard` for sensitive tool calls, file upload pipeline (PDF / image / text) into chat, thumbs-up/down feedback loop feeding cognitive memory, and an Agent Theater UI streaming live ReAct steps and delegations (`df77d5a`).
- **Agentic v3**: world model, uncertainty tracking, temporal anchors, inference, learning, recovery, trust, and vision subsystems in the agent module (`82fe95a`). New DB tables `world_models` and `temporal_anchors` (`640c2d3`).
- **MCP server** with 10 registered tools + Claude Bridge escalation path (`fd5fe41a`, `1f1e7b75`).
- **Stripe day pass** — one-time checkout sessions for premium access (`1f1e7b75`).
- **Chat feedback** — thumbs up/down on floating chat panel responses (`38ffc5a8`).
- **HITL deep reasoning** — human-in-the-loop confirmations wired into the deep reasoning loop (`fcc5f2f6`).
- **WhatsApp image sending** — image attachment support for the WhatsApp integration channel (`828c2376`).
- **Prometheus alerting** — alert rules file + Alertmanager config routing to Telegram (`71ae3249`).
- **ChatSidebar** wired to real conversation threads instead of mock data (`d8b4eea0`).
- **Nightly AI audit** — Cronicle job that refreshes `.pi/FULL_AUDIT.md` automatically (`1f1e7b75`).
- **Prometheus `/api/metrics`** endpoint with full request / LLM / SSE instrumentation (`3ac06ee`). Grafana dashboards wired at `monitor.geekspace.space`.
- **Backup verification drills** plus Cloudflare runbook and Prometheus → Telegram alert routing via Alertmanager (`2297978`).
- **E2E Playwright suite in CI**, load-test baseline, security scans, and litestream documentation for SQLite off-box replication (`3e28ba8`).
- **Multi-agent coordination system** and Office command-center hub (`7d9d5c1`, `e0a4169`).
- **Cognitive memory + agent observer + per-agent tools** (`63530f3`), agent-initiated notifications, autonomy levels, and a transparent multi-agent delegation UI (`11d359d`, `b9641d0`).
- **AI Security Layer** middleware with typed guards and monitoring hooks (`63a2c9a`).
- Claude Bridge sidecar (`:8787`) wrapping Claude Code CLI; Cronicle (`:3012`) running nightly docker reports, smoke tests, and autonomy audits.
- Agent Zero container exposed at `agent.agentin.chat` for browser-accessible ad-hoc agent work.
- Design System v2.0: `DashboardPageWrapper`, violet-first tokens, light mode support, new 3D isometric "A" brand mark, and `agentin-tokens.css` design variables (`9e8abcf`, `e1268d4`, `aa391af`, `474d1e3`, `e77b37c`).
- Frontend design skills + ui-ux-pro-max intelligence installed (`e2188cb`, `4fa9d53`).

### Changed
- **Bundle splitting** — index chunk down 76%, ConvertTool down 99%, blocknote down 44% (`35c19a17`).
- **CI deploy scripts hardened** — staging and production deploys now abort stuck merge/rebase state and use `git reset --hard origin/main` instead of `git pull` to handle squash-merge divergence (`805fc96b`).
- **Modularized API services** — extracted webhook routes and service modules for cleaner separation (`a8ee6668`).
- **Migrated to `createBrowserRouter`** — data router mode for React Router 7 (`06c7f616`).
- **CI parallelized** — pipeline time reduced from 12min to 3min (`60727a5d`).
- **LLM routing is now intent-based** rather than a flat waterfall: simple/automation hits Groq Llama 3.3 70B first (~0.2s, free), complex/coding hits local Ollama `gemma4` first; both fall through to OpenRouter-free as a safety net (`ddb0e84`). PicoClaw (`qwen2.5-coder:3b`) remains the local triage sidecar. Ollama now runs `gemma4` — legacy `qwen3` models removed (`725f900`).
- **All 24 large dashboard pages decomposed into sub-components** (`087af4e`, `23fc2d6`); all 39/40 dashboard pages redesigned with the new design intelligence (`109bab4`, `e1268d4`).
- **ChatPage refactor**: split into 7 modules, fixed mobile layout, added test IDs, added `useChatStream` hook, markdown rendering, conversation sidebar, 15s stream fallback to cloud, 30s timeout, tight message bubbles (`e7077d3`, `cef9df6`, `d03ade6`, `8cde073`, `0ce89ab`, `5cc3a23`).
- **Office canvas**: lively agent animations, delegation walks, meeting huddles, SSE event pipeline + intent classifier reactivity, mobile fixes (`a515673`, `1ded153`, `ee11dbd`, `cb2fa0e`).
- **Repo cleanup**: surgical cleanup, archived 13 completed plans/specs/audits, removed orphan scripts, moved `.pi/skills/` → global `~/.pi/agent/skills/` (`d921705`, `fd7d206`, `a013774`, `7394d5e`).
- `AGENTS.md` rewritten as a master orchestrator brief (v2) with a fresh `.pi/FULL_AUDIT.md` (`bb060a4`).

### Fixed
- **Stripe webhook** now properly grants credits; fixed habits schema drift (`9e16d346`).
- **CORS** locked to production domains (no wildcard), `.env.example` added for onboarding, WAL-safe backup script (`3b2c4af5`).
- **Infra** — split `/srv/` into prod/staging directories, fixed TTS/STT sidecar configs (`4a1c88ef`).
- **Vitest** — restored setup file, fixed worktree path resolution, re-excluded office tests requiring live deps (`55f095cc`, `ea7c6a9f`).
- **Office integration tests** — scaffolded test suite for the office module (`c8b239bf`).
- Missing `world_models` and `temporal_anchors` tables (`640c2d3`).
- Flaky animation test in `ChatPage`/`SpriteTeaser` ref cleanup (`3ac06ee`, `ca0399a`).
- 18 lint errors across decomposed sub-components; all lint errors from AI security middleware, Design System merge, and staging build failures (`23fc2d6`, `a4b50bd`, `ccb011a`, `8821164`, `64e8426`, `ecf3a80`).
- Chat 401 on stream endpoint redirects to login; empty messages, typing indicator, state cleanup, disconnect state, mobile bloat, box-in-box layout (`dee5593`, `5cc3a23`, `1957a83`, `0ce89ab`).
- Dashboard navigation, mobile office layout, telegram bot, canvas layout, feed scroll, duplicate chat input, `/dashboard` URL handling (`cb2fa0e`, `9a99682`).
- `noUnusedLocals` lint errors (`buildMemoryContext`, `formatMemoryContext`) that were breaking Docker builds (`910288a`).
- TypeScript errors in the AI security layer; `any` → proper typing (`ddf7349`, `105a29b`).
- Server tests re-aligned with extracted Dashboard components and `DashboardRouter.tsx` page routing (`427f6fe`, `f41da98`, `9237c8d`).

### Security
- Full AI Security Layer landed (`63a2c9a`) — middleware, monitoring, typed guards.
- Nightly security scans + `npm audit` wired into CI (`3e28ba8`).
- Backup verification drills with off-box replication via litestream; Prometheus alerting to Telegram for drift detection (`2297978`, `3e28ba8`).

### Removed
- Legacy `qwen3:8b` / `qwen3:14b` Ollama models; replaced by `gemma4` (`725f900`).
- Orphan `scripts/write_files.py`; 13 completed plans/specs/audits archived out of the live docs tree (`a013774`, `fd7d206`).

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
