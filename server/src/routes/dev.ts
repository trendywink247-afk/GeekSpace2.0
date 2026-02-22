// ============================================================
// DevClaw Bridge — Admin-only developer API
// ============================================================

import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAdminToken } from '../middleware/auth.js';
import { logDevAction, completeDevAction, getDevAuditLog } from '../services/dev-audit.js';

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

// ---- GET /audit-log — recent dev actions ----
devRouter.get('/audit-log', (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
  const entries = getDevAuditLog(limit);
  res.json({ entries, count: entries.length });
});
