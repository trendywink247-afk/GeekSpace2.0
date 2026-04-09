// ============================================================
// Dashboard & misc services — extracted from api.ts
// ============================================================

import api from './api-client.js';
import type { DashboardStats, FeatureToggles } from '@/types';

// ----- Dashboard (aggregated) --------------------------------

export const dashboardService = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  quickStats: () => api.get<{ remindersActive: number; messagesToday: number; automationsActive: number }>('/dashboard/quick-stats'),
  overview: () => api.get('/dashboard/overview'),
};

// ----- Activity Stats ----------------------------------------

export const activityService = {
  getStats: () => api.get<{ days: { date: string; messages: number; reminders: number }[] }>('/activity/stats'),
  export: () => api.get<Blob>('/activity/export', { responseType: 'blob' }),
  getHeatmap: () => api.get<{ heatmap: Array<{ date: string; count: number }> }>('/activity/heatmap'),
};

// ----- Version -----------------------------------------------

export const versionService = {
  get: () =>
    api.get<{ version: string; buildTime: string; nodeVersion: string }>('/version'),
};

// ----- Public Stats (landing page social proof) ----------------

export interface PlatformStats {
  users: number;
  conversations: number;
  messages_today: number;
  reminders_created: number;
  automations_active: number;
  countries: number;
  uptime_pct: number;
}

export const statsService = {
  getPublic: () => api.get<PlatformStats>('/stats/public'),
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

// ----- Recommendations ----

export interface Recommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  action: string;
  actionUrl?: string;
  priority: number;
  feature: string;
  cta: string;
  ctaPath: string;
  reason: string;
}

export const recommendationsService = {
  list: () =>
    api.get<{ recommendations: Recommendation[] }>('/dashboard/recommendations'),
  get: (limit?: number) =>
    api.get<Recommendation[]>('/dashboard/recommendations', { params: limit ? { limit } : undefined }),
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

// ---- Skills ----
export const skillService = {
  getCatalog: () => api.get<{ skills: Array<Record<string, unknown>> }>('/skills/catalog'),
  getUserSkills: () => api.get<{ skills: Array<Record<string, unknown>> }>('/skills/user'),
  install: (skillId: string) => api.post<{ ok: boolean }>(`/skills/${skillId}/install`),
  uninstall: (skillId: string) => api.delete<{ ok: boolean }>(`/skills/${skillId}`),
  toggle: (skillId: string, enabled: boolean) => api.patch<{ ok: boolean }>(`/skills/${skillId}`, { enabled }),
  updateAgents: (skillId: string, overrides: Record<string, unknown>) => api.patch<{ ok: boolean }>(`/skills/${skillId}/agents`, overrides),
};

// ---- Office (combined endpoint) ----
export const officeService = {
  getState: () => api.get<{
    agentStates: Array<{ agentId: string; agentName: string; state: string; content?: string; timestamp: string }>;
    taskBoard: Record<string, Array<{ id: string; agent_id: string; title: string; status: string; priority: number; started_at: string | null; created_at: string }>>;
    taskStats: { total: number; pending: number; running: number; completed: number; failed: number; completedToday: number };
    comms: Array<{ id: string; from_agent: string; to_agent: string; message: string; message_type: string; created_at: string }>;
    commStats: { total: number; unacknowledged: number; byAgent: Record<string, number>; byType: Record<string, number> };
    timeline: Array<{ action: string; details: string; icon: string; created_at: string }>;
  }>('/office/state'),
};

// ---- Planner (GAP-1) ----
export interface PlannerBlock {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: number;
  board: string;
  column: string;
  position: number;
  due_date: string | null;
  tags: string;
  sort_order: number;
  category: string;
  duration: number;
  color: string;
  source: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export const plannerService = {
  list: (board?: string) =>
    api.get<{ blocks: PlannerBlock[] }>('/planner/blocks', { params: board ? { board } : undefined }),
  getByDate: (date: string) =>
    api.get<{ blocks: PlannerBlock[] }>('/planner/blocks', { params: { date } }),
  create: (data: { title: string; description?: string; board?: string; column?: string; priority?: number; due_date?: string; tags?: string[]; date?: string; duration?: number; color?: string; category?: string; sort_order?: number; source?: string; source_id?: string }) =>
    api.post<{ block: PlannerBlock }>('/planner/blocks', data),
  update: (id: string, data: Partial<PlannerBlock>) =>
    api.patch<{ block: PlannerBlock }>(`/planner/blocks/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/planner/blocks/${id}`),
};
