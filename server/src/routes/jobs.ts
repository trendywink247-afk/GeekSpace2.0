// ============================================================
// Jobs API Routes — Phase 80
//
// GET /api/jobs/:id — poll async job status
//   Returns job status (pending | processing | done | failed)
//   and result/error when complete.
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getJobStatus } from '../services/job-queue.js';

export const jobsRouter = Router();

// GET /api/jobs/:id — poll a job's status
jobsRouter.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const job = await getJobStatus(id);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Security: users can only poll their own jobs
  if (job.userId && job.userId !== userId) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.status === 'done' ? job.result : undefined,
    error: job.status === 'failed' ? job.error : undefined,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});
