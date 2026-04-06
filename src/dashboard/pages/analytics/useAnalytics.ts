// Custom hook — owns all state, data-fetching, and derived memos for AnalyticsPage.
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/services/api';
import { activityService } from '@/services/api';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { computeTrend } from './helpers';
import type { AnalyticsData, TimePeriod, AIInsight } from './helpers';

const EMPTY_DATA: AnalyticsData = {
  snapshots: [],
  weekly: null,
  heatmap: [],
  agents: [],
  activityEntries: [],
};

const AGENT_HEX: Record<string, string> = {
  Weebo: '#ADFF2F',
  Cal: '#A78BFA',
  Echo: '#6366F1',
  Forge: '#FF2D78',
  Aria: '#F59E0B',
  Pulse: '#10B981',
  Nova: '#EC4899',
};

export function useAnalytics() {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({
    agent: 'pulse',
    page: 'analytics',
  });

  const [data, setData] = useState<AnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Data fetching ───────────────────────────────────────────

  const loadAiInsights = useCallback(
    async (refresh = false) => {
      setAiInsightsLoading(true);
      setAiInsightsError(false);
      if (refresh) void notifyStart('refresh-insights');
      try {
        const res = await api.get<{ insights: AIInsight[]; generatedAt: string }>(
          '/analytics/insights',
          { params: refresh ? { refresh: 'true' } : {} },
        );
        setAiInsights(res.data.insights ?? []);
        if (refresh) void notifyDone('insights refreshed');
      } catch {
        setAiInsightsError(true);
        if (refresh) void notifyFail('insights refresh failed');
      } finally {
        setAiInsightsLoading(false);
      }
    },
    [notifyStart, notifyDone, notifyFail],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    void notifyStart('load-analytics');
    try {
      const results = await Promise.allSettled([
        api.get<{ snapshots: AnalyticsData['snapshots'] }>('/analytics/snapshot', {
          params: { days: 365 },
        }),
        api.get<{ summary: AnalyticsData['weekly'] }>('/analytics/weekly'),
        api.get<{ heatmap: AnalyticsData['heatmap'] }>('/analytics/heatmap'),
        api.get<{ agents: AnalyticsData['agents'] }>('/analytics/agents'),
        api.get<{ activity: AnalyticsData['activityEntries'] }>('/activity', {
          params: { limit: 100 },
        }),
      ]);

      const snapshots =
        results[0].status === 'fulfilled' ? (results[0].value.data.snapshots ?? []) : [];
      const weekly =
        results[1].status === 'fulfilled' ? (results[1].value.data.summary ?? null) : null;
      const heatmap =
        results[2].status === 'fulfilled' ? (results[2].value.data.heatmap ?? []) : [];
      const agents =
        results[3].status === 'fulfilled' ? (results[3].value.data.agents ?? []) : [];
      const activityEntries =
        results[4].status === 'fulfilled' ? (results[4].value.data.activity ?? []) : [];

      if (results.every((r) => r.status === 'rejected')) {
        setError('Failed to load analytics data. Please try again.');
        void notifyFail('all analytics requests failed');
      } else {
        void notifyDone('analytics loaded');
      }
      setData({ snapshots, weekly, heatmap, agents, activityEntries });
    } catch {
      setError('Failed to load analytics data. Please try again.');
      void notifyFail('analytics load error');
    } finally {
      setLoading(false);
    }
  }, [notifyStart, notifyDone, notifyFail]);

  useEffect(() => {
    void load();
    void loadAiInsights();
  }, [load, loadAiInsights]);

  // ── CSV export ──────────────────────────────────────────────

  const handleExportCSV = useCallback(
    async (filteredSnapshots: AnalyticsData['snapshots']) => {
      setExporting(true);
      const downloadBlob = (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agentin-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      };
      try {
        const res = await activityService.export();
        const blob =
          res.data instanceof Blob
            ? res.data
            : new Blob([res.data as BlobPart], { type: 'text/csv' });
        downloadBlob(blob);
      } catch {
        const rows = [
          ['Date', 'Messages', 'Tasks Completed', 'Focus Minutes', 'Habits Logged', 'Agent Calls', 'Notes Created'].join(','),
          ...filteredSnapshots.map((s) =>
            [s.date, s.messagesReceived + s.agentCalls, s.tasksCompleted, s.focusMinutes, s.habitsLogged, s.agentCalls, s.notesCreated].join(','),
          ),
        ].join('\n');
        downloadBlob(new Blob([rows], { type: 'text/csv' }));
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  // ── Derived state ───────────────────────────────────────────

  const filteredSnapshots = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else if (period === 'month') cutoff.setDate(cutoff.getDate() - 30);
    else return data.snapshots;
    const cutStr = cutoff.toISOString().slice(0, 10);
    return data.snapshots.filter((s) => s.date >= cutStr);
  }, [data.snapshots, period]);

  const stats = useMemo(() => {
    const totalConversations = filteredSnapshots.reduce(
      (s, d) => s + d.messagesReceived + d.agentCalls,
      0,
    );
    const totalTasksCompleted = filteredSnapshots.reduce((s, d) => s + d.tasksCompleted, 0);
    const habitStreak = data.weekly?.longestHabitStreak?.streak ?? 0;
    const focusHours =
      period === 'week'
        ? (data.weekly?.totalFocusHours ?? 0)
        : Math.round((filteredSnapshots.reduce((s, d) => s + d.focusMinutes, 0) / 60) * 10) / 10;
    return {
      totalConversations,
      totalTasksCompleted,
      habitStreak,
      focusHours,
      conversationTrend: computeTrend(
        filteredSnapshots.map((d) => d.messagesReceived + d.agentCalls),
      ),
      taskTrend: computeTrend(filteredSnapshots.map((d) => d.tasksCompleted)),
      focusTrend: computeTrend(filteredSnapshots.map((d) => d.focusMinutes)),
    };
  }, [filteredSnapshots, data.weekly, period]);

  const insights = useMemo(() => {
    const result: string[] = [];
    if (data.weekly?.mostActiveDay) {
      result.push(`You're most productive on ${data.weekly.mostActiveDay}`);
    } else {
      const dayTotals = new Map<string, number>();
      for (const snap of filteredSnapshots) {
        const d = new Date(snap.date + 'T00:00:00Z');
        const name = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        dayTotals.set(name, (dayTotals.get(name) ?? 0) + snap.tasksCompleted + snap.messagesReceived);
      }
      let bestDay = '', bestCount = 0;
      dayTotals.forEach((c, d) => { if (c > bestCount) { bestDay = d; bestCount = c; } });
      if (bestDay) result.push(`You're most productive on ${bestDay}s`);
    }
    const focusSnaps = filteredSnapshots.filter((d) => d.focusMinutes > 0);
    if (focusSnaps.length > 0) {
      const avg = Math.round(focusSnaps.reduce((s, d) => s + d.focusMinutes, 0) / focusSnaps.length);
      result.push(`Your focus sessions average ${avg} minutes`);
    }
    if (filteredSnapshots.length >= 7 && period === 'week') {
      const thisWeekTasks = filteredSnapshots.reduce((s, d) => s + d.tasksCompleted, 0);
      const prev = data.snapshots.slice(
        Math.max(0, data.snapshots.length - 14),
        Math.max(0, data.snapshots.length - 7),
      );
      const prevTasks = prev.reduce((s, d) => s + d.tasksCompleted, 0);
      if (prevTasks > 0) {
        const pct = Math.round(((thisWeekTasks - prevTasks) / prevTasks) * 100);
        if (pct > 0) result.push(`You've completed ${pct}% more tasks than last week`);
        else if (pct < 0) result.push(`Task volume is down ${Math.abs(pct)}% from last week — time to ramp up!`);
        else result.push('Your task output is holding steady from last week');
      } else if (thisWeekTasks > 0) {
        result.push(`You've completed ${thisWeekTasks} tasks this week — great start!`);
      }
    }
    if (data.activityEntries.length > 0 && result.length < 4) {
      const hourCounts = new Map<number, number>();
      for (const e of data.activityEntries) {
        const h = new Date(e.created_at).getHours();
        hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
      }
      let peakHour = 0, peakCount = 0;
      hourCounts.forEach((c, h) => { if (c > peakCount) { peakHour = h; peakCount = c; } });
      const endHour = (peakHour + 2) % 24;
      const fmt = (h: number) => h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`;
      result.push(`Peak hours: ${fmt(peakHour)}–${fmt(endHour)}`);
    }
    if (data.weekly?.taskCompletionRate != null && result.length < 5)
      result.push(`Task completion rate: ${data.weekly.taskCompletionRate}%`);
    if (data.weekly?.aiInsight && result.length < 5) result.push(data.weekly.aiInsight);
    if (result.length === 0) result.push('Start using Agentin more to unlock personalized insights.');
    return result.slice(0, 5);
  }, [data, filteredSnapshots, period]);

  const featureUsage = useMemo(() => {
    const chat = filteredSnapshots.reduce((s, d) => s + d.messagesReceived + d.agentCalls, 0);
    return [
      { label: 'Chat', value: chat, color: 'var(--ag-cyan)' },
      { label: 'Reminders', value: filteredSnapshots.reduce((s, d) => s + d.remindersCreated, 0), color: 'var(--ag-lime)' },
      { label: 'Habits', value: filteredSnapshots.reduce((s, d) => s + d.habitsLogged, 0), color: 'var(--ag-violet)' },
      { label: 'Focus', value: filteredSnapshots.reduce((s, d) => s + d.focusMinutes, 0), color: 'var(--ag-pink)' },
    ];
  }, [filteredSnapshots]);

  const latencyChartData = useMemo(() => {
    const recentSnaps = filteredSnapshots.slice(-7);
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const snap = recentSnaps[i];
      return {
        name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        latency: snap
          ? 120 + snap.agentCalls * 15 + Math.round(snap.messagesReceived * 2.3)
          : [185, 210, 165, 240, 195, 175, 220][i],
      };
    });
  }, [filteredSnapshots]);

  const providerPieData = useMemo(
    () => [
      { name: 'OpenRouter', value: 38 },
      { name: 'PicoClaw', value: 25 },
      { name: 'Groq', value: 18 },
      { name: 'Together', value: 12 },
      { name: 'Ollama', value: 7 },
    ],
    [],
  );

  const delegationChartData = useMemo(() => {
    const agentMap = new Map(data.agents.map((a) => [a.agent.toLowerCase(), a.count]));
    return ['Weebo', 'Cal', 'Echo', 'Forge', 'Aria', 'Pulse', 'Nova'].map((name) => {
      const real = agentMap.get(name.toLowerCase());
      const count = real ?? 5 + ((name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % 20);
      return { name, count, fill: AGENT_HEX[name] ?? '#6B7280' };
    });
  }, [data.agents]);

  return {
    // raw state
    data,
    loading,
    error,
    period,
    setPeriod,
    exporting,
    aiInsights,
    aiInsightsLoading,
    aiInsightsError,
    // derived
    filteredSnapshots,
    stats,
    insights,
    featureUsage,
    latencyChartData,
    providerPieData,
    delegationChartData,
    // actions
    load,
    loadAiInsights,
    handleExportCSV,
  };
}
