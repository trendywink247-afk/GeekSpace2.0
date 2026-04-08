// ============================================================
// Auth & User services — extracted from api.ts
// ============================================================

import api from './api-client.js';
import type { User } from '@/types';

// ----- Auth --------------------------------------------------

export const authService = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { email, password }),

  signup: (email: string, password: string, username: string, name?: string, invite_code?: string) =>
    api.post<{ user: User; token: string }>('/auth/signup', { email, password, username, name, invite_code }),

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

  // 82.8: Permanently delete the authenticated user's account
  deleteUserAccount: (password: string) =>
    api.post<{ success: boolean; message: string }>('/auth/delete-account', { password }),
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

  getActivity: (limit = 50, offset = 0, q?: string, actionType?: string, from?: string, to?: string, category?: string) => {
    const params: Record<string, string | number> = { limit, offset };
    if (q) params.q = q;
    if (actionType) params.type = actionType;
    if (from) params.from = from;
    if (to) params.to = to;
    if (category) params.category = category;
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
