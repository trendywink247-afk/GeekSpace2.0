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
  OnboardingState,
  FeatureToggles,
  MemoryEntry,
  ConversationEntry,
  ChartDataPoint,
  ProviderBreakdown,
  HourlyActivity,
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

// Refresh / logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gs_token');
      window.location.href = '/login';
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

  completeOnboarding: (state: OnboardingState) =>
    api.post<User>('/auth/onboarding', state),
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
    api.post<{ text: string; route: string; latencyMs: number; provider: string }>('/agent/chat', { message, channel }),

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
      `/usage/events?page=${page}&limit=${limit}`,
    ),

  chart: (range: '7d' | '14d' | '30d' = '7d') =>
    api.get<ChartDataPoint[]>(`/usage/chart?range=${range}`),

  providers: (days = 30) =>
    api.get<ProviderBreakdown[]>(`/usage/providers?days=${days}`),

  latency: () => api.get<HourlyActivity[]>('/usage/latency'),
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

  create: (data: { category: string; key: string; value: string; confidence?: number }) =>
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

// ----- Public Agent Chat -------------------------------------

export const publicAgentService = {
  chat: (username: string, message: string) =>
    api.post<{ reply: string; agentName: string; ownerName: string }>(`/agent/chat/public/${username}`, { message }),
};

export default api;
