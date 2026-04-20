# GeekSpace 2.0 — Architecture Overview

> Umbrella TOC for the operation. Sections 1–8 below are the quick-reference; the `docs/arch-*.md` sub-documents are the audit-grade deep-dives ([AGE-64](/AGE/issues/AGE-64)). For solution internals see [`docs/SOLUTION_ARCHITECTURE.md`](docs/SOLUTION_ARCHITECTURE.md) and [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md); for multi-agent operations see [`AGENTS.md`](AGENTS.md).

**Last updated:** 2026-04-20

---

## 0. Deep-dive sub-documents (AGE-64 audit)

| # | Scope | Document | Ticket |
|---|---|---|---|
| §1 | VPS host + every container, ports, memory, Caddy routing | [`docs/arch-containers.md`](docs/arch-containers.md) | [AGE-66](/AGE/issues/AGE-66) |
| §2 | Repository layout, module map, key files | [`docs/arch-repo.md`](docs/arch-repo.md) | [AGE-67](/AGE/issues/AGE-67) |
| §3 | CI/CD pipeline (GitHub Actions, deploy, rollback) | [`docs/arch-ci.md`](docs/arch-ci.md) | [AGE-67](/AGE/issues/AGE-67) |
| §4 | Paperclip orchestrator — tasks, runs, agent IDs, DB schema | [`docs/arch-paperclip.md`](docs/arch-paperclip.md) | [AGE-66](/AGE/issues/AGE-66) |
| §5 | Agents — roster, instructions bundles, memory pattern | [`docs/arch-agents.md`](docs/arch-agents.md) | [AGE-68](/AGE/issues/AGE-68) |

Each sub-document carries a `<!-- snapshot: YYYY-MM-DDT... -->` marker; refresh by re-running the capture commands noted inline when the host drifts.

---

## 1. System at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│ Edge (Caddy) — TLS, HTTP/3, security headers                    │
│ ai.agentin.chat  staging.agentin.chat  monitor.geekspace.space  │
│ status.agentin.chat   agent.agentin.chat                        │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│ GeekSpace stack (Docker Compose, 10 containers)                 │
│ ┌─────────────┐ ┌───────────────┐ ┌─────────────┐ ┌──────────┐ │
│ │ app :3001   │ │ staging :3002 │ │ redis ×2    │ │ picoclaw │ │
│ │ (Express +  │ │ (Express +    │ │ (cache,     │ │ (triage  │ │
│ │  Vite SSR)  │ │  Vite SSR)    │ │  queues)    │ │  LLM)    │ │
│ └─────────────┘ └───────────────┘ └─────────────┘ └──────────┘ │
│ browser · meilisearch · qdrant · searxng · uptime-kuma          │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│ External stacks (12 containers)                                 │
│ • Monitoring (5): grafana · prometheus · alertmanager ·         │
│                   loki · promtail · cadvisor                    │
│ • AI/automation (4): ollama · agent-zero · claude-bridge ·      │
│                      cronicle                                   │
│ • Utility (3): crawl4ai · healthchecks · healthchecks-postgres  │
└─────────────────────────────────────────────────────────────────┘
```

**Total: 22 running containers across 4 stacks.** Full inventory with ports, memory, restart policies, and Caddy upstream map: [`docs/arch-containers.md`](docs/arch-containers.md). Orchestrator-side (Paperclip tasks, runs, agents, DB schema): [`docs/arch-paperclip.md`](docs/arch-paperclip.md).

---

## 2. Application layers

### Frontend (`src/`)
- **Stack:** React 19, Vite 7, TypeScript, Tailwind 3.4, Zustand, Radix UI, Framer Motion
- **Entry:** `src/main.tsx` → `src/App.tsx` → `src/dashboard/DashboardRouter.tsx`
- **Pages:** 41 lazy-loaded dashboard pages in `src/dashboard/`
- **Components:** 122 reusable components in `src/components/`
- **State:** Zustand stores in `src/stores/` (auth, dashboard, theme, terminal)
- **Design system:** CSS variables in `src/styles/agentin-tokens.css` — never hardcode colors
- **Mobile:** Minimum 44px touch targets enforced

### Backend (`server/`)
- **Stack:** Node 20, Express, better-sqlite3 (**synchronous**), Redis, TypeScript
- **Entry:** `server/src/index.ts` → `server/src/app.ts`
- **Modules:** 18 domain modules in `server/src/modules/` — each self-contained with routes, services, repositories
  ```
  admin · agent · auth · automation · billing · comms · content ·
  dashboard · focus · geekos · health · integrations · media ·
  memory · office · portfolio · reminders · users
  ```
- **The `agent` module** (~42 files) is the heart: ReAct loop, 7-tier LLM router, goals, delegation, proactive engine, Agent Theater
- **Database:** `server/data/geekspace.db` (SQLite). Schema lives in `server/src/db/index.ts`. Migrations are idempotent, run at startup.
- **Middleware:** `auth`, `validate`, `errors`, `error-handler`, `metrics`, `ai-security`

Full repo layout + module-by-module map: [`docs/arch-repo.md`](docs/arch-repo.md).

### Data (`server/data/`)
- SQLite primary (synchronous I/O — DO NOT `await` DB calls)
- Redis for cache, queues, rate limits
- Meilisearch for full-text search
- Qdrant for vector search (embeddings via `nomic-embed-text` local)
- Litestream for continuous SQLite → S3-compatible backup

---

## 3. LLM routing (intent-based)

```
request → intent classifier (PicoClaw, local qwen2.5-coder:3b)
           │
           ├─ simple/automation ──▶ Groq 70B (≤0.2s, free tier)
           │                         fallback → Ollama → OpenRouter-free
           │
           ├─ complex/coding   ──▶ Ollama gemma4 (local, free)
           │                         fallback → Groq → OpenRouter-free
           │
           ├─ triage           ──▶ PicoClaw (qwen2.5-coder:3b, local)
           │
           └─ embeddings       ──▶ nomic-embed-text (local)
```

Implementation: `server/src/modules/agent/services/llm.ts` + `message-router.ts`.
Details: `docs/adr/ADR-001-llm-waterfall-phase111.md`.

---

## 4. Agentic v2 features

| Feature | Key files |
|---|---|
| Conversation threading | `modules/agent/services/conversation-threads.ts`, `modules/memory/services/memory.ts` |
| Human-in-the-loop confirmations | `modules/agent/services/confirm-action.ts`, `modules/agent/services/react-loop.ts` |
| File upload & processing | `modules/agent/middleware/file-upload.ts`, `modules/agent/services/file-processor.ts` |
| Feedback & cognitive memory | `modules/agent/services/feedback-service.ts`, `modules/memory/services/cognitive-memory.ts` |
| Agent Theater UI | `src/components/AgentTheaterPanel.tsx` |
| Proactive engine | `modules/agent/services/proactive-engine.ts` |
| Goals & delegation | `modules/agent/services/goal-service.ts` |

---

## 5. Observability

- **Metrics:** Prometheus scrapes `/api/metrics` on app + staging (`server/src/middleware/metrics.ts`)
- **Logs:** Promtail → Loki, queryable in Grafana
- **Dashboards:** Grafana at `monitor.geekspace.space`
- **Uptime:** Uptime Kuma at `status.agentin.chat`
- **Alerts:** Prometheus alertmanager → Telegram webhook
- **Backups:** Nightly drill via Cronicle; continuous via Litestream

---

## 6. CI/CD

- **GitHub Actions:** lint → typecheck → test → build → E2E (Playwright) → security scans (npm audit, gitleaks)
- **Pre-push hook** (`.git/hooks/pre-push`): lint changed files, frontend tsc, server tsc, vite build — push blocked on failure
- **Deploy:** tagged release → Docker build → rolling restart via `scripts/staging.sh` / production deploy
- **Load test baseline:** `scripts/load-test.sh` documented in `scripts/LOAD-TEST-BASELINE.md`

End-to-end pipeline walkthrough (workflow files, gates, rollback path): [`docs/arch-ci.md`](docs/arch-ci.md).

---

## 7. Conventions

See [`docs/NAMING_CONVENTIONS.md`](docs/NAMING_CONVENTIONS.md) for the full naming standard.

**Quick rules:**
- PascalCase for React components, kebab-case for everything else
- Hooks prefix with `use-` (e.g. `use-chat-stream.ts`)
- DB: `snake_case` tables + columns
- API: `/api/kebab-case` paths, `camelCase` JSON
- Git: [Conventional Commits](https://www.conventionalcommits.org/)
- Env vars: `SCREAMING_SNAKE_CASE`

---

## 8. Where to go next

| If you want to… | Read |
|---|---|
| Set up a dev environment | [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) |
| Understand the solution in depth | [`docs/SOLUTION_ARCHITECTURE.md`](docs/SOLUTION_ARCHITECTURE.md) |
| See every doc | [`docs/DOC_MAP.md`](docs/DOC_MAP.md) |
| Deploy to production | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| Debug a production issue | [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) |
| Write tests | [`docs/TESTING.md`](docs/TESTING.md) |
| Configure env vars | [`docs/ENV_VARS.md`](docs/ENV_VARS.md) |
| Understand API surface | [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) |
| Operate the multi-agent fleet | [`AGENTS.md`](AGENTS.md) |
| Work with Claude Code | [`CLAUDE.md`](CLAUDE.md) |
| Audit the container fleet | [`docs/arch-containers.md`](docs/arch-containers.md) |
| Audit the repo structure | [`docs/arch-repo.md`](docs/arch-repo.md) |
| Audit the CI/CD pipeline | [`docs/arch-ci.md`](docs/arch-ci.md) |
| Audit the Paperclip orchestrator | [`docs/arch-paperclip.md`](docs/arch-paperclip.md) |
| Audit the agent roster and memory | [`docs/arch-agents.md`](docs/arch-agents.md) |
