// ============================================================
// Notification Bell — Header component with unread count + dropdown
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink, X } from 'lucide-react';
import { agentNotificationsService, type AgentNotificationData } from '@/services/api';

const POLL_INTERVAL = 30_000; // 30s

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AgentNotificationData[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Poll unread count
  const fetchCount = useCallback(async () => {
    try {
      const res = await agentNotificationsService.count();
      setUnread(res.data.unread || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCount(); // eslint-disable-line react-hooks/set-state-in-effect
    const interval = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Load notifications when dropdown opens
  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await agentNotificationsService.list(8);
      setNotifications(res.data.notifications || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      await agentNotificationsService.markAllRead();
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    } catch { /* ignore */ }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await agentNotificationsService.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const typeIcons: Record<string, string> = {
    goal_progress: '🎯',
    goal_completed: '🎉',
    step_completed: '✅',
    delegation_result: '🔄',
    daily_summary: '📊',
    nudge: '💡',
    celebration: '🏆',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg transition-all hover:bg-white/5"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white animate-pulse"
            style={{ background: '#EF4444', padding: '0 4px' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] max-h-[420px] overflow-hidden rounded-xl shadow-2xl z-50"
          style={{
            background: '#0C0C18',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-gray-200">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[320px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="w-8 h-8 text-gray-600 mb-2" />
                <span className="text-sm text-gray-500">No notifications yet</span>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
                  style={{ background: n.read ? 'transparent' : 'rgba(139,92,246,0.03)' }}
                  onClick={() => handleMarkRead(n.id)}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{typeIcons[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${n.read ? 'text-gray-400' : 'text-gray-200 font-medium'}`}>
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <span className="text-xs text-gray-600 mt-1 block">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-4 py-2">
            <button
              onClick={() => { setOpen(false); navigate('/dashboard/proactive'); }}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 w-full justify-center py-1"
            >
              View all <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
