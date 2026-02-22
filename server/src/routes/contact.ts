// ============================================================
// Contact Request API Routes
// Human-to-Human contact with consent
// ============================================================

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  notifyUserOfContactRequest,
  handleAcceptRequest,
  handleDeclineRequest,
  getUserChannelStatus,
  getAvailabilityResponse,
  isInQuietHours,
  type ContactRequest,
} from '../services/contactRouter.js';
import type { AuthRequest } from '../types.js';

const router = Router();

// Rate limiting config
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 5; // max 5 requests per hour per user/IP

/**
 * Check rate limit for contact requests
 */
function checkRateLimit(identifier: string, identifierType: 'user' | 'ip' | 'session'): boolean {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Count recent requests
  const count = db.prepare(
    `SELECT COUNT(*) as count FROM contact_requests 
     WHERE (from_user_id = ? OR (from_user_id IS NULL AND created_at > ?))
     AND created_at > datetime('now', '-1 hour')`
  ).get(identifierType === 'user' ? identifier : null) as { count: number };

  return count.count < RATE_LIMIT_MAX_REQUESTS;
}

/**
 * POST /api/contact/request
 * Create a new contact request
 */
router.post('/request', async (req: AuthRequest, res) => {
  try {
    const {
      toUserId,
      source,
      fromName,
      fromPhone,
      fromEmail,
      intention,
      initialMessage,
    } = req.body;

    // Validate required fields
    if (!toUserId || !source) {
      return res.status(400).json({ error: 'Missing required fields: toUserId, source' });
    }

    // Check if target user exists
    const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(toUserId) as { id: string; name: string } | undefined;
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Rate limiting
    const identifier = req.userId || req.ip || 'unknown';
    const idType: 'user' | 'ip' | 'session' = req.userId ? 'user' : req.ip ? 'ip' : 'session';
    
    if (!checkRateLimit(identifier, idType)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    // Check if target user allows guest contacts (if X is not logged in)
    if (!req.userId) {
      const prefs = db.prepare(
        'SELECT allow_guest_contacts FROM user_contact_preferences WHERE user_id = ?'
      ).get(toUserId) as { allow_guest_contacts: number } | undefined;
      
      if (prefs && !prefs.allow_guest_contacts) {
        return res.status(403).json({ error: 'This user only accepts contacts from registered users.' });
      }
    }

    // Validate guest contact details
    let finalFromName = fromName;
    let finalFromPhone = fromPhone;
    let finalFromEmail = fromEmail;

    if (!req.userId) {
      // Guest users must provide name and phone
      if (!fromName || !fromPhone) {
        return res.status(400).json({ 
          error: 'Guest contacts must provide name and phone',
          nextStep: 'collect_contact_details'
        });
      }

      // Validate phone format (basic)
      const phoneRegex = /^[+]?[\d\s-()]{10,}$/;
      if (!phoneRegex.test(fromPhone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      finalFromName = fromName.trim();
      finalFromPhone = fromPhone.trim();
      finalFromEmail = fromEmail?.trim() || null;
    } else {
      // Logged-in users: use their profile
      const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.userId) as { name: string; email: string };
      finalFromName = user.name;
      finalFromEmail = user.email;
    }

    // Check for existing pending request (deduplication)
    const existingRequest = db.prepare(
      `SELECT id FROM contact_requests 
       WHERE to_user_id = ? AND status = 'pending'
       AND ((from_user_id = ? AND from_user_id IS NOT NULL) OR (from_name = ? AND from_phone = ?))
       AND created_at > datetime('now', '-24 hours')`
    ).get(toUserId, req.userId || null, finalFromName, finalFromPhone || null) as { id: string } | undefined;

    if (existingRequest) {
      return res.status(409).json({ 
        error: 'A pending request already exists',
        requestId: existingRequest.id,
        status: 'pending'
      });
    }

    // Create contact request
    const requestId = uuid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    db.prepare(
      `INSERT INTO contact_requests 
       (id, from_user_id, from_name, from_phone, from_email, to_user_id, source, intention, initial_message, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`
    ).run(
      requestId,
      req.userId || null,
      finalFromName,
      finalFromPhone || null,
      finalFromEmail || null,
      toUserId,
      source,
      intention || null,
      initialMessage || null,
      expiresAt
    );

    // Log audit
    db.prepare(
      `INSERT INTO contact_request_audit (id, request_id, action, actor_type, actor_id, metadata, created_at)
       VALUES (?, ?, 'created', ?, ?, ?, datetime('now'))`
    ).run(
      uuid(),
      requestId,
      req.userId ? 'x_user' : 'system',
      req.userId || null,
      JSON.stringify({ source, has_intention: !!intention })
    );

    // Check if target is in quiet hours
    const inQuietHours = isInQuietHours(toUserId);
    
    // Notify target user (unless in quiet hours - delay notification)
    let notifyResult = { success: false, channel: 'none' as const, error: 'Quiet hours' };
    if (!inQuietHours) {
      const request: ContactRequest = {
        id: requestId,
        fromUserId: req.userId || null,
        fromName: finalFromName,
        fromPhone: finalFromPhone || null,
        fromEmail: finalFromEmail || null,
        toUserId,
        source,
        intention: intention || null,
        initialMessage: initialMessage || null,
        status: 'pending',
        channelNotified: 'none',
        createdAt: new Date().toISOString(),
        expiresAt,
      };
      notifyResult = await notifyUserOfContactRequest(request);
    }

    // Create reminder for target user if notification failed or in quiet hours
    if (!notifyResult.success || inQuietHours) {
      db.prepare(
        `INSERT INTO reminders (id, user_id, text, datetime, channel, created_at)
         VALUES (?, ?, ?, datetime('now', '+1 hour'), 'telegram', datetime('now'))`
      ).run(uuid(), toUserId, `You have a pending contact request from ${finalFromName}`);
    }

    logger.info({ 
      requestId, 
      fromUserId: req.userId || 'guest', 
      toUserId,
      notified: notifyResult.success,
      channel: notifyResult.channel
    }, 'Contact request created');

    res.status(201).json({
      requestId,
      status: 'pending',
      nextStep: 'waiting_for_accept',
      expiresAt,
      notified: notifyResult.success,
      channel: notifyResult.channel,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to create contact request');
    res.status(500).json({ error: 'Failed to create contact request' });
  }
});

/**
 * POST /api/contact/:id/accept
 * Accept a contact request (Y only)
 */
router.post('/:id/accept', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { responseMessage } = req.body;
    const userId = req.userId!;

    const result = await handleAcceptRequest(id, userId, responseMessage);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      conversationId: result.conversationId,
      redirectUrl: `/dashboard/agent?conversation=${result.conversationId}`,
    });
  } catch (err) {
    logger.error({ err, requestId: req.params.id }, 'Failed to accept contact request');
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

/**
 * POST /api/contact/:id/decline
 * Decline a contact request (Y only)
 */
router.post('/:id/decline', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { responseMessage } = req.body;
    const userId = req.userId!;

    const result = await handleDeclineRequest(id, userId, responseMessage);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, requestId: req.params.id }, 'Failed to decline contact request');
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

/**
 * GET /api/contact/:id/status
 * Get status of a contact request (X can poll this)
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const request = db.prepare(
      `SELECT cr.*, 
              u.name as to_user_name, u.avatar as to_user_avatar
       FROM contact_requests cr
       JOIN users u ON cr.to_user_id = u.id
       WHERE cr.id = ?`
    ).get(id) as (ContactRequest & { to_user_name: string; to_user_avatar: string }) | undefined;

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if expired
    if (request.status === 'pending' && new Date(request.expiresAt) < new Date()) {
      // Auto-update to timed_out
      db.prepare(
        "UPDATE contact_requests SET status = 'timed_out', updated_at = datetime('now') WHERE id = ?"
      ).run(id);
      request.status = 'timed_out';

      // Get availability response
      const availabilityResponse = await getAvailabilityResponse(request.toUserId);
      
      return res.json({
        requestId: id,
        status: 'timed_out',
        message: availabilityResponse,
      });
    }

    res.json({
      requestId: id,
      status: request.status,
      toUser: {
        name: request.to_user_name,
        avatar: request.to_user_avatar,
      },
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      decidedAt: request.status !== 'pending' ? request.decidedAt : null,
    });
  } catch (err) {
    logger.error({ err, requestId: req.params.id }, 'Failed to get contact request status');
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * GET /api/contact/incoming
 * Get incoming contact requests for current user (Y)
 */
router.get('/incoming', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const requests = db.prepare(
      `SELECT cr.*, 
              u.name as from_user_name, u.avatar as from_user_avatar
       FROM contact_requests cr
       LEFT JOIN users u ON cr.from_user_id = u.id
       WHERE cr.to_user_id = ? AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`
    ).all(userId) as Array<ContactRequest & { from_user_name: string; from_user_avatar: string }>;

    res.json({
      requests: requests.map(r => ({
        id: r.id,
        fromName: r.fromName,
        fromUser: r.from_user_id ? {
          name: r.from_user_name,
          avatar: r.from_user_avatar,
        } : null,
        source: r.source,
        intention: r.intention,
        initialMessage: r.initialMessage,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        channelNotified: r.channelNotified,
      })),
    });
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'Failed to get incoming contact requests');
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

/**
 * GET /api/contact/preferences
 * Get contact preferences for current user
 */
router.get('/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    let prefs = db.prepare(
      'SELECT * FROM user_contact_preferences WHERE user_id = ?'
    ).get(userId) as Record<string, unknown> | undefined;

    if (!prefs) {
      // Create default preferences
      db.prepare(
        `INSERT INTO user_contact_preferences (user_id, created_at, updated_at)
         VALUES (?, datetime('now'), datetime('now'))`
      ).run(userId);
      
      prefs = db.prepare(
        'SELECT * FROM user_contact_preferences WHERE user_id = ?'
      ).get(userId) as Record<string, unknown>;
    }

    res.json(prefs);
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'Failed to get contact preferences');
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/contact/preferences
 * Update contact preferences
 */
router.put('/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      availabilityMode,
      shareAvailabilityLevel,
      defaultResponseTemplate,
      quietHoursStart,
      quietHoursEnd,
      allowGuestContacts,
    } = req.body;

    db.prepare(
      `UPDATE user_contact_preferences SET
       availability_mode = COALESCE(?, availability_mode),
       share_availability_level = COALESCE(?, share_availability_level),
       default_response_template = COALESCE(?, default_response_template),
       quiet_hours_start = COALESCE(?, quiet_hours_start),
       quiet_hours_end = COALESCE(?, quiet_hours_end),
       allow_guest_contacts = COALESCE(?, allow_guest_contacts),
       updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(
      availabilityMode,
      shareAvailabilityLevel,
      defaultResponseTemplate,
      quietHoursStart,
      quietHoursEnd,
      allowGuestContacts,
      userId
    );

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'Failed to update contact preferences');
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export { router as contactRouter };
