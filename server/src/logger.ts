// ============================================================
// Structured logger (pino) with request ID support
// ============================================================

import pino from 'pino';
import { config } from './config.js';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const logger = pino({
  level: config.logLevel,
  ...(config.isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});

// Extend Express Request with requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/** Middleware: attach a unique request ID and log request start/end */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      requestId,
      method,
      url,
      status: res.statusCode,
      durationMs: duration,
    }, `${method} ${url} ${res.statusCode} ${duration}ms`);
  });

  next();
}
