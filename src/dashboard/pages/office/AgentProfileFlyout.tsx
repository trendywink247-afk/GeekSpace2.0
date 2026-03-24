// src/dashboard/pages/office/AgentProfileFlyout.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, ClipboardList } from 'lucide-react';
import {
  useFloating,
  useHover,
  useDismiss,
  useInteractions,
  FloatingPortal,
  offset,
  flip,
  shift,
  autoUpdate,
} from '@floating-ui/react';
import {
  AGENT_META,
  AGENT_COLORS,
  SPECIALIST_PARENT,
  SPECIALIST_AGENTS,
  C,
} from './constants';
import type { AgentId, SpecialistId } from './types';

interface Props {
  agentId: string | null;
  onClose: () => void;
  onNavigateToChat: (agentId: string) => void;
}

const STATE_DOT_COLORS: Record<string, string> = {
  idle: '#4B5563',
  thinking: '#F59E0B',
  typing: '#00F0FF',
  tool_call: '#8B5CF6',
  responding: '#ADFF2F',
  done: '#10B981',
  delegating: '#FF6B9D',
  task_started: '#F59E0B',
  task_completed: '#10B981',
  task_failed: '#FF2D78',
};

const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  weebo: 'Your creative AI companion. Generates ideas, writes content, and handles creative tasks with flair.',
  edith: 'Strategic analysis engine. Breaks down complex problems and crafts actionable plans.',
  jarvis: 'Operations specialist. Manages tasks, schedules, and keeps everything running smoothly.',
  aria: 'Creative director working under Weebo. Handles visual design, branding, and art direction.',
  forge: 'Tech lead working under Edith. Builds, debugs, and architects technical solutions.',
  pulse: 'Data analyst working under Edith. Crunches numbers, spots trends, and delivers insights.',
  echo: 'Personal coach working under Weebo. Provides motivation, feedback, and growth guidance.',
  cal: 'Scheduler working under Jarvis. Manages calendar, meetings, and time optimization.',
  nova: 'Researcher working under Jarvis. Deep-dives into topics and surfaces key findings.',
};

function getSpecialistsForAgent(agentId: AgentId): SpecialistId[] {
  return SPECIALIST_AGENTS.filter(
    (sid) => SPECIALIST_PARENT[sid] === agentId,
  );
}

interface StatItemProps {
  label: string;
  value: string;
  color: string;
}

function StatItem({ label, value, color }: StatItemProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 rounded-lg bg-white/[0.03] py-2">
      <span className="text-lg font-bold" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] text-[#8892A4]">{label}</span>
    </div>
  );
}

/** Reusable floating tooltip shown on hover. */
function AgentTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context, { delay: { open: 300, close: 0 } });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss]);

  return (
    <>
      <div ref={refs.setReference} {...getReferenceProps()}>
        {children}
      </div>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="px-2 py-1 rounded-md bg-[#1A1A2E] border border-[#00F0FF]/10 text-[10px] text-[#E8E8F0] shadow-lg shadow-black/40 z-[60] pointer-events-none max-w-[200px]"
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

export function AgentProfileFlyout({ agentId, onClose, onNavigateToChat }: Props) {
  const isOpen = agentId !== null;
  const id = (agentId ?? 'weebo') as AgentId;
  const meta = AGENT_META[id];
  const color = AGENT_COLORS[id] ?? C.cyan;
  const description = AGENT_DESCRIPTIONS[id] ?? '';
  const specialists = getSpecialistsForAgent(id);
  const stateDotColor = STATE_DOT_COLORS['idle'] ?? '#4B5563';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="flyout-backdrop"
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="flyout-panel"
            className="fixed top-0 right-0 h-full w-[360px] max-w-[90vw] overflow-y-auto z-50"
            style={{
              backgroundColor: C.card,
              borderLeft: `1px solid ${color}33`,
            }}
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between p-5"
              style={{ borderBottom: `1px solid ${color}15` }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-3xl">{meta?.emoji ?? '?'}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-[#F4F6FF]">
                    {id.charAt(0).toUpperCase() + id.slice(1)}
                  </h2>
                  <p className="text-xs text-[#8892A4]">{meta?.role ?? 'Agent'}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-[#4B5563]" />
              </button>
            </div>

            {/* Description */}
            <div className="px-5 py-4">
              <p className="text-xs leading-relaxed text-[#8892A4]">{description}</p>
            </div>

            {/* Current State */}
            <div className="px-5 pb-4">
              <AgentTooltip label="Agent is currently idle and ready for tasks">
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stateDotColor }}
                  />
                  <span className="text-xs text-[#F4F6FF]">Idle</span>
                  <span className="text-[10px] text-[#4B5563] ml-auto">Current state</span>
                </div>
              </AgentTooltip>
            </div>

            {/* Today's Stats */}
            <div className="px-5 pb-4">
              <h3 className="text-xs font-semibold text-[#8892A4] uppercase tracking-wider mb-2">
                Today&apos;s Stats
              </h3>
              <div className="flex gap-2">
                <StatItem label="Tasks" value="--" color={color} />
                <StatItem label="Comms" value="--" color={color} />
                <StatItem label="Tools" value="--" color={color} />
                <StatItem label="Uptime" value="--" color={color} />
              </div>
            </div>

            {/* Specialists */}
            {specialists.length > 0 && (
              <div className="px-5 pb-4">
                <h3 className="text-xs font-semibold text-[#8892A4] uppercase tracking-wider mb-2">
                  Specialists
                </h3>
                <div className="space-y-2">
                  {specialists.map((sid) => {
                    const sMeta = AGENT_META[sid];
                    const sColor = AGENT_COLORS[sid];
                    const sDesc = AGENT_DESCRIPTIONS[sid as unknown as AgentId] ?? (sMeta?.role ?? 'Specialist');
                    return (
                      <AgentTooltip key={sid} label={sDesc}>
                        <button
                          onClick={() => onNavigateToChat(sid)}
                          className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
                        >
                          <span className="text-base">{sMeta?.emoji ?? '?'}</span>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium text-[#F4F6FF]">
                              {sid.charAt(0).toUpperCase() + sid.slice(1)}
                            </span>
                            <p className="text-[10px] text-[#4B5563]">
                              {sMeta?.role ?? 'Specialist'}
                            </p>
                          </div>
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: sColor }}
                          />
                        </button>
                      </AgentTooltip>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 pb-6 space-y-2">
              <AgentTooltip label={`Start a conversation with ${id.charAt(0).toUpperCase() + id.slice(1)}`}>
                <button
                  onClick={() => onNavigateToChat(id)}
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: `${color}15`,
                    color,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat with {id.charAt(0).toUpperCase() + id.slice(1)}
                </button>
              </AgentTooltip>
              <AgentTooltip label="Create and assign a new task to this agent">
                <button
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium text-[#8892A4] bg-white/[0.03] border border-white/5 transition-colors hover:bg-white/[0.06]"
                >
                  <ClipboardList className="w-4 h-4" />
                  Assign Task
                </button>
              </AgentTooltip>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
