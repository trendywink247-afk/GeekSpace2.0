// ============================================================
// Content services (artifacts, templates, recipes, briefings, models,
// portfolio, directory) — extracted from api.ts
// ============================================================

import api from './api-client.js';
import type {
  Portfolio, DirectoryProfile, Artifact, ArtifactDomain,
  ArtifactDeployment, Template, TemplateCategory,
  FreeModelsResponse, ModelChangelogEntry,
} from '@/types';

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

  generateField: (field: string, context: string) =>
    api.post<{ generated: string; creditsUsed: number; creditsRemaining: number }>(
      `/portfolio/generate/${field}`,
      { context }
    ),

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

  getAgentStatus: (username: string) =>
    api.get<{
      status: 'active' | 'inactive';
      enabled: boolean;
      lastActive: number | null;
      inactiveSince: number | null;
      reason?: string;
    }>(`/portfolio/${username}/agent-status`),

  getStats: () =>
    api.get<{ totalViews: number; recentViews: number; dailyBreakdown: { date: string; count: number }[] }>('/portfolio/stats'),

  exportStats: () =>
    api.get<Blob>('/portfolio/stats/export', { responseType: 'blob' }),

  recordView: (username: string) =>
    api.post<{ ok: boolean }>(`/portfolio/${username}/view`),

  contact: (username: string, data: { senderName: string; senderEmail?: string; message: string; nonce?: string }) =>
    api.post<{ success: boolean }>(`/portfolio/${username}/contact`, data),

  contactNonce: (username: string) =>
    api.get<{ nonce: string }>(`/portfolio/${username}/contact-nonce`),

  getContacts: () =>
    api.get<PortfolioContact[]>('/portfolio/contacts'),

  getMeStats: () =>
    api.get<{ view_count: number; contact_count: number; project_count: number; last_viewed_at: string | null }>('/portfolio/me/stats'),

  exportAnalyticsCSV: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return api.get<string>(`/portfolio/me/analytics/export${qs ? `?${qs}` : ''}`, { responseType: 'text' });
  },

  getAnalyticsSources: () =>
    api.get<{ sources: Array<{ source: string; visits: number }> }>('/portfolio/me/analytics/sources'),
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

// ----- Artifacts -------------------------------------------

export const artifactService = {
  list: () => api.get<{ artifacts: Artifact[] }>('/artifacts'),

  get: (id: string) => api.get<Artifact & { html?: string; css?: string; js?: string }>(`/artifacts/${id}`),

  create: (data: { title: string; html?: string; css?: string; js?: string }) =>
    api.post<Artifact & { html?: string; css?: string; js?: string }>('/artifacts', data),

  update: (id: string, data: { title?: string; html?: string; css?: string; js?: string }) =>
    api.patch<Artifact>(`/artifacts/${id}`, data),

  delete: (id: string) => api.delete(`/artifacts/${id}`),

  setDomain: (id: string, subdomain: string) =>
    api.post(`/artifacts/${id}/domain`, { subdomain }),

  getDomain: (id: string) =>
    api.get<ArtifactDomain>(`/artifacts/${id}/domain`),

  removeDomain: (id: string) =>
    api.delete(`/artifacts/${id}/domain`),

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

// ----- Free Models -------------------------------------------

export const modelService = {
  getFreeModels: () => api.get<FreeModelsResponse>('/models/free'),
  getChangelog: () => api.get<{ entries: ModelChangelogEntry[] }>('/models/changelog'),
};
