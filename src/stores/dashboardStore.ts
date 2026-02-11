import { create } from 'zustand';
import type {
  DashboardStats,
  UsageSummary,
  AgentConfig,
  Integration,
  Reminder,
  Automation,
  FeatureToggles,
  ReminderChannel,
  ReminderCategory,
} from '@/types';
import {
  dashboardService,
  usageService,
  agentService,
  integrationService,
  reminderService,
  automationService,
  featureService,
} from '@/services/api';

// ----- Fallback data used when backend is unavailable --------

const fallbackStats: DashboardStats = {
  messagesSent: 0, messagesChange: 0, remindersActive: 0, remindersChange: 0,
  apiCalls: 0, apiCallsChange: 0, responseTimeMs: 0, responseTimeChange: 0,
  agentStatus: 'offline', agentModel: 'none', agentUptime: '0%',
};

const fallbackUsage: UsageSummary = {
  totalCostUSD: 0, totalTokensIn: 0, totalTokensOut: 0, totalMessages: 0,
  totalToolCalls: 0, byProvider: {}, byChannel: {}, byTool: {}, forecastUSD: 0,
};

const fallbackAgent: AgentConfig = {
  id: '', userId: '', name: 'Geek', displayName: 'Your AI',
  mode: 'builder', voice: 'friendly',
  systemPrompt: 'You are a helpful personal AI assistant.',
  primaryModel: 'geekspace-default', fallbackModel: 'ollama-qwen2.5',
  creativity: 70, formality: 50, monthlyBudgetUSD: 5, status: 'offline',
};

const fallbackFeatures: FeatureToggles = {
  socialDiscovery: true, portfolioChat: true, automationBuilder: true,
  websiteBuilder: false, n8nIntegration: true, manyChatIntegration: false,
};

// ----- Store -------------------------------------------------

interface DashboardStore {
  stats: DashboardStats;
  usage: UsageSummary;
  agent: AgentConfig;
  integrations: Integration[];
  reminders: Reminder[];
  automations: Automation[];
  features: FeatureToggles;
  isLoading: boolean;
  error: string | null;

  loadDashboard: () => Promise<void>;
  updateAgent: (data: Partial<AgentConfig>) => Promise<void>;
  addReminder: (data: { text: string; datetime: string; channel: ReminderChannel; recurring?: string; category: ReminderCategory }) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  connectIntegration: (type: string) => Promise<void>;
  disconnectIntegration: (id: string) => Promise<void>;
  toggleFeature: (key: keyof FeatureToggles) => Promise<void>;
  setUsageRange: (range: 'day' | 'week' | 'month') => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  stats: fallbackStats,
  usage: fallbackUsage,
  agent: fallbackAgent,
  integrations: [],
  reminders: [],
  automations: [],
  features: fallbackFeatures,
  isLoading: false,
  error: null,

  loadDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fire all API calls in parallel
      const [statsRes, usageRes, agentRes, intRes, remRes, autoRes, featRes] = await Promise.allSettled([
        dashboardService.stats(),
        usageService.summary('month'),
        agentService.getConfig(),
        integrationService.list(),
        reminderService.list(),
        automationService.list(),
        featureService.get(),
      ]);

      set({
        stats: statsRes.status === 'fulfilled' ? statsRes.value.data : fallbackStats,
        usage: usageRes.status === 'fulfilled' ? usageRes.value.data : fallbackUsage,
        agent: agentRes.status === 'fulfilled' ? agentRes.value.data : fallbackAgent,
        integrations: intRes.status === 'fulfilled' ? intRes.value.data : [],
        reminders: remRes.status === 'fulfilled' ? remRes.value.data : [],
        automations: autoRes.status === 'fulfilled' ? autoRes.value.data : [],
        features: featRes.status === 'fulfilled' ? featRes.value.data : fallbackFeatures,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to load dashboard data' });
    }
  },

  updateAgent: async (data) => {
    // Optimistic update
    set((s) => ({ agent: { ...s.agent, ...data } }));
    try {
      const { data: updated } = await agentService.updateConfig(data);
      set({ agent: updated });
    } catch {
      // Revert on failure would require storing previous state
    }
  },

  addReminder: async (data) => {
    try {
      const { data: created } = await reminderService.create({
        text: data.text,
        datetime: data.datetime,
        channel: data.channel,
        recurring: data.recurring as Reminder['recurring'],
        category: data.category,
        completed: false,
      });
      set((s) => ({ reminders: [...s.reminders, created] }));
    } catch {
      // Fallback: add locally
      set((s) => ({
        reminders: [...s.reminders, {
          id: Date.now().toString(), userId: '', text: data.text,
          datetime: data.datetime, channel: data.channel,
          recurring: data.recurring as Reminder['recurring'],
          completed: false, category: data.category,
          createdBy: 'user' as const, createdAt: new Date().toISOString(),
        }],
      }));
    }
  },

  toggleReminder: async (id) => {
    const reminder = get().reminders.find((r) => r.id === id);
    if (!reminder) return;

    // Optimistic update
    set((s) => ({
      reminders: s.reminders.map((r) => r.id === id ? { ...r, completed: !r.completed } : r),
    }));
    try {
      await reminderService.update(id, { completed: !reminder.completed });
    } catch { /* keep optimistic update */ }
  },

  deleteReminder: async (id) => {
    const prev = get().reminders;
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
    try {
      await reminderService.delete(id);
    } catch {
      set({ reminders: prev }); // Revert
    }
  },

  connectIntegration: async (type) => {
    try {
      const { data } = await integrationService.connect(type);
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.id === data.id || i.type === type ? data : i
        ),
      }));
    } catch {
      // Optimistic fallback
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.type === type ? { ...i, status: 'connected' as const, health: 100, lastSync: 'Just now' } : i
        ),
      }));
    }
  },

  disconnectIntegration: async (id) => {
    try {
      const { data } = await integrationService.disconnect(id);
      set((s) => ({
        integrations: s.integrations.map((i) => i.id === id ? data : i),
      }));
    } catch {
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.id === id ? { ...i, status: 'disconnected' as const, health: 0 } : i
        ),
      }));
    }
  },

  toggleFeature: async (key) => {
    const current = get().features[key];
    // Optimistic update
    set((s) => ({ features: { ...s.features, [key]: !current } }));
    try {
      await featureService.update({ [key]: !current });
    } catch { /* keep optimistic update */ }
  },

  setUsageRange: async (range) => {
    try {
      const { data } = await usageService.summary(range);
      set({ usage: data });
    } catch { /* keep existing data */ }
  },
}));
