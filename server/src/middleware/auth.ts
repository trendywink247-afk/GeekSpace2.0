import type { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import jwtPkg from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { timingSafeEqual, createHash } from 'crypto';
import { config } from '../config.js';
import { db } from '../db/index.js';

const { sign, verify, TokenExpiredError } = jwtPkg;

/**
 * Extended Express Request that carries the authenticated user's identity.
 * Populated by {@link requireAuth} or {@link optionalAuth} after JWT verification.
 *
 * Downstream route handlers can safely read `req.userId` when preceded by
 * `requireAuth` (guaranteed string) or check for its presence after
 * `optionalAuth` (may be undefined for anonymous visitors).
 */
export interface AuthRequest extends Request {
  /** The `sub` claim from the verified JWT -- a user ID or `guest:<uuid>`. */
  userId?: string;
  /** Set when a guest/visitor JWT contains a portfolioUsername claim */
  portfolioUsername?: string;
}

/**
 * Express middleware that enforces JWT authentication on a route.
 *
 * Reads `Authorization: Bearer <token>` from the request header, verifies it
 * with HS256 using the configured JWT secret, and populates `req.userId`.
 *
 * **Side effects beyond authentication:**
 * 1. Checks the `token_blocklist` table -- rejects tokens that were explicitly
 *    invalidated (e.g. on logout).
 * 2. Rejects tokens issued before the user's last password change (`iat < password_changed_at`).
 * 3. Updates `users.last_active` timestamp (fire-and-forget).
 * 4. Upserts a `user_sessions` row for lightweight session tracking (the session
 *    ID is a SHA-256 of user ID + User-Agent).
 * 5. Sets `Cache-Control: no-store` to prevent proxies caching authed responses.
 *
 * All DB side effects are wrapped in try/catch so a missing table on first
 * deploy does not block authentication.
 *
 * @param req  - The incoming request (extended to {@link AuthRequest}).
 * @param res  - Express response; receives 401 JSON on failure.
 * @param next - Called on successful authentication.
 */
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

/**
 * Express middleware that extracts user identity from a JWT if present, but
 * never rejects the request. Invalid or expired tokens are silently ignored,
 * and the request proceeds as anonymous (`req.userId` remains undefined).
 *
 * Use this on routes that behave differently for logged-in vs. anonymous users
 * (e.g. portfolio public pages that show extra controls for the owner).
 *
 * @param req  - The incoming request (extended to {@link AuthRequest}).
 * @param _res - Unused; always calls `next()`.
 * @param next - Always called, regardless of token validity.
 */
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

/**
 * Creates a signed HS256 JWT for a given user. The token includes a unique
 * `jti` (JWT ID) so it can later be added to the blocklist on logout.
 *
 * Expiry is controlled by `config.jwtExpiresIn` (default `"15m"`).
 *
 * @param userId - The user's database ID, stored as the `sub` claim.
 * @returns A compact JWT string suitable for the `Authorization: Bearer` header.
 */
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

/**
 * Express middleware that gates a route behind the server-level admin token.
 * Compares the `Authorization: Bearer <token>` value against `config.adminToken`
 * using a **timing-safe comparison** to prevent timing-based token leakage.
 *
 * Returns 503 if `ADMIN_TOKEN` is not configured, 401 if missing or invalid.
 *
 * @param req  - Standard Express request (no user context needed).
 * @param res  - Receives 401 or 503 JSON on failure.
 * @param next - Called only when the token matches.
 *
 * @security Uses `crypto.timingSafeEqual` -- safe against timing attacks.
 */
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

/**
 * Express middleware that checks the `X-Admin-Password` header against the
 * configured admin token. Unlike {@link requireAdminToken} (which uses Bearer
 * auth), this reads a custom header -- used by the admin dashboard UI.
 *
 * @param req  - Must include `X-Admin-Password` header.
 * @param res  - Receives 401 JSON on failure.
 * @param next - Called only when the password matches.
 *
 * @security Uses `crypto.timingSafeEqual` -- safe against timing attacks.
 */
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
