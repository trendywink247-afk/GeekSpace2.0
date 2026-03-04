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
  messageCount: z.number().int().min(0).optional(),
  channel: z.string().max(50).optional(),
  context: z.string().max(50).optional(),
  // When set by the website builder, generate_code will update this artifact instead of creating a new one
  existingArtifactId: z.string().uuid().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(20).optional(),
});

export const commandSchema = z.object({
  command: z.string().min(1).max(500),
});

export const reminderCreateSchema = z.object({
  text: z.string().min(1).max(500),
  datetime: z.string().max(50).optional().refine(
    (v) => !v || !isNaN(Date.parse(v)),
    { message: 'Invalid datetime format' }
  ),
  channel: z.enum(['telegram', 'email', 'push']).optional().default('push'),
  recurring: z.enum(['', 'daily', 'weekly', 'monthly']).optional(),
  recurrence: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
  category: z.enum(['personal', 'work', 'health', 'other', 'general']).optional().default('personal'),
  completed: z.boolean().optional().default(false),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
});

export const automationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  triggerType: z.enum(['time', 'event', 'webhook', 'manual', 'keyword', 'health_down']),
  triggerConfig: z.record(z.string(), z.unknown()).optional().default({}),
  actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast', 'whatsapp-message', 'call_api', 'create_reminder', 'log']),
  actionConfig: z.record(z.string(), z.unknown()).optional().default({}),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
}).refine((data) => {
  // 65.3: Validate webhook URL format when actionType requires a URL
  const urlActionTypes = ['n8n-webhook', 'call_api'];
  if (!urlActionTypes.includes(data.actionType)) return true;
  const url = (data.actionConfig?.url as string | undefined) || (data.actionConfig?.webhook_url as string | undefined);
  if (!url) return true; // URL is optional at create time
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch { return false; }
}, { message: 'actionConfig.url must be a valid http:// or https:// URL', path: ['actionConfig'] });

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
  displayName: z.string().max(50).optional(),
  greeting: z.string().max(200).optional(),
  mode: z.enum(['builder', 'creative', 'analyst', 'minimal', 'operator']).optional(),
  voice: z.enum(['friendly', 'professional', 'casual', 'formal', 'witty']).optional(),
  systemPrompt: z.string().max(2000).optional(),
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
  personality: z.enum(['edith', 'jarvis', 'weebo']).optional(),
  model_preference: z.enum(['auto', 'local', 'cloud', 'premium']).optional(),
  preferred_free_model: z.string().max(200).optional(),
  preferred_image_model: z.string().min(1).max(200).optional(),
  preferred_video_model: z.string().min(1).max(200).optional(),
  briefing_time: z.string().max(10).optional(),
  notif_reminders: z.number().int().min(0).max(1).optional(),
  notif_escalations: z.number().int().min(0).max(1).optional(),
  notif_agents: z.number().int().min(0).max(1).optional(),
  notif_daily_briefing: z.number().int().min(0).max(1).optional(),
  notif_connections: z.number().int().min(0).max(1).optional(),
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
    mode: z.enum(['light', 'dark', 'system']).optional(),
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

// HTML tag stripper for plain-text fields (XSS hardening — 24.3)
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim();

export const portfolioUpdateSchema = z.object({
  headline: z.string().max(200).transform(stripHtml).optional(),
  about: z.string().max(2000).transform(stripHtml).optional(),
  avatar: z.string().max(2048).optional(),
  location: z.string().max(100).transform(stripHtml).optional(),
  role: z.string().max(100).transform(stripHtml).optional(),
  company: z.string().max(100).transform(stripHtml).optional(),
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
  // 59.9: SEO meta description (max 160 chars — Google snippet limit)
  metaDescription: z.string().max(160).transform(stripHtml).optional(),
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
  recurrence: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
  completed: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

export const automationUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  triggerType: z.enum(['time', 'event', 'webhook', 'manual', 'keyword', 'health_down']).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast', 'whatsapp-message', 'call_api', 'create_reminder', 'log']).optional(),
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

// ---- Billing schemas ----

export const billingUpgradeSchema = z.object({
  plan: z.enum(['free', 'pilot', 'intro', 'halfyear', 'yearly']),
  currency: z.enum(['USD', 'INR']).optional(),
});

export const notificationEmailSchema = z.object({
  enabled: z.boolean().optional(),
  address: z.string().email().max(254).nullable().optional(),
}).refine((data) => data.enabled !== undefined || data.address !== undefined, {
  message: 'At least one of enabled or address must be provided',
});

// ---- Premium agent schemas ----

export const deployPremiumSchema = z.object({
  task: z.string().min(1).max(2000),
});

export const premiumChatSchema = z.object({
  message: z.string().min(1).max(4000),
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

// ---- Workflow schemas ----

export const workflowQuerySchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
});

// ---- Pico Fleet schemas ----

export const picoAgentCreateSchema = z.object({
  name: z.string().min(1).max(30),
  personality: z.enum(['edith', 'jarvis', 'weebo']).default('weebo'),
});

export const picoAgentUpdateSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  status: z.enum(['active', 'paused']).optional(),
  system_prompt: z.string().max(2000).optional(),
  mode: z.enum(['minimal', 'builder', 'operator']).optional(),
  voice: z.enum(['professional', 'friendly', 'witty']).optional(),
  creativity: z.number().int().min(0).max(100).optional(),
  formality: z.number().int().min(0).max(100).optional(),
  model_preference: z.enum(['auto', 'local', 'cloud', 'premium']).optional(),
  custom_commands: z.string().max(2000).optional(),
  assigned_tools: z.array(z.enum(['recipes', 'image-gen', 'video-gen', 'website-builder', 'social-media'])).optional(),
  enabled: z.boolean().optional(),
}).strict();

export const picoTaskPlanSchema = z.object({
  request: z.string().min(1).max(1000),
});

export const picoTaskQuerySchema = z.object({
  status: z.enum(['queued', 'running', 'completed', 'failed']).optional(),
  slot: z.coerce.number().int().min(1).max(6).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const picoCronJobCreateSchema = z.object({
  name: z.string().min(1).max(100),
  task_type: z.enum(['create_reminder', 'telegram_message', 'call_api', 'n8n_webhook', 'portfolio_deploy', 'social_media_post']),
  task_config: z.record(z.string(), z.unknown()).default({}),
  interval_minutes: z.number().int().min(5).max(10080),
  agent_slot: z.number().int().min(2).max(6).default(2),
});

export const picoCronJobUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  task_type: z.enum(['create_reminder', 'telegram_message', 'call_api', 'n8n_webhook', 'portfolio_deploy', 'social_media_post']).optional(),
  task_config: z.record(z.string(), z.unknown()).optional(),
  interval_minutes: z.number().int().min(5).max(10080).optional(),
  agent_slot: z.number().int().min(2).max(6).optional(),
  enabled: z.boolean().optional(),
}).strict();

// ---- Social Media schemas ----

export const socialAccountCreateSchema = z.object({
  platform: z.enum(['instagram', 'facebook']),
  account_name: z.string().min(1).max(100),
  posting_method: z.enum(['webhook', 'api']),
  webhook_url: z.string().url().max(2000).optional(),
  page_id: z.string().max(200).optional(),
  access_token: z.string().max(2000).optional(),
}).refine(
  (data) => {
    if (data.posting_method === 'webhook') return !!data.webhook_url;
    if (data.posting_method === 'api') return !!data.page_id && !!data.access_token;
    return true;
  },
  { message: 'Webhook method requires webhook_url; API method requires page_id and access_token' },
);

export const socialAccountUpdateSchema = z.object({
  account_name: z.string().min(1).max(100).optional(),
  posting_method: z.enum(['webhook', 'api']).optional(),
  webhook_url: z.string().url().max(2000).optional(),
  page_id: z.string().max(200).optional(),
  access_token: z.string().max(2000).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export const contentPlanGenerateSchema = z.object({
  topic: z.string().min(1).max(200),
  niche: z.string().min(1).max(200),
  social_account_id: z.string().max(100).optional(),
});

export const contentPlanActivateSchema = z.object({
  start_date: z.string().min(1).max(50),
  social_account_id: z.string().min(1).max(100),
  posting_times: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM')).max(2).optional(),
});

export const contentPlanItemUpdateSchema = z.object({
  caption: z.string().max(2200).optional(),
  media_id: z.string().max(200).optional(),
  enabled: z.boolean().optional(),
});


// ---- Bulk Reminder Delete schema (25.5) ----

export const bulkReminderDeleteSchema = z.object({
  ids: z.array(z.string().min(1).max(100)).min(1).max(100),
});

// ---- Change Password schema (25.3) ----

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
