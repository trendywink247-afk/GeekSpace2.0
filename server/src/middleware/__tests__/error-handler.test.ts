import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { agentinErrorHandler } from '../error-handler.js';
import {
  AgentinError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
} from '../../errors/index.js';
import { AppError } from '../errors.js';

function makeReqRes(requestId = 'test-req-id') {
  const req = {
    requestId,
    method: 'GET',
    url: '/api/test',
    userId: 'user-1',
    headers: {},
  } as unknown as Request & { requestId?: string; userId?: string };

  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  const next: NextFunction = vi.fn();

  return { req, res, status, json, next };
}

describe('agentinErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AgentinError subclasses', () => {
    it('returns typed status + code + requestId for NotFoundError', () => {
      const { req, res, status, json } = makeReqRes();
      const err = new NotFoundError('Widget not found');

      agentinErrorHandler(err, req, res, vi.fn());

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        error: 'Widget not found',
        code: 'NOT_FOUND',
        requestId: 'test-req-id',
      });
    });

    it('returns 401 for UnauthorizedError', () => {
      const { req, res, status, json } = makeReqRes();
      const err = new UnauthorizedError();

      agentinErrorHandler(err, req, res, vi.fn());

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        requestId: 'test-req-id',
      });
    });

    it('returns 400 for ValidationError', () => {
      const { req, res, status, json } = makeReqRes();
      const err = new ValidationError('key is required');

      agentinErrorHandler(err, req, res, vi.fn());

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        error: 'key is required',
        code: 'VALIDATION_ERROR',
        requestId: 'test-req-id',
      });
    });

    it('returns 409 for ConflictError', () => {
      const { req, res, status, json } = makeReqRes();
      const err = new ConflictError('Email already taken');

      agentinErrorHandler(err, req, res, vi.fn());

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        error: 'Email already taken',
        code: 'CONFLICT',
        requestId: 'test-req-id',
      });
    });

    it('preserves requestId from req.requestId', () => {
      const { req, res, json } = makeReqRes('custom-req-123');
      const err = new AgentinError('Something', 'MY_CODE', 418);

      agentinErrorHandler(err, req, res, vi.fn());

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'custom-req-123' }),
      );
    });
  });

  describe('unknown Error (generic 500)', () => {
    it('returns INTERNAL_ERROR with requestId for unknown Error', () => {
      const { req, res, status, json } = makeReqRes('req-abc');
      const err = new Error('Something exploded');

      agentinErrorHandler(err, req, res, vi.fn());

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: 'req-abc',
      });
    });

    it('does not leak internal error details in the 500 response', () => {
      const { req, res, json } = makeReqRes();
      const err = new Error('db password = secret123');

      agentinErrorHandler(err, req, res, vi.fn());

      const body = json.mock.calls[0][0] as Record<string, unknown>;
      expect(body.error).toBe('Internal server error');
      expect(JSON.stringify(body)).not.toContain('secret123');
    });
  });

  describe('legacy AppError', () => {
    it('returns APP_ERROR code for AppError', () => {
      const { req, res, status, json } = makeReqRes();
      const err = new AppError(422, 'Unprocessable entity');

      agentinErrorHandler(err, req, res, vi.fn());

      expect(status).toHaveBeenCalledWith(422);
      expect(json).toHaveBeenCalledWith({
        error: 'Unprocessable entity',
        code: 'APP_ERROR',
        requestId: 'test-req-id',
      });
    });
  });

  describe('body-parser 4xx errors', () => {
    it('returns BAD_REQUEST for malformed JSON (err.status 400)', () => {
      const { req, res, status, json } = makeReqRes();
      const err = Object.assign(new Error('Unexpected token'), { status: 400 });

      agentinErrorHandler(err, req, res, vi.fn());

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        error: 'Unexpected token',
        code: 'BAD_REQUEST',
        requestId: 'test-req-id',
      });
    });
  });

  describe('requestId fallback', () => {
    it('falls back to x-request-id header when req.requestId is absent', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        headers: { 'x-request-id': 'header-req-99' },
      } as unknown as Request;
      const json = vi.fn();
      const res = { status: vi.fn().mockReturnValue({ json }), json } as unknown as Response;

      agentinErrorHandler(new NotFoundError(), req, res, vi.fn());

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'header-req-99' }),
      );
    });

    it('uses "unknown" when no requestId is available', () => {
      const req = { method: 'GET', url: '/api/test', headers: {} } as unknown as Request;
      const json = vi.fn();
      const res = { status: vi.fn().mockReturnValue({ json }), json } as unknown as Response;

      agentinErrorHandler(new NotFoundError(), req, res, vi.fn());

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'unknown' }),
      );
    });
  });
});
