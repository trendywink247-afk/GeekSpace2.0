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

// ----- Mock data used when backend is unavailable ------------

const mockStats: DashboardStats = {
  messagesSent: 1247,
  messagesChange: 12,
  remindersActive: 23,
  remindersChange: 3,
  apiCalls: 8400,
  apiCallsChange: 24,
  responseTimeMs: 1200,
  responseTimeChange: -8,
  agentStatus: 'online',
  agentModel: 'OpenClaw v2.1',
  agentUptime: '99.99%',
};

const mockUsage: UsageSummary = {
  totalCostUSD: 3.2,
  totalTokensIn: 520000,
  totalTokensOut: 180000,
  totalMessages: 1247,
  totalToolCalls: 340,
  byProvider: { openai: 1.8, qwen: 0.9, anthropic: 0.5 },
  byChannel: { web: 480, telegram: 320, terminal: 280, 'portfolio-chat': 167 },
  byTool: { 'reminders.create': 0.8, 'ai.chat': 1.1, 'portfolio.update': 0.6, 'usage.summary': 0.2, 'schedule.get': 0.5 },
  forecastUSD: 4.1,
};

const mockAgent: AgentConfig = {
  id: 'agent-1',
  userId: 'demo-1',
  name: 'Geek',
  displayName: "Alex's AI",
  mode: 'builder',
  voice: 'friendly',
  systemPrompt: "You are Alex's personal AI assistant. You help with coding, reminders, and daily tasks. Be helpful, concise, and proactive. When uncertain, ask for clarification.",
  primaryModel: 'geekspace-default',
  fallbackModel: 'ollama-qwen2.5',
  creativity: 70,
  formality: 50,
  monthlyBudgetUSD: 5,
  status: 'online',
};

const mockReminders: Reminder[] = [
  { id: '1', userId: 'demo-1', text: 'Call mom', datetime: '2026-02-12T09:00', channel: 'telegram', category: 'personal', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
  { id: '2', userId: 'demo-1', text: 'Submit project report', datetime: '2026-02-12T17:00', channel: 'email', recurring: 'weekly', category: 'work', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
  { id: '3', userId: 'demo-1', text: 'Team standup', datetime: '2026-02-12T10:00', channel: 'push', recurring: 'daily', category: 'work', completed: true, createdBy: 'agent', createdAt: '2026-02-10T00:00:00Z' },
  { id: '4', userId: 'demo-1', text: 'Pay rent', datetime: '2026-02-15T09:00', channel: 'telegram', recurring: 'monthly', category: 'personal', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
  { id: '5', userId: 'demo-1', text: 'Gym workout', datetime: '2026-02-12T07:00', channel: 'push', category: 'health', completed: false, createdBy: 'automation', createdAt: '2026-02-10T00:00:00Z' },
  { id: '6', userId: 'demo-1', text: 'Review pull requests', datetime: '2026-02-12T14:00', channel: 'email', category: 'work', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
];

const mockFeatures: FeatureToggles = {
  socialDiscovery: true,
  portfolioChat: true,
  automationBuilder: true,
  websiteBuilder: false,
  n8nIntegration: true,
  manyChatIntegration: false,
};

// ----- Store -------------------------------------------------

interface DashboardStore {
  // state
  stats: DashboardStats;
  usage: UsageSummary;
  agent: AgentConfig;
  integrations: Integration[];
  reminders: Reminder[];
  automations: Automation[];
  features: FeatureToggles;
  isLoading: boolean;

  // actions
  loadDashboard: () => Promise<void>;
  updateAgent: (data: Partial<AgentConfig>) => void;
  addReminder: (data: { text: string; datetime: string; channel: ReminderChannel; recurring?: string; category: ReminderCategory }) => void;
  toggleReminder: (id: string) => void;
  deleteReminder: (id: string) => void;
  connectIntegration: (id: string) => void;
  disconnectIntegration: (id: string) => void;
  toggleFeature: (key: keyof FeatureToggles) => void;
  setUsageRange: (range: 'day' | 'week' | 'month') => void;
}

export const useDashboardStore = create<DashboardStore>((set, _get) => ({
  stats: mockStats,
  usage: mockUsage,
  agent: mockAgent,
  integrations: [],
  reminders: mockReminders,
  automations: [],
  features: mockFeatures,
  isLoading: false,

  loadDashboard: async () => {
    set({ isLoading: true });
    // In production, each of these would be an API call.
    // For now we use mock data that's already set as defaults.
    // try { const { data } = await dashboardService.stats(); ... }
    set({ isLoading: false });
  },

  updateAgent: (data) =>
    set((s) => ({ agent: { ...s.agent, ...data } })),

  addReminder: (data) =>
    set((s) => ({
      reminders: [
        ...s.reminders,
        {
          id: Date.now().toString(),
          userId: 'demo-1',
          text: data.text,
          datetime: data.datetime,
          channel: data.channel,
          recurring: data.recurring as Reminder['recurring'],
          completed: false,
          category: data.category,
          createdBy: 'user' as const,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  toggleReminder: (id) =>
    set((s) => ({
      reminders: s.reminders.map((r) =>
        r.id === id ? { ...r, completed: !r.completed } : r,
      ),
    })),

  deleteReminder: (id) =>
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),

  connectIntegration: (id) =>
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, status: 'connected' as const, health: 100, lastSync: 'Just now' } : i,
      ),
    })),

  disconnectIntegration: (id) =>
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, status: 'disconnected' as const, health: 0, lastSync: undefined } : i,
      ),
    })),

  toggleFeature: (key) =>
    set((s) => ({
      features: { ...s.features, [key]: !s.features[key] },
    })),

  setUsageRange: (_range) => {
    // Would re-fetch usage with different range; using mock for now.
  },
}));
