// src/dashboard/pages/office/InsightToast.tsx
// Floating insight toast — floats at top-center of the canvas stage.
// Shows one insight at a time from a queue, auto-dismisses after TOAST_DURATION_MS.
// Max queue of TOAST_MAX_QUEUE. Discards stale toasts on tab focus regain.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { InsightCard } from './types';
import { AGENT_META, AGENT_COLORS } from './constants';
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

  // Nothing to show
  if (!current || fadeState === 'hidden') return null;

  const agentEmoji = AGENT_META[current.agentId as AgentId]?.emoji ?? '🤖';
  const agentColor = AGENT_COLORS[current.agentId as AgentId] ?? '#F59E0B';

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-start gap-2"
      style={{
        maxWidth: 'min(80%, 480px)',
        // mobile override handled via inline style below
        padding: '8px 16px',
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '10px',
        opacity: fadeState === 'in' ? 1 : 0,
        transition: `opacity ${TOAST_FADE_MS}ms ease`,
        pointerEvents: 'auto',
      }}
    >
      {/* Agent emoji / icon */}
      <span
        className="text-base flex-shrink-0 mt-0.5"
        style={{ color: agentColor }}
        aria-hidden="true"
      >
        {agentEmoji}
      </span>

      {/* Insight text */}
      <button
        className="flex-1 text-left text-xs leading-snug cursor-pointer bg-transparent border-0 p-0"
        style={{ color: '#F4F6FF' }}
        onClick={() => onClickInsight?.(current.id)}
        aria-label={`Insight from ${current.agentName}: ${current.text}`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#F59E0B' }}>
          {current.agentName}
        </span>
        <br />
        <span className="sm:text-xs text-[11px]">{current.text}</span>
      </button>

      {/* Dismiss button */}
      <button
        onClick={() => dismissCurrent(current.id)}
        className="flex-shrink-0 text-xs leading-none opacity-60 hover:opacity-100 transition-opacity mt-0.5 ml-1"
        style={{ color: '#F4F6FF', background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-label="Dismiss insight"
      >
        ✕
      </button>
    </div>
  );
}
