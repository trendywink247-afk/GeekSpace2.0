// ============================================================
// DevClaw Bridge — GitHub PR creation via `gh` CLI
// ============================================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

/** Branches that can never be created or pushed to */
const PROTECTED_BRANCHES = ['main', 'master', 'live-production'];

/** Max branch name length */
const MAX_BRANCH_LENGTH = 100;

/** Regex: alphanumeric, hyphens, underscores, slashes */
const BRANCH_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/;

/**
 * Validate a branch name. Returns null if valid, or an error string if invalid.
 */
export function validateBranchName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Branch name cannot be empty';
  }
  if (name.length > MAX_BRANCH_LENGTH) {
    return `Branch name too long (max ${MAX_BRANCH_LENGTH} chars)`;
  }
  if (!BRANCH_NAME_RE.test(name)) {
    return 'Branch name may only contain alphanumeric characters, hyphens, underscores, and slashes';
  }
  if (PROTECTED_BRANCHES.includes(name)) {
    return `Cannot create protected branch: ${name}`;
  }
  return null;
}

/**
 * Env vars safe to pass to git/gh child processes.
 * GH_TOKEN is added for gh CLI authentication.
 */
function getGitEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.HOME) env.HOME = process.env.HOME;
  if (config.githubDevToken) env.GH_TOKEN = config.githubDevToken;
  return env;
}

/** Git working directory — /repo is the host mount inside Docker */
const GIT_CWD = '/repo';

/**
 * Run a git command with execFile (no shell injection possible).
 */
async function git(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: GIT_CWD,
    env: getGitEnv(),
    timeout: 30000,
  });
  return stdout.trim();
}

/**
 * Run a gh CLI command with execFile.
 */
async function gh(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('gh', args, {
    cwd: GIT_CWD,
    env: getGitEnv(),
    timeout: 30000,
  });
  return stdout.trim();
}

export interface GitPushResult {
  branch: string;
  remote: string;
  sha: string;
}

/**
 * Push an existing local branch to origin.
 * The branch must already exist locally (e.g. created by OpenClaw).
 */
export async function pushBranch(branchName: string): Promise<GitPushResult> {
  const branchError = validateBranchName(branchName);
  if (branchError) throw new Error(branchError);

  if (!config.githubDevToken) {
    throw new Error('GITHUB_DEV_TOKEN not configured');
  }

  // Ensure remote URL uses the token for auth
  const remoteUrl = await git('remote', 'get-url', 'origin');
  const tokenUrl = injectToken(remoteUrl, config.githubDevToken);
  if (tokenUrl !== remoteUrl) {
    await git('remote', 'set-url', 'origin', tokenUrl);
  }

  try {
    await git('push', '-u', 'origin', branchName);
    const sha = await git('rev-parse', '--short', branchName);
    return { branch: branchName, remote: 'origin', sha };
  } finally {
    // Restore original remote URL (don't leave token in config)
    if (tokenUrl !== remoteUrl) {
      await git('remote', 'set-url', 'origin', remoteUrl).catch(() => {});
    }
  }
}

/**
 * Inject a token into a GitHub HTTPS remote URL.
 * e.g. https://github.com/user/repo.git → https://TOKEN@github.com/user/repo.git
 */
function injectToken(url: string, token: string): string {
  // Already has a token/credentials
  if (url.includes('@')) {
    return url.replace(/\/\/[^@]+@/, `//${token}@`);
  }
  // Plain HTTPS
  if (url.startsWith('https://')) {
    return url.replace('https://', `https://${token}@`);
  }
  return url;
}

export interface CreatePRResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
}

/**
 * Create a new branch and open a PR.
 * If sourceBranch is provided, branches from that; otherwise from the current HEAD.
 */
export async function createDevPR(
  branchName: string,
  title: string,
  body: string,
  sourceBranch?: string,
): Promise<CreatePRResult> {
  // 1. Validate branch
  const branchError = validateBranchName(branchName);
  if (branchError) throw new Error(branchError);

  if (!config.githubDevToken) {
    throw new Error('GITHUB_DEV_TOKEN not configured');
  }

  const base = sourceBranch || 'feature/testing-ci';
  let branchCreated = false;

  // Inject token for push
  const remoteUrl = await git('remote', 'get-url', 'origin');
  const tokenUrl = injectToken(remoteUrl, config.githubDevToken);
  if (tokenUrl !== remoteUrl) {
    await git('remote', 'set-url', 'origin', tokenUrl);
  }

  try {
    // 2. Fetch the base branch
    await git('fetch', 'origin', base);

    // 3. Create new branch from the base
    await git('checkout', '-b', branchName, `origin/${base}`);
    branchCreated = true;

    // 4. Push the branch
    await git('push', 'origin', branchName);

    // 5. Create the PR
    const prOutput = await gh(
      'pr', 'create',
      '--title', title,
      '--body', body,
      '--base', 'main',
      '--head', branchName,
    );

    // gh pr create outputs the PR URL
    const prUrl = prOutput.trim();
    const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : 0;

    return { prUrl, prNumber, branchName };
  } catch (err) {
    // Cleanup: delete local branch on failure
    if (branchCreated) {
      try {
        await git('checkout', '-');
        await git('branch', '-D', branchName);
      } catch { /* cleanup best-effort */ }
    }
    throw err;
  } finally {
    // Restore original remote URL
    if (tokenUrl !== remoteUrl) {
      await git('remote', 'set-url', 'origin', remoteUrl).catch(() => {});
    }
  }
}
