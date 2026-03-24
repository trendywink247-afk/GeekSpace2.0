// ============================================================
// Sandbox System — TypeScript Types & Interfaces
//
// On-demand Docker containers for per-user code execution.
// Each user gets ONE sandbox shared across all their agents.
// LLM calls still go through the existing waterfall — sandboxes
// are strictly for code execution, file ops, git, and tests.
//
// Tier gating:
//   free         → no sandbox (chat only)
//   intro/pilot  → no sandbox (chat only)
//   monthly      → 64MB / 15min idle  (basic execution)
//   halfyear     → 64MB / 15min idle  (basic execution)
//   yearly       → 128MB / 30min idle (full features)
//   pro          → 128MB / 30min idle / burst to 192MB
//   team         → 256MB / 512MB burst / 2hr idle
// ============================================================

// ── Sandbox Tiers ─────────────────────────────────────────────

/**
 * User plan names — mirrors the `plan` column in `users` and
 * `subscriptions` tables, plus the DELEGATION_LIMITS keys in
 * delegation.ts.
 */
export type UserPlan =
  | 'free'
  | 'intro'
  | 'pilot'
  | 'monthly'
  | 'halfyear'
  | 'yearly'
  | 'pro'
  | 'team';

/**
 * Sandbox access level derived from user plan.
 *   none  — plan has no sandbox access (free/intro/pilot)
 *   basic — limited memory, shorter idle timeout
 *   full  — higher memory, longer idle, burst headroom
 */
export type SandboxTier = 'none' | 'basic' | 'full';

/**
 * Resource limits for a given tier.
 * Memory values are in megabytes. Timeouts are in milliseconds.
 */
export interface TierLimits {
  /** Whether this plan grants sandbox access at all */
  enabled: boolean;

  /** Derived tier for feature gating */
  tier: SandboxTier;

  /** Hard memory cap in MB — container is OOM-killed above this */
  memoryMb: number;

  /** Burst memory allowance in MB (--memory-reservation vs --memory) */
  memoryBurstMb: number;

  /** CPU quota as a fraction of one core (0.5 = half a core) */
  cpuQuota: number;

  /** Max idle time before auto-destroy, in ms */
  idleTimeoutMs: number;

  /** Max wall-clock time for a single exec command, in ms */
  execTimeoutMs: number;

  /** Max concurrent exec commands per sandbox */
  maxConcurrentExec: number;

  /** Disk quota for the workspace volume, in MB */
  diskMb: number;

  /** Whether the sandbox can install packages (npm/pip) */
  canInstallPackages: boolean;

  /** Whether the sandbox has git access */
  canUseGit: boolean;

  /** Whether the sandbox can make outbound HTTP requests */
  canNetworkOut: boolean;

  /** Max sandboxes the user can have (always 1 for now) */
  maxSandboxes: number;

  /** Daily execution-seconds budget (0 = unlimited) */
  dailyExecSecondsLimit: number;
}

/**
 * Tier limits map — keyed by UserPlan.
 * Env var overrides follow the pattern SANDBOX_<PLAN>_<FIELD>.
 *
 * These defaults are deliberately conservative for a 16GB VPS.
 * The sandbox manager reads env overrides at startup.
 */
export const TIER_LIMITS: Record<UserPlan, TierLimits> = {
  free: {
    enabled: false,
    tier: 'none',
    memoryMb: 0,
    memoryBurstMb: 0,
    cpuQuota: 0,
    idleTimeoutMs: 0,
    execTimeoutMs: 0,
    maxConcurrentExec: 0,
    diskMb: 0,
    canInstallPackages: false,
    canUseGit: false,
    canNetworkOut: false,
    maxSandboxes: 0,
    dailyExecSecondsLimit: 0,
  },

  intro: {
    enabled: false,
    tier: 'none',
    memoryMb: 0,
    memoryBurstMb: 0,
    cpuQuota: 0,
    idleTimeoutMs: 0,
    execTimeoutMs: 0,
    maxConcurrentExec: 0,
    diskMb: 0,
    canInstallPackages: false,
    canUseGit: false,
    canNetworkOut: false,
    maxSandboxes: 0,
    dailyExecSecondsLimit: 0,
  },

  pilot: {
    enabled: false,
    tier: 'none',
    memoryMb: 0,
    memoryBurstMb: 0,
    cpuQuota: 0,
    idleTimeoutMs: 0,
    execTimeoutMs: 0,
    maxConcurrentExec: 0,
    diskMb: 0,
    canInstallPackages: false,
    canUseGit: false,
    canNetworkOut: false,
    maxSandboxes: 0,
    dailyExecSecondsLimit: 0,
  },

  monthly: {
    enabled: true,
    tier: 'basic',
    memoryMb: 64,
    memoryBurstMb: 64,        // no burst for basic
    cpuQuota: 0.25,            // quarter core
    idleTimeoutMs: 15 * 60 * 1000,  // 15 min
    execTimeoutMs: 30_000,     // 30s per command
    maxConcurrentExec: 1,
    diskMb: 128,
    canInstallPackages: true,
    canUseGit: false,
    canNetworkOut: false,
    maxSandboxes: 1,
    dailyExecSecondsLimit: 600,  // 10 min total exec per day
  },

  halfyear: {
    enabled: true,
    tier: 'basic',
    memoryMb: 64,
    memoryBurstMb: 64,
    cpuQuota: 0.25,
    idleTimeoutMs: 15 * 60 * 1000,
    execTimeoutMs: 30_000,
    maxConcurrentExec: 1,
    diskMb: 128,
    canInstallPackages: true,
    canUseGit: false,
    canNetworkOut: false,
    maxSandboxes: 1,
    dailyExecSecondsLimit: 600,
  },

  yearly: {
    enabled: true,
    tier: 'full',
    memoryMb: 128,
    memoryBurstMb: 128,
    cpuQuota: 0.5,
    idleTimeoutMs: 30 * 60 * 1000,  // 30 min
    execTimeoutMs: 60_000,     // 60s per command
    maxConcurrentExec: 2,
    diskMb: 256,
    canInstallPackages: true,
    canUseGit: true,
    canNetworkOut: true,
    maxSandboxes: 1,
    dailyExecSecondsLimit: 1800,  // 30 min total exec per day
  },

  pro: {
    enabled: true,
    tier: 'full',
    memoryMb: 128,
    memoryBurstMb: 192,       // burst headroom
    cpuQuota: 0.5,
    idleTimeoutMs: 30 * 60 * 1000,
    execTimeoutMs: 120_000,    // 2 min per command
    maxConcurrentExec: 3,
    diskMb: 512,
    canInstallPackages: true,
    canUseGit: true,
    canNetworkOut: true,
    maxSandboxes: 1,
    dailyExecSecondsLimit: 3600,  // 1 hr total exec per day
  },

  team: {
    enabled: true,
    tier: 'full',
    memoryMb: 256,
    memoryBurstMb: 512,
    cpuQuota: 1.0,             // full core
    idleTimeoutMs: 2 * 60 * 60 * 1000,  // 2 hours
    execTimeoutMs: 300_000,    // 5 min per command
    maxConcurrentExec: 5,
    diskMb: 1024,
    canInstallPackages: true,
    canUseGit: true,
    canNetworkOut: true,
    maxSandboxes: 1,
    dailyExecSecondsLimit: 0,  // unlimited
  },
};

// ── Sandbox Lifecycle ─────────────────────────────────────────

/**
 * Container lifecycle states.
 *   creating   → Docker container being built/started
 *   running    → Container is live, accepting exec commands
 *   idle       → Container is live but no active exec (idle timer ticking)
 *   paused     → Container paused (docker pause) to reclaim CPU
 *   destroying → Teardown in progress
 *   destroyed  → Fully removed, workspace volume deleted
 *   error      → Failed to create or crashed — needs manual cleanup
 */
export type SandboxStatus =
  | 'creating'
  | 'running'
  | 'idle'
  | 'paused'
  | 'destroying'
  | 'destroyed'
  | 'error';

/**
 * Full sandbox state tracked in memory and persisted to SQLite.
 * One row per user (users.id → sandbox_sessions.user_id).
 */
export interface SandboxState {
  /** UUID — primary key in sandbox_sessions table */
  id: string;

  /** Owner — FK to users.id */
  userId: string;

  /** Docker container ID (64-char hex) */
  containerId: string;

  /** Container name (geekspace-sandbox-<userId-prefix>) */
  containerName: string;

  /** Current lifecycle status */
  status: SandboxStatus;

  /** Resolved tier limits for this sandbox */
  tier: SandboxTier;
  limits: TierLimits;

  /** Docker image used (e.g. 'geekspace-sandbox:node20') */
  image: string;

  /** Host-side workspace path (bind mount) */
  workspacePath: string;

  /** Timestamp when the container was created */
  createdAt: string;

  /** Timestamp of the last exec command or terminal interaction */
  lastActivityAt: string;

  /** Total exec-seconds consumed today (for daily budget enforcement) */
  execSecondsToday: number;

  /** Date string (YYYY-MM-DD) for resetting execSecondsToday */
  execBudgetDate: string;

  /** Number of currently running exec commands */
  activeExecCount: number;

  /** Port mapping: container internal port → host port (for SSE streaming) */
  hostPort: number;
}

// ── Exec Commands ─────────────────────────────────────────────

/**
 * Supported execution languages / runtimes.
 * The sandbox image has Node 20 + Python 3.12 preinstalled.
 * 'shell' runs raw bash (for git, package install, etc.)
 */
export type ExecRuntime = 'node' | 'python' | 'shell';

/**
 * A single code execution request sent to the sandbox.
 */
export interface ExecRequest {
  /** Which sandbox to target (resolved from userId) */
  sandboxId: string;

  /** Runtime to use */
  runtime: ExecRuntime;

  /** Code or command to execute */
  code: string;

  /** Working directory inside the container (default: /workspace) */
  cwd?: string;

  /** Environment variables to inject (keys are validated against allowlist) */
  env?: Record<string, string>;

  /** Timeout override in ms (capped by tier limit) */
  timeoutMs?: number;

  /** If true, stream stdout/stderr via SSE instead of buffering */
  stream?: boolean;

  /** Optional label for display in terminal UI */
  label?: string;
}

/**
 * Result of a code execution.
 */
export interface ExecResult {
  /** Exit code (0 = success) */
  exitCode: number;

  /** Combined stdout content */
  stdout: string;

  /** Combined stderr content */
  stderr: string;

  /** Wall-clock execution time in ms */
  durationMs: number;

  /** Whether output was truncated (max 64KB per stream) */
  truncated: boolean;

  /** Whether the command was killed due to timeout */
  timedOut: boolean;

  /** Whether the command was killed due to OOM */
  oomKilled: boolean;

  /** Runtime that was used */
  runtime: ExecRuntime;

  /** The original code/command (for logging) */
  command: string;
}

// ── File Operations ───────────────────────────────────────────

/**
 * File operation types for the workspace filesystem.
 */
export type FileOpType = 'read' | 'write' | 'delete' | 'list' | 'mkdir' | 'stat';

/**
 * A file operation request.
 * Paths are always relative to /workspace inside the container.
 */
export interface FileOp {
  /** Operation type */
  type: FileOpType;

  /** Path relative to /workspace — sanitized to prevent traversal */
  path: string;

  /** File content (for write ops) */
  content?: string;

  /** Encoding (default: utf-8) */
  encoding?: 'utf-8' | 'base64';

  /** Recursive flag (for mkdir and list) */
  recursive?: boolean;
}

/**
 * Result of a file operation.
 */
export interface FileOpResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** For read: file content. For list: JSON array of entries. For stat: JSON metadata */
  data?: string;

  /** Error message if success=false */
  error?: string;

  /** File size in bytes (for stat/read) */
  size?: number;
}

/**
 * Directory listing entry.
 */
export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: string;
}

// ── Terminal Streaming (SSE) ──────────────────────────────────

/**
 * SSE event types pushed to the frontend terminal.
 */
export type TerminalEventType =
  | 'sandbox:creating'
  | 'sandbox:ready'
  | 'sandbox:error'
  | 'sandbox:destroyed'
  | 'exec:start'
  | 'exec:stdout'
  | 'exec:stderr'
  | 'exec:exit'
  | 'exec:timeout'
  | 'exec:oom'
  | 'file:changed'
  | 'idle:warning'
  | 'idle:destroying';

/**
 * A single SSE event sent to the frontend.
 */
export interface TerminalEvent {
  /** Event type for the SSE `event:` field */
  type: TerminalEventType;

  /** Event payload (serialized as JSON in SSE `data:` field) */
  data: {
    /** Optional exec request ID for correlating start/output/exit */
    execId?: string;

    /** Text content (stdout/stderr chunks, status messages) */
    text?: string;

    /** Exit code (for exec:exit) */
    exitCode?: number;

    /** Duration in ms (for exec:exit) */
    durationMs?: number;

    /** Seconds remaining before idle destroy (for idle:warning) */
    idleSecondsRemaining?: number;

    /** Error message (for sandbox:error, exec:timeout, exec:oom) */
    error?: string;

    /** Runtime used (for exec:start) */
    runtime?: ExecRuntime;

    /** Timestamp */
    timestamp: string;
  };
}

// ── Docker Container Config ───────────────────────────────────

/**
 * Configuration passed to dockerode when creating a sandbox container.
 * This is an internal type — not exposed to the API.
 */
export interface ContainerConfig {
  /** Docker image to use */
  image: string;

  /** Container name */
  name: string;

  /** Labels for identification and cleanup */
  labels: Record<string, string>;

  /** Memory limit in bytes */
  memoryBytes: number;

  /** Memory reservation (burst) in bytes */
  memoryReservationBytes: number;

  /** CPU period + quota for --cpus equivalent */
  cpuPeriod: number;
  cpuQuota: number;

  /** Bind mount: host workspace path → /workspace in container */
  workspaceMount: {
    hostPath: string;
    containerPath: string;
  };

  /** Network mode — 'none' for isolated, custom bridge for outbound */
  networkMode: string;

  /** Security options */
  securityOpts: string[];

  /** Capabilities to drop */
  capDrop: string[];

  /** Whether to set --read-only on root fs (workspace is writable via mount) */
  readOnlyRootfs: boolean;

  /** Temp filesystem mounts (for /tmp inside container) */
  tmpfs: Record<string, string>;

  /** User to run as inside the container (non-root) */
  user: string;

  /** Pids limit — prevent fork bombs */
  pidsLimit: number;
}

// ── Sandbox Manager Interface ─────────────────────────────────

/**
 * The public interface that the sandbox manager service exposes.
 * This is what routes and agent services call.
 */
export interface ISandboxManager {
  /**
   * Get or create a sandbox for a user.
   * If a sandbox already exists and is running/idle, return it.
   * If none exists, create one (tier-gated).
   *
   * Throws SandboxError if user's plan has no sandbox access.
   */
  acquire(userId: string, userPlan: UserPlan): Promise<SandboxState>;

  /**
   * Execute code in a user's sandbox.
   * Creates the sandbox first if it doesn't exist.
   */
  exec(userId: string, request: ExecRequest): Promise<ExecResult>;

  /**
   * Execute code with SSE streaming.
   * Returns a readable stream of TerminalEvent objects.
   */
  execStream(userId: string, request: ExecRequest): AsyncGenerator<TerminalEvent>;

  /**
   * Perform a file operation in the user's sandbox workspace.
   */
  fileOp(userId: string, op: FileOp): Promise<FileOpResult>;

  /**
   * Get the current sandbox state for a user (or null if no sandbox).
   */
  getState(userId: string): SandboxState | null;

  /**
   * Destroy a user's sandbox immediately (manual teardown).
   */
  destroy(userId: string): Promise<void>;

  /**
   * Destroy all sandboxes (shutdown hook).
   */
  destroyAll(): Promise<void>;

  /**
   * Get aggregate stats for admin monitoring.
   */
  stats(): SandboxStats;
}

// ── Stats & Monitoring ────────────────────────────────────────

/**
 * Aggregate stats for the admin health endpoint.
 */
export interface SandboxStats {
  /** Number of currently running/idle sandboxes */
  activeSandboxes: number;

  /** Total sandboxes created since server start */
  totalCreated: number;

  /** Total sandboxes destroyed since server start */
  totalDestroyed: number;

  /** Total exec commands run since server start */
  totalExecs: number;

  /** Total exec-seconds consumed since server start */
  totalExecSeconds: number;

  /** Current aggregate memory usage in MB (sum of all active sandboxes) */
  memoryUsageMb: number;

  /** Per-sandbox breakdown */
  sandboxes: SandboxStatEntry[];
}

export interface SandboxStatEntry {
  userId: string;
  sandboxId: string;
  status: SandboxStatus;
  memoryMb: number;
  cpuQuota: number;
  uptimeMs: number;
  execCount: number;
  execSecondsToday: number;
  lastActivityAt: string;
}

// ── Error Types ───────────────────────────────────────────────

/**
 * Sandbox-specific error codes.
 * These map to HTTP status codes in the route handler.
 */
export type SandboxErrorCode =
  | 'SANDBOX_TIER_DENIED'       // 403 — user's plan has no sandbox access
  | 'SANDBOX_LIMIT_REACHED'     // 429 — max sandboxes for this user
  | 'SANDBOX_CREATE_FAILED'     // 500 — Docker API error during creation
  | 'SANDBOX_NOT_FOUND'         // 404 — no active sandbox for this user
  | 'SANDBOX_NOT_READY'         // 409 — sandbox is creating/destroying
  | 'SANDBOX_EXEC_TIMEOUT'      // 408 — command exceeded time limit
  | 'SANDBOX_EXEC_OOM'          // 413 — command killed by OOM
  | 'SANDBOX_EXEC_LIMIT'        // 429 — too many concurrent execs
  | 'SANDBOX_BUDGET_EXHAUSTED'  // 429 — daily exec-seconds budget used up
  | 'SANDBOX_FILE_TRAVERSAL'    // 400 — path traversal attempt blocked
  | 'SANDBOX_FILE_TOO_LARGE'    // 413 — file exceeds size limit
  | 'SANDBOX_DOCKER_ERROR'      // 502 — Docker daemon unreachable
  | 'SANDBOX_DESTROYED';        // 410 — sandbox was destroyed while exec was pending

/**
 * Structured error thrown by the sandbox manager.
 * Route handlers catch this and map errorCode to HTTP status.
 */
export class SandboxError extends Error {
  public readonly errorCode: SandboxErrorCode;
  public readonly httpStatus: number;

  constructor(code: SandboxErrorCode, message: string) {
    super(message);
    this.name = 'SandboxError';
    this.errorCode = code;
    this.httpStatus = SANDBOX_ERROR_HTTP_MAP[code] ?? 500;
  }
}

const SANDBOX_ERROR_HTTP_MAP: Record<SandboxErrorCode, number> = {
  SANDBOX_TIER_DENIED:      403,
  SANDBOX_LIMIT_REACHED:    429,
  SANDBOX_CREATE_FAILED:    500,
  SANDBOX_NOT_FOUND:        404,
  SANDBOX_NOT_READY:        409,
  SANDBOX_EXEC_TIMEOUT:     408,
  SANDBOX_EXEC_OOM:         413,
  SANDBOX_EXEC_LIMIT:       429,
  SANDBOX_BUDGET_EXHAUSTED: 429,
  SANDBOX_FILE_TRAVERSAL:   400,
  SANDBOX_FILE_TOO_LARGE:   413,
  SANDBOX_DOCKER_ERROR:     502,
  SANDBOX_DESTROYED:        410,
};

// ── DB Schema (for sandbox_sessions table) ────────────────────

/**
 * Row shape for the sandbox_sessions SQLite table.
 * Matches the CREATE TABLE in db/index.ts (to be added).
 *
 * CREATE TABLE IF NOT EXISTS sandbox_sessions (
 *   id TEXT PRIMARY KEY,
 *   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *   container_id TEXT NOT NULL DEFAULT '',
 *   container_name TEXT NOT NULL DEFAULT '',
 *   status TEXT NOT NULL DEFAULT 'creating',
 *   tier TEXT NOT NULL DEFAULT 'none',
 *   image TEXT NOT NULL DEFAULT '',
 *   workspace_path TEXT NOT NULL DEFAULT '',
 *   exec_seconds_today REAL DEFAULT 0,
 *   exec_budget_date TEXT DEFAULT (date('now')),
 *   host_port INTEGER DEFAULT 0,
 *   created_at TEXT DEFAULT (datetime('now')),
 *   last_activity_at TEXT DEFAULT (datetime('now')),
 *   destroyed_at TEXT
 * );
 * CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_user ON sandbox_sessions(user_id);
 * CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_status ON sandbox_sessions(status);
 */
export interface SandboxSessionRow {
  id: string;
  user_id: string;
  container_id: string;
  container_name: string;
  status: string;
  tier: string;
  image: string;
  workspace_path: string;
  exec_seconds_today: number;
  exec_budget_date: string;
  host_port: number;
  created_at: string;
  last_activity_at: string;
  destroyed_at: string | null;
}

/**
 * Row shape for the sandbox_exec_log SQLite table.
 * Logs every exec command for auditing and budget tracking.
 *
 * CREATE TABLE IF NOT EXISTS sandbox_exec_log (
 *   id TEXT PRIMARY KEY,
 *   sandbox_id TEXT NOT NULL REFERENCES sandbox_sessions(id),
 *   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *   runtime TEXT NOT NULL DEFAULT 'shell',
 *   command TEXT NOT NULL DEFAULT '',
 *   exit_code INTEGER DEFAULT -1,
 *   duration_ms INTEGER DEFAULT 0,
 *   stdout_bytes INTEGER DEFAULT 0,
 *   stderr_bytes INTEGER DEFAULT 0,
 *   timed_out INTEGER DEFAULT 0,
 *   oom_killed INTEGER DEFAULT 0,
 *   created_at TEXT DEFAULT (datetime('now'))
 * );
 * CREATE INDEX IF NOT EXISTS idx_sandbox_exec_log_sandbox ON sandbox_exec_log(sandbox_id);
 * CREATE INDEX IF NOT EXISTS idx_sandbox_exec_log_user ON sandbox_exec_log(user_id);
 */
export interface SandboxExecLogRow {
  id: string;
  sandbox_id: string;
  user_id: string;
  runtime: string;
  command: string;
  exit_code: number;
  duration_ms: number;
  stdout_bytes: number;
  stderr_bytes: number;
  timed_out: number;
  oom_killed: number;
  created_at: string;
}

// ── Config (env var overrides) ────────────────────────────────

/**
 * Sandbox system configuration — read from env vars at startup.
 * Follows the same optional() / optionalInt() pattern as config.ts.
 *
 * Env vars:
 *   SANDBOX_ENABLED             — master kill switch (default: false)
 *   SANDBOX_IMAGE               — Docker image name (default: geekspace-sandbox:node20)
 *   SANDBOX_WORKSPACE_ROOT      — host dir for workspace mounts (default: /var/lib/geekspace/sandboxes)
 *   SANDBOX_NETWORK             — Docker network name (default: geekspace-sandbox-net)
 *   SANDBOX_MAX_OUTPUT_BYTES    — max stdout/stderr capture (default: 65536)
 *   SANDBOX_CLEANUP_INTERVAL_MS — how often to check for idle sandboxes (default: 60000)
 *   SANDBOX_MAX_FILE_BYTES      — max file size for write ops (default: 1048576 = 1MB)
 *   SANDBOX_PORT_RANGE_START    — start of host port range for SSE (default: 9100)
 *   SANDBOX_PORT_RANGE_END      — end of host port range for SSE (default: 9200)
 *   SANDBOX_MAX_TOTAL_MEMORY_MB — global memory cap across all sandboxes (default: 1024)
 *   SANDBOX_PIDS_LIMIT          — per-container pids limit (default: 64)
 */
export interface SandboxConfig {
  enabled: boolean;
  image: string;
  workspaceRoot: string;
  networkName: string;
  maxOutputBytes: number;
  cleanupIntervalMs: number;
  maxFileBytes: number;
  portRangeStart: number;
  portRangeEnd: number;
  maxTotalMemoryMb: number;
  pidsLimit: number;
}

// ── Env Var Allowlist (for exec commands) ─────────────────────

/**
 * Environment variable keys that are safe to inject into sandbox
 * containers. Everything else is stripped.
 * Mirrors the SAFE_ENV_KEYS pattern in dev-runner.ts.
 */
export const SANDBOX_SAFE_ENV_KEYS: readonly string[] = [
  'PATH',
  'HOME',
  'LANG',
  'TERM',
  'NODE_ENV',
  'NODE_PATH',
  'PYTHONPATH',
  'PYTHONDONTWRITEBYTECODE',
] as const;

/**
 * Environment variable keys that are NEVER allowed in sandboxes,
 * even if explicitly requested. Defense-in-depth against secret leakage.
 */
export const SANDBOX_BLOCKED_ENV_KEYS: readonly string[] = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'ADMIN_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'GROQ_API_KEY',
  'GROQ_API_KEY_2',
  'GROQ_API_KEY_3',
  'OPENROUTER_API_KEY',
  'OPENROUTER_FREE_API_KEY',
  'TOGETHER_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'HF_TOKEN',
  'FAL_KEY',
  'WINDMILL_TOKEN',
  'GITHUB_DEV_TOKEN',
  'GATE_COOKIE_VALUE',
  'DB_PATH',
  'REDIS_URL',
] as const;

// ── Docker Image Spec ─────────────────────────────────────────

/**
 * What the sandbox Docker image must provide.
 * The Dockerfile for geekspace-sandbox:node20 installs:
 *   - Node.js 20 LTS + npm
 *   - Python 3.12 + pip
 *   - git
 *   - common build tools (gcc, make)
 *   - A non-root user 'sandbox' (uid 1000)
 *
 * The entrypoint is a lightweight HTTP server that accepts exec
 * commands and streams output. This avoids docker exec overhead
 * and gives us proper process management inside the container.
 */
export interface SandboxImageSpec {
  /** Image name:tag */
  image: string;

  /** Runtimes available */
  runtimes: ExecRuntime[];

  /** Default working directory */
  workdir: string;

  /** Non-root user the container runs as */
  user: string;

  /** Internal port the exec server listens on */
  internalPort: number;
}

export const DEFAULT_IMAGE_SPEC: SandboxImageSpec = {
  image: 'geekspace-sandbox:node20',
  runtimes: ['node', 'python', 'shell'],
  workdir: '/workspace',
  user: 'sandbox',
  internalPort: 9000,
};

// ── API Request/Response Shapes ───────────────────────────────

/**
 * POST /api/sandbox/exec — Execute code in the user's sandbox.
 */
export interface ApiExecRequest {
  runtime: ExecRuntime;
  code: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  stream?: boolean;
  label?: string;
}

/**
 * POST /api/sandbox/exec — Response (non-streaming).
 */
export interface ApiExecResponse {
  execId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
  timedOut: boolean;
  oomKilled: boolean;
  runtime: ExecRuntime;
}

/**
 * POST /api/sandbox/file — File operation.
 */
export interface ApiFileRequest {
  type: FileOpType;
  path: string;
  content?: string;
  encoding?: 'utf-8' | 'base64';
  recursive?: boolean;
}

/**
 * POST /api/sandbox/file — Response.
 */
export interface ApiFileResponse {
  success: boolean;
  data?: string;
  error?: string;
  size?: number;
}

/**
 * GET /api/sandbox/status — Sandbox status for current user.
 */
export interface ApiSandboxStatus {
  /** Whether the user's plan allows sandbox access */
  available: boolean;

  /** Current sandbox state (null if no sandbox exists) */
  sandbox: {
    id: string;
    status: SandboxStatus;
    tier: SandboxTier;
    createdAt: string;
    lastActivityAt: string;
    execSecondsToday: number;
    dailyLimit: number;
    memoryMb: number;
    idleTimeoutMs: number;
  } | null;

  /** Tier limits for the user's plan */
  limits: TierLimits;
}

/**
 * DELETE /api/sandbox — Destroy the user's sandbox.
 */
export interface ApiSandboxDestroyResponse {
  success: boolean;
  message: string;
}

/**
 * GET /api/admin/sandboxes — Admin stats (requires admin token).
 */
export type ApiAdminSandboxStats = SandboxStats;

// ── Helpers ───────────────────────────────────────────────────

/**
 * Resolve the TierLimits for a given user plan.
 * Falls back to the 'free' tier (no sandbox) for unknown plans.
 */
export function getTierLimits(plan: string): TierLimits {
  return TIER_LIMITS[plan as UserPlan] ?? TIER_LIMITS.free;
}

/**
 * Check if a user plan has sandbox access.
 */
export function hasSandboxAccess(plan: string): boolean {
  return getTierLimits(plan).enabled;
}

/**
 * Sanitize a workspace-relative path to prevent directory traversal.
 * Returns null if the path is unsafe.
 *
 * Rules:
 *   - Must not start with / (it's relative to /workspace)
 *   - Must not contain .. segments
 *   - Must not contain null bytes
 *   - Normalized to remove redundant slashes and ./ segments
 */
export function sanitizePath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;
  if (rawPath.includes('\0')) return null;

  // Normalize: collapse slashes, remove leading slash, remove ./ prefix
  let normalized = rawPath
    .replace(/\\/g, '/')         // Windows paths → Unix
    .replace(/\/+/g, '/')        // collapse multiple slashes
    .replace(/^\/+/, '')         // strip leading slash
    .replace(/^(\.\/)+/, '');    // strip ./ prefix

  // Reject any remaining .. segments
  const segments = normalized.split('/');
  if (segments.some(s => s === '..')) return null;

  // Reject empty path
  if (!normalized || normalized === '.') normalized = '';

  return normalized;
}
