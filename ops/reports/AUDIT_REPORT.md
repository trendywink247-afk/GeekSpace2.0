# AUDIT REPORT — Industry-Grade Hardening (Phase 0+1)

**Date:** 2026-02-23
**Branch:** `refactor/industry-grade-hardening-2026-02-23`
**Status:** Phase 0+1 complete (audit + plan). NO code changes made.

---

## DB SAFETY NOTE

### Database Type & Connection
- **Engine:** SQLite 3 via `better-sqlite3` (synchronous, single-file)
- **ORM/Query Layer:** Raw SQL via `db.prepare().run/get/all()`; NO ORM
- **Connection Source:** `process.env.DB_PATH` → defaults to `./data/geekspace.db` (dev) or `/app/data/geekspace.db` (Docker volume)
- **Schema Location:** `server/src/db/index.ts` (main) + `server/src/services/pico-fleet.ts` (pico tables)
- **Migration Strategy:** Idempotent `ALTER TABLE ... ADD COLUMN` wrapped in try/catch. `CREATE TABLE IF NOT EXISTS` for all tables. No migration framework.
- **WAL Mode:** Enabled (`journal_mode = WAL`), allows concurrent reads + single writer
- **Foreign Keys:** Enabled (`foreign_keys = ON`), all user-facing tables have `ON DELETE CASCADE`

### Tables Inventory (30 tables)

| Table | Owner Scope | Notes |
|-------|-------------|-------|
| `users` | PK: id | Core user table |
| `agent_configs` | user_id (UNIQUE) | 1:1 per user |
| `api_keys` | user_id | Encrypted key storage |
| `reminders` | user_id | Push/Telegram/email |
| `integrations` | user_id | Connected services |
| `portfolios` | user_id (PK) | Public profiles |
| `automations` | user_id | Trigger-action pairs |
| `usage_events` | user_id | Token/credit tracking |
| `features` | user_id (PK) | Feature flags |
| `contact_submissions` | (none) | Public contact form |
| `activity_log` | user_id | User actions |
| `premium_sessions` | user_id | Premium agent sessions |
| `subscriptions` | user_id (UNIQUE) | Billing/credits |
| `channel_links` | user_id | Telegram/WhatsApp links |
| `link_codes` | user_id | Temp linking codes |
| `free_models` | (global) | Model registry |
| `model_changelog` | (global) | Model changes |
| `briefings` | user_id | Daily briefings |
| `installed_recipes` | user_id | User recipe config |
| `generated_artifacts` | user_id | Code/HTML artifacts |
| `artifact_domains` | user_id | Custom subdomains |
| `artifact_deployments` | user_id | External deploys |
| `telegram_onboarding` | user_id (nullable) | Bot onboarding state |
| `generated_outputs` | user_id | PDFs/docs |
| `automation_logs` | user_id | Automation run logs |
| `agent_messages` | from_user_id, to_user_id | Inter-user chat |
| `dev_audit_log` | (admin) | Admin dev actions |
| `password_reset_tokens` | user_id | Reset OTPs |
| `password_reset_rate_limits` | identifier | Rate limiting |
| `password_reset_audit` | user_id | Reset audit trail |
| `user_connections` | user_id, connected_user_id | Social graph |
| `security_events` | (global) | Security log |
| `token_usage` | user_id | Monthly token tracking |
| `day_passes` | user_id | $1 day passes |
| `templates` | created_by | Code templates |
| `pico_agents` | user_id | Weebo fleet slots |
| `pico_tasks` | user_id, agent_id | Task queue |
| `pico_task_logs` | task_id, agent_id | Task execution logs |
| `pico_cron_jobs` | user_id | Scheduled tasks |
| `user_images` | user_id | Generated images |
| `user_videos` | user_id | Generated videos |

### What Could Go Wrong
1. **Unintentional migration in production** — The `ALTER TABLE` pattern runs on EVERY app boot. A bad migration could corrupt the schema.
2. **Cross-user data leakage** — If any query forgets `WHERE user_id = ?`, data from one user could be exposed to another.
3. **Demo data seed in prod** — `seedDemoData()` is guarded by `NODE_ENV !== 'production'`, but a misconfigured env could trigger it.
4. **Concurrent writes** — SQLite single-writer constraint. PM2 cluster (2 workers) means write contention is possible.
5. **No backup validation** — Backups exist via cron but no restore-test automation.

### How We Avoid Risk
1. **NO schema changes in Phase 2** — All hardening is application-level code.
2. **Read-only audit** — This phase only reads code and DB schema; no writes to prod.
3. **Testing on dev DB only** — All test runs use `TEST_MODE=true` with temp DB.
4. **Additive-only migrations** — If future phases require schema changes, they will be ADD COLUMN only with defaults.
5. **Feature flag gating** — Any behavioral changes will be behind config flags.

### Migration Tooling Risk Assessment
- **Current state:** No formal migration tool. All migrations are `try { ALTER TABLE } catch {}` in `db/index.ts` and `pico-fleet.ts`.
- **Production guard:** Migrations run on every boot. This is safe for additive changes but dangerous for destructive ones.
- **Recommendation (Phase 2):** Add an environment guard `ALLOW_MIGRATIONS=true` that must be explicitly set for any new migrations to execute.

---

## Multi-User Isolation Audit

### Current State: STRONG (with gaps)

**All 30+ user-facing tables** have `user_id` foreign key with `ON DELETE CASCADE`. Every route handler that was audited (30 files) enforces `user_id` scoping on read/write operations.

### Scoping Audit Results

| Component | Scoping Quality | Issues Found |
|-----------|----------------|--------------|
| Auth middleware | Excellent | JWT → req.userId on every authed request |
| Dashboard routes | Proper | All queries include `user_id = ?` |
| Reminder routes | Excellent | Dual id + user_id check on mutations |
| Artifact routes | Excellent | Dual id + user_id check everywhere |
| Pico fleet routes | Excellent | All CRUD scoped to userId |
| Portfolio routes | Proper | Public view intentional, mutations scoped |
| Agent routes | Excellent | Large file (1700+ lines), all scoped |
| Automation routes | Good | Manual trigger scoped; webhook relies on UUID |
| Memory service | Excellent | All functions require userId parameter |
| Token budget | Excellent | All functions require userId parameter |
| Agent chat | Excellent | from_user_id / to_user_id enforced |
| Webhook handlers | Good | External callbacks verify signatures |

### Cross-User Leakage Risks (4 findings)

| # | Risk | Severity | Location | Description |
|---|------|----------|----------|-------------|
| 1 | Webhook automation bypass | MEDIUM | `automations-engine.ts:292` | `executeWebhookTrigger()` takes only automationId, no userId. Attacker with valid UUID could trigger another user's automation. Mitigated by UUID randomness. |
| 2 | n8n webhook userId injection | MEDIUM | `webhooks.ts:698` | n8n callback reads userId from request body. If n8n is compromised, attacker could impersonate users. Mitigated by n8n secret token. |
| 3 | Portfolio chat memory pollution | LOW | `agent.ts:1513` | Visitors store memories in portfolio owner's context. Spam risk. |
| 4 | Security events table | LOW | `db/index.ts:478` | No user_id column — events are global. Design choice (not a leak). |

---

## Service Architecture Map

### Docker Services (Active)
| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| geekspace | geekspace-app | 3001 | Main app (Express + static) |
| caddy | geekspace-caddy | 80/443 | Reverse proxy + TLS |
| redis | geekspace-redis | 6379 | Cache + job queue |
| picoclaw | geekspace-picoclaw | 8080 | Fast AI triage sidecar |

### Docker Services (Inactive/Profile-gated)
| Service | Profile | Status |
|---------|---------|--------|
| edith-bridge | `edith` | DEPRECATED — replaced by direct edith.ts |
| n8n | `n8n` | Optional workflow automation |

### External Containers (Hostinger-managed)
| Container | Port | Purpose |
|-----------|------|---------|
| ollama-qtzz-ollama-1 | 32778 (host) / 11434 (docker) | Local LLM (llama3.1:8b) |
| openclaw-e3n5-openclaw-1 | 55550 | Kimi K2/Moonshot reasoning |

### Network Topology
```
Internet → Caddy (443) → geekspace:3001
  ├── ai.geekspace.space → Frontend + /api/*
  └── api.geekspace.space → API only

geekspace-net (internal): geekspace ↔ redis ↔ picoclaw ↔ caddy
geekspace-shared (external): geekspace → ollama, openclaw
```

### Backend Architecture
```
Request → Helmet → CORS → Rate Limiter → Auth middleware → Route handler
  → Service layer → LLM router (intent → provider)
  → Action parser (<<<ACTION blocks) → Action executor → Response
```

### Workers & Background Processes
1. **Pico Fleet Worker** — In-process, round-robin task executor (10s tick, 5min idle)
2. **Reminder Scheduler** — Checks due reminders, sends via Telegram/push
3. **Recipe Scheduler** — Runs installed recipes on schedule
4. **Model Sync** — Refreshes OpenRouter free model list
5. **Artifact Cleanup** — Purges expired artifacts
6. **Daily Summarizer** — Midnight memory consolidation
7. **Cron Job Checker** — Executes due pico_cron_jobs
8. **Social Media Checker** — Posts due social media content

### Frontend Architecture
```
App.tsx (BrowserRouter) → Auth gate (Zustand) → DashboardApp
  ├── Sidebar (desktop) / Bottom nav (mobile)
  └── Lazy-loaded pages → Zustand stores → API service (Axios + JWT)
```

Key pages: Chat, Reminders, Portfolio, Pico Fleet, Automations, Billing, Images, Videos, Website Builder, Social Media, Settings

---

## Previous Audit Findings (from AUDIT-2026-02-17)

### Still Open
- 5 CRITICAL routing/API issues (navigation missing `replace: true`, endpoint mismatches)
- 5 HIGH security issues (health SSE unauthenticated, n8n webhook unsecured, streaming bypasses rate limiter)
- 12 MEDIUM issues (missing indexes, blanket catches, schema fragmentation)

### Fixed (per ECOSYSTEM_FIX_REPORT)
- Telegram reload loop
- Done button redirect
- Reminders + memory sync
- Health tab infinite loading
- Automations mobile UI
- Terminal persistence

---

## Weebo Fleet "At Least 1 Active" Gap

### Current State
- Users can **disable** ALL Weebo agents via the UI toggle
- Backend `deleteAgent()` prevents deleting slot 1, but `updateAgent()` allows setting `enabled = 0` on any agent including slot 1
- **No validation** in frontend (`PicoFleetPage.tsx:294`) or backend (`pico-fleet.ts:295`) prevents all agents from being disabled

### Impact
If all agents are disabled, the Pico worker (`processNextTask()`) skips all tasks for that user because it checks `a.enabled = 1`. Tasks queue up indefinitely.

### Plan
- **Backend:** Add validation in `updateAgent()` — if setting `enabled = false` on the last enabled agent, reject with error
- **Frontend:** Disable the toggle switch on the last active agent with tooltip "At least 1 agent must be active"
- **API:** Return 400 with message when trying to disable last active agent
