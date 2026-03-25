// src/hooks/useOverviewData.ts
// Extracted from OverviewPage — fetches GET /api/dashboard/overview data.

import { useState, useEffect, useCallback } from 'react';
import { dashboardService, reminderService } from '@/services/api';

// ---------------------------------------------------------------------------
// Types (match GET /api/dashboard/overview response)
// ---------------------------------------------------------------------------

export interface OverviewReminder {
  id: string;
  text: string;
  datetime: string;
  category: string;
  recurring: string;
  priority: string;
  overdue: boolean;
}

export interface OverviewHabit {
  id: number;
  name: string;
  icon: string;
  streak: number;
  loggedToday: boolean;
}

export interface OverviewCalendarEvent {
  id: number;
  title: string;
  start_time: number;
  end_time: number | null;
}

export interface OverviewWeeklyStats {
  messagesThisWeek: number;
  remindersCompleted: number;
  habitsLogged: number;
}

export interface OverviewRecentConversation {
  id: string;
  content: string;
  created_at: string;
}

interface OverviewDataPayload {
  greeting: string;
  remindersDueToday: OverviewReminder[];
  habitsToday: OverviewHabit[];
  calendarEventsToday: OverviewCalendarEvent[];
  weeklyStats: OverviewWeeklyStats;
  recentConversations: OverviewRecentConversation[];
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseOverviewDataReturn {
  reminders: OverviewReminder[];
  habits: OverviewHabit[];
  calendarEvents: OverviewCalendarEvent[];
  weeklyStats: OverviewWeeklyStats | null;
  recentConversations: OverviewRecentConversation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  completeReminder: (id: string) => Promise<void>;
  dismissReminder: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOverviewData(): UseOverviewDataReturn {
  const [data, setData] = useState<OverviewDataPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await dashboardService.overview();
      setData(res.data as OverviewDataPayload);
    } catch {
      setError('Failed to load overview data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Complete a reminder (optimistic update)
  const completeReminder = useCallback(async (id: string) => {
    try {
      await reminderService.update(id, { completed: true });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          remindersDueToday: prev.remindersDueToday.filter((r) => r.id !== id),
          weeklyStats: {
            ...prev.weeklyStats,
            remindersCompleted: prev.weeklyStats.remindersCompleted + 1,
          },
        };
      });
    } catch {
      // silent — user can retry
    }
  }, []);

  // Dismiss a reminder from the list (local only, no API call)
  const dismissReminder = useCallback((id: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        remindersDueToday: prev.remindersDueToday.filter((r) => r.id !== id),
      };
    });
  }, []);

  return {
    reminders: data?.remindersDueToday ?? [],
    habits: data?.habitsToday ?? [],
    calendarEvents: data?.calendarEventsToday ?? [],
    weeklyStats: data?.weeklyStats ?? null,
    recentConversations: data?.recentConversations ?? [],
    isLoading,
    error,
    refetch: fetchData,
    completeReminder,
    dismissReminder,
  };
}
