// ============================================================
// Global error handling middleware
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Catch-all error handler — must be registered LAST */
export function errorHandler(err: Error & { status?: number; type?: string }, req: Request & { userId?: string }, res: Response, _next: NextFunction) {
  const requestId = req.requestId || 'unknown';
  // 54.6: Structured 5xx context — include method, url, userId for faster debugging
  const errCtx = {
    requestId,
    method: req.method,
    url: req.url,
    userId: (req as unknown as { userId?: string }).userId ?? undefined,
  };

  if (err instanceof AppError) {
    logger.warn({ ...errCtx, statusCode: err.statusCode, err: err.message }, 'App error');
    res.status(err.statusCode).json({
      error: err.message,
      requestId,
    });
    return;
  }

  // body-parser / express.json errors (e.g. strict mode rejects JSON primitives, malformed JSON)
  // These have err.status set to 400 and err.type like 'entity.parse.failed'
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    logger.warn({ ...errCtx, status: err.status, err: err.message }, 'Request parse/validation error');
    res.status(err.status).json({ error: err.message || 'Bad request', requestId });
    return;
  }

  // Unexpected errors — log full stack but don't leak to client
  logger.error({ ...errCtx, err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    requestId,
    hint: 'If this persists, contact support with the requestId above.',
  });
}

/** Wrap async route handlers so thrown errors hit the global handler */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
