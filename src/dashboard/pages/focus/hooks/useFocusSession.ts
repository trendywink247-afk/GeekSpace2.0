import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { useTimer } from '../helpers';
import type { FocusSession, NotifSettings } from '../helpers';
import { useFocusStore } from '../state/focus-store';
export interface UseFocusSessionReturn {
  session: FocusSession | null; settings: NotifSettings | null; deferredCount: number; isLoading: boolean;
  elapsed: number; remaining: number | null; progress: number; elapsedStr: string; remainStr: string;
  start: (goal: string | null, durationMin: number) => Promise<void>;
  end: (completed?: boolean) => Promise<void>;
  toggleFocusMode: () => Promise<void>;
  loadSession: () => Promise<void>;
}
const p = (n: number) => String(n).padStart(2, '0');
export function useFocusSession(): UseFocusSessionReturn {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'pulse', page: 'focus' });
  const { activeSession, settings, deferredCount, isLoading, setActiveSession, setSettings, setDeferredCount, setLoading } = useFocusStore();
  const { elapsed, remaining, progress } = useTimer(activeSession?.started_at ?? null, activeSession?.duration_min ?? null);
  const wlRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!activeSession) { if (wlRef.current) { wlRef.current.release().catch(() => {}); wlRef.current = null; } return; }
    const acq = async () => { if (!('wakeLock' in navigator)) return; try { wlRef.current = await navigator.wakeLock.request('screen'); } catch (e) { console.warn('[Focus]', e instanceof Error ? e.message : e); } };
    void acq();
    const onVis = () => { if (document.visibilityState === 'visible' && !wlRef.current) void acq(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); if (wlRef.current) { wlRef.current.release().catch(() => {}); wlRef.current = null; } };
  }, [activeSession]);
  useEffect(() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); }, []);
  const loadSession = useCallback(async () => {
    try {
      const [sR, nR, dR] = await Promise.all([api.get('/focus/active'), api.get('/focus/settings'), api.get('/focus/deferred')]);
      setActiveSession((sR.data as { session: FocusSession | null }).session);
      setSettings((nR.data as { settings: NotifSettings }).settings);
      setDeferredCount((dR.data as { count: number }).count);
    } catch { /* caller handles */ }
  }, [setActiveSession, setSettings, setDeferredCount]);
  const start = useCallback(async (goal: string | null, durationMin: number) => {
    setLoading(true);
    try { const r = await api.post('/focus/start', { goal, durationMin }); setActiveSession((r.data as { session: FocusSession }).session); toast.success('Focus session started'); void notifyDone('Focus session started'); }
    catch { toast.error('Failed to start focus session'); void notifyFail('Failed to start focus session'); }
    setLoading(false);
  }, [setLoading, setActiveSession, notifyDone, notifyFail]);
  const end = useCallback(async (completed = true) => {
    setLoading(true);
    try { await api.post('/focus/end', { completed }); setActiveSession(null); toast.success(completed ? 'Focus session completed' : 'Focus session ended'); void notifyDone(completed ? 'Focus session completed' : 'Focus session ended'); }
    catch { toast.error('Failed to end focus session'); void notifyFail('Failed to end focus session'); }
    setLoading(false);
  }, [setLoading, setActiveSession, notifyDone, notifyFail]);
  const toggleFocusMode = useCallback(async () => {
    const v = settings?.focus_mode_active ? 0 : 1;
    try { const r = await api.patch('/focus/settings', { focus_mode_active: v }); setSettings((r.data as { settings: NotifSettings }).settings); toast.success(v ? 'Focus mode ON' : 'Focus mode OFF'); void notifyDone(v ? 'Focus mode enabled' : 'Focus mode disabled'); }
    catch { toast.error('Failed to update focus mode'); void notifyFail('Failed to update focus mode'); }
  }, [settings, setSettings, notifyDone, notifyFail]);
  const elapsedStr = p(Math.floor(elapsed / 60)) + ':' + p(elapsed % 60);
  const remainStr = remaining !== null ? p(Math.floor(remaining / 60)) + ':' + p(remaining % 60) : '';
  return { session: activeSession, settings, deferredCount, isLoading, elapsed, remaining, progress, elapsedStr, remainStr, start, end, toggleFocusMode, loadSession };
}
