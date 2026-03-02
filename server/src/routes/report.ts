// ============================================================
// Report Routes — Phase 82
//
// POST /api/report — flag an AI response for review
//   Body: { messageContent, reason, additionalInfo? }
//   Reasons: harmful | inaccurate | inappropriate | other
//
// GET /api/report — list the reporter's own reports
//
// Admin: GET /api/report/admin — all open reports (admin only)
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';

export const reportRouter = Router();

const VALID_REASONS = ['harmful', 'inaccurate', 'inappropriate', 'other'] as const;
type ReportReason = typeof VALID_REASONS[number];

// ---- POST /report — submit a new report ----

reportRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { messageContent, reason, additionalInfo } = req.body as {
    messageContent?: string;
    reason?: string;
    additionalInfo?: string;
  };

  if (!messageContent?.trim()) {
    res.status(400).json({ error: 'messageContent is required' });
    return;
  }

  if (!reason || !VALID_REASONS.includes(reason as ReportReason)) {
    res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
    return;
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO reports (id, reporter_id, message_content, reason, additional_info, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'open', datetime('now'))
  `).run(id, userId, messageContent.trim().slice(0, 2000), reason, (additionalInfo || '').slice(0, 500));

  logger.info({ userId, reportId: id, reason }, 'AI response reported');

  res.status(201).json({ reportId: id, status: 'received', message: 'Thank you — your report has been submitted for review.' });
});

// ---- GET /report — list caller's own reports ----

reportRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const reports = db.prepare(`
    SELECT id, reason, status, created_at
    FROM reports
    WHERE reporter_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId);

  res.json({ reports, count: reports.length });
});
