// ============================================================
// DevClaw Bridge — Admin-only developer API
// ============================================================

import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAdminToken } from '../middleware/auth.js';
import { logDevAction, completeDevAction, getDevAuditLog } from '../services/dev-audit.js';
import { isAllowedCommand, runAllowlistedCommand, COMMAND_ALLOWLIST } from '../services/dev-runner.js';
import { createDevPR, validateBranchName } from '../services/dev-github.js';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

export const devRouter = Router();

// All dev routes require admin token
devRouter.use(requireAdminToken);

// ---- GET /status — system + git info ----
devRouter.get('/status', async (_req, res) => {
  const auditId = logDevAction('status');
  try {
    const [shaResult, branchResult] = await Promise.all([
      execFileAsync('git', ['rev-parse', '--short', 'HEAD']).catch(() => ({ stdout: 'unknown' })),
      execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ({ stdout: 'unknown' })),
    ]);

    const result = {
      version: '3.0.0',
      gitSha: shaResult.stdout.trim(),
      branch: branchResult.stdout.trim(),
      uptime: process.uptime(),
      nodeVersion: process.version,
    };

    completeDevAction(auditId, 'success');
    res.json(result);
  } catch (err) {
    completeDevAction(auditId, 'failed', String(err));
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ---- POST /run-checks — run an allowlisted dev command ----
devRouter.post('/run-checks', async (req, res) => {
  const { command } = req.body || {};

  if (!command || typeof command !== 'string') {
    res.status(400).json({ error: 'Missing required field: command' });
    return;
  }

  if (!isAllowedCommand(command)) {
    res.status(400).json({
      error: `Unknown command: ${command}`,
      allowed: Object.keys(COMMAND_ALLOWLIST),
    });
    return;
  }

  const auditId = logDevAction('run-checks', { command });
  try {
    const result = await runAllowlistedCommand(command);
    const status = result.exitCode === 0 ? 'success' : 'failed';
    completeDevAction(auditId, status, `exit=${result.exitCode} duration=${result.durationMs}ms`);
    res.json({
      command,
      ...result,
    });
  } catch (err) {
    completeDevAction(auditId, 'failed', String(err));
    res.status(500).json({ error: 'Command execution failed', details: String(err) });
  }
});

// ---- POST /create-pr — create a branch + PR from feature/testing-ci ----
devRouter.post('/create-pr', async (req, res) => {
  if (!config.githubDevToken) {
    res.status(503).json({ error: 'GITHUB_DEV_TOKEN not configured' });
    return;
  }

  const { branchName, title, body } = req.body || {};

  if (!branchName || typeof branchName !== 'string') {
    res.status(400).json({ error: 'Missing required field: branchName' });
    return;
  }

  const branchError = validateBranchName(branchName);
  if (branchError) {
    res.status(400).json({ error: branchError });
    return;
  }

  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Missing required field: title' });
    return;
  }

  const auditId = logDevAction('create-pr', { branchName, title });
  try {
    const result = await createDevPR(branchName, title, body || '');
    completeDevAction(auditId, 'success', `PR #${result.prNumber}`, result.prUrl);
    res.json(result);
  } catch (err) {
    completeDevAction(auditId, 'failed', String(err));
    res.status(500).json({ error: 'Failed to create PR', details: String(err) });
  }
});

// ---- GET /audit-log — recent dev actions ----
devRouter.get('/audit-log', (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
  const entries = getDevAuditLog(limit);
  res.json({ entries, count: entries.length });
});
