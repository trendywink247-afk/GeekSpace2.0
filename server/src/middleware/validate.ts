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

// ---- Onboarding schema ----

export const onboardingSchema = z.object({
  profile: z.object({
    name: z.string().max(100).optional(),
    username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
    bio: z.string().max(500).optional(),
    avatar: z.string().url().max(2048).optional(),
  }).optional(),
  agentMode: z.enum(['builder', 'creative', 'analyst', 'minimal', 'operator']).optional(),
  integrations: z.array(z.string().max(50)).max(20).optional(),
});

// ---- PATCH schemas (partial updates with bounds) ----

export const agentConfigUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  displayName: z.string().max(100).optional(),
  mode: z.enum(['builder', 'creative', 'analyst', 'minimal', 'operator']).optional(),
  voice: z.enum(['friendly', 'professional', 'casual', 'formal', 'witty']).optional(),
  systemPrompt: z.string().max(4000).optional(),
  primaryModel: z.string().max(100).optional(),
  fallbackModel: z.string().max(100).optional(),
  creativity: z.number().min(0).max(1).optional(),
  formality: z.number().min(0).max(1).optional(),
  responseSpeed: z.enum(['fast', 'balanced', 'thorough']).optional(),
  monthlyBudgetUSD: z.number().min(0).max(10000).optional(),
  avatarEmoji: z.string().max(10).optional(),
  accentColor: z.string().max(20).optional(),
  bubbleStyle: z.string().max(20).optional(),
  status: z.enum(['online', 'offline', 'busy']).optional(),
}).strict();

export const userUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().max(2048).optional(),
  location: z.string().max(100).optional(),
  website: z.string().max(500).optional(),
  role: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  theme: z.object({
    mode: z.enum(['light', 'dark']).optional(),
    accentColor: z.string().max(20).optional(),
  }).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    agentUpdates: z.boolean().optional(),
    reminders: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    showProfile: z.boolean().optional(),
    showActivity: z.boolean().optional(),
    allowAgentChat: z.boolean().optional(),
    showLocation: z.boolean().optional(),
  }).optional(),
});

export const portfolioUpdateSchema = z.object({
  headline: z.string().max(200).optional(),
  about: z.string().max(5000).optional(),
  avatar: z.string().max(2048).optional(),
  location: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  layout: z.string().max(50).optional(),
  skills: z.array(z.string().max(50)).max(50).optional(),
  projects: z.array(z.object({
    name: z.string().max(200),
    description: z.string().max(1000).optional(),
    url: z.string().max(500).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }).passthrough()).max(20).optional(),
  milestones: z.array(z.object({
    title: z.string().max(200),
    date: z.string().max(50).optional(),
    description: z.string().max(500).optional(),
  }).passthrough()).max(20).optional(),
  social: z.record(z.string().max(50), z.string().max(500)).optional(),
  visibility: z.record(z.string().max(50), z.boolean()).optional(),
  agentEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const portfolioAiEditSchema = z.object({
  prompt: z.string().min(1).max(2000),
});

export const reminderUpdateSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  datetime: z.string().max(50).optional(),
  channel: z.enum(['telegram', 'email', 'push']).optional(),
  category: z.enum(['personal', 'work', 'health', 'other', 'general']).optional(),
  recurring: z.enum(['', 'daily', 'weekly', 'monthly']).optional(),
  completed: z.boolean().optional(),
});

export const automationUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerType: z.enum(['time', 'event', 'webhook']).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast']).optional(),
  actionConfig: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const permissionsUpdateSchema = z.object({
  permissions: z.array(z.string().max(100)).max(50),
});

export const featuresUpdateSchema = z.object({
  socialDiscovery: z.boolean().optional(),
  portfolioChat: z.boolean().optional(),
  automationBuilder: z.boolean().optional(),
  websiteBuilder: z.boolean().optional(),
  n8nIntegration: z.boolean().optional(),
  manyChatIntegration: z.boolean().optional(),
});

// ---- Memory schemas ----

export const memoryCreateSchema = z.object({
  category: z.string().min(1).max(50),
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  source: z.string().max(50).optional().default('manual'),
});

export const memoryUpdateSchema = z.object({
  category: z.string().min(1).max(50).optional(),
  key: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
