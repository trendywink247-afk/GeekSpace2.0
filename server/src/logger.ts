// ============================================================
// Structured logger (pino) with request ID support
// ============================================================

import pino from 'pino';
import { config } from './config.js';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Application-wide structured logger powered by Pino.
 *
 * In production, outputs newline-delimited JSON (for log aggregators). In
 * development, pipes through `pino-pretty` with colorized output.
 *
 * Log level is controlled by `config.logLevel` (env `LOG_LEVEL`), defaulting
 * to `"info"` in production and `"debug"` in development.
 *
 * @example
 * logger.info({ userId, action: 'login' }, 'User logged in');
 * logger.error({ err }, 'Database query failed');
 */
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

/**
 * Express middleware that assigns a unique request ID and logs every HTTP
 * request's outcome on response finish.
 *
 * **Request ID:** Uses the incoming `X-Request-Id` header if present (for
 * distributed tracing through reverse proxies), otherwise generates a UUID v4.
 * The ID is attached to `req.requestId` and echoed back in the
 * `X-Request-Id` response header.
 *
 * **Log levels by outcome:**
 * - `error` -- 5xx status codes
 * - `warn`  -- 4xx status codes or latency > 500 ms (marked `[SLOW]`)
 * - `info`  -- everything else
 *
 * @param req  - Express request (extended with `requestId`).
 * @param res  - Express response (receives `X-Request-Id` header).
 * @param next - Always called immediately; logging happens on `res.finish`.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    // Slow requests (>500ms) at warn regardless of status, errors always at error level
    const level = res.statusCode >= 500
      ? 'error'
      : res.statusCode >= 400 || duration > 500
        ? 'warn'
        : 'info';
    logger[level]({
      requestId,
      method,
      url,
      status: res.statusCode,
      durationMs: duration,
      slow: duration > 500,
    }, `${method} ${url} ${res.statusCode} ${duration}ms${duration > 500 ? ' [SLOW]' : ''}`);
  });

  next();
}
