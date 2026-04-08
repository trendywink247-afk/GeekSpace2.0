// useFocusSession — active session lifecycle + timer
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { useTimer } from '../helpers';
import type { FocusSession, NotifSettings } from '../helpers';
import { useFocusStore } from '../state/focus-store';

export interface UseFocusSessionReturn {
  session: FocusSession | null;
  settings: NotifSettings | null;
  deferredCount: number;
  isLoading: boolean;
  elapsed: number;
  remaining: number | null;
  progress: number;
  elapsedStr: string;
  remainStr: string;
  start: (goal: string | null, durationMin: number) => Promise<void>;
  end: (completed?: boolean) => Promise<void>;
  toggleFocusMode: () => Promise<void>;
  loadSession: () => Promise<void>;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export function useFocusSession(): UseFocusSessionReturn {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'pulse', page: 'focus' });
  const { activeSession, settings, deferredCount, isLoading, setActiveSession, setSettings, setDeferredCount, setLoading } = useFocusStore();

  const { elapsed, remaining, progress } = useTimer(activeSession?.started_at ?? null, activeSession?.duration_min ?? null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!activeSession) {
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
      return;
    }
    async function acquire() {
      if (!('wakeLock' in navigator)) return;
      try { wakeLockRef.current = await navigator.wakeLock.request('screen'); }
      catch (err) { console.warn('[Focus]', err instanceof Error ? err.message : err); }
    }
    void acquire();
    function onVis() { if (document.visibilityState === 'visible' && !wakeLockRef.current) void acquire(); }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    };
  }, [activeSession]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const [sRes, nsRes, dRes] = await Promise.all([api.get('/focus/active'), api.get('/focus/settings'), api.get('/focus/deferred')]);
      setActiveSession((sRes.data as { session: FocusSession | null }).session);
      setSettings((nsRes.data as { settings: NotifSettings }).settings);
      setDeferredCount((dRes.data as { count: number }).count);
    } catch { /* caller handles */ }
  }, [setActiveSession, setSettings, setDeferredCount]);

  const start = useCallback(async (goal: string | null, durationMin: number) => {
    setLoading(true);
    try {
      const res = await api.post('/focus/start', { goal, durationMin });
      setActiveSession((res.data as { session: FocusSession }).session);
      toast.success('Focus session started');
      void notifyDone('Focus session started');
    } catch { toast.error('Failed to start focus session'); void notifyFail('Failed to start focus session'); }
    setLoading(false);
  }, [setLoading, setActiveSession, notifyDone, notifyFail]);

  const end = useCallback(async (completed = true) => {
    setLoading(true);
    try {
      await api.post('/focus/end', { completed });
      setActiveSession(null);
      toast.success(completed ? 'Focus session completed' : 'Focus session ended');
      void notifyDone(completed ? 'Focus session completed' : 'Focus session ended');
    } catch { toast.error('Failed to end focus session'); void notifyFail('Failed to end focus session'); }
    setLoading(false);
  }, [setLoading, setActiveSession, notifyDone, notifyFail]);

  const toggleFocusMode = useCallback(async () => {
    const newVal = settings?.focus_mode_active ? 0 : 1;
    try {
      const res = await api.patch('/focus/settings', { focus_mode_active: newVal });
      setSettings((res.data as { settings: NotifSettings }).settings);
      toast.success(newVal ? 'Focus mode ON' : 'Focus mode OFF');
      void notifyDone(newVal ? 'Focus mode enabled' : 'Focus mode disabled');
    } catch { toast.error('Failed to update focus mode'); void notifyFail('Failed to update focus mode'); }
  }, [settings, setSettings, notifyDone, notifyFail]);

  const elapsedStr = pad(Math.floor(elapsed / 60)) + ':' + pad(elapsed % 60);
  const remainStr = remaining !== null ? pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60) : '';
  return { session: activeSession, settings, deferredCount, isLoading, elapsed, remaining, progress, elapsedStr, remainStr, start, end, toggleFocusMode, loadSession };
}
