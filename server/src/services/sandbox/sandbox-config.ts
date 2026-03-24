// ============================================================
// Sandbox Config — Tier limits and environment configuration
//
// Defines per-plan resource limits for Docker sandboxes.
// Free/Intro users have no sandbox access. Monthly+ plans
// get progressively more resources (memory, CPU, idle time).
//
// Environment overrides allow ops to tune limits without
// code changes (same pattern as config.ts optional/optionalInt).
// ============================================================

import { logger } from '../../logger.js';

// ── Env helpers (mirrors config.ts pattern) ─────────────────

function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function intEnv(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

// ── Tier resource definitions ───────────────────────────────

export interface TierLimits {
  enabled: true;
  memoryMB: number;
  burstMB: number;
  idleMinutes: number;
  cpuCores: number;
  hasBrowser: boolean;
  maxFiles: number;
  maxFileSizeMB: number;
}

interface TierDisabled {
  enabled: false;
}

type TierEntry = TierLimits | TierDisabled;

export const SANDBOX_TIERS: Record<string, TierEntry> = {
  free:    { enabled: false },
  intro:   { enabled: false },
  monthly: { enabled: true, memoryMB: 128, burstMB: 256, idleMinutes: 30,  cpuCores: 0.5, hasBrowser: false, maxFiles: 50,  maxFileSizeMB: 5 },
  yearly:  { enabled: true, memoryMB: 128, burstMB: 256, idleMinutes: 30,  cpuCores: 0.5, hasBrowser: false, maxFiles: 50,  maxFileSizeMB: 5 },
  pro:     { enabled: true, memoryMB: 256, burstMB: 512, idleMinutes: 60,  cpuCores: 1.0, hasBrowser: true,  maxFiles: 200, maxFileSizeMB: 10 },
  team:    { enabled: true, memoryMB: 256, burstMB: 512, idleMinutes: 120, cpuCores: 1.0, hasBrowser: true,  maxFiles: 500, maxFileSizeMB: 25 },
} as const;

// ── Global sandbox config (env-overridable) ─────────────────

export const SANDBOX_CONFIG = {
  dockerSocket:             env('DOCKER_SOCKET', '/var/run/docker.sock'),
  sandboxImage:             env('SANDBOX_IMAGE', 'geekspace-sandbox:latest'),
  networkName:              env('SANDBOX_NETWORK', 'geekspace-sandbox-net'),
  maxConcurrentSandboxes:   intEnv('MAX_SANDBOXES', 40),
  idleCheckIntervalMs:      60_000,      // check for idle sandboxes every minute
  maxExecTimeoutMs:         300_000,     // 5 min max per exec
  terminalHistorySize:      100,         // last 100 events buffered
} as const;

// ── Public API ──────────────────────────────────────────────

/**
 * Get the resource limits for a given subscription plan.
 * Returns null if the plan has no sandbox access.
 */
export function getTierLimits(plan: string): TierLimits | null {
  const entry = SANDBOX_TIERS[plan];
  if (!entry || !entry.enabled) return null;
  return entry as TierLimits;
}

/**
 * Check whether a plan is allowed to use sandboxes at all.
 */
export function canUseSandbox(plan: string): boolean {
  const entry = SANDBOX_TIERS[plan];
  return !!entry && entry.enabled;
}

/**
 * Build a safe set of environment variables to inject into
 * sandbox containers. Never passes secrets — only runtime
 * metadata the sandbox process needs (user ID, tier, limits).
 */
export function getSandboxEnvVars(userId: string, plan: string): Record<string, string> {
  const limits = getTierLimits(plan);
  if (!limits) {
    logger.warn({ userId, plan }, 'getSandboxEnvVars called for disabled tier');
    return {};
  }

  return {
    SANDBOX_USER_ID:        userId,
    SANDBOX_TIER:           plan,
    SANDBOX_MEMORY_MB:      String(limits.memoryMB),
    SANDBOX_BURST_MB:       String(limits.burstMB),
    SANDBOX_CPU_CORES:      String(limits.cpuCores),
    SANDBOX_MAX_FILES:      String(limits.maxFiles),
    SANDBOX_MAX_FILE_SIZE:  String(limits.maxFileSizeMB),
    SANDBOX_HAS_BROWSER:    limits.hasBrowser ? '1' : '0',
    SANDBOX_IDLE_MINUTES:   String(limits.idleMinutes),
    // Never pass JWT secrets, DB paths, API keys, etc.
  };
}
