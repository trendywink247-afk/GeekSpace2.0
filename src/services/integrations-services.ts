// ============================================================
// Integrations services (telegram, gmail, social, automations,
// reminders, suggestions) — extracted from api.ts
// ============================================================

import api from './api-client.js';
import type { Integration, Reminder, Automation, AutomationLog } from '@/types';

// ----- Integrations ------------------------------------------

export const integrationService = {
  list: () => api.get<Integration[]>('/integrations'),

  connect: (type: string, config?: Record<string, unknown>) =>
    api.post<Integration>(`/integrations/${type}/connect`, config),

  disconnect: (id: string) =>
    api.post(`/integrations/${id}/disconnect`),

  updatePermissions: (id: string, permissions: string[]) =>
    api.patch<Integration>(`/integrations/${id}/permissions`, { permissions }),

  linkTelegram: () =>
    api.post<{ linked: boolean; code?: string; deepLink?: string | null; botUsername?: string | null; expiresIn?: number; message: string }>('/integrations/telegram/link'),

  checkTelegramLink: () =>
    api.get<{ linked: boolean; connected?: boolean; botConfigured?: boolean; externalId?: string; username?: string; linkedAt?: string; lastMessageAt?: string | null; lastPing?: string | null }>('/integrations/telegram/status'),

  unlinkTelegram: () =>
    api.delete('/integrations/telegram/link'),

  connectCustomTelegramBot: (data: { botToken: string }) =>
    api.post<{ botName: string; botUsername: string; connected: boolean }>('/integrations/telegram/custom/connect', data),

  disconnectCustomTelegramBot: () =>
    api.delete('/integrations/telegram/custom/connect'),

  getCustomTelegramBotStatus: () =>
    api.get<{ connected: boolean; botName?: string; botUsername?: string }>('/integrations/telegram/custom/status'),

  linkWhatsApp: () => api.post<{ linked: boolean; token?: string; qrUrl?: string; expiresIn?: number; message?: string }>('/integrations/whatsapp/link'),
  checkWhatsAppStatus: () => api.get<{ linked: boolean; externalId?: string; linkedAt?: string }>('/integrations/whatsapp/status'),
  unlinkWhatsApp: () => api.delete('/integrations/whatsapp/link'),

  linkWhatsAppQR: () => api.post<{ success: boolean; sessionId: string; qrCodeDataUrl?: string; error?: string }>('/integrations/whatsapp/qr'),
  checkWhatsAppQRStatus: (sessionId: string) => api.get<{ linked: boolean; phoneNumber?: string; error?: string }>('/integrations/whatsapp/qr/' + sessionId + '/status'),

  updateNotificationEmail: (data: { enabled?: boolean; address?: string }) =>
    api.patch<{ enabled: boolean; address: string | null }>('/users/notification-email', data),

  testIntegration: (type: string) =>
    api.post<{ healthy: boolean; reason: string; type: string }>(`/integrations/${type}/test`),

  pingIntegration: (type: string) =>
    api.get<{ latencyMs: number; healthy: boolean; reason: string; type: string }>(`/integrations/${type}/ping`),

  createInvite: (email?: string) =>
    api.post<{ inviteUrl: string; token: string; expiresAt: number }>('/integrations/invite', { email }),

  listInvites: () =>
    api.get<{ id: string; token: string; email: string | null; inviteUrl: string; expired: boolean; used: boolean; created_at: number }[]>('/integrations/invites'),

  getEvents: (limit = 50) =>
    api.get<{ events: Array<{ id: string; action: string; details: string; icon: string; created_at: string }> }>(`/integrations/events?limit=${limit}`),
};

// ----- Reminders ---------------------------------------------

export const reminderService = {
  list: (filter?: { status?: string; from?: string; to?: string }) =>
    api.get<Reminder[]>('/reminders', { params: filter }),

  create: (data: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'createdBy'>) =>
    api.post<Reminder>('/reminders', data),

  update: (id: string, data: Partial<Reminder>) =>
    api.patch<Reminder>(`/reminders/${id}`, data),

  delete: (id: string) => api.delete(`/reminders/${id}`),

  bulkDelete: (ids: string[]) =>
    api.delete<{ deleted: number }>('/reminders/bulk', { data: { ids } }),

  bulkSnooze: (ids: string[], preset: '1h' | 'tomorrow' | 'next-week') =>
    api.post<{ snoozed: number; newDatetime: string }>('/reminders/bulk-snooze', { ids, preset }),

  bulkRestoreSnooze: (ids: string[], preset: '1h' | 'tomorrow' | 'next-week') =>
    api.post<{ restored: number; newDatetime: string }>('/reminders/bulk-restore-snooze', { ids, preset }),

  getStreak: () =>
    api.get<{ streak: number; longestStreak: number; completedToday: boolean }>('/reminders/streak'),

  snooze: (id: string, preset?: '1h' | 'tomorrow' | 'next-week', customDatetime?: string) =>
    api.post<{ snoozed: boolean; newDatetime: string }>(`/reminders/${id}/snooze`,
      preset ? { preset } : { customDatetime }),

  getSnoozeHistory: (id: string) =>
    api.get<{ history: Array<{ id: string; snoozed_at: number; preset: string; new_datetime: string }> }>(`/reminders/${id}/snooze-history`),

  bulkComplete: (ids: string[]) =>
    api.post<{ updated: number }>('/reminders/bulk-complete', { ids }),

  batchEdit: (ids: string[], fields: { priority?: string; category?: string }) =>
    api.patch<{ updated: number }>('/reminders/batch-edit', { ids, ...fields }),

  getStats: () =>
    api.get<{ total: number; active: number; completed: number; overdue: number; byPriority: { low: number; normal: number; high: number; urgent: number } }>('/reminders/stats'),

  exportCsv: (status: 'all' | 'active' | 'completed' = 'all') =>
    api.get<string>(`/reminders/export.csv?status=${status}`),

  exportIcs: (status: 'all' | 'active' | 'completed' = 'active') =>
    api.get<string>(`/reminders/export.ics?status=${status}`),

  duplicate: (id: string) => api.post<Reminder>(`/reminders/${id}/duplicate`),
};

// ----- Automations -------------------------------------------

export const automationService = {
  list: () => api.get<Automation[]>('/automations'),

  create: (data: Omit<Automation, 'id' | 'userId' | 'lastRun' | 'runCount' | 'createdAt'>) =>
    api.post<Automation>('/automations', data),

  update: (id: string, data: Partial<Automation>) =>
    api.patch<Automation>(`/automations/${id}`, data),

  delete: (id: string) => api.delete(`/automations/${id}`),

  trigger: (id: string) =>
    api.post<{ success: boolean }>(`/automations/${id}/trigger`),

  testFire: (id: string) =>
    api.post<{ success: boolean; statusCode: number; message: string; latencyMs?: number; contentType?: string; responseBody?: string }>(`/automations/${id}/test`),

  getDeadLetters: () =>
    api.get<Array<{ id: string; automation_id: string; url: string; error: string; payload: string | null; failed_at: number; retry_count: number; last_error: string | null }>>('/automations/dead-letters'),

  retryDeadLetter: (id: string) =>
    api.post<{ retried: boolean; removed: boolean; result: { success: boolean; output: string } }>(`/automations/dead-letters/${id}/retry`),

  duplicate: (id: string) => api.post<Automation>(`/automations/${id}/duplicate`),

  getStats: () => api.get<{ total: number; enabled: number; disabled: number; byTrigger: Array<{ trigger_type: string; cnt: number }>; recentRuns: number }>('/automations/stats'),

  dryRun: (id: string) => api.post<{
    dryRun: boolean; automationId: string; automationName: string;
    triggerType: string; actionType: string; simulatedOutput: string; enabled: boolean;
  }>(`/automations/${id}/dry-run`),
};

// ----- Automation Logs ---------------------------------------

export const automationLogService = {
  list: (limit = 50, offset = 0, status?: string) =>
    api.get<{ logs: AutomationLog[]; limit: number; offset: number }>(
      `/automations/logs?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}`
    ),

  forAutomation: (automationId: string, limit = 50, offset = 0) =>
    api.get<{ logs: AutomationLog[]; limit: number; offset: number }>(`/automations/${automationId}/logs?limit=${limit}&offset=${offset}`),
};

// ----- Social Media (Social Media Handler) ---------------------

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: 'instagram' | 'facebook';
  account_name: string;
  posting_method: 'webhook' | 'api';
  webhook_url: string;
  page_id: string;
  access_token_encrypted: string;
  status: 'active' | 'paused';
  posts_count: number;
  last_post_at: string | null;
  created_at: string;
}

export interface ContentPlan {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  niche: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  social_account_id: string | null;
  start_date: string | null;
  created_at: string;
  items?: ContentPlanItem[];
}

export interface ContentPlanItem {
  id: string;
  plan_id: string;
  day_number: number;
  slot: number;
  caption: string;
  media_id: string;
  media_type: string;
  media_url: string;
  scheduled_at: string | null;
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
  enabled: number;
  posted_at: string | null;
  error_message: string;
  created_at: string;
}

export const socialMediaService = {
  getAccounts: () =>
    api.get<SocialAccount[]>('/social-media/accounts'),

  createAccount: (data: {
    platform: string; account_name: string; posting_method: string;
    webhook_url?: string; page_id?: string; access_token?: string;
  }) => api.post<SocialAccount>('/social-media/accounts', data),

  updateAccount: (id: string, data: {
    account_name?: string; posting_method?: string; webhook_url?: string;
    page_id?: string; access_token?: string; status?: string;
  }) => api.patch<SocialAccount>(`/social-media/accounts/${id}`, data),

  deleteAccount: (id: string) =>
    api.delete<{ deleted: boolean }>(`/social-media/accounts/${id}`),

  testAccount: (id: string) =>
    api.post<{ success: boolean; message: string }>(`/social-media/accounts/${id}/test`),

  getPlans: () =>
    api.get<ContentPlan[]>('/social-media/plans'),

  getPlan: (id: string) =>
    api.get<ContentPlan>(`/social-media/plans/${id}`),

  generatePlan: (topic: string, niche: string, social_account_id?: string) =>
    api.post<ContentPlan>('/social-media/plans/generate', { topic, niche, social_account_id }),

  deletePlan: (id: string) =>
    api.delete<{ deleted: boolean }>(`/social-media/plans/${id}`),

  activatePlan: (id: string, data: {
    start_date: string; social_account_id: string; posting_times?: string[];
  }) => api.post<ContentPlan>(`/social-media/plans/${id}/activate`, data),

  updatePlanItem: (planId: string, itemId: string, data: {
    caption?: string; media_id?: string; enabled?: boolean;
  }) => api.patch<ContentPlanItem>(`/social-media/plans/${planId}/items/${itemId}`, data),

  postItem: (planId: string, itemId: string) =>
    api.post<{ success: boolean; result: string }>(`/social-media/plans/${planId}/items/${itemId}/post`),
};

// ----- Suggestions (Suggest & Earn) ---------------------------

export const suggestionService = {
  create: (data: { title: string; body: string; tags: string[] }) =>
    api.post<{ id: string; title: string; body: string; tags: string; status: string; created_at: string; duplicate_warning?: boolean; similar_title?: string }>('/suggestions', data),
  mine: (params?: { page?: number; limit?: number }) =>
    api.get<{ suggestions: Array<{ id: string; title: string; body: string; status: string; created_at: string; upvotes?: number; downvotes?: number; trending?: number }>; total: number; page: number; limit: number }>('/suggestions/mine', { params }),
  clusters: () => api.get<{ clusters: Array<{ id: string; canonical_summary: string; name?: string; tags: string; suggestion_ids: string; overall_score: number | null; total_votes?: number; created_at: string }> }>('/suggestions/clusters'),
  update: (id: string, data: { title: string; body: string }) =>
    api.patch<{ id: string; title: string; body: string; status: string; updated_at: string }>(`/suggestions/${id}`, data),
  delete: (id: string) => api.delete(`/suggestions/${id}`),
  rewards: () => api.get<{ rewards: Array<{ id: string; eventType: string; credits: number; suggestionId: string | null; clusterId: string | null; createdAt: string }> }>('/suggestions/rewards/mine'),
  vote: (id: string, vote: 1 | -1) =>
    api.post<{ upvotes: number; downvotes: number }>(`/suggestions/${id}/vote`, { vote }),
  events: (id: string) =>
    api.get<{ events: Array<{ id: string; suggestionId: string; oldStatus: string; newStatus: string; changedBy: string; changedAt: string }> }>(`/suggestions/${id}/events`),
  get: (id: string) =>
    api.get<{ id: string; userId: string; title: string; body: string; tags: string[]; status: string; createdAt: string; updatedAt: string; upvotes: number; downvotes: number }>(`/suggestions/${id}`),
};
