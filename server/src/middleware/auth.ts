import type { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import jwtPkg from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { timingSafeEqual, createHash } from 'crypto';
import { config } from '../config.js';
import { db } from '../db/index.js';

const { sign, verify, TokenExpiredError } = jwtPkg;

export interface AuthRequest extends Request {
  userId?: string;
  /** Set when a guest/visitor JWT contains a portfolioUsername claim */
  portfolioUsername?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing auth token' });
    return;
  }

  try {
    const payload = verify(header.slice(7), config.jwtSecret, {
      algorithms: ['HS256'],
    }) as { sub: string; iat?: number; exp?: number; jti?: string; portfolioUsername?: string };
    req.userId = payload.sub;
    if (payload.portfolioUsername) req.portfolioUsername = payload.portfolioUsername;

    // 92.6: JWT blocklist --- reject logged-out tokens
    if (payload.jti) {
      try {
        const nowSec = Math.floor(Date.now() / 1000);
        const blocked = db.prepare('SELECT 1 FROM token_blocklist WHERE jti = ? AND expires_at > ?')
          .get(payload.jti, nowSec) as { 1: number } | undefined;
        if (blocked) {
          res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
          return;
        }
      } catch { /* non-fatal --- table may not exist on first deploy */ }
    }

    // Prevent caching of authenticated responses
    res.set('Cache-Control', 'no-store');

    // 25.3: Reject tokens issued before the user's last password change
    try {
      const tokenIat = payload.iat ?? 0;
      const row = db.prepare('SELECT password_changed_at FROM users WHERE id = ?').get(payload.sub) as { password_changed_at?: number } | undefined;
      const changedAt = row?.password_changed_at ?? 0;
      if (changedAt > 0 && tokenIat < changedAt) {
        res.status(401).json({ error: 'Session expired after password change. Please log in again.' });
        return;
      }
    } catch { /* ignore — column may not exist on first deploy */ }

    // Update last_active timestamp (non-blocking, fire-and-forget)
    try {
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(
        new Date().toISOString(),
        payload.sub,
      );
    } catch { /* ignore — column may not exist on first deploy */ }

    // Upsert session record for lightweight session tracking
    // NOTE: JWT tokens are stateless — revoking a session record does not
    // invalidate the token; existing tokens stay valid until expiry.
    try {
      const ua = (req.headers['user-agent'] || '').slice(0, 255);
      const ip = req.ip || req.socket?.remoteAddress || '';
      // Derive a stable session ID from user + user-agent fingerprint using the
      // already-imported createHash from crypto (sync, no await needed)
      const sessionId = createHash('sha256')
        .update(`${payload.sub}:${ua}`)
        .digest('hex')
        .slice(0, 32);
      db.prepare(`
        INSERT INTO user_sessions (id, user_id, user_agent, ip, created_at, last_seen, is_active)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 1)
        ON CONFLICT(id) DO UPDATE SET last_seen = datetime('now'), ip = excluded.ip, is_active = 1
      `).run(sessionId, payload.sub, ua, ip);
    } catch { /* ignore — table may not exist on first deploy */ }

    next();
  } catch (err) {
    const message = err instanceof TokenExpiredError ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: message });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verify(header.slice(7), config.jwtSecret, {
        algorithms: ['HS256'],
      }) as { sub: string };
      req.userId = payload.sub;
    } catch { /* invalid/expired token — proceed as anonymous */ }
  }
  next();
}

export function signToken(userId: string): string {
  return sign({ sub: userId, jti: uuid() }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

// Alias for OAuth compatibility
export const generateToken = signToken;

/** Issue a short-lived guest JWT for portfolio visitors — no account required.
 *  sub = 'guest:<uuid>' so DB user lookup in optionalAuth returns nothing (visitorName stays anonymous).
 *  Stored in localStorage by the frontend; sent as Authorization: Bearer on subsequent messages.
 *  portfolioUsername (optional) is embedded so /api/agent/chat can route visitor requests. */
export function signGuestToken(portfolioUsername?: string): string {
  const payload: Record<string, unknown> = { sub: `guest:${uuid()}`, type: 'visitor' };
  if (portfolioUsername) payload.portfolioUsername = portfolioUsername;
  return sign(payload, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

// Bearer token middleware — checks Authorization: Bearer <ADMIN_TOKEN>
export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    res.status(503).json({ error: 'Admin token not configured' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing admin token' });
    return;
  }
  const expected = Buffer.from(config.adminToken, 'utf8');
  const provided = Buffer.from(token, 'utf8');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }
  next();
}

// Admin middleware - checks for admin password header
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const adminPassword = req.headers['x-admin-password'];
  if (typeof adminPassword !== 'string') {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  const expected = Buffer.from(config.adminToken || '', 'utf8');
  const provided = Buffer.from(adminPassword, 'utf8');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  next();
}
