// ============================================================
// Express Error Handler for AgentinError hierarchy
//
// Catches AgentinError subclasses (typed domain errors) and the
// legacy AppError class, then returns a unified JSON shape:
//   { error: string, code: string, requestId: string }
//
// Unknown errors are logged and return a generic 500.
//
// Wired in app.ts:657 via `app.use(agentinErrorHandler)` (replaces old errorHandler).
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { AgentinError } from '../errors/index.js';
import { AppError } from './errors.js';
import { logger } from '../logger.js';

/**
 * Wrap an async route handler so thrown errors are forwarded to the
 * agentinErrorHandler via next(err).  Modules can throw AgentinError
 * subclasses and get normalized JSON responses without try/catch boilerplate.
 *
 * @example
 * router.get('/resource/:id', requireAuth, withAgentinError(async (req, res) => {
 *   const row = db.prepare('SELECT ...').get(req.params.id);
 *   if (!row) throw new NotFoundError('Resource not found');
 *   res.json(row);
 * }));
 */
export function withAgentinError(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

type ExtendedRequest = Request & { userId?: string; requestId?: string };

/**
 * Express error-handling middleware — must be registered AFTER all routes.
 *
 * Handles (in priority order):
 *  1. AgentinError subclasses  → typed status + code
 *  2. Legacy AppError          → status from class, code APP_ERROR
 *  3. body-parser / express 4xx parse errors (err.status set by framework)
 *  4. Unknown errors           → 500 INTERNAL_ERROR
 *
 * All responses share the shape: { error, code, requestId }
 */
export function agentinErrorHandler(
  err: Error & { status?: number; type?: string },
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? (req.headers['x-request-id'] as string | undefined) ?? 'unknown';

  if (err instanceof AgentinError) {
    logger.warn(
      { requestId, code: err.code, statusCode: err.statusCode, err: err.message },
      'AgentinError',
    );
    res.status(err.statusCode).json({ error: err.message, code: err.code, requestId });
    return;
  }

  // Legacy AppError (from middleware/errors.ts) — kept for backward compat
  if (err instanceof AppError) {
    logger.warn(
      { requestId, statusCode: err.statusCode, err: err.message },
      'AppError',
    );
    res.status(err.statusCode).json({ error: err.message, code: 'APP_ERROR', requestId });
    return;
  }

  // body-parser / express.json parse errors have err.status in 400–499
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    logger.warn(
      { requestId, status: err.status, err: err.message },
      'Request parse/validation error',
    );
    res.status(err.status).json({ error: err.message || 'Bad request', code: 'BAD_REQUEST', requestId });
    return;
  }

  // Unknown / unexpected error — log full stack, do not leak details
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
    requestId,
  });
}
