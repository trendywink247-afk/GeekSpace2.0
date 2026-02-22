// ============================================================
// DevClaw Bridge — Allowlisted command runner
// ============================================================

import { exec } from 'child_process';
import { config } from '../config.js';

/**
 * Hardcoded allowlist — never accept command strings from user input.
 * Keys are the only valid input; values are the actual shell commands.
 */
export const COMMAND_ALLOWLIST: Record<string, string> = {
  lint: 'npm run lint',
  test: 'npm --prefix server test',
  build: 'npm run build && cd server && npm run build',
  typecheck: 'cd server && npx tsc --noEmit',
  e2e: 'npx playwright test --project=chromium',
} as const;

const ALLOWED_KEYS = Object.keys(COMMAND_ALLOWLIST) as (keyof typeof COMMAND_ALLOWLIST)[];

/**
 * Type guard: is this key in the allowlist?
 */
export function isAllowedCommand(key: string): key is keyof typeof COMMAND_ALLOWLIST {
  return ALLOWED_KEYS.includes(key);
}

/**
 * Env vars that are safe to pass to child processes.
 * Everything else is stripped to prevent secret leakage.
 */
const SAFE_ENV_KEYS = ['PATH', 'HOME', 'NODE_ENV', 'DB_PATH', 'npm_config_cache'];

function getSafeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key]) {
      env[key] = process.env[key]!;
    }
  }
  // Always set TEST_MODE for test commands
  env.TEST_MODE = 'true';
  return env;
}

const MAX_OUTPUT_CHARS = 5000;

export interface RunResult {
  exitCode: number;
  output: string;
  durationMs: number;
  truncated: boolean;
}

/**
 * Run an allowlisted command. Rejects if the key is not in the allowlist.
 * Uses shell execution (needed for compound `&&` commands) but the command
 * string comes exclusively from the hardcoded allowlist, never from input.
 */
export function runAllowlistedCommand(key: string): Promise<RunResult> {
  if (!isAllowedCommand(key)) {
    return Promise.reject(new Error(`Command not allowed: ${key}`));
  }

  const command = COMMAND_ALLOWLIST[key];
  const timeoutMs = config.devRunnerTimeoutMs;
  const start = Date.now();

  return new Promise((resolve) => {
    const child = exec(command, {
      cwd: process.cwd(),
      env: getSafeEnv(),
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB
      shell: '/bin/bash',
    }, (error, stdout, stderr) => {
      const durationMs = Date.now() - start;
      let output = (stdout || '') + (stderr ? '\n--- stderr ---\n' + stderr : '');
      let truncated = false;

      if (output.length > MAX_OUTPUT_CHARS) {
        output = '...[truncated]\n' + output.slice(-MAX_OUTPUT_CHARS);
        truncated = true;
      }

      resolve({
        exitCode: error?.code ?? (child.exitCode ?? 0),
        output,
        durationMs,
        truncated,
      });
    });
  });
}
