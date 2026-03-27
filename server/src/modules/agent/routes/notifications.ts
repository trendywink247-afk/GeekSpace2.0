// ============================================================
// Agent Notifications Routes — /api/agent/notifications
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import {
  getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification,
} from '../services/agent-notifications.js';

const router = Router();

// GET /notifications — list notifications
router.get('/notifications', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const unreadOnly = req.query.unread === 'true';
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const notifications = getNotifications(authReq.userId!, unreadOnly, limit);
  const unreadCount = getUnreadCount(authReq.userId!);
  res.json({ notifications, unreadCount });
});

// GET /notifications/count — unread count
router.get('/notifications/count', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  res.json({ count: getUnreadCount(authReq.userId!) });
});

// PATCH /notifications/:id/read — mark one as read
router.patch('/notifications/:id/read', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const success = markAsRead(req.params.id, authReq.userId!);
  res.json({ success });
});

// POST /notifications/read-all — mark all as read
router.post('/notifications/read-all', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const count = markAllAsRead(authReq.userId!);
  res.json({ markedRead: count });
});

// DELETE /notifications/:id — delete a notification
router.delete('/notifications/:id', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const success = deleteNotification(req.params.id, authReq.userId!);
  res.json({ success });
});

export default router;
