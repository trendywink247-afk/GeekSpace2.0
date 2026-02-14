// ============================================================
// Request validation middleware using Zod schemas
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/** Validate request body against a Zod schema */
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Validate query params against a Zod schema */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      res.status(400).json({ error: 'Invalid query parameters', details: errors });
      return;
    }
    req.query = result.data as any;
    next();
  };
}

// ---- Common schemas ----

export const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'Username: letters, numbers, _ and - only'),
  name: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const chatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long (4000 chars max)'),
});

export const commandSchema = z.object({
  command: z.string().min(1).max(500),
});

export const reminderCreateSchema = z.object({
  text: z.string().min(1).max(500),
  datetime: z.string().max(50).optional(),
  channel: z.enum(['telegram', 'email', 'push']).optional().default('push'),
  recurring: z.enum(['', 'daily', 'weekly', 'monthly']).optional(),
  category: z.enum(['personal', 'work', 'health', 'other', 'general']).optional().default('personal'),
  completed: z.boolean().optional().default(false),
});

export const automationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  triggerType: z.enum(['time', 'event', 'webhook']),
  actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast']),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

export const apiKeyCreateSchema = z.object({
  provider: z.string().min(1).max(50),
  key: z.string().min(1).max(500),
  label: z.string().max(100).optional(),
  isDefault: z.boolean().optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  company: z.string().max(200).optional().default(''),
  message: z.string().min(1).max(5000),
});
