// ============================================================
// Delegation Live Indicator — Shows real-time agent handoffs
//
// When an agent delegates to a specialist, shows an animated
// flow: "Weebo → Forge" with tool context.
// Appears inline in chat during delegation events.
// Mobile-first, compact, touch-friendly.
// ============================================================

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { AgentCapabilityBadge } from './AgentCapabilityBadge';

const AGENT_META: Record<string, { emoji: string; name: string; color: string }> = {
  weebo: { emoji: '✨', name: 'Weebo', color: 'var(--ag-weebo, #00F0FF)' },
  edith: { emoji: '🔷', name: 'Edith', color: 'var(--ag-edith, #8B5CF6)' },
  jarvis: { emoji: '🤖', name: 'Jarvis', color: 'var(--ag-jarvis, #ADFF2F)' },
  aria: { emoji: '🎨', name: 'Aria', color: 'var(--ag-aria, #FF6B9D)' },
  forge: { emoji: '⚙️', name: 'Forge', color: 'var(--ag-forge, #F59E0B)' },
  pulse: { emoji: '📊', name: 'Pulse', color: 'var(--ag-pulse, #10B981)' },
  echo: { emoji: '💬', name: 'Echo', color: 'var(--ag-echo, #6366F1)' },
  cal: { emoji: '📅', name: 'Cal', color: 'var(--ag-cal, #84CC16)' },
  nova: { emoji: '🔬', name: 'Nova', color: 'var(--ag-nova, #EC4899)' },
};

interface DelegationLiveIndicatorProps {
  fromAgent: string;
  toAgent: string;
  reason?: string;
  status: 'delegating' | 'working' | 'done';
  showCapabilities?: boolean;
}

export function DelegationLiveIndicator({
  fromAgent,
  toAgent,
  reason,
  status,
  showCapabilities = false,
}: DelegationLiveIndicatorProps) {
  const from = AGENT_META[fromAgent] || AGENT_META.weebo;
  const to = AGENT_META[toAgent] || AGENT_META.weebo;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div
          className="mx-4 my-2 px-3.5 py-3 rounded-xl border"
          style={{
            background: `linear-gradient(135deg, ${from.color}06, ${to.color}06)`,
            borderColor: `${to.color}15`,
          }}
        >
          {/* Agent flow: From → To */}
          <div className="flex items-center gap-2.5">
            {/* From agent */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{from.emoji}</span>
              <span className="text-[11px] font-medium text-[var(--ag-text-muted)]">
                {from.name}
              </span>
            </div>

            {/* Arrow with animation */}
            <motion.div
              animate={status === 'delegating' ? { x: [0, 4, 0] } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <ArrowRight className="w-3.5 h-3.5 text-[var(--ag-text-muted)]" />
            </motion.div>

            {/* To agent */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{to.emoji}</span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: to.color }}
              >
                {to.name}
              </span>
            </div>

            {/* Status indicator */}
            <div className="ml-auto flex items-center gap-1.5">
              {status === 'delegating' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-3 h-3 text-[var(--ag-text-muted)]" />
                </motion.div>
              )}
              {status === 'working' && (
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: to.color }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {status === 'done' && (
                <span className="text-[10px] text-[var(--ag-green)]">✓ Done</span>
              )}

              <span className="text-[10px] text-[var(--ag-text-muted)]">
                {status === 'delegating' ? 'Handing off...' : status === 'working' ? 'Working...' : ''}
              </span>
            </div>
          </div>

          {/* Reason */}
          {reason && (
            <p className="mt-1.5 text-[10px] text-[var(--ag-text-muted)] leading-relaxed pl-7">
              {reason}
            </p>
          )}

          {/* Capabilities of target agent */}
          {showCapabilities && status !== 'done' && (
            <div className="mt-2 pl-7">
              <AgentCapabilityBadge agentId={toAgent} variant="inline" />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
