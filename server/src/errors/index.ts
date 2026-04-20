// ============================================================
// Typed Error Hierarchy for Agentin
//
// Base class + domain-specific subclasses. Each carries a
// machine-readable `code` and HTTP `statusCode` so error
// handlers can map them to structured JSON responses.
// ============================================================

/**
 * Base error for all Agentin domain errors.
 *
 * Every subclass carries a machine-readable `code` string (e.g. `"NOT_FOUND"`)
 * and an HTTP `statusCode` so the global error handler can map caught errors
 * directly to structured JSON responses without a switch/case.
 *
 * Uses `Object.setPrototypeOf` to restore the prototype chain broken by
 * ES2015 class inheritance from `Error` -- this ensures `instanceof` checks
 * work correctly even when transpiled to ES5.
 *
 * @example
 * throw new AgentinError('Flux capacitor overheated', 'FLUX_ERROR', 500);
 */
export class AgentinError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'AgentinError';
    this.code = code;
    this.statusCode = statusCode;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * HTTP 404 -- the requested resource does not exist.
 *
 * Thrown by route handlers when a database lookup returns no rows (e.g.
 * user, reminder, automation, artifact not found by ID).
 *
 * @param message - Human-readable detail (default: `"Not found"`).
 */
export class NotFoundError extends AgentinError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * HTTP 401 -- authentication is required or the provided credentials are
 * invalid. Typically caught by the global error handler and returned as
 * `{ error: message }`.
 *
 * @param message - Human-readable detail (default: `"Unauthorized"`).
 */
export class UnauthorizedError extends AgentinError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * HTTP 429 -- the user has exceeded their rate limit, credit quota, or
 * daily token budget. The client should back off or upgrade their plan.
 *
 * @param message - Human-readable detail (default: `"Quota exceeded"`).
 */
export class QuotaExceededError extends AgentinError {
  constructor(message = 'Quota exceeded') {
    super(message, 'QUOTA_EXCEEDED', 429);
    this.name = 'QuotaExceededError';
  }
}

/**
 * HTTP 400 -- the request body or query parameters failed schema validation.
 * Typically thrown when Zod parsing fails outside the middleware layer, or
 * for semantic validation that schemas cannot express.
 *
 * @param message - Human-readable detail (default: `"Validation failed"`).
 */
export class ValidationError extends AgentinError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/**
 * HTTP 402 -- the requested feature requires a paid subscription that the
 * user does not have (e.g. premium LLM tiers, advanced automations).
 *
 * @param message - Human-readable detail (default: `"Payment required"`).
 */
export class PaymentRequiredError extends AgentinError {
  constructor(message = 'Payment required') {
    super(message, 'PAYMENT_REQUIRED', 402);
    this.name = 'PaymentRequiredError';
  }
}

/**
 * HTTP 409 -- the request conflicts with current state (e.g. duplicate email,
 * already-active resource, optimistic concurrency mismatch).
 *
 * @param message - Human-readable detail (default: `"Conflict"`).
 */
export class ConflictError extends AgentinError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/**
 * HTTP 503 -- a required external service (Stripe, Razorpay, etc.) is not
 * configured or is temporarily unavailable.
 *
 * @param message - Human-readable detail (default: `"Service unavailable"`).
 */
export class ServiceUnavailableError extends AgentinError {
  constructor(message = 'Service unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
    this.name = 'ServiceUnavailableError';
  }
}
