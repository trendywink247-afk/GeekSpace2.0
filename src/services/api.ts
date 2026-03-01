// ============================================================
// Agentin API service layer — typed HTTP client that
// communicates with the Core API backend.
// ============================================================

import axios from 'axios';
import type {
  User,
  AgentConfig,
  ApiKey,
  ApiKeyCreateInput,
  UsageSummary,
  BillingInfo,
  Integration,
  Reminder,
  Portfolio,
  Automation,
  AutomationLog,
  DashboardStats,
  DirectoryProfile,
  FeatureToggles,
  MemoryEntry,
  ConversationEntry,
  ChartDataPoint,
  ProviderBreakdown,
  HourlyActivity,
  Personality,
  Subscription,
  PlanDefinition,
  DailyUsage,
  PremiumSession,
  FreeModelsResponse,
  ModelChangelogEntry,
  Artifact,
  ArtifactDomain,
  ArtifactDeployment,
  Template,
  TemplateCategory,
  UsageEvent,
} from '@/types';

// ----- Axios instance ----------------------------------------

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh / logout on 401 (skip for auth endpoints — 401 there means wrong credentials)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      const isAuthEndpoint = ['/auth/login', '/auth/signup', '/auth/demo', '/auth/google', '/auth/github'].some(
        (p) => url.includes(p),
      );
      if (!isAuthEndpoint) {
        // Clear raw token and Zustand persisted auth state so UI resets cleanly
        localStorage.removeItem('gs_token');
        localStorage.removeItem('gs-auth');
        window.location.href = '/login';
      }
    }
    // Propagate requestId from response headers (33.5)
    if (err.response?.headers) {
      const reqId = err.response.headers['x-request-id'] ?? err.response.data?.requestId;
      if (reqId && err.response.data && typeof err.response.data === 'object') {
        err.response.data.requestId = reqId;
      }
    }
    return Promise.reject(err);
  },
);

// ----- Auth --------------------------------------------------

export const authService = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { email, password }),

  signup: (email: string, password: string, username: string) =>
    api.post<{ user: User; token: string }>('/auth/signup', { email, password, username }),

  me: () => api.get<User>('/auth/me'),

  loginDemo: () =>
    api.post<{ user: User; token: string }>('/auth/demo'),

  logout: () => {
    localStorage.removeItem('gs_token');
    localStorage.removeItem('gs-auth');
  },

  saveOnboardingStep: (step: number, data: Record<string, unknown>) =>
    api.patch(`/auth/onboarding/${step}`, data),

  completeOnboarding: () =>
    api.post('/auth/onboarding/complete'),

  requestPasswordReset: (email: string, channel?: 'email' | 'telegram' | 'auto') =>
    api.post<{ success: boolean; message: string; channel?: string; error?: string }>('/auth/forgot-password', { email, channel }),

  verifyResetOTP: (email: string, otp: string) =>
    api.post<{ success: boolean; resetToken?: string; error?: string }>('/auth/verify-reset-otp', { email, otp }),

  resetPassword: (resetToken: string, newPassword: string) =>
    api.post<{ success: boolean; message?: string; error?: string }>('/auth/reset-password', { resetToken, newPassword }),
};

// ----- Users -------------------------------------------------

export interface UserSession {
  id: string;
  created_at: string;
  last_seen: string;
  user_agent: string;
  ip: string;
  is_active: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  details: string;
  icon: string;
  created_at: string;
}

export const userService = {
  getProfile: () => api.get<User>('/users/me'),

  updateProfile: (data: Partial<User>) =>
    api.patch<User>('/users/me', data),

  getPublicProfile: (username: string) =>
    api.get<User>(`/users/${username}/public`),

  getSessions: () =>
    api.get<{ sessions: UserSession[] }>('/auth/sessions'),

  revokeSession: (id: string) =>
    api.delete<{ success: boolean }>(`/auth/sessions/${id}`),

  revokeAllSessions: () =>
    api.delete<{ success: boolean }>('/auth/sessions'),

  getPreferredModel: () =>
    api.get<{ preferredModel: string }>('/users/me/model'),

  setPreferredModel: (model: string) =>
    api.put<{ preferredModel: string }>('/users/me/model', { model }),

  getActivity: (limit = 50, offset = 0, q?: string, actionType?: string, from?: string, to?: string) => {
    const params: Record<string, string | number> = { limit, offset };
    if (q) params.q = q;
    if (actionType) params.type = actionType;
    if (from) params.from = from;
    if (to) params.to = to;
    return api.get<{ activity: ActivityEntry[]; total: number }>('/activity', { params });
  },

  clearActivity: () =>
    api.delete<{ deleted: number }>('/activity'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/users/me/change-password', {
      currentPassword,
      newPassword,
    }),

  deleteActivityEntry: (id: string) =>
    api.delete<{ deleted: number }>(`/activity/${id}`),
};

// ----- Agent -------------------------------------------------

export const agentService = {
  getConfig: () => api.get<AgentConfig>('/agent/config'),

  updateConfig: (data: Partial<AgentConfig>) =>
    api.patch<AgentConfig>('/agent/config', data),

  chat: (message: string, channel: string = 'web') =>
    api.post<{
      text: string;
      route: string;
      latencyMs: number;
      provider: string;
      model: string;
      actions?: Array<{
        tool: string;
        success: boolean;
        message: string;
        artifactId?: string;
        data?: Record<string, unknown>;
        receipt?: { icon: string; text: string; details?: string; link?: string };
      }>;
      receiptText?: string;
      receipts?: Array<{ icon: string; text: string; details?: string; link?: string }>;
    }>('/agent/chat', { message, channel }),

  /** SSE streaming chat — returns a ReadableStream */
  chatStream: async (message: string, channel: string = 'web') => {
    const token = localStorage.getItem('gs_token');
    const res = await fetch(`${API_URL}/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, channel }),
    });
    return res;
  },

  executeCommand: (command: string) =>
    api.post<{ output: string; isError: boolean }>('/agent/command', { command }),

  getPersonalities: () =>
    api.get<Record<string, Personality>>('/agent/personalities'),

  generateContent: (type: string, tags: string[], name?: string) =>
    api.post<{ content: string; parsed?: Record<string, unknown> }>('/agent/generate-content', { type, tags, name }),

  generateBackground: (vibe?: string) =>
    api.post<{ gradient: string; name: string; accent: string }>('/agent/generate-background', { vibe }),

  getQuality: () =>
    api.get<{
      totalMessages: number;
      positiveReactions: number;
      negativeReactions: number;
      satisfactionRate: number | null;
      trend: 'up' | 'down' | 'neutral';
      hasEnoughData: boolean;
    }>('/agent/quality'),

  getRateLimitStatus: () =>
    api.get<{ remaining: number; limit: number; resetAt: string; windowMinutes: number }>('/agent/rate-limit-status'),

  // 60.2: Star / unstar a message
  toggleStar: (messageId: string) =>
    api.post<{ starred: boolean }>(`/agent/conversations/${messageId}/star`),

  // 60.2: Get starred messages
  getStarred: (limit = 50) =>
    api.get<{ messages: ConversationEntry[] }>(`/agent/conversations/starred?limit=${limit}`),
};

// ----- Version -----------------------------------------------

export const versionService = {
  get: () =>
    api.get<{ version: string; buildTime: string; nodeVersion: string }>('/version'),
};

// ----- API Keys ----------------------------------------------

export const apiKeyService = {
  list: () => api.get<ApiKey[]>('/api-keys'),

  create: (data: ApiKeyCreateInput) =>
    api.post<ApiKey>('/api-keys', data),

  delete: (id: string) => api.delete(`/api-keys/${id}`),

  setDefault: (id: string) =>
    api.patch<ApiKey>(`/api-keys/${id}/default`),

  rotate: (id: string, key: string) =>
    api.post<{ success: boolean; maskedKey: string }>(`/api-keys/${id}/rotate`, { key }),
};

// ----- Usage & Billing ---------------------------------------

export const usageService = {
  summary: (range: 'day' | 'week' | 'month' = 'month') =>
    api.get<UsageSummary>(`/usage/summary?range=${range}`),

  billing: () => api.get<BillingInfo>('/usage/billing'),

  events: (page = 1, limit = 50) =>
    api.get<{ events: import('@/types').UsageEvent[]; total: number }>(
      `/usage/events?offset=${(page - 1) * limit}&limit=${limit}`,
    ),

  chart: (range: '7d' | '14d' | '30d' = '7d') =>
    api.get<ChartDataPoint[]>(`/usage/chart?range=${range}`),

  providers: (days = 30) =>
    api.get<ProviderBreakdown[]>(`/usage/providers?days=${days}`),

  latency: () => api.get<HourlyActivity[]>('/usage/latency'),

  daily: (days = 7) =>
    api.get<Array<{ day: string; label: string; messages: number; credits: number }>>(`/usage/daily?days=${days}`),

  today: () =>
    api.get<{
      plan: string;
      tokenBudget: number;
      tokenUsed: number;
      tokenPercentage: number;
      messages: { used: number; limit: number; percentage: number };
      voice: { used: number; limit: number; percentage: number };
      images: { used: number; limit: number; percentage: number };
    }>('/usage/today'),
};

// ----- Billing -----------------------------------------------

export const billingService = {
  getPlans: () => api.get<PlanDefinition[]>('/billing/plans'),

  getPlan: () => api.get<Subscription>('/billing/plan'),

  upgrade: (plan: string, currency: string) =>
    api.post<Subscription>('/billing/upgrade', { plan, currency }),

  getUsage: () => api.get<DailyUsage[]>('/billing/usage'),

  activateDayPass: () => api.post<{ message: string; expiresAt: string }>('/billing/day-pass'),

  getEvents: () => api.get<UsageEvent[]>('/billing/events'),
};

// ----- Integrations ------------------------------------------

export const integrationService = {
  list: () => api.get<Integration[]>('/integrations'),

  connect: (type: string, config?: Record<string, unknown>) =>
    api.post<Integration>(`/integrations/${type}/connect`, config),

  disconnect: (id: string) =>
    api.post(`/integrations/${id}/disconnect`),

  updatePermissions: (id: string, permissions: string[]) =>
    api.patch<Integration>(`/integrations/${id}/permissions`, { permissions }),

  // Telegram linking
  linkTelegram: () =>
    api.post<{ linked: boolean; code?: string; deepLink?: string | null; botUsername?: string | null; expiresIn?: number; message: string }>('/integrations/telegram/link'),

  checkTelegramLink: () =>
    api.get<{ linked: boolean; externalId?: string; username?: string; linkedAt?: string; lastMessageAt?: string | null }>('/integrations/telegram/status'),

  unlinkTelegram: () =>
    api.delete('/integrations/telegram/link'),

  // WhatsApp linking (old token-based)
  linkWhatsApp: () => api.post<{ linked: boolean; token?: string; qrUrl?: string; expiresIn?: number; message?: string }>('/integrations/whatsapp/link'),
  checkWhatsAppStatus: () => api.get<{ linked: boolean; externalId?: string; linkedAt?: string }>('/integrations/whatsapp/status'),
  unlinkWhatsApp: () => api.delete('/integrations/whatsapp/link'),
  
  // WhatsApp QR-based linking (new, like OpenClaw)
  linkWhatsAppQR: () => api.post<{ success: boolean; sessionId: string; qrCodeDataUrl?: string; error?: string }>('/integrations/whatsapp/qr'),
  checkWhatsAppQRStatus: (sessionId: string) => api.get<{ linked: boolean; phoneNumber?: string; error?: string }>('/integrations/whatsapp/qr/' + sessionId + '/status'),

  // Email notification settings
  updateNotificationEmail: (data: { enabled?: boolean; address?: string }) =>
    api.patch<{ enabled: boolean; address: string | null }>('/users/notification-email', data),

  // Health check for a connected integration (24.1)
  testIntegration: (type: string) =>
    api.post<{ healthy: boolean; reason: string; type: string }>(`/integrations/${type}/test`),

  // 62.7: Ping integration with latency measurement
  pingIntegration: (type: string) =>
    api.get<{ latencyMs: number; healthy: boolean; reason: string; type: string }>(`/integrations/${type}/ping`),

  // 27.3: Connection invite links
  createInvite: (email?: string) =>
    api.post<{ inviteUrl: string; token: string; expiresAt: number }>('/integrations/invite', { email }),

  listInvites: () =>
    api.get<{ id: string; token: string; email: string | null; inviteUrl: string; expired: boolean; used: boolean; created_at: number }[]>('/integrations/invites'),

  // 65.6: Integration event log
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

  // 53.4: Restore completed reminders back to active with a snooze preset
  bulkRestoreSnooze: (ids: string[], preset: '1h' | 'tomorrow' | 'next-week') =>
    api.post<{ restored: number; newDatetime: string }>('/reminders/bulk-restore-snooze', { ids, preset }),

  getStreak: () =>
    api.get<{ streak: number; longestStreak: number; completedToday: boolean }>('/reminders/streak'),

  snooze: (id: string, preset?: '1h' | 'tomorrow' | 'next-week', customDatetime?: string) =>
    api.post<{ snoozed: boolean; newDatetime: string }>(`/reminders/${id}/snooze`,
      preset ? { preset } : { customDatetime }),

  getSnoozeHistory: (id: string) =>
    api.get<{ history: Array<{ id: string; snoozed_at: number; preset: string; new_datetime: string }> }>(`/reminders/${id}/snooze-history`),

  // 38.3: CSV export — returns raw CSV text (authenticated via Axios interceptor)
  bulkComplete: (ids: string[]) =>
    api.post<{ updated: number }>('/reminders/bulk-complete', { ids }),

  // 62.10: Batch edit priority/category
  batchEdit: (ids: string[], fields: { priority?: string; category?: string }) =>
    api.patch<{ updated: number }>('/reminders/batch-edit', { ids, ...fields }),

  getStats: () =>
    api.get<{ total: number; active: number; completed: number; overdue: number; byPriority: { low: number; normal: number; high: number; urgent: number } }>('/reminders/stats'),

  exportCsv: (status: 'all' | 'active' | 'completed' = 'all') =>
    api.get<string>(`/reminders/export.csv?status=${status}`),

  exportIcs: (status: 'all' | 'active' | 'completed' = 'active') =>
    api.get<string>(`/reminders/export.ics?status=${status}`),

  // 64.4: Duplicate a reminder
  duplicate: (id: string) => api.post<Reminder>(`/reminders/${id}/duplicate`),
};

// ----- Portfolio ---------------------------------------------

export type PortfolioContact = {
  id: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
  created_at: string;
};

export const portfolioService = {
  get: () => api.get<Portfolio>('/portfolio/me'),

  update: (data: Partial<Portfolio>) =>
    api.patch<Portfolio>('/portfolio/me', data),

  getPublic: (username: string) =>
    api.get<Portfolio>(`/portfolio/${username}`),

  aiEdit: (prompt: string) =>
    api.post<Portfolio>('/portfolio/ai-edit', { prompt }),

  // Task 5: Magic Generate
  generateField: (field: string, context: string) =>
    api.post<{ generated: string; creditsUsed: number; creditsRemaining: number }>(
      `/portfolio/generate/${field}`,
      { context }
    ),

  // Task 6: Suggestions
  getSuggestions: () =>
    api.get<Array<{
      id: string;
      field: string;
      currentValue: string;
      suggestedValue: string;
      reason: string;
      confidence: number;
    }>>('/portfolio/suggestions'),

  applySuggestion: (id: string) =>
    api.post<{ success: boolean }>(`/portfolio/suggestions/${id}/apply`),

  // Task 7: Agent Chat
  canChat: (username: string) =>
    api.get<{ canChat: boolean }>(`/portfolio/${username}/can-chat`),

  sendAgentMessage: (username: string, message: string) =>
    api.post<{ success: boolean }>(`/portfolio/${username}/chat`, { message }),

  getAgentMessages: () =>
    api.get<Array<{
      id: string;
      from_user_id: string;
      to_user_id: string;
      content: string;
      is_read: number;
      created_at: string;
      from_username: string;
    }>>('/portfolio/agent-messages'),

  // Agent status for portfolio view (Active/Inactive)
  getAgentStatus: (username: string) =>
    api.get<{
      status: 'active' | 'inactive';
      enabled: boolean;
      lastActive: number | null;
      inactiveSince: number | null;
      reason?: string;
    }>(`/portfolio/${username}/agent-status`),

  // Portfolio visit stats (includes 30-day daily breakdown)
  getStats: () =>
    api.get<{ totalViews: number; recentViews: number; dailyBreakdown: { date: string; count: number }[] }>('/portfolio/stats'),

  // Portfolio visit stats CSV export (last 90 days)
  exportStats: () =>
    api.get<Blob>('/portfolio/stats/export', { responseType: 'blob' }),

  // 34.3: Increment view count for a portfolio (public, no auth)
  recordView: (username: string) =>
    api.post<{ ok: boolean }>(`/portfolio/${username}/view`),

  // 37.1: Contact portfolio owner (public)
  contact: (username: string, data: { senderName: string; senderEmail?: string; message: string; nonce?: string }) =>
    api.post<{ success: boolean }>(`/portfolio/${username}/contact`, data),

  // 49.7: Fetch a one-time nonce token for the contact form (prevents replay attacks)
  contactNonce: (username: string) =>
    api.get<{ nonce: string }>(`/portfolio/${username}/contact-nonce`),

  // 37.1: Get contact messages (authenticated, owner only)
  getContacts: () =>
    api.get<PortfolioContact[]>('/portfolio/contacts'),

  // 42.4: GET /portfolio/me/stats — view_count, contact_count, project_count, last_viewed_at
  getMeStats: () =>
    api.get<{ view_count: number; contact_count: number; project_count: number; last_viewed_at: string | null }>('/portfolio/me/stats'),

  // 63.2: Download daily analytics as CSV (66.6: optional date range)
  exportAnalyticsCSV: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return api.get<string>(`/portfolio/me/analytics/export${qs ? `?${qs}` : ''}`, { responseType: 'text' });
  },

  // 65.10: Visitor source analytics
  getAnalyticsSources: () =>
    api.get<{ sources: Array<{ source: string; visits: number }> }>('/portfolio/me/analytics/sources'),
};

// ----- Activity Stats ----------------------------------------

export const activityService = {
  getStats: () => api.get<{ days: { date: string; messages: number; reminders: number }[] }>('/activity/stats'),
  // 64.8: CSV export of last 500 activity entries
  export: () => api.get<Blob>('/activity/export', { responseType: 'blob' }),
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

  // 34.5: Test-fire a webhook automation
  testFire: (id: string) =>
    api.post<{ success: boolean; statusCode: number; message: string; latencyMs?: number; contentType?: string; responseBody?: string }>(`/automations/${id}/test`),

  // 37.4: Dead-letter log for failed webhook deliveries
  getDeadLetters: () =>
    api.get<Array<{ id: string; automation_id: string; url: string; error: string; payload: string | null; failed_at: number; retry_count: number; last_error: string | null }>>('/automations/dead-letters'),

  // 55.6: Retry a failed dead-letter webhook delivery
  retryDeadLetter: (id: string) =>
    api.post<{ retried: boolean; removed: boolean; result: { success: boolean; output: string } }>(`/automations/dead-letters/${id}/retry`),

  // 59.4: Duplicate an automation
  duplicate: (id: string) => api.post<Automation>(`/automations/${id}/duplicate`),

  // 64.5: Automation stats (total, enabled, disabled, recentRuns, byTrigger)
  getStats: () => api.get<{ total: number; enabled: number; disabled: number; byTrigger: Array<{ trigger_type: string; cnt: number }>; recentRuns: number }>('/automations/stats'),

  // 61.8: Dry-run simulation
  dryRun: (id: string) => api.post<{
    dryRun: boolean; automationId: string; automationName: string;
    triggerType: string; actionType: string; simulatedOutput: string; enabled: boolean;
  }>(`/automations/${id}/dry-run`),
};

// ----- Dashboard (aggregated) --------------------------------

export const dashboardService = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  // 65.5: Lightweight quick-stats (Redis-cached 60s)
  quickStats: () => api.get<{ remindersActive: number; messagesToday: number; automationsActive: number }>('/dashboard/quick-stats'),
};

// ----- Explore / Directory -----------------------------------

export const directoryService = {
  list: (params?: { tags?: string[]; search?: string; page?: number }) => {
    const query: Record<string, string> = {};
    if (params?.search) query.search = params.search;
    if (params?.tags?.length) query.tag = params.tags[0];
    if (params?.page) query.page = String(params.page);
    return api.get<{ profiles: DirectoryProfile[]; total: number }>('/directory', { params: query });
  },
};

// ----- Feature Toggles ---------------------------------------

export const featureService = {
  get: () => api.get<FeatureToggles>('/features'),

  update: (data: Partial<FeatureToggles>) =>
    api.patch<FeatureToggles>('/features', data),
};

// ----- Contact -----------------------------------------------

export const contactService = {
  submit: (data: { name: string; email: string; company?: string; message: string }) =>
    api.post<{ success: boolean; message: string }>('/dashboard/contact', data),
};

// ----- Memory ------------------------------------------------

export const memoryService = {
  list: (category?: string, search?: string) =>
    api.get<MemoryEntry[]>('/agent/memory', {
      params: { ...(category ? { category } : {}), ...(search ? { search } : {}) },
    }),

  create: (data: { category: string; key: string; value: string; confidence?: number; source?: string }) =>
    api.post<MemoryEntry>('/agent/memory', data),

  update: (id: string, data: { category?: string; key?: string; value?: string; confidence?: number }) =>
    api.put<MemoryEntry>(`/agent/memory/${id}`, data),

  delete: (memoryId: string) =>
    api.delete(`/agent/memory/${memoryId}`),

  // 65.7: Bulk-clear all memories in a category
  bulkClear: (category: string) =>
    api.delete<{ deleted: number }>(`/agent/memory/bulk?category=${encodeURIComponent(category)}`),

  conversations: (limit = 20) =>
    api.get<ConversationEntry[]>(`/agent/conversations?limit=${limit}`),

  getConversationsExport: (limit = 1000) =>
    api.get<ConversationEntry[]>(`/agent/conversations?limit=${limit}`),

  getConversationsMarkdownExport: () =>
    api.get<string>('/agent/conversations/export?format=md', { responseType: 'text' }),

  getConversationsMarkdownExport7Days: () =>
    api.get<string>('/agent/conversations/export?format=md&days=7', { responseType: 'text' }),

  addReaction: (messageId: string, reaction: string) =>
    api.post<{ success: boolean }>('/agent/conversations/reactions', { messageId, reaction }),

  getReactionSummary: () =>
    api.get<{ reactions: { reaction: string; count: number }[] }>('/agent/conversations/reactions/summary'),

};

// ----- Automation Logs ---------------------------------------

export const automationLogService = {
  // 53.7: Paginated — returns { logs, limit, offset }; 63.4: optional status filter
  list: (limit = 50, offset = 0, status?: string) =>
    api.get<{ logs: AutomationLog[]; limit: number; offset: number }>(
      `/automations/logs?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}`
    ),

  forAutomation: (automationId: string, limit = 50, offset = 0) =>
    api.get<{ logs: AutomationLog[]; limit: number; offset: number }>(`/automations/${automationId}/logs?limit=${limit}&offset=${offset}`),
};

// ----- Premium Agent -----------------------------------------

export const premiumAgentService = {
  deploy: (task: string) =>
    api.post<PremiumSession>('/agent/deploy-premium', { task }),

  chat: (sessionId: string, message: string) =>
    api.post<{ text: string; provider: string; model: string; latencyMs: number; creditsUsed: number; sessionCreditsTotal: number; messagesCount: number; creditsRemaining: number }>(
      `/agent/premium-chat/${sessionId}`, { message }),

  endSession: (sessionId: string) =>
    api.delete<PremiumSession>(`/agent/premium-session/${sessionId}`),
};

// ----- Public Agent Chat -------------------------------------

export const publicAgentService = {
  canChat: (username: string) =>
    api.get<{ canChat: boolean }>(`/agent/can-chat-public/${username}`),
  chat: (username: string, message: string, history?: Array<{ role: string; content: string }>, messageCount?: number) =>
    api.post<{ reply: string; agentName: string; ownerName: string; personality: string; personalityEmoji: string }>(`/agent/chat/public/${username}`, { message, history, messageCount }),
};

// ----- Weebo Fleet ----------------------------------------

export interface PicoAgentFull {
  id: string; user_id: string; slot: number; name: string; personality: string;
  status: string; tasks_completed: number; tasks_failed: number;
  created_at: string;
  system_prompt: string; mode: string; voice: string;
  creativity: number; formality: number; model_preference: string;
  custom_commands: string; assigned_tools: string; enabled: number;
}

export interface PicoCronJob {
  id: string; user_id: string; agent_slot: number; name: string;
  task_type: string; task_config: string; interval_minutes: number;
  enabled: number; last_run_at: string | null; next_run_at: string | null;
  run_count: number; created_at: string;
}

export const picoService = {
  getAgents: () =>
    api.get<PicoAgentFull[]>('/pico/agents'),

  createAgent: (name: string, personality: string = 'weebo') =>
    api.post<PicoAgentFull>('/pico/agents', { name, personality }),

  updateAgent: (id: string, data: {
    name?: string; status?: string; system_prompt?: string;
    mode?: string; voice?: string; creativity?: number; formality?: number;
    model_preference?: string; custom_commands?: string;
    assigned_tools?: string[]; enabled?: boolean;
  }) => api.patch<PicoAgentFull>(`/pico/agents/${id}`, data),

  deleteAgent: (id: string) =>
    api.delete(`/pico/agents/${id}`),

  getTasks: (params?: { status?: string; slot?: number; limit?: number }) =>
    api.get<Array<{
      id: string; user_id: string; agent_slot: number; agent_name: string;
      task_type: string; description: string; payload: string;
      status: string; result: string | null; planned_by: string;
      created_at: string; started_at: string | null; completed_at: string | null;
    }>>('/pico/tasks', { params }),

  getTask: (id: string) =>
    api.get('/pico/tasks/' + id),

  planTask: (request: string) =>
    api.post<{
      planned: Array<{ task_type: string; description: string }>;
      queued: number;
      task_ids: string[];
      credits_used: number;
      credits_remaining: number;
      message?: string;
      escalate?: boolean;
      request?: string;
    }>('/pico/tasks/plan', { request }),

  planTaskPremium: (request: string) =>
    api.post<{
      planned: Array<{ task_type: string; description: string }>;
      queued: number;
      task_ids: string[];
      credits_used: number;
      credits_remaining: number;
      message?: string;
    }>('/pico/tasks/plan-premium', { request }),

  cancelTask: (id: string) =>
    api.delete(`/pico/tasks/${id}`),

  // Cron Jobs
  getCronJobs: () =>
    api.get<PicoCronJob[]>('/pico/cron-jobs'),

  createCronJob: (data: {
    name: string; task_type: string; task_config?: Record<string, unknown>;
    interval_minutes: number; agent_slot?: number;
  }) => api.post<PicoCronJob>('/pico/cron-jobs', data),

  updateCronJob: (id: string, data: {
    name?: string; task_type?: string; task_config?: Record<string, unknown>;
    interval_minutes?: number; agent_slot?: number; enabled?: boolean;
  }) => api.patch<PicoCronJob>(`/pico/cron-jobs/${id}`, data),

  deleteCronJob: (id: string) =>
    api.delete(`/pico/cron-jobs/${id}`),
};

// ----- Briefings -------------------------------------------

export const briefingService = {
  getRecent: (limit = 10) =>
    api.get<Array<{
      id: string; type: string; content: string;
      channels_sent: string; created_at: string;
    }>>('/briefings', { params: { limit } }),

  triggerNow: () =>
    api.post('/briefings/trigger'),
};

// ----- Recipes -----------------------------------------------

export const recipeService = {
  getAll: () =>
    api.get<Array<{
      id: string; name: string; description: string; icon: string;
      category: string; requiredIntegrations: string[];
      installed: boolean; installedAt: string | null;
    }>>('/recipes'),

  install: (id: string, config?: Record<string, unknown>) =>
    api.post(`/recipes/${id}/install`, { config }),

  uninstall: (id: string) =>
    api.delete(`/recipes/${id}/uninstall`),
};

// ----- Free Models -------------------------------------------

export const modelService = {
  getFreeModels: () => api.get<FreeModelsResponse>('/models/free'),
  getChangelog: () => api.get<{ entries: ModelChangelogEntry[] }>('/models/changelog'),
};

// ----- Artifacts -------------------------------------------

export const artifactService = {
  list: () => api.get<{ artifacts: Artifact[] }>('/artifacts'),

  get: (id: string) => api.get<Artifact & { html?: string; css?: string; js?: string }>(`/artifacts/${id}`),

  update: (id: string, data: { title?: string; html?: string; css?: string; js?: string }) =>
    api.patch<Artifact>(`/artifacts/${id}`, data),

  delete: (id: string) => api.delete(`/artifacts/${id}`),

  // Custom domain
  setDomain: (id: string, subdomain: string) =>
    api.post(`/artifacts/${id}/domain`, { subdomain }),

  getDomain: (id: string) =>
    api.get<ArtifactDomain>(`/artifacts/${id}/domain`),

  removeDomain: (id: string) =>
    api.delete(`/artifacts/${id}/domain`),

  // Exports
  exportZip: (id: string) =>
    api.post(`/artifacts/${id}/export/zip`, {}, { responseType: 'blob' }),

  deployToNetlify: (id: string, netlifyToken: string) =>
    api.post<{ success: boolean; url: string; message: string }>(`/artifacts/${id}/export/netlify`, { netlifyToken }),

  deployToVercel: (id: string, vercelToken: string) =>
    api.post<{ success: boolean; url: string; message: string }>(`/artifacts/${id}/export/vercel`, { vercelToken }),

  getDeployments: (id: string) =>
    api.get<{ deployments: ArtifactDeployment[] }>(`/artifacts/${id}/deployments`),
};

// ----- Templates -------------------------------------------

export const templateService = {
  list: (params?: { category?: string; search?: string; officialOnly?: boolean }) =>
    api.get<{ templates: Template[] }>('/templates', { params }),

  get: (id: string) => api.get<Template>(`/templates/${id}`),

  clone: (id: string, title?: string) =>
    api.post<{ success: boolean; artifactId: string; title: string; previewUrl: string; message: string }>(`/templates/${id}/clone`, { title }),

  getCategories: () =>
    api.get<{ categories: TemplateCategory[] }>('/templates/categories/list'),
};

// ----- Images (Image Generator) --------------------------------

export interface UserImage {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  width: number;
  height: number;
  source: 'generated' | 'edited' | 'uploaded';
  created_at: string;
  expires_at: string;
}

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  cost: string;
  credits: number;
  tier: 'auto' | 'free' | 'standard' | 'premium';
}

export const imageService = {
  list: () =>
    api.get<{ images: UserImage[]; count: number; max: number }>('/images'),

  get: (id: string) =>
    api.get<UserImage>(`/images/${id}`),

  generate: (prompt: string, model?: string, width?: number, height?: number) =>
    api.post<UserImage>('/images/generate', { prompt, model, width, height }),

  edit: (prompt: string, referenceUrl?: string, model?: string) =>
    api.post<UserImage>('/images/edit', { prompt, reference_url: referenceUrl, model }),

  delete: (id: string) =>
    api.delete<{ deleted: boolean }>(`/images/${id}`),

  getModels: () =>
    api.get<{ models: ImageModel[] }>('/images/models/available'),
};

// ----- Videos (Video Generator) --------------------------------

export interface UserVideo {
  id: string;
  prompt: string;
  model: string;
  video_url: string;
  width: number;
  height: number;
  duration: number;
  status: 'processing' | 'ready';
  source: 'generated';
  created_at: string;
  expires_at: string;
}

export interface VideoModel {
  id: string;
  name: string;
  description: string;
  cost: string;
  credits: number;
  tier: 'auto' | 'free' | 'standard' | 'premium';
}

// ── Director Mode types ───────────────────────────────────────

export interface DirectorShot {
  index: number;
  prompt: string;
  cameraMove: string;
}

export interface DirectorPacket {
  title: string;
  genre: string;
  styleGuide: string;
  transitions: string;
  shotlist: DirectorShot[];
}

export interface DirectorClip {
  success: boolean;
  url: string;
  error?: string;
  requestId?: string;
  durationMs?: number;
}

export interface DirectorJob {
  id: string;
  idea: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  packet: DirectorPacket | null;
  clips: DirectorClip[];
  error: string | null;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

export const videoService = {
  list: () =>
    api.get<{ videos: UserVideo[]; count: number; max: number }>('/videos'),

  get: (id: string) =>
    api.get<UserVideo>(`/videos/${id}`),

  generate: (prompt: string, model?: string, width?: number, height?: number, duration?: number) =>
    api.post<UserVideo & { estimated_time: number }>('/videos/generate', { prompt, model, width, height, duration }),

  checkStatus: (id: string) =>
    api.get<{ status: string; video_url: string }>(`/videos/${id}/status`),

  delete: (id: string) =>
    api.delete<{ deleted: boolean }>(`/videos/${id}`),

  getModels: () =>
    api.get<{ models: VideoModel[] }>('/videos/models/available'),

  // 55.13: Seedance Director Mode
  directorCreate: (idea: string, width?: number, height?: number) =>
    api.post<{ jobId: string; status: string; message: string }>('/videos/director/create', { idea, width, height }),

  // 65.13: Expand idea with AI before creating a Director job
  directorExpandIdea: (idea: string) =>
    api.post<{ expanded: string }>('/videos/director/expand-idea', { idea }),

  directorList: () =>
    api.get<{ jobs: DirectorJob[] }>('/videos/director'),

  directorGet: (jobId: string) =>
    api.get<DirectorJob>(`/videos/director/${jobId}`),

  // 57.13: Stitch clips into one video
  directorStitch: (jobId: string) =>
    api.post<{ stitched: boolean; stitchedUrl: string | null; clipUrls: string[]; softStitch: boolean; cached?: boolean }>(`/videos/director/${jobId}/stitch`),

  // 60.13: Retry a single failed clip
  directorRetryClip: (jobId: string, clipIndex: number) =>
    api.post<{ message: string; clipIndex: number }>(`/videos/director/${jobId}/retry-clip/${clipIndex}`),
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
  // Accounts
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

  // Plans
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

  // Plan Items
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

export default api;
