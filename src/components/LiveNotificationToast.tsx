// ============================================================
// Live Notification Toast — SSE-powered real-time notifications
//
// Replaces polling with EventSource for instant Agent Observer
// notifications. Shows as floating toasts that auto-dismiss.
// Mobile-first: full-width on mobile, compact on desktop.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Target, Flame, AlertTriangle, PartyPopper, Eye } from 'lucide-react';

interface AgentNotification {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  created_at: string;
}

interface ToastItem extends AgentNotification {
  _dismissTimer?: ReturnType<typeof setTimeout>;
}

const AGENT_EMOJI: Record<string, string> = {
  weebo: '✨', edith: '🔷', jarvis: '🤖', aria: '🎨',
  forge: '⚙️', pulse: '📊', echo: '💬', cal: '📅', nova: '🔬',
};

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  goal_progress: { icon: Target, color: 'var(--ag-cyan)' },
  goal_completed: { icon: PartyPopper, color: 'var(--ag-green)' },
  step_completed: { icon: Target, color: 'var(--ag-green)' },
  checkin: { icon: Eye, color: 'var(--ag-violet)' },
  anomaly: { icon: AlertTriangle, color: 'var(--ag-amber)' },
  celebration: { icon: PartyPopper, color: 'var(--ag-pink)' },
  agent_insight: { icon: Eye, color: 'var(--ag-cyan)' },
  streak_at_risk: { icon: Flame, color: 'var(--ag-amber)' },
  suggestion: { icon: Bell, color: 'var(--ag-violet)' },
};

const TOAST_DURATION = 6000; // 6 seconds
const MAX_TOASTS = 3;

interface LiveNotificationToastProps {
  /** Called when user clicks a notification with an action URL */
  onNavigate?: (url: string) => void;
  /** Update the unread count in the notification bell */
  onUnreadChange?: (delta: number) => void;
}

export function LiveNotificationToast({ onNavigate, onUnreadChange }: LiveNotificationToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const seenIdsRef = useRef(new Set<string>());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((notification: AgentNotification) => {
    // Deduplicate
    if (seenIdsRef.current.has(notification.id)) return;
    seenIdsRef.current.add(notification.id);

    // Keep seen set bounded
    if (seenIdsRef.current.size > 100) {
      const arr = [...seenIdsRef.current];
      seenIdsRef.current = new Set(arr.slice(-50));
    }

    const toast: ToastItem = { ...notification };

    setToasts(prev => {
      const next = [toast, ...prev].slice(0, MAX_TOASTS);
      return next;
    });

    // Notify parent of unread change
    onUnreadChange?.(1);

    // Auto-dismiss
    setTimeout(() => dismissToast(notification.id), TOAST_DURATION);
  }, [dismissToast, onUnreadChange]);

  // SSE connection for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('gs_token') || localStorage.getItem('token');
    if (!token) return;

    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
    const sseUrl = `${apiBase}/agent-state/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          agentId: string; agentName: string; state: string;
          content?: string; notificationId?: string; notificationType?: string;
          title?: string; actionUrl?: string; timestamp: string;
        };

        // Only show notification-type events as toasts
        // The agent observer emits 'responding' state with notification content
        if (data.state === 'responding' && data.content && data.notificationType) {
          addToast({
            id: data.notificationId || `sse-${Date.now()}-${Math.random()}`,
            agent_id: data.agentId,
            type: data.notificationType,
            title: data.title || `${data.agentName} noticed something`,
            message: data.content,
            action_url: data.actionUrl,
            created_at: data.timestamp || new Date().toISOString(),
          });
        }
      } catch { /* ignore malformed */ }
    };

    eventSourceRef.current = es;
    return () => { es.close(); };
  }, [addToast]);

  const handleClick = (toast: ToastItem) => {
    if (toast.action_url) {
      onNavigate?.(toast.action_url);
    }
    dismissToast(toast.id);
  };

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-80 z-[60] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.agent_insight!;
          const Icon = config.icon;
          const agentEmoji = AGENT_EMOJI[toast.agent_id] || '🔔';

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="pointer-events-auto rounded-xl border shadow-2xl overflow-hidden cursor-pointer"
              style={{
                background: 'rgba(12, 12, 30, 0.95)',
                borderColor: `${config.color}30`,
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
              onClick={() => handleClick(toast)}
            >
              <div className="px-3.5 py-3 flex items-start gap-3">
                {/* Agent icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${config.color}12` }}
                >
                  <span className="text-sm">{agentEmoji}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className="w-3 h-3 shrink-0" style={{ color: config.color }} />
                    <span className="text-xs font-semibold text-[var(--ag-text-primary)] truncate">
                      {toast.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--ag-text-secondary)] line-clamp-2 leading-relaxed">
                    {toast.message}
                  </p>
                </div>

                {/* Dismiss */}
                <button
                  onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
                  className="p-1 rounded-md text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5 transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Progress bar (auto-dismiss timer) */}
              <motion.div
                className="h-[2px]"
                style={{ background: config.color, opacity: 0.4 }}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: TOAST_DURATION / 1000, ease: 'linear' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
