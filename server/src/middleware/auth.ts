import type { Request, Response, NextFunction } from 'express';
import { sign, verify, TokenExpiredError, type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';

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
    const payload = verify(header.slice(7), config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch (err) {
    const message = err instanceof TokenExpiredError ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: message });
  }
}

export function signToken(userId: string): string {
  return sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
}
