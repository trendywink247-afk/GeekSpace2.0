# Naming Conventions

**Status:** Authoritative — all new code MUST follow these rules. Existing violations are being migrated (see branch `chore/repo-cleanup-2026-04`).
**Last updated:** 2026-04-06

---

## 1. File Naming

| Entity | Convention | Example |
|---|---|---|
| React components (`.tsx`) | `PascalCase.tsx` | `ChatPanel.tsx`, `AgentTheaterPanel.tsx` |
| shadcn/ui primitives (`src/components/ui/*.tsx`) | `kebab-case.tsx` *(shadcn convention — do not change)* | `button.tsx`, `dialog.tsx` |
| React hooks (`.ts`/`.tsx`) | `use-kebab-case.ts` | `use-chat-stream.ts`, `use-feature-flag.ts` |
| Zustand stores | `kebab-case-store.ts` | `auth-store.ts`, `dashboard-store.ts` |
| Utilities / pure modules | `kebab-case.ts` | `date-format.ts`, `text-measure.ts` |
| Services (frontend) | `kebab-case.ts` | `api.ts`, `notifications.ts` |
| Server modules / files | `kebab-case.ts` | `react-loop.ts`, `conversation-threads.ts` |
| Server repositories | `kebab-case.repository.ts` | `agent-config.repository.ts` |
| Server routes | `kebab-case.ts` | `password-reset.ts`, `api-keys.ts` |
| Server services | `kebab-case.ts` | `message-router.ts`, `llm.ts` |
| Test files (colocated) | `<file>.test.ts` | `use-chat-stream.test.ts` |
| Test files (separate) | `__tests__/<file>.test.ts` | `__tests__/message-router.test.ts` |
| E2E tests | `kebab-case.spec.ts` | `chat-flow.spec.ts` |

**One-liner:** PascalCase for JSX components, kebab-case for everything else. Hooks prefix with `use-`.

---

## 2. Identifiers (inside files)

| Entity | Convention | Example |
|---|---|---|
| Variables, functions, params | `camelCase` | `const userCount`, `function fetchThread()` |
| React components (symbol) | `PascalCase` | `function ChatPanel()` |
| Hooks (symbol) | `camelCase` starting with `use` | `function useChatStream()` |
| Classes | `PascalCase` | `class MessageRouter` |
| Types / interfaces | `PascalCase`, **no `I` prefix** | `type ThreadId`, `interface UserProfile` |
| Type params (generics) | Single uppercase letter or `PascalCase` | `<T>`, `<TContext>` |
| Enums | `PascalCase` name, `PascalCase` members | `enum RunStatus { Pending, Running }` |
| Constants (module-level) | `SCREAMING_SNAKE_CASE` | `const MAX_RETRIES = 3` |
| Env vars | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`, `OPENAI_API_KEY` |
| CSS class names (custom) | `kebab-case` | `.chat-panel-body` |
| Tailwind usage | utility classes, extract with `@apply` only when repeated 5+ times | — |
| CSS variables | `--kebab-case` | `--color-surface-raised` |

---

## 3. Database

| Entity | Convention | Example |
|---|---|---|
| Tables | `snake_case`, plural | `agent_runs`, `world_models` |
| Columns | `snake_case` | `created_at`, `user_id` |
| Primary keys | `id` | |
| Foreign keys | `<table_singular>_id` | `thread_id`, `user_id` |
| Timestamps | `created_at`, `updated_at`, `deleted_at` | |
| Booleans | `is_*`, `has_*`, `can_*` | `is_active`, `has_feedback` |
| Indexes | `idx_<table>_<col>[_<col>]` | `idx_agent_runs_user_id` |

**DB access:** SQLite via better-sqlite3 is **synchronous**. Never use `async/await` on DB calls. Wrap multi-statement work in `db.transaction(() => {…})`.

---

## 4. HTTP API

| Entity | Convention | Example |
|---|---|---|
| Route paths | `/api/kebab-case` | `/api/agent-runs`, `/api/world-models` |
| Path params | `:camelCase` | `/api/threads/:threadId` |
| Query params | `camelCase` | `?pageSize=20&sortBy=createdAt` |
| JSON request/response keys | `camelCase` | `{ userId, createdAt }` |
| HTTP methods | Standard REST | `GET`, `POST`, `PATCH`, `DELETE` |
| Status codes | Standard HTTP | 200, 201, 400, 401, 403, 404, 409, 422, 500 |

**Mapping note:** DB is `snake_case`, API is `camelCase`. Repositories are the translation boundary — convert once on read/write, never leak snake_case to the frontend.

---

## 5. Git

| Entity | Convention | Example |
|---|---|---|
| Branches | `<type>/<short-slug>` | `feat/world-models`, `fix/db-tables` |
| Branch types | `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ops` | |
| Commit messages | [Conventional Commits](https://www.conventionalcommits.org/) | `fix(db): add missing world_models table` |
| Commit scope | Module or area | `agent`, `db`, `ops`, `docs`, `ui`, `api` |
| Commit subject | Imperative mood, lowercase, no period | `add metrics endpoint` not `Added metrics endpoint.` |
| Commit body | Why, not what. Wrap at 72. | |
| PR titles | Same as commits | `feat(agent): conversation threading` |

---

## 6. Environment Variables

- `SCREAMING_SNAKE_CASE`
- Prefix by domain: `DB_*`, `REDIS_*`, `OPENAI_*`, `GROQ_*`, `STRIPE_*`, `RAZORPAY_*`, `TELEGRAM_*`
- Boolean env vars: `ENABLE_*`, `DISABLE_*` → parse with explicit `=== 'true'`
- Required vs optional: document in `docs/ENV_VARS.md` and `.env.example`
- Secrets: never commit. `.env` is gitignored. Rotate on exposure.

---

## 7. Exceptions & Rationale

### Why kebab-case for non-component files?
Matches the modern React + Node ecosystem (shadcn, Vite, Next.js App Router, NestJS, Remix). Case-insensitive filesystems (macOS default) are less error-prone with kebab-case. Hooks-as-kebab is the React 19 / Next 14 convention.

### Why PascalCase for components?
React convention; JSX parser requires capital letter to distinguish component from HTML element.

### Why shadcn/ui primitives stay kebab?
Generated by `npx shadcn add` which enforces kebab-case. Renaming breaks the update CLI. **Do not rename** files under `src/components/ui/`.

### Why snake_case for DB?
SQL standard. Most ORMs and tooling expect it. Prevents quoting hell (`"ColumnName"` vs `column_name`).

### Why camelCase for API JSON?
Matches JavaScript/TypeScript idiomatic usage on both client and server. No transformation needed at the consumer.

---

## 8. Enforcement

- **Lint rules:** ESLint does not currently enforce file naming. Recommended: add [`unicorn/filename-case`](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md) in a follow-up PR.
- **Review:** Code review MUST flag naming violations.
- **New files:** Follow this guide from day one.
- **Renames:** See `.pi/CLEANUP_AUDIT.md` §5 for the migration plan. Low-risk batches auto-renamed; high-risk (hooks) done with full import sweep + build verification.

---

## 9. Cheat sheet

```
src/components/ChatPanel.tsx          ✅ React component
src/components/ui/button.tsx          ✅ shadcn primitive
src/hooks/use-chat-stream.ts          ✅ hook
src/stores/auth-store.ts              ✅ zustand store
src/utils/date-format.ts              ✅ utility
server/src/modules/agent/services/react-loop.ts              ✅ server module
server/src/repositories/agent-config.repository.ts           ✅ repository
server/src/routes/password-reset.ts                          ✅ route

AgentConfigRepository.ts              ❌ PascalCase file → agent-config.repository.ts
useChatStream.ts                      ❌ camelCase hook → use-chat-stream.ts
authStore.ts                          ❌ camelCase store → auth-store.ts
passwordReset.ts                      ❌ camelCase route → password-reset.ts
```
