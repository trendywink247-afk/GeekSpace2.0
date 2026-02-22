// ============================================================
// GeekSpace API service layer — typed HTTP client that
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
      const isAuthEndpoint = ['/auth/login', '/auth/signup', '/auth/demo'].some(
        (p) => url.includes(p),
      );
      if (!isAuthEndpoint) {
        localStorage.removeItem('gs_token');
        window.location.href = '/login';
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
  },

  saveOnboardingStep: (step: number, data: Record<string, unknown>) =>
    api.patch(`/auth/onboarding/${step}`, data),

  completeOnboarding: () =>
    api.post('/auth/onboarding/complete'),

  requestPasswordReset: (email: string, channel?: 'email' | 'telegram' | 'auto') =>
    api.post<{ success: boolean; message: string; channel?: string }>('/auth/forgot-password', { email, channel }),

  verifyResetOTP: (email: string, otp: string) =>
    api.post<{ success: boolean; resetToken?: string; error?: string }>('/auth/verify-reset-otp', { email, otp }),

  resetPassword: (resetToken: string, newPassword: string) =>
    api.post<{ success: boolean; message?: string; error?: string }>('/auth/reset-password', { resetToken, newPassword }),
};

// ----- Users -------------------------------------------------

export const userService = {
  getProfile: () => api.get<User>('/users/me'),

  updateProfile: (data: Partial<User>) =>
    api.patch<User>('/users/me', data),

  getPublicProfile: (username: string) =>
    api.get<User>(`/users/${username}/public`),
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
};

// ----- API Keys ----------------------------------------------

export const apiKeyService = {
  list: () => api.get<ApiKey[]>('/api-keys'),

  create: (data: ApiKeyCreateInput) =>
    api.post<ApiKey>('/api-keys', data),

  delete: (id: string) => api.delete(`/api-keys/${id}`),

  setDefault: (id: string) =>
    api.patch<ApiKey>(`/api-keys/${id}/default`),
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
};

// ----- Billing -----------------------------------------------

export const billingService = {
  getPlans: () => api.get<PlanDefinition[]>('/billing/plans'),

  getPlan: () => api.get<Subscription>('/billing/plan'),

  upgrade: (plan: string, currency: string) =>
    api.post<Subscription>('/billing/upgrade', { plan, currency }),

  getUsage: () => api.get<DailyUsage[]>('/billing/usage'),

  activateDayPass: () => api.post<{ message: string; expiresAt: string }>('/billing/day-pass'),
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
};

// ----- Portfolio ---------------------------------------------

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
};

// ----- Dashboard (aggregated) --------------------------------

export const dashboardService = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
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

  conversations: (limit = 20) =>
    api.get<ConversationEntry[]>(`/agent/conversations?limit=${limit}`),
};

// ----- Automation Logs ---------------------------------------

export const automationLogService = {
  list: (limit = 50) =>
    api.get<AutomationLog[]>(`/automations/logs?limit=${limit}`),

  forAutomation: (automationId: string, limit = 50) =>
    api.get<AutomationLog[]>(`/automations/${automationId}/logs?limit=${limit}`),
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
  chat: (username: string, message: string) =>
    api.post<{ reply: string; agentName: string; ownerName: string; personality: string; personalityEmoji: string }>(`/agent/chat/public/${username}`, { message }),
};

// ----- Weebo Fleet ----------------------------------------

export const picoService = {
  getAgents: () =>
    api.get<Array<{
      id: string; user_id: string; slot: number; name: string; personality: string;
      status: string; tasks_completed: number; tasks_failed: number;
      created_at: string;
    }>>('/pico/agents'),

  createAgent: (name: string, personality: string = 'weebo') =>
    api.post<{ id: string; slot: number; name: string; personality: string }>('/pico/agents', { name, personality }),

  updateAgent: (id: string, data: { name?: string; status?: string }) =>
    api.patch(`/pico/agents/${id}`, data),

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

export default api;
