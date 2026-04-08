import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import type { FocusSession, FocusSummary } from '../helpers';
export interface UseFocusHistoryReturn {
  history: FocusSession[]; summary: FocusSummary | null; completedHistory: FocusSession[]; focusStreak: number; loadHistory: () => Promise<void>;
}
export function useFocusHistory(): UseFocusHistoryReturn {
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const loadHistory = useCallback(async () => {
    try { const [h, s] = await Promise.all([api.get('/focus/history?limit=20'), api.get('/focus/summary')]); setHistory((h.data as { sessions: FocusSession[] }).sessions); setSummary((s.data as { summary: FocusSummary }).summary); }
    catch { toast.error('Failed to load focus history'); }
  }, []);
  const completedHistory = history.filter((h) => h.ended_at !== null);
  const focusStreak = (() => {
    if (!completedHistory.length) return 0;
    const ds = new Set(completedHistory.filter((s) => s.completed).map((s) => new Date(s.started_at).toISOString().slice(0, 10)));
    const t = new Date(); t.setHours(0,0,0,0);
    const c = new Date(t), y = new Date(t); y.setDate(y.getDate() - 1);
    if (!ds.has(c.toISOString().slice(0,10)) && !ds.has(y.toISOString().slice(0,10))) return 0;
    if (!ds.has(c.toISOString().slice(0,10))) c.setDate(c.getDate() - 1);
    let streak = 0;
    while (ds.has(c.toISOString().slice(0,10))) { streak++; c.setDate(c.getDate() - 1); }
    return streak;
  })();
  return { history, summary, completedHistory, focusStreak, loadHistory };
}
