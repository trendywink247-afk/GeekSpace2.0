// ============================================================
// Agent services — extracted from api.ts
// ============================================================

import api, { API_URL } from './api-client.js';
import type { AgentConfig, ConversationEntry, Personality, PremiumSession, MemoryEntry } from '@/types';

// ----- Agent -------------------------------------------------

export const agentService = {
  getConfig: () => api.get<AgentConfig>('/agent/config'),

  updateConfig: (data: Partial<AgentConfig>) =>
    api.patch<AgentConfig>('/agent/config', data),

  chat: (message: string, channel: string = 'web', existingArtifactId?: string, conversationId?: string) =>
    api.post<{
      text: string;
      route: string;
      latencyMs: number;
      provider: string;
      model: string;
      conversationId?: string;
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
    }>('/agent/chat', { message, channel, ...(existingArtifactId ? { existingArtifactId } : {}), ...(conversationId ? { conversationId } : {}) }),

  /** SSE streaming chat — returns a ReadableStream */
  chatStream: async (message: string, channel: string = 'web', signal?: AbortSignal, personality?: string, conversationId?: string) => {
    const token = localStorage.getItem('gs_token');
    const res = await fetch(`${API_URL}/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, channel, ...(personality ? { personality } : {}), ...(conversationId ? { conversationId } : {}) }),
      signal,
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

  setImageModel: (modelId: string) =>
    api.patch<Record<string, unknown>>('/agent/config', { preferred_image_model: modelId }),

  setVideoModel: (modelId: string) =>
    api.patch<Record<string, unknown>>('/agent/config', { preferred_video_model: modelId }),

  // Rate a conversation (1-5 stars)
  rateConversation: (messageId: string, score: number) =>
    api.post<{ ok: boolean }>(`/agent/conversations/${messageId}/rating`, { score }),
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

  // Clear ALL memories for the user (requires confirm=yes)
  clearAll: () =>
    api.delete<{ deleted: number }>('/agent/memory/bulk-all?confirm=yes'),

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

// ----- Goals (Agentic Experience) ----

export interface GoalData {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'failed' | 'archived';
  priority: number;
  category: string;
  assigned_agent: string;
  target_date: string | null;
  progress: number;
  outcome: string | null;
  parent_goal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalStepData {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked';
  assigned_agent: string;
  step_order: number;
  depends_on: string;
  effort: 'low' | 'medium' | 'high';
  result: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalEventData {
  id: string;
  goal_id: string;
  event_type: string;
  agent_id: string | null;
  step_id: string | null;
  message: string;
  metadata: string;
  created_at: string;
}

export interface WorkspaceArtifactData {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  content: string;
  artifact_type: string;
  created_by_agent: string | null;
  tags: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AgentNotificationData {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  goal_id: string | null;
  agent_id: string | null;
  read: number;
  created_at: string;
}

export const goalsService = {
  list: (status?: string) =>
    api.get<{ goals: GoalData[] }>('/agent/goals', { params: status ? { status } : undefined }),
  get: (id: string) =>
    api.get<{ goal: GoalData; steps: GoalStepData[] }>(`/agent/goals/${id}`),
  create: (data: { title: string; description?: string; category?: string; target_date?: string }) =>
    api.post<{ goal: GoalData }>('/agent/goals', data),
  update: (id: string, data: Partial<{ title: string; description: string; status: string; priority: number; category: string; target_date: string }>) =>
    api.patch<{ goal: GoalData }>(`/agent/goals/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/agent/goals/${id}`),
  plan: (id: string) =>
    api.post<{ steps: GoalStepData[] }>(`/agent/goals/${id}/plan`),
  executeNext: (id: string) =>
    api.post<{ step: GoalStepData; result: string }>(`/agent/goals/${id}/execute`),
  getSteps: (id: string) =>
    api.get<{ steps: GoalStepData[] }>(`/agent/goals/${id}/steps`),
  updateStep: (goalId: string, stepId: string, data: { status?: string; result?: string }) =>
    api.patch<{ step: GoalStepData }>(`/agent/goals/${goalId}/steps/${stepId}`, data),
  getEvents: (id: string, limit?: number) =>
    api.get<{ events: GoalEventData[] }>(`/agent/goals/${id}/events`, { params: limit ? { limit } : undefined }),
  stats: () =>
    api.get<{ total: number; active: number; completed: number; paused: number; failed: number; completionRate: number }>('/agent/goals/stats'),
};

export const workspaceService = {
  list: (goalId?: string) =>
    api.get<{ artifacts: WorkspaceArtifactData[] }>('/agent/workspace', { params: goalId ? { goal_id: goalId } : undefined }),
  create: (data: { title: string; content: string; artifact_type?: string; goal_id?: string; tags?: string[] }) =>
    api.post<{ artifact: WorkspaceArtifactData }>('/agent/workspace', data),
  update: (id: string, data: Partial<{ title: string; content: string; tags: string[] }>) =>
    api.patch<{ artifact: WorkspaceArtifactData }>(`/agent/workspace/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/agent/workspace/${id}`),
};

export const agentNotificationsService = {
  list: (limit?: number) =>
    api.get<{ notifications: AgentNotificationData[] }>('/agent/notifications', { params: limit ? { limit } : undefined }),
  count: () =>
    api.get<{ unread: number }>('/agent/notifications/count'),
  markRead: (id: string) =>
    api.patch<{ success: boolean }>(`/agent/notifications/${id}/read`),
  markAllRead: () =>
    api.post<{ success: boolean }>('/agent/notifications/read-all'),
};

// ---- Conversation Threading ----
export interface ConversationThreadData {
  id: string;
  user_id: string;
  title: string;
  last_message_preview: string;
  message_count: number;
  channel: string;
  agent_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export const conversationThreadsService = {
  list: (limit?: number) =>
    api.get<{ conversations: ConversationThreadData[] }>('/agent/conversations/threads', { params: limit ? { limit } : undefined }),
  getMessages: (conversationId: string, limit?: number) =>
    api.get<{ messages: Array<{ id: string; role: string; content: string; agent_id: string | null; provider: string; created_at: string }> }>(
      `/agent/conversations/${conversationId}/messages`, { params: limit ? { limit } : undefined }
    ),
};

// ---- Feedback ----
export const feedbackService = {
  record: (messageId: string, rating: 'up' | 'down', comment?: string) =>
    api.post<{ success: boolean }>('/agent/feedback', { messageId, rating, comment }),
  stats: () =>
    api.get<{ total: number; positive: number; negative: number; patterns: string[] }>('/agent/feedback/stats'),
};

// ---- Confirmation ----
export const confirmService = {
  resolve: (confirmId: string, approved: boolean, editedParams?: Record<string, unknown>, rejectReason?: string) =>
    api.post(`/agent/confirm/${confirmId}`, { approved, editedParams, rejectReason }),
  listPending: () =>
    api.get<{ confirmations: Array<{ id: string; tool: string; params: string; status: string; expires_at: string }> }>('/agent/confirm/pending'),
};

// ---- Agent State ----
export interface AgentAutocompleteItem {
  label: string;
  value: string;
  category: string;
  description?: string;
  icon?: string;
}

export const agentStateService = {
  getAutocomplete: (prefix: string) =>
    api.get<{ items: AgentAutocompleteItem[] }>('/agent-state/autocomplete', { params: { q: prefix } }),

  getInfo: () =>
    api.get<{ connectedClients: number; redisPubSub: boolean }>('/agent-state/info'),

  getStates: () =>
    api.get('/agent-state/states'),
};

// ---- Agent Tasks & Comms ----
export interface AgentTask {
  id: string;
  user_id: string;
  agent_id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  result: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const agentTasksService = {
  list: (params?: { status?: string; agentId?: string; agent_id?: string; limit?: number }) =>
    api.get<{ tasks: AgentTask[] }>('/agent-tasks', { params }),
  get: (id: string) =>
    api.get<AgentTask>(`/agent-tasks/${id}`),
  create: (data: { title: string; description?: string; agentId?: string; agent_id?: string; priority?: number }) =>
    api.post<AgentTask>('/agent-tasks', data),
  update: (id: string, action: string) =>
    api.patch<AgentTask>(`/agent-tasks/${id}`, { action }),
  cancel: (id: string) =>
    api.post<{ success: boolean }>(`/agent-tasks/${id}/cancel`),
  stats: (agentId?: string) =>
    api.get('/agent-tasks/stats', { params: agentId ? { agentId } : undefined }),
};

export interface AgentComm {
  id: string;
  user_id: string;
  from_agent: string;
  to_agent: string;
  message: string;
  message_type: string;
  acknowledged: number;
  response: string | null;
  created_at: string;
}

export const agentCommsService = {
  list: (params?: { agent?: string; type?: string; limit?: number }) =>
    api.get<{ comms: AgentComm[] }>('/agent-comms', { params }),
  send: (data: { from: string; to: string; message: string; type?: string }) =>
    api.post<AgentComm>('/agent-comms', data),
  acknowledge: (id: string, response?: string) =>
    api.post<{ success: boolean }>(`/agent-comms/${id}/ack`, { response }),
};
