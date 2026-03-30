// src/dashboard/pages/office/InsightToast.tsx
// Floating insight toast — floats at top-center of the canvas stage.
// Shows one insight at a time from a queue, auto-dismisses after TOAST_DURATION_MS.
// Max queue of TOAST_MAX_QUEUE. Discards stale toasts on tab focus regain.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { InsightCard } from './types';
import { AGENT_COLORS } from './constants';
import type { AgentId } from './types';
import {
  TOAST_DURATION_MS,
  TOAST_FADE_MS,
  TOAST_GAP_MS,
  TOAST_MAX_QUEUE,
  TOAST_MAX_AGE_MS,
} from './constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InsightToastProps {
  insights: InsightCard[];
  onDismiss: (id: string) => void;
  onClickInsight?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InsightToast({ insights, onDismiss, onClickInsight }: InsightToastProps) {
  // The current insight being displayed (or null)
  const [current, setCurrent] = useState<InsightCard | null>(null);
  // Fade state: 'in' | 'out' | 'hidden'
  const [fadeState, setFadeState] = useState<'in' | 'out' | 'hidden'>('hidden');
  // Internal queue (capped at TOAST_MAX_QUEUE)
  const queueRef = useRef<InsightCard[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowingRef = useRef(false);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (gapTimerRef.current) { clearTimeout(gapTimerRef.current); gapTimerRef.current = null; }
  }, []);

  // Dismiss current toast: fade out then clear
  const dismissCurrent = useCallback((id: string) => {
    clearTimers();
    setFadeState('out');
    timerRef.current = setTimeout(() => {
      setCurrent(null);
      setFadeState('hidden');
      isShowingRef.current = false;
      onDismiss(id);
      // Wait TOAST_GAP_MS before showing the next one
      gapTimerRef.current = setTimeout(() => {
        gapTimerRef.current = null;
        // showNext will run via the queue effect
      }, TOAST_GAP_MS);
    }, TOAST_FADE_MS);
  }, [clearTimers, onDismiss]);

  // Show next queued insight
  const showNext = useCallback(() => {
    if (isShowingRef.current) return;
    if (queueRef.current.length === 0) return;
    const next = queueRef.current.shift()!;
    isShowingRef.current = true;
    setCurrent(next);
    setFadeState('in');

    // Auto-dismiss after TOAST_DURATION_MS
    timerRef.current = setTimeout(() => {
      dismissCurrent(next.id);
    }, TOAST_DURATION_MS);
  }, [dismissCurrent]);

  // Enqueue new insights (not already shown, capped at TOAST_MAX_QUEUE)
  useEffect(() => {
    let changed = false;
    for (const insight of insights) {
      if (shownIdsRef.current.has(insight.id)) continue;
      if (queueRef.current.some(q => q.id === insight.id)) continue;
      if (queueRef.current.length >= TOAST_MAX_QUEUE) break;
      queueRef.current.push(insight);
      shownIdsRef.current.add(insight.id);
      changed = true;
    }
    if (changed && !isShowingRef.current && !gapTimerRef.current) {
      showNext();
    }
  }, [insights, showNext]);

  // After gap finishes — show next (poll queue)
  useEffect(() => {
    if (!isShowingRef.current && queueRef.current.length > 0 && !gapTimerRef.current) {
      showNext();
    }
  });

  // On tab focus regain: discard queued toasts older than TOAST_MAX_AGE_MS
  useEffect(() => {
    const onFocus = () => {
      const cutoff = Date.now() - TOAST_MAX_AGE_MS;
      const before = queueRef.current.length;
      queueRef.current = queueRef.current.filter(
        (ins) => new Date(ins.timestamp).getTime() >= cutoff,
      );
      if (queueRef.current.length !== before) {
        // Stale toasts removed — attempt to show next fresh one
        if (!isShowingRef.current) showNext();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [showNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Track progress bar animation start time
  const progressStartRef = useRef<number>(0);
  const [progressPct, setProgressPct] = useState(100);

  // Animate progress bar countdown
  useEffect(() => {
    if (fadeState !== 'in' || !current) return;
    progressStartRef.current = Date.now();
    setProgressPct(100); // eslint-disable-line react-hooks/set-state-in-effect
    const interval = setInterval(() => {
      const elapsed = Date.now() - progressStartRef.current;
      const remaining = Math.max(0, 100 - (elapsed / TOAST_DURATION_MS) * 100);
      setProgressPct(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [current, fadeState]);

  // Nothing to show
  if (!current || fadeState === 'hidden') return null;

  const agentColor = AGENT_COLORS[current.agentId as AgentId] ?? '#F59E0B';

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 overflow-hidden"
      style={{
        maxWidth: 'min(85%, 480px)',
        minWidth: '280px',
        borderRadius: 'var(--ag-radius-md, 12px)',
        opacity: fadeState === 'in' ? 1 : 0,
        transition: `opacity ${TOAST_FADE_MS}ms ease`,
        pointerEvents: 'auto',
        background: 'var(--ag-glass-bg, rgba(12,12,30,0.4))',
        backdropFilter: 'blur(var(--ag-glass-blur, 16px))',
        WebkitBackdropFilter: 'blur(var(--ag-glass-blur, 16px))',
        border: `1px solid ${agentColor}30`,
        boxShadow: `0 0 20px ${agentColor}10`,
      }}
    >
      <div className="flex items-start gap-2.5 p-3">
        {/* Agent colored avatar dot */}
        <div className="flex-shrink-0 mt-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: agentColor,
              boxShadow: `0 0 8px ${agentColor}60`,
            }}
          />
        </div>

        {/* Insight content */}
        <button
          className="flex-1 text-left cursor-pointer bg-transparent border-0 p-0"
          onClick={() => onClickInsight?.(current.id)}
          aria-label={`Insight from ${current.agentName}: ${current.text}`}
        >
          {/* Agent name header in their color */}
          <span
            className="text-[10px] font-bold uppercase tracking-wider block mb-0.5"
            style={{ color: agentColor }}
          >
            {current.agentName}
          </span>
          <span
            className="text-xs leading-snug block"
            style={{ color: 'var(--ag-text-primary, #F4F6FF)' }}
          >
            {current.text}
          </span>
        </button>

        {/* CTA button */}
        {current.action && (
          <a
            href={current.action.href}
            onClick={() => dismissCurrent(current.id)}
            className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:brightness-110 mt-0.5"
            style={{
              background: `${agentColor}20`,
              color: agentColor,
              border: `1px solid ${agentColor}30`,
            }}
          >
            {current.action.label}
          </a>
        )}

        {/* Dismiss button */}
        <button
          onClick={() => dismissCurrent(current.id)}
          className="flex-shrink-0 text-xs leading-none opacity-60 hover:opacity-100 transition-opacity mt-0.5 ml-1 min-h-[44px] min-w-[44px] flex items-start justify-center pt-0.5"
          style={{ color: 'var(--ag-text-primary, #F4F6FF)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label="Dismiss insight"
        >
          x
        </button>
      </div>

      {/* Progress bar — auto-dismiss countdown */}
      <div
        className="h-[2px] w-full"
        style={{ background: `${agentColor}15` }}
      >
        <div
          className="h-full transition-none"
          style={{
            width: `${progressPct}%`,
            background: agentColor,
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}
