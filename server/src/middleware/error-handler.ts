// ============================================================
// Express Error Handler for AgentinError hierarchy
//
// Catches AgentinError subclasses and returns structured JSON.
// Unknown errors are logged and return a generic 500.
//
// NOTE: Not wired into app.ts yet — created for future use.
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { AgentinError } from '../errors/index.js';
import { logger } from '../logger.js';

/**
 * Express error-handling middleware for AgentinError subclasses.
 *
 * Returns structured JSON:
 *   { error: string, code: string }
 *
 * Must be registered AFTER all routes:
 *   app.use(agentinErrorHandler);
 */
export function agentinErrorHandler(
  err: Error,
  req: Request & { userId?: string; requestId?: string },
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId || 'unknown';

  if (err instanceof AgentinError) {
    logger.warn(
      { requestId, code: err.code, statusCode: err.statusCode, err: err.message },
      'AgentinError',
    );
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Unknown / unexpected error — log full stack, return generic 500
  logger.error(
    {
      requestId,
      method: req.method,
      url: req.url,
      userId: req.userId,
      err: err.message,
      stack: err.stack,
    },
    'Unhandled error in agentinErrorHandler',
  );

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
