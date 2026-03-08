import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';
import {
  getInbox,
  getUnreadCount,
  markRead,
  archiveMessage,
  deleteMessage,
  getMessageById,
  addInboxMessage,
  triageMessage,
} from '../services/inbox.js';
import { sendChannelResponse } from '../services/message-router.js';

export const inboxRouter = Router();

// ---- GET /api/inbox ---- list messages
inboxRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = Math.max(0, parseInt(req.query.offset as string || '0', 10));
  const source = req.query.source as string | undefined;

  const messages = getInbox(userId, { unreadOnly, limit, offset, source });
  res.json({ messages, limit, offset });
});

// ---- GET /api/inbox/count ---- unread count
inboxRouter.get('/count', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const unread = getUnreadCount(userId);
  res.json({ unread });
});

// ---- PATCH /api/inbox/:id/read ---- mark read
inboxRouter.patch('/:id/read', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const ok = markRead(userId, id);
  if (!ok) { res.status(404).json({ error: 'Message not found' }); return; }
  res.json({ success: true });
});

// ---- PATCH /api/inbox/:id/archive ---- archive
inboxRouter.patch('/:id/archive', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const ok = archiveMessage(userId, id);
  if (!ok) { res.status(404).json({ error: 'Message not found' }); return; }
  res.json({ success: true });
});

// ---- DELETE /api/inbox/:id ---- hard delete
inboxRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const ok = deleteMessage(userId, id);
  if (!ok) { res.status(404).json({ error: 'Message not found' }); return; }
  res.json({ success: true });
});

// ---- POST /api/inbox/:id/reply ---- send suggested reply via original channel
inboxRouter.post('/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const msg = getMessageById(userId, id);
  if (!msg) { res.status(404).json({ error: 'Message not found' }); return; }

  const replyText = req.body.text || msg.suggested_reply;
  if (!replyText) { res.status(400).json({ error: 'No reply text provided' }); return; }

  // Only Telegram/WhatsApp can be replied to via channel
  if (msg.source !== 'telegram' && msg.source !== 'whatsapp') {
    res.status(400).json({ error: 'Cannot send reply for this source type' });
    return;
  }

  try {
    // sender field contains the externalId (chat ID) for channel messages
    await sendChannelResponse({
      channel: msg.source as 'telegram' | 'whatsapp',
      externalId: msg.sender || '',
      text: replyText,
    });

    // Mark as read after replying
    markRead(userId, id);

    logger.info({ userId, messageId: id, source: msg.source }, 'Inbox reply sent');
    res.json({ success: true, sent: replyText });
  } catch (e) {
    logger.error({ err: (e as Error).message, messageId: id }, 'Failed to send inbox reply');
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// ---- POST /api/inbox (internal/testing) ---- add a message manually
inboxRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { source, sender, content } = req.body;

  if (!source || !content) {
    res.status(400).json({ error: 'source and content are required' });
    return;
  }

  const validSources = ['telegram', 'whatsapp', 'system', 'agent'];
  if (!validSources.includes(source)) {
    res.status(400).json({ error: 'Invalid source' });
    return;
  }

  const messageId = addInboxMessage(userId, source, sender || null, content);

  // Wait for triage to complete so tests can verify
  await triageMessage(messageId);

  const msg = getMessageById(userId, messageId);
  res.status(201).json({ message: msg });
});
