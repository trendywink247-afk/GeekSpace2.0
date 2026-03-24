# Sandbox System — Architecture & API Contract

On-demand Docker containers for per-user code execution in GeekSpace.

## Design Principles

1. **One sandbox per user** — shared across all their agents (Weebo, Forge, Edith, etc.)
2. **LLM calls stay in the waterfall** — sandboxes are for code execution only
3. **Tier-gated** — free/intro/pilot users get chat only; paid tiers unlock sandboxes
4. **VPS-safe** — hard memory caps, CPU limits, global memory budget (default 1GB across all sandboxes on a 16GB VPS)
5. **Auto-destroy on idle** — no orphan containers wasting memory
6. **No secrets in sandboxes** — env var blocklist, non-root user, read-only root fs

## Data Flow

```
User Message (frontend)
    |
    v
[agent.ts POST /api/agent/chat]
    |
    |-- Intent detection (delegation.ts, message-router.ts)
    |-- LLM call (llm.ts waterfall — PicoClaw/Ollama/OpenRouter/Groq/etc.)
    |
    v
LLM Response includes <<<ACTION>>> code block
    |
    v
[action-parser.ts] detects tool: sandbox_exec / sandbox_file
    |
    v
[action-executor.ts] calls SandboxManager
    |
    |-- acquire(userId, userPlan)
    |   |-- Check tier (types.ts → getTierLimits)
    |   |-- Return existing sandbox OR create new one
    |   |-- Docker container via dockerode
    |   |
    |-- exec(userId, { runtime, code })
    |   |-- Validate daily budget (exec_seconds_today)
    |   |-- Docker exec / HTTP to in-container server
    |   |-- Capture stdout/stderr
    |   |-- Log to sandbox_exec_log
    |   |-- Reset idle timer
    |   |
    |-- fileOp(userId, { type, path, content })
    |   |-- Sanitize path (prevent traversal)
    |   |-- Read/write via Docker cp or exec
    |
    v
ExecResult / FileOpResult → formatted into LLM response
    |
    v
Frontend renders terminal output
```

## Direct API Flow (Terminal UI)

```
Frontend Terminal Component
    |
    |-- POST /api/sandbox/exec   (run code)
    |-- POST /api/sandbox/file   (file operations)
    |-- GET  /api/sandbox/status (check sandbox state)
    |-- GET  /api/sandbox/stream (SSE terminal output)
    |-- DELETE /api/sandbox      (manual destroy)
    |
    v
[sandbox routes] → requireAuth → tier check → SandboxManager
```

## Integration with Existing Agent Routing

The sandbox system adds two new action tools to the existing action parser:

```
<<<ACTION>>>
tool: sandbox_exec
runtime: node
code: console.log("Hello from sandbox")
<<<END>>>

<<<ACTION>>>
tool: sandbox_file
type: write
path: src/index.js
content: console.log("hello")
<<<END>>>
```

These are parsed by `action-parser.ts` and executed by `action-executor.ts`,
just like `web_search`, `crawl_url`, `send_telegram`, etc.

The system prompt for agents with sandbox access (Forge, Edith, Jarvis) includes
sandbox tool descriptions when the user's tier allows it.

## Tier Limits

| Plan      | Access | Memory | Burst  | CPU   | Idle Timeout | Exec Timeout | Disk  | Packages | Git | Network | Daily Budget |
|-----------|--------|--------|--------|-------|-------------|-------------|-------|----------|-----|---------|-------------|
| free      | No     | -      | -      | -     | -           | -           | -     | No       | No  | No      | -           |
| intro     | No     | -      | -      | -     | -           | -           | -     | No       | No  | No      | -           |
| pilot     | No     | -      | -      | -     | -           | -           | -     | No       | No  | No      | -           |
| monthly   | Basic  | 64MB   | 64MB   | 0.25  | 15 min      | 30s         | 128MB | Yes      | No  | No      | 10 min      |
| halfyear  | Basic  | 64MB   | 64MB   | 0.25  | 15 min      | 30s         | 128MB | Yes      | No  | No      | 10 min      |
| yearly    | Full   | 128MB  | 128MB  | 0.50  | 30 min      | 60s         | 256MB | Yes      | Yes | Yes     | 30 min      |
| pro       | Full   | 128MB  | 192MB  | 0.50  | 30 min      | 2 min       | 512MB | Yes      | Yes | Yes     | 1 hr        |
| team      | Full   | 256MB  | 512MB  | 1.00  | 2 hr        | 5 min       | 1GB   | Yes      | Yes | Yes     | Unlimited   |

## API Endpoints

### `POST /api/sandbox/exec`

Execute code in the user's sandbox. Creates the sandbox if it does not exist.

**Auth**: `requireAuth` (JWT bearer token)

**Request body**:
```json
{
  "runtime": "node",
  "code": "console.log('hello')",
  "cwd": "/workspace/src",
  "timeoutMs": 10000,
  "stream": false,
  "label": "Run tests"
}
```

| Field     | Type   | Required | Description                                    |
|-----------|--------|----------|------------------------------------------------|
| runtime   | string | Yes      | `"node"`, `"python"`, or `"shell"`             |
| code      | string | Yes      | Code or shell command to execute                |
| cwd       | string | No       | Working dir inside container (default `/workspace`) |
| timeoutMs | number | No       | Override timeout (capped by tier limit)         |
| stream    | bool   | No       | If true, returns SSE stream instead of buffer   |
| label     | string | No       | Display label for terminal UI                   |

**Response (non-streaming)**:
```json
{
  "execId": "uuid",
  "exitCode": 0,
  "stdout": "hello\n",
  "stderr": "",
  "durationMs": 42,
  "truncated": false,
  "timedOut": false,
  "oomKilled": false,
  "runtime": "node"
}
```

**Response (streaming, `stream: true`)**:
Returns SSE event stream. Client connects via EventSource or fetch.

```
event: exec:start
data: {"execId":"uuid","runtime":"node","timestamp":"..."}

event: exec:stdout
data: {"execId":"uuid","text":"hello\n","timestamp":"..."}

event: exec:exit
data: {"execId":"uuid","exitCode":0,"durationMs":42,"timestamp":"..."}
```

**Error codes**:

| HTTP | Code                     | Meaning                        |
|------|--------------------------|--------------------------------|
| 403  | SANDBOX_TIER_DENIED      | Plan has no sandbox access     |
| 408  | SANDBOX_EXEC_TIMEOUT     | Command exceeded time limit    |
| 409  | SANDBOX_NOT_READY        | Sandbox is creating/destroying |
| 413  | SANDBOX_EXEC_OOM         | Command killed by OOM          |
| 429  | SANDBOX_EXEC_LIMIT       | Too many concurrent execs      |
| 429  | SANDBOX_BUDGET_EXHAUSTED | Daily exec budget used up      |
| 502  | SANDBOX_DOCKER_ERROR     | Docker daemon unreachable      |

### `POST /api/sandbox/file`

Read, write, delete, list, mkdir, or stat files in the workspace.

**Auth**: `requireAuth`

**Request body**:
```json
{
  "type": "write",
  "path": "src/index.js",
  "content": "console.log('hello')",
  "encoding": "utf-8",
  "recursive": false
}
```

| Field     | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| type      | string | Yes      | `read`, `write`, `delete`, `list`, `mkdir`, `stat` |
| path      | string | Yes      | Relative to /workspace (sanitized)       |
| content   | string | No       | File content (for write)                 |
| encoding  | string | No       | `utf-8` (default) or `base64`            |
| recursive | bool   | No       | Recursive for mkdir/list                 |

**Response**:
```json
{
  "success": true,
  "data": "console.log('hello')",
  "size": 22
}
```

Path traversal attempts return `400 SANDBOX_FILE_TRAVERSAL`.
Files larger than 1MB return `413 SANDBOX_FILE_TOO_LARGE`.

### `GET /api/sandbox/status`

Get the current sandbox state for the authenticated user.

**Auth**: `requireAuth`

**Response**:
```json
{
  "available": true,
  "sandbox": {
    "id": "uuid",
    "status": "idle",
    "tier": "full",
    "createdAt": "2026-03-23T10:00:00Z",
    "lastActivityAt": "2026-03-23T10:05:00Z",
    "execSecondsToday": 120,
    "dailyLimit": 3600,
    "memoryMb": 128,
    "idleTimeoutMs": 1800000
  },
  "limits": { "...TierLimits object..." }
}
```

If the user has no sandbox, `sandbox` is `null`.
If the user's plan does not allow sandboxes, `available` is `false`.

### `GET /api/sandbox/stream`

SSE endpoint for real-time terminal output. Stays open as long as the sandbox
exists. Receives all events: exec output, idle warnings, sandbox lifecycle.

**Auth**: `requireAuth` (via query param `token=<jwt>` for EventSource compat)

**SSE Events**: See `TerminalEventType` in types.ts.

### `DELETE /api/sandbox`

Manually destroy the user's sandbox.

**Auth**: `requireAuth`

**Response**:
```json
{
  "success": true,
  "message": "Sandbox destroyed"
}
```

### `GET /api/admin/sandboxes`

Admin-only: aggregate stats for all active sandboxes.

**Auth**: `X-Admin-Token` header (same pattern as `/api/health/detailed`)

**Response**: `SandboxStats` object (see types.ts).

## Security Model

### What is isolated

- Each sandbox runs in its own Docker container
- Containers run as non-root user `sandbox` (uid 1000)
- Root filesystem is read-only (only /workspace and /tmp are writable)
- Capabilities dropped: all except minimal set needed for code execution
- `--security-opt no-new-privileges` (matches existing container policy)
- PID limit: 64 (prevents fork bombs)
- No access to Docker socket
- No access to host network (network mode `none` for basic tier, restricted bridge for full tier)

### What is shared

- The workspace volume persists across exec calls within the same sandbox session
- All agents for the same user share the same sandbox (Forge writes code, Edith reviews it, etc.)
- The sandbox exec log is shared with the admin dashboard

### Env var protection

Two layers of defense against secret leakage:

1. **Allowlist** (`SANDBOX_SAFE_ENV_KEYS`): Only these env vars are passed into the container
2. **Blocklist** (`SANDBOX_BLOCKED_ENV_KEYS`): These are rejected even if explicitly requested in the exec env field

### Path traversal protection

`sanitizePath()` in types.ts validates all file operation paths:
- Must not start with `/`
- Must not contain `..` segments
- Must not contain null bytes
- Normalized to remove redundant slashes

### Resource protection (VPS-safe)

- Global memory budget: 1GB default across all sandboxes (configurable via `SANDBOX_MAX_TOTAL_MEMORY_MB`)
- Per-container hard memory cap with OOM-kill
- CPU quota prevents any single sandbox from starving the VPS
- Daily exec-seconds budget prevents runaway usage
- Idle timeout auto-destroys unused sandboxes
- Cleanup interval (60s) catches any missed idle timeouts

## Database Schema

Two new tables (added via migration in db/index.ts):

### `sandbox_sessions`

Tracks sandbox lifecycle. One active row per user at most.

| Column              | Type | Notes                                        |
|---------------------|------|----------------------------------------------|
| id                  | TEXT | PK, UUID                                     |
| user_id             | TEXT | FK to users.id, indexed                      |
| container_id        | TEXT | Docker container ID (64-char hex)            |
| container_name      | TEXT | Friendly name (geekspace-sandbox-<prefix>)   |
| status              | TEXT | creating/running/idle/paused/destroying/destroyed/error |
| tier                | TEXT | none/basic/full                              |
| image               | TEXT | Docker image used                            |
| workspace_path      | TEXT | Host-side workspace mount path               |
| exec_seconds_today  | REAL | Accumulated exec time for budget enforcement |
| exec_budget_date    | TEXT | Date for resetting exec_seconds_today        |
| host_port           | INT  | Mapped host port for SSE                     |
| created_at          | TEXT | datetime('now')                              |
| last_activity_at    | TEXT | Updated on every exec                        |
| destroyed_at        | TEXT | Nullable, set on teardown                    |

### `sandbox_exec_log`

Audit log for every exec command.

| Column        | Type | Notes                              |
|---------------|------|------------------------------------|
| id            | TEXT | PK, UUID                           |
| sandbox_id    | TEXT | FK to sandbox_sessions.id          |
| user_id       | TEXT | FK to users.id, indexed            |
| runtime       | TEXT | node/python/shell                  |
| command       | TEXT | The code/command that was run       |
| exit_code     | INT  | Process exit code                  |
| duration_ms   | INT  | Wall-clock execution time          |
| stdout_bytes  | INT  | Size of captured stdout            |
| stderr_bytes  | INT  | Size of captured stderr            |
| timed_out     | INT  | 0 or 1                             |
| oom_killed    | INT  | 0 or 1                             |
| created_at    | TEXT | datetime('now')                    |

## Env Vars

All sandbox configuration is optional with safe defaults.

| Env Var                       | Default                           | Description                                |
|-------------------------------|-----------------------------------|--------------------------------------------|
| SANDBOX_ENABLED               | false                             | Master kill switch                         |
| SANDBOX_IMAGE                 | geekspace-sandbox:node20          | Docker image for sandbox containers        |
| SANDBOX_WORKSPACE_ROOT        | /var/lib/geekspace/sandboxes      | Host dir for workspace bind mounts         |
| SANDBOX_NETWORK               | geekspace-sandbox-net             | Docker network for sandboxes               |
| SANDBOX_MAX_OUTPUT_BYTES      | 65536                             | Max stdout/stderr capture per exec         |
| SANDBOX_CLEANUP_INTERVAL_MS   | 60000                             | Idle sandbox check interval                |
| SANDBOX_MAX_FILE_BYTES        | 1048576                           | Max file size for write ops (1MB)          |
| SANDBOX_PORT_RANGE_START      | 9100                              | Start of host port range for SSE           |
| SANDBOX_PORT_RANGE_END        | 9200                              | End of host port range for SSE             |
| SANDBOX_MAX_TOTAL_MEMORY_MB   | 1024                              | Global memory cap across all sandboxes     |
| SANDBOX_PIDS_LIMIT            | 64                                | Per-container PID limit                    |

## File Organization

```
server/src/services/sandbox/
  types.ts        ← All interfaces, types, tier limits, helpers (this PR)
  README.md       ← This file (this PR)
  manager.ts      ← SandboxManager: lifecycle, acquire, destroy, idle cleanup
  executor.ts     ← exec() and execStream(): run code, capture output
  files.ts        ← fileOp(): read/write/delete/list/mkdir/stat
  docker.ts       ← Thin dockerode wrapper: create, start, stop, remove, inspect
  config.ts       ← Read env vars, merge with tier defaults
  stream.ts       ← SSE event formatting and broadcast

server/src/routes/
  sandbox.ts      ← Express router: /api/sandbox/* endpoints

server/src/db/index.ts
  (migration)     ← sandbox_sessions + sandbox_exec_log tables
```

## Implementation Notes for Coders

### dockerode usage

```typescript
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Create container
const container = await docker.createContainer({
  Image: config.image,
  name: containerName,
  HostConfig: {
    Memory: limits.memoryMb * 1024 * 1024,
    MemoryReservation: limits.memoryBurstMb * 1024 * 1024,
    CpuPeriod: 100000,
    CpuQuota: Math.floor(limits.cpuQuota * 100000),
    NetworkMode: tierAllowsNetwork ? config.networkName : 'none',
    SecurityOpt: ['no-new-privileges'],
    CapDrop: ['ALL'],
    ReadonlyRootfs: true,
    Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=32m' },
    PidsLimit: config.pidsLimit,
    Binds: [`${hostWorkspacePath}:/workspace:rw`],
    PortBindings: { '9000/tcp': [{ HostPort: String(hostPort) }] },
  },
  User: 'sandbox',
  WorkingDir: '/workspace',
  Labels: {
    'geekspace.sandbox': 'true',
    'geekspace.user': userId,
    'geekspace.tier': tier,
  },
});
```

### Idle cleanup loop

```typescript
// Runs every SANDBOX_CLEANUP_INTERVAL_MS
setInterval(() => {
  for (const [userId, state] of activeSandboxes) {
    const idleMs = Date.now() - new Date(state.lastActivityAt).getTime();
    if (idleMs > state.limits.idleTimeoutMs) {
      // Warn at 80% of timeout, destroy at 100%
      destroy(userId);
    }
  }
}, config.cleanupIntervalMs);
```

### Daily budget enforcement

```typescript
function checkDailyBudget(state: SandboxState, requestedMs: number): void {
  const limits = state.limits;
  if (limits.dailyExecSecondsLimit === 0) return; // unlimited

  // Reset if date changed
  const today = new Date().toISOString().slice(0, 10);
  if (state.execBudgetDate !== today) {
    state.execSecondsToday = 0;
    state.execBudgetDate = today;
  }

  const usedSeconds = state.execSecondsToday;
  const limitSeconds = limits.dailyExecSecondsLimit;
  if (usedSeconds >= limitSeconds) {
    throw new SandboxError('SANDBOX_BUDGET_EXHAUSTED',
      `Daily execution budget exhausted (${usedSeconds}s / ${limitSeconds}s)`);
  }
}
```

### Integration with action-executor.ts

The action executor already handles tools like `web_search`, `crawl_url`, etc.
Add two new cases:

```typescript
case 'sandbox_exec': {
  const { runtime, code, cwd } = parsed;
  const result = await sandboxManager.exec(userId, { sandboxId: '', runtime, code, cwd });
  return { tool: 'sandbox_exec', success: result.exitCode === 0, content: result.stdout || result.stderr };
}

case 'sandbox_file': {
  const { type, path, content } = parsed;
  const result = await sandboxManager.fileOp(userId, { type, path, content });
  return { tool: 'sandbox_file', success: result.success, content: result.data || result.error || '' };
}
```

### System prompt injection

When a user's tier allows sandbox access, the system prompt (built in agent.ts
`buildSystemPrompt()`) includes the sandbox tools:

```
<<<ACTION>>>
tool: sandbox_exec
runtime: node
code: your javascript code here
<<<END>>>

<<<ACTION>>>
tool: sandbox_file
type: write
path: relative/path/to/file.js
content: file content here
<<<END>>>
```

Only Forge, Edith, and Jarvis get sandbox tools injected. Weebo, Aria, Echo,
Cal, Pulse, and Nova do not execute code.

## Startup & Shutdown

### Startup

1. Read SANDBOX_ENABLED env var. If false, skip all sandbox initialization
2. Ensure workspace root directory exists
3. Create Docker network if it does not exist
4. Query sandbox_sessions for any rows with status != 'destroyed'
5. For each stale row: check if container still exists in Docker
   - If yes and running: re-register in memory, resume idle timer
   - If no or stopped: mark as destroyed in DB, clean up workspace dir
6. Start idle cleanup interval

### Shutdown (SIGTERM/SIGINT)

1. Stop accepting new exec requests
2. For each active sandbox:
   - Send `idle:destroying` SSE event
   - Kill running exec processes
   - Stop and remove container
   - Update DB row to status='destroyed'
3. Do NOT delete workspace directories on graceful shutdown (they survive restarts)

### Crash Recovery

On startup, the reconciliation in step 4-5 handles crash recovery. Containers
that were running when the server crashed are either re-adopted or cleaned up.
The workspace directories persist on the host filesystem and are re-mounted if
the sandbox is re-created.
