// ============================================================
// Typed Error Hierarchy for Agentin
//
// Base class + domain-specific subclasses. Each carries a
// machine-readable `code` and HTTP `statusCode` so error
// handlers can map them to structured JSON responses.
// ============================================================

/**
 * Base error for all Agentin domain errors.
 * Carries a machine-readable `code` and HTTP `statusCode`.
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

/** 404 — resource not found */
export class NotFoundError extends AgentinError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/** 401 — authentication required or invalid */
export class UnauthorizedError extends AgentinError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

/** 429 — rate limit or quota exceeded */
export class QuotaExceededError extends AgentinError {
  constructor(message = 'Quota exceeded') {
    super(message, 'QUOTA_EXCEEDED', 429);
    this.name = 'QuotaExceededError';
  }
}

/** 400 — invalid input */
export class ValidationError extends AgentinError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/** 402 — payment required (e.g. free plan trying premium feature) */
export class PaymentRequiredError extends AgentinError {
  constructor(message = 'Payment required') {
    super(message, 'PAYMENT_REQUIRED', 402);
    this.name = 'PaymentRequiredError';
  }
}
