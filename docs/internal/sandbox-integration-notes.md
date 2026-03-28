# Sandbox System Integration Notes

Reviewed by: Code Review Agent
Date: 2026-03-23
Codebase: ~/GeekSpace2.0 (server/)

---

## 1. Exact Integration Points in agent.ts

The main chat endpoint is `POST /api/agent/chat` (server/src/routes/agent.ts, line 359).
The message flows through these stages:

```
Line 359-398:  Auth + guest check
Line 400-421:  Load agentConfig, user, subscription, credit check
Line 422-427:  Content filter + conversation logging
Line 430-452:  Terminal channel fast-path (exits early)
Line 454-530:  Route prefix parsing (/premium, /local, /pico, /bridge, /task, /agent:*)
Line 533-561:  Auto-detect task intent (remind, telegram, deploy)
Line 564-651:  Website builder fast-path
Line 654-683:  Image generation fast-path
Line 686-707:  Auto-route through bridge (URL detection, multilingual, model preference)
Line 710-785:  Premium route
Line 787-918:  Bridge route (Pico-Kimi orchestration)
Line 959-1135: Default local-first route (runReactLoop)
```

### Where sandbox detection should hook in

Insert a new fast-path block between the image generation fast-path (line 683)
and the bridge auto-route (line 686). This follows the existing pattern of
fast-paths that detect intent and exit early.

The detection block should:
1. Check if the message matches a sandbox intent pattern (e.g., "run this code",
   "execute python", "test this in sandbox", "/sandbox", "/run")
2. Verify the user is on a paid plan (reuse the subscription check already done
   at line 407-408, variable `userPlan`)
3. Call the sandbox bridge service
4. Return a response with `route: 'sandbox'` and exit early

Suggested insertion point -- after line 683, before line 686:

```typescript
// ---- Sandbox execution fast-path ----
if (!forceRoute) {
  const sandboxPattern = /\b(?:run|execute|test|compile|sandbox)\b.{0,40}\b(?:code|script|python|node|javascript|typescript|java|go|rust|c\+\+)\b/i;
  const isExplicitSandbox = message.startsWith('/run ') || message.startsWith('/sandbox ');
  if (sandboxPattern.test(message) || isExplicitSandbox) {
    // ... call sandbox bridge, return early
  }
}
```

### Alternative: Bridge-level integration

If sandbox should also work for multi-agent workflows (e.g., Forge generates
code, then sandbox runs it), the sandbox should also be available as a tool
in the action-executor system. Register a new action tool `sandbox_exec` in
`server/src/services/action-executor.ts` following the same pattern as
`generate_code`, `web_search`, `send_telegram`, etc. The LLM can then emit:

```
<<<ACTION>>>
tool: sandbox_exec
language: python
code: print("hello")
<<<END>>>
```

This requires adding the tool description to the system prompt in the
`toolsBlock` variable at line 113-154 of agent.ts.

---

## 2. Route Registration

### Current pattern

All routers are:
1. Defined in `server/src/routes/<name>.ts` as named exports
2. Imported in `server/src/app.ts` (line 78 for sandbox)
3. Registered with `app.use('/api/<name>', <router>)` (line 523 for sandbox)

### Sandbox routes already exist

The sandbox router is ALREADY registered:
- File: `server/src/routes/sandbox.ts` (exists, 370+ lines)
- Import: `server/src/app.ts` line 78
- Mount: `server/src/app.ts` line 523 at `/api/sandbox`

The existing sandbox route file already has:
- `POST /api/sandbox/create` -- create/get sandbox for user
- `POST /api/sandbox/exec` -- execute command in sandbox
- `GET /api/sandbox/stream/:id` -- SSE stream of terminal output
- `POST /api/sandbox/file/write` -- write file to sandbox
- `POST /api/sandbox/file/read` -- read file from sandbox
- `GET /api/sandbox/file/list` -- list files in sandbox
- `POST /api/sandbox/file/upload` -- multipart file upload
- `GET /api/sandbox/file/download` -- download file from sandbox
- `POST /api/sandbox/git/clone` -- git clone into sandbox
- `GET /api/sandbox/status` -- user's sandbox status
- `DELETE /api/sandbox/destroy` -- destroy user's sandbox
- `GET /api/sandbox/health` -- sandbox system health

The route file imports `SandboxService` from `../services/sandbox/sandbox-service.js`
but that file DOES NOT EXIST yet. This is what the coders need to build.

### What coders must NOT do

- Do NOT create a new route file -- use the existing `server/src/routes/sandbox.ts`
- Do NOT add a new `app.use()` line -- it is already at line 523
- Do NOT change the multer configuration -- it is already set up correctly

---

## 3. DB Migration Pattern

### How existing migrations work

The project does NOT use a migration runner (no knex, no prisma, no drizzle).
All schema is managed in `server/src/db/index.ts` using two patterns:

**Pattern A -- Initial schema (lines 37-301):**
Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` inside a
single `db.exec()` block. This is the core schema that runs on every startup.

**Pattern B -- Additive migrations (lines 303+):**
Each migration is wrapped in a try/catch that silently ignores "column already
exists" or "table already exists" errors:

```typescript
// Adding a column
try {
  db.exec(`ALTER TABLE agent_configs ADD COLUMN personality TEXT DEFAULT 'jarvis'`);
} catch { /* column already exists -- ignore */ }

// Adding a table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_passes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ...
    );
    CREATE INDEX IF NOT EXISTS idx_day_passes_user ON day_passes(user_id);
  `);
} catch { /* table already exists -- ignore */ }
```

### How sandbox tables should be added

Add the sandbox tables in `server/src/db/index.ts` using Pattern B at the
bottom of the file (after the last migration block). The tables should be:

```typescript
// Sandbox environments
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sandboxes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      container_id TEXT,
      name TEXT NOT NULL DEFAULT 'default',
      template TEXT DEFAULT 'node',
      status TEXT NOT NULL DEFAULT 'creating',
      port_mapping TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      last_active TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sandboxes_user ON sandboxes(user_id);
    CREATE INDEX IF NOT EXISTS idx_sandboxes_status ON sandboxes(status);
    CREATE INDEX IF NOT EXISTS idx_sandboxes_expires ON sandboxes(expires_at);
  `);
} catch { /* table already exists */ }

// Sandbox execution log
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sandbox_executions (
      id TEXT PRIMARY KEY,
      sandbox_id TEXT NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      command TEXT NOT NULL,
      exit_code INTEGER,
      stdout TEXT DEFAULT '',
      stderr TEXT DEFAULT '',
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sandbox_exec_sandbox ON sandbox_executions(sandbox_id);
    CREATE INDEX IF NOT EXISTS idx_sandbox_exec_user ON sandbox_executions(user_id, created_at);
  `);
} catch { /* table already exists */ }
```

### Critical rules

- ALWAYS use `CREATE TABLE IF NOT EXISTS` (never bare `CREATE TABLE`)
- ALWAYS wrap in try/catch with empty catch block and a comment
- ALWAYS add foreign key references to users(id) with ON DELETE CASCADE
- ALWAYS create indexes with `IF NOT EXISTS`
- Use TEXT for IDs (UUID), TEXT for timestamps (ISO format via `datetime('now')`)
- The `db` export is a synchronous better-sqlite3 instance -- no async needed

---

## 4. Network Isolation -- Docker

### Current network setup

The project has two Docker networks (docker-compose.yml lines 627-631):

```yaml
networks:
  geekspace-net:     # Internal bridge -- all services communicate here
    driver: bridge
  geekspace-shared:  # External -- connects to Ollama/Moonshot managed externally
    external: true
```

Services on `geekspace-net`:
- geekspace (app), redis, picoclaw, caddy, n8n, uptime-kuma, searxng,
  meilisearch, qdrant, browser, staging, staging-redis, geekos, geekos-postgres

Services also on `geekspace-shared`:
- geekspace (app), caddy, picoclaw, edith-bridge, staging

### Sandbox network requirements

Sandbox containers MUST be network-isolated from the main stack. Create a
dedicated network for each sandbox OR use a shared sandbox network with
no connectivity to `geekspace-net`:

```yaml
networks:
  sandbox-net:
    driver: bridge
    internal: true  # No internet access by default
```

If sandboxes need internet access (e.g., npm install, pip install), use a
separate network that has internet but no access to internal services:

```yaml
networks:
  sandbox-external:
    driver: bridge
    # Has internet but NOT connected to geekspace-net
```

### Security constraints from existing patterns

All existing containers use:
- `security_opt: ["no-new-privileges:true"]` -- MANDATORY for sandbox
- `cap_drop: [ALL]` -- MANDATORY for sandbox
- Memory limits (`deploy.resources.limits.memory`) -- MANDATORY for sandbox
- CPU limits (`deploy.resources.limits.cpus`) -- MANDATORY for sandbox
- Log rotation (`logging.driver: json-file`, max-size: 10m, max-file: 3)

Sandbox containers MUST also have:
- `read_only: true` (except /workspace volume)
- `tmpfs: ["/tmp:size=64m"]`
- Network isolation from geekspace-net
- PID limit (e.g., `pids_limit: 100`)
- No Docker socket access (NEVER mount /var/run/docker.sock into sandbox)

### Docker socket access for the app container

The geekspace-app container currently does NOT have access to the Docker socket.
The `SandboxService` needs to create/manage containers, so it needs dockerode.
Two options:

**Option A -- Mount Docker socket into app container (simpler, less secure):**
Add to docker-compose.yml geekspace service volumes:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```
Risk: if the app is compromised, attacker gets Docker access.

**Option B -- Sidecar sandbox manager (more secure):**
Create a separate minimal service that manages sandbox containers and exposes
a REST API to the main app. The sidecar has Docker socket access but the
main app does not.

Given the existing `no-new-privileges` security posture, Option B is recommended
but Option A is acceptable for MVP if the socket is mounted read-only and the
app validates all container operations.

---

## 5. Existing Patterns to Follow

### Error handling

Every route handler uses this pattern:

```typescript
try {
  // ... business logic
  res.json({ /* success response */ });
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error({ err, userId: req.userId }, 'Sandbox <action> failed');
  res.status(500).json({ error: message, code: 'ACTION_FAILED' });
}
```

Error response format: `{ error: string, code?: string }`
The `code` field is used by the sandbox routes for machine-readable error types.

### Logging

Uses pino logger imported from `../logger.js`:
```typescript
import { logger } from '../logger.js';

logger.info({ userId, sandboxId }, 'Sandbox created');
logger.warn({ err: (e as Error).message }, 'Description');
logger.error({ err, userId: req.userId }, 'Description');
logger.debug({ ... }, 'Description');
```

Always include `userId` in log context. Use structured logging (object first,
message string second).

### Response format for chat endpoint

The chat endpoint returns a consistent shape:
```typescript
{
  text: string,          // The reply text
  route: string,         // 'sandbox' | 'bridge' | 'premium' | 'local' | etc.
  tier: string,          // 'local' | 'premium'
  provider: string,      // Provider name
  model?: string,        // Model name
  creditsUsed: number,   // Credits deducted
  creditsRemaining: number,
  latencyMs?: number,
  actionResults?: ActionResult[],  // Tool execution results
  receipts?: ReceiptItem[],        // For display
}
```

### Auth middleware

```typescript
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

router.post('/endpoint', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;  // Always available after requireAuth
  // ...
});
```

### Validation

Uses Zod schemas via `validateBody()`:
```typescript
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';

const mySchema = z.object({
  sandboxId: z.string().uuid(),
  command: z.string().min(1).max(4096),
});

router.post('/exec', requireAuth, validateBody(mySchema), async (req, res) => {
  // req.body is typed and validated
});
```

### Activity logging

```typescript
import { logActivity } from '../services/activity-log.js';

logActivity(userId, 'Sandbox exec', command.slice(0, 80), 'terminal');
```

### Redis caching (for rate limiting)

```typescript
import { cacheGet, cacheSet } from '../services/cache.js';

const key = `sandbox:rl:exec:${userId}`;
const raw = await cacheGet(key);
await cacheSet(key, String(count), windowSeconds);
```

### SSE streaming pattern (already in sandbox routes)

```typescript
res.set({
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',  // Prevents Caddy/nginx buffering
});
res.flushHeaders();

// Send data
res.write(`data: ${JSON.stringify({ output: data })}\n\n`);

// Cleanup on disconnect
req.on('close', () => { cleanup(); });
```

Note: compression middleware in app.ts (line 168-174) already skips SSE
streams, so no special handling needed.

---

## 6. Potential Conflicts and Gotchas

### File upload -- multer already configured

Multer is already set up in `server/src/routes/sandbox.ts` (lines 29-32)
and in `server/src/routes/files.ts` (lines 61-63). Both use `memoryStorage()`.
The sandbox upload limit is 10MB. DO NOT add a second multer instance to the
sandbox routes.

Content-Type enforcement in app.ts (line 197-214) already allows
`multipart/form-data` -- no changes needed.

### SSE -- existing patterns

SSE is already used in:
- `server/src/routes/health.ts` -- admin health stream (MAX_SSE_CONNECTIONS = 25)
- `server/src/routes/agent-state.ts` -- per-user agent state stream
- `server/src/routes/sandbox.ts` (line 131-162) -- already has SSE stream

The sandbox SSE endpoint at `GET /api/sandbox/stream/:id` already exists.
DO NOT create a duplicate. Instead, implement the `SandboxService.streamOutput`
method that the route already calls.

### Docker socket access

The geekspace-app container currently does NOT mount the Docker socket.
This is the biggest missing piece. The `dockerode` package is already
installed (package.json line 25) but cannot connect without socket access.

Options:
1. Mount socket in docker-compose.yml (see section 4)
2. Use TCP connection to Docker daemon
3. Use a sidecar pattern

### Request timeout

The default request timeout is 30 seconds (app.ts line 221). The chat endpoint
overrides this to 120 seconds (agent.ts line 361). Sandbox exec should also
override this or use a streaming response that stays open.

### Plan gating

The existing sandbox routes already gate on paid plans:
```typescript
const ALLOWED_PLANS = new Set(['monthly', 'halfyear', 'yearly', 'pro', 'team']);
```

This does NOT include 'pilot' or 'intro' plans. Verify this is intentional.
The PLAN_DEFINITIONS in db/index.ts include: free, pilot, intro, halfyear, yearly.

### Container cleanup

There is no cron/worker for cleaning up expired sandbox containers. This needs
a cleanup mechanism -- either:
1. A background worker (similar to reminder-worker or pico-fleet-worker)
2. Cleanup on access (lazy cleanup when user requests a new sandbox)
3. A Docker container lifecycle hook

### VPS resource constraints

From CLAUDE.md: VPS has 2-core CPU, 16GB RAM. The earlyoom daemon protects
against OOM. Sandbox containers MUST have strict memory limits (suggest 256MB
per sandbox, max 2 concurrent sandboxes per user). Total sandbox memory budget
should not exceed 2GB to leave headroom for the 13+ existing containers.

---

## 7. Dependencies Needed

### Already installed (no action needed)

- `dockerode` v4.0.10 -- Docker API client (package.json line 25)
- `@types/dockerode` v4.0.1 -- TypeScript types (package.json line 16)
- `multer` v2.1.1 -- file uploads (package.json line 34)
- `@types/multer` v2.1.0 -- TypeScript types (package.json line 56)
- `uuid` v10.0.0 -- UUID generation (package.json line 45)
- `zod` v4.3.6 -- validation schemas (package.json line 46)
- `ioredis` v5.9.3 -- Redis client for rate limiting (package.json line 30)
- `pino` v10.3.1 -- structured logging (package.json line 41)

### Potentially needed (evaluate before installing)

- `tar-stream` -- for building Docker images from Dockerfiles in memory
  (only if you need to build custom images; prefer pulling pre-built images)
- `node-pty` -- for PTY-based terminal sessions
  (only if SSE streaming of interactive shells is needed; the existing
  dockerode exec + stream should suffice for command execution)

### NOT needed

- express -- already installed
- better-sqlite3 -- already installed
- jsonwebtoken -- already installed (auth middleware)

---

## 8. Config Additions

### Pattern

All env vars are defined in `server/src/config.ts` using these helpers:
```typescript
function required(key: string): string     // Crashes if missing
function optional(key: string, fallback: string): string
function optionalInt(key: string, fallback: number): number
```

### Add to server/src/config.ts

Add these inside the `config` object, grouped together:

```typescript
// ---- Sandbox (Docker-based dev environments) ----
sandboxEnabled: optional('SANDBOX_ENABLED', 'false') === 'true',
sandboxDockerSocket: optional('SANDBOX_DOCKER_SOCKET', '/var/run/docker.sock'),
sandboxBaseImage: optional('SANDBOX_BASE_IMAGE', 'node:20-slim'),
sandboxNetwork: optional('SANDBOX_NETWORK', 'sandbox-net'),
sandboxMaxPerUser: optionalInt('SANDBOX_MAX_PER_USER', 2),
sandboxMemoryLimitMb: optionalInt('SANDBOX_MEMORY_LIMIT_MB', 256),
sandboxCpuLimit: optional('SANDBOX_CPU_LIMIT', '0.5'),
sandboxIdleTimeoutMs: optionalInt('SANDBOX_IDLE_TIMEOUT_MS', 30 * 60 * 1000),
sandboxMaxLifetimeMs: optionalInt('SANDBOX_MAX_LIFETIME_MS', 4 * 60 * 60 * 1000),
sandboxExecTimeoutMs: optionalInt('SANDBOX_EXEC_TIMEOUT_MS', 30000),
```

### Add to .env.example

```bash
# ---- Sandbox ----
SANDBOX_ENABLED=false
SANDBOX_DOCKER_SOCKET=/var/run/docker.sock
SANDBOX_BASE_IMAGE=node:20-slim
SANDBOX_NETWORK=sandbox-net
SANDBOX_MAX_PER_USER=2
SANDBOX_MEMORY_LIMIT_MB=256
SANDBOX_CPU_LIMIT=0.5
SANDBOX_IDLE_TIMEOUT_MS=1800000
SANDBOX_MAX_LIFETIME_MS=14400000
SANDBOX_EXEC_TIMEOUT_MS=30000
```

---

## Summary: Files the Coders Need to Create/Modify

### CREATE (new files)

1. `server/src/services/sandbox/sandbox-service.ts`
   - The core service class that `server/src/routes/sandbox.ts` already imports
   - Must export `SandboxService` with static methods: `createOrGet`, `exec`,
     `streamOutput`, `writeFile`, `readFile`, `listFiles`, `uploadFile`,
     `downloadFile`, `gitClone`, `getStatus`, `destroy`

2. `server/src/services/sandbox/docker-manager.ts`
   - Low-level Docker container lifecycle (create, start, stop, remove, exec)
   - Uses `dockerode` to talk to Docker daemon

3. `server/src/services/sandbox/container-pool.ts` (optional)
   - Pre-warmed container pool for fast startup
   - Manages idle timeout and cleanup

### MODIFY (existing files)

1. `server/src/db/index.ts` -- Add sandbox tables (see section 3)
2. `server/src/config.ts` -- Add sandbox config vars (see section 8)
3. `docker-compose.yml` -- Add Docker socket mount + sandbox network (see section 4)
4. `server/src/routes/agent.ts` -- Add sandbox fast-path (see section 1)
   ONLY if chat-triggered sandbox execution is desired
5. `server/src/services/action-executor.ts` -- Add `sandbox_exec` tool
   ONLY if LLM-triggered sandbox execution is desired

### DO NOT MODIFY

- `server/src/routes/sandbox.ts` -- Already complete, just needs the service
- `server/src/app.ts` -- Sandbox router already registered
- `server/src/middleware/auth.ts` -- Auth works as-is
- `server/src/middleware/validate.ts` -- Validation works as-is
