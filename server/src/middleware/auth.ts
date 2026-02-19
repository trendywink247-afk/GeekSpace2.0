import type { Request, Response, NextFunction } from 'express';
import jwtPkg from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { config } from '../config.js';
import { db } from '../db/index.js';

const { sign, verify, TokenExpiredError } = jwtPkg;

export interface AuthRequest extends Request {
  userId?: string;
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
    }) as { sub: string };
    req.userId = payload.sub;

    // Update last_active timestamp (non-blocking, fire-and-forget)
    try {
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(
        new Date().toISOString(),
        payload.sub,
      );
    } catch { /* ignore — column may not exist on first deploy */ }

    next();
  } catch (err) {
    const message = err instanceof TokenExpiredError ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: message });
  }
}

export function signToken(userId: string): string {
  return sign({ sub: userId }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
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
