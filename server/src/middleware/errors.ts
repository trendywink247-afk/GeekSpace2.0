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
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId || 'unknown';

  if (err instanceof AppError) {
    logger.warn({ requestId, statusCode: err.statusCode, err: err.message }, 'App error');
    res.status(err.statusCode).json({
      error: err.message,
      requestId,
    });
    return;
  }

  // Unexpected errors — log full stack but don't leak to client
  logger.error({ requestId, err: err.message, stack: err.stack }, 'Unhandled error');
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
