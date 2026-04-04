// ============================================================
// Session Continuity Banner — "Welcome back" with context
//
// When a returning user opens chat, shows what they were working on
// last time, pending items, and quick-resume suggestions.
// Mobile-first, matches Agentin design system.
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Clock, X, Sparkles } from 'lucide-react';

interface SessionSummary {
  summary: string;
  accomplished: string[];
  pending: string[];
  created_at: string;
}

interface SessionContinuityBannerProps {
  userId?: string;
  onResume?: (prompt: string) => void;
  onDismiss?: () => void;
}

export function SessionContinuityBanner({ onResume, onDismiss }: SessionContinuityBannerProps) {
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionAge, setSessionAge] = useState('');

  useEffect(() => {
    const fetchLastSession = async () => {
      try {
        const token = localStorage.getItem('gs_token') || localStorage.getItem('token');
        if (!token) { setLoading(false); return; }
        const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
        const res = await fetch(`${apiBase}/agent/session/last-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json() as { summary?: SessionSummary };
        if (data.summary) {
          setSession(data.summary);
          const diff = Date.now() - new Date(data.summary.created_at).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 60) setSessionAge(`${mins}m ago`);
          else if (mins < 1440) setSessionAge(`${Math.floor(mins / 60)}h ago`);
          else { const d = Math.floor(mins / 1440); setSessionAge(d === 1 ? 'yesterday' : `${d}d ago`); }
        }
      } catch { /* no session data available */ }
      setLoading(false);
    };
    fetchLastSession();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleResume = (text: string) => {
    onResume?.(text);
    setDismissed(true);
  };

  if (loading || !session || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md mx-auto mb-4"
      >
        <div
          className="relative rounded-2xl border backdrop-blur-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.04))',
            borderColor: 'var(--ag-border-default)',
          }}
        >
          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5 transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="px-4 py-3.5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.12)' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--ag-cyan)]" />
              </div>
              <span className="text-xs font-medium text-[var(--ag-text-secondary)]">
                Welcome back
              </span>
              <span className="text-[10px] text-[var(--ag-text-muted)] flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {sessionAge}
              </span>
            </div>

            {/* Summary */}
            <p className="text-sm text-[var(--ag-text-primary)] leading-relaxed mb-2.5 pr-6">
              {session.summary}
            </p>

            {/* Pending items as quick-resume buttons */}
            {session.pending.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[var(--ag-text-muted)] font-medium">
                  Continue where you left off
                </span>
                {session.pending.slice(0, 2).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleResume(`Continue working on: ${item}`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-all min-h-[40px]"
                    style={{
                      background: 'var(--ag-bg-surface)',
                      border: '1px solid var(--ag-border-subtle)',
                      color: 'var(--ag-text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ag-border-default)';
                      e.currentTarget.style.color = 'var(--ag-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ag-border-subtle)';
                      e.currentTarget.style.color = 'var(--ag-text-secondary)';
                    }}
                  >
                    <ArrowRight className="w-3 h-3 text-[var(--ag-cyan)] shrink-0" />
                    <span className="line-clamp-1">{item}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
