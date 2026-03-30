// src/dashboard/pages/office/AgentProfileFlyout.tsx
import { useState, useCallback } from 'react';
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
import { createTask, TASK_TYPE_LABELS } from './taskQueue';
import type { TaskType } from './taskQueue';

interface Props {
  agentId: string | null;
  onClose: () => void;
  onNavigateToChat: (agentId: string) => void;
  /** Callback when a task is assigned via the flyout modal. */
  onTaskAssigned?: (agentId: AgentId, taskLabel: string) => void;
}

const STATE_DOT_COLORS: Record<string, string> = {
  idle: '#4B5563',
  thinking: '#F59E0B',
  typing: '#8B5CF6',
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
      <span className="text-[10px] text-[#9CA3AF]">{label}</span>
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

  const setRef = useCallback((node: HTMLDivElement | null) => { refs.setReference(node); }, [refs]);
  const setFloat = useCallback((node: HTMLDivElement | null) => { refs.setFloating(node); }, [refs]);

  return (
    <>
      <div ref={setRef} {...getReferenceProps()}>
        {children}
      </div>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={setFloat}
            style={floatingStyles}
            {...getFloatingProps()}
            className="px-2 py-1 rounded-md bg-[#1A1A2E] border border-[#8B5CF6]/10 text-[10px] text-[#E8E8F0] shadow-lg shadow-black/40 z-[60] pointer-events-none max-w-[200px]"
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

export function AgentProfileFlyout({ agentId, onClose, onNavigateToChat, onTaskAssigned }: Props) {
  const isOpen = agentId !== null;
  const id = (agentId ?? 'weebo') as AgentId;
  const meta = AGENT_META[id];
  const color = AGENT_COLORS[id] ?? C.cyan;
  const description = AGENT_DESCRIPTIONS[id] ?? '';
  const specialists = getSpecialistsForAgent(id);
  const stateDotColor = STATE_DOT_COLORS['idle'] ?? '#4B5563';

  // A.4 — Assign Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('generate_insight');

  const handleAssignTask = useCallback(() => {
    const label = taskInput.trim();
    if (!label) return;
    createTask({
      type: taskType,
      label,
      assignedTo: id,
      priority: 2,
    });
    onTaskAssigned?.(id, label);
    setTaskInput('');
    setShowTaskModal(false);
  }, [taskInput, taskType, id, onTaskAssigned]);

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

          {/* Panel — glassmorphism */}
          <motion.div
            key="flyout-panel"
            className="fixed top-0 right-0 h-full w-[360px] max-w-[90vw] overflow-y-auto z-50"
            style={{
              background: 'rgba(6,6,26,0.7)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderLeft: `1px solid ${color}25`,
              boxShadow: `-8px 0 40px rgba(0,0,0,0.3), 0 0 60px ${color}08`,
            }}
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between p-5"
              style={{
                borderBottom: `1px solid ${color}15`,
                background: `linear-gradient(135deg, ${color}06 0%, transparent 100%)`,
              }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className="text-3xl"
                  style={{ filter: `drop-shadow(0 0 8px ${color}30)` }}
                >
                  {meta?.emoji ?? '?'}
                </span>
                <div className="min-w-0">
                  <h2
                    className="text-lg font-bold text-[#F4F6FF]"
                    style={{ textShadow: `0 0 20px ${color}25` }}
                  >
                    {id.charAt(0).toUpperCase() + id.slice(1)}
                  </h2>
                  <p className="text-xs text-[#9CA3AF]">{meta?.role ?? 'Agent'}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5 text-[#4B5563]" />
              </button>
            </div>

            {/* Description */}
            <div className="px-5 py-4">
              <p className="text-xs leading-relaxed text-[#9CA3AF]">{description}</p>
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
              <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">
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
                <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">
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
                          className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left min-h-[44px]"
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
                <motion.button
                  onClick={() => onNavigateToChat(id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors min-h-[44px]"
                  style={{
                    background: `linear-gradient(135deg, ${color}18, ${color}0a)`,
                    color,
                    border: `1px solid ${color}30`,
                    backdropFilter: 'blur(8px)',
                    boxShadow: `0 0 20px ${color}08`,
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat with {id.charAt(0).toUpperCase() + id.slice(1)}
                </motion.button>
              </AgentTooltip>
              <AgentTooltip label="Create and assign a new task to this agent">
                <motion.button
                  onClick={() => setShowTaskModal(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium text-[#9CA3AF] transition-colors min-h-[44px]"
                  style={{
                    background: 'rgba(12,12,30,0.4)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <ClipboardList className="w-4 h-4" />
                  Assign Task
                </motion.button>
              </AgentTooltip>
            </div>

            {/* A.4 — Assign Task Modal */}
            <AnimatePresence>
              {showTaskModal && (
                <motion.div
                  key="task-modal-overlay"
                  className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div
                    className="absolute inset-0 bg-black/60"
                    onClick={() => setShowTaskModal(false)}
                  />
                  <motion.div
                    className="relative w-full max-w-md rounded-2xl p-5"
                    style={{
                      backgroundColor: C.card,
                      border: `1px solid ${color}30`,
                      boxShadow: `0 0 40px ${color}10`,
                    }}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-[#F4F6FF]">
                        What should {id.charAt(0).toUpperCase() + id.slice(1)} do?
                      </h3>
                      <button
                        onClick={() => setShowTaskModal(false)}
                        className="p-1 rounded-lg hover:bg-white/5"
                      >
                        <X className="w-4 h-4 text-[#4B5563]" />
                      </button>
                    </div>

                    {/* Task type dropdown */}
                    <label className="block mb-3">
                      <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] mb-1 block">
                        Task Type
                      </span>
                      <select
                        value={taskType}
                        onChange={e => setTaskType(e.target.value as TaskType)}
                        className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                        style={{
                          background: '#12121F',
                          color: '#F4F6FF',
                          border: '1px solid rgba(139,92,246,0.1)',
                        }}
                      >
                        {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </label>

                    {/* Task description input */}
                    <label className="block mb-4">
                      <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] mb-1 block">
                        Description
                      </span>
                      <input
                        type="text"
                        value={taskInput}
                        onChange={e => setTaskInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAssignTask(); }}
                        placeholder={`What should ${id.charAt(0).toUpperCase() + id.slice(1)} work on?`}
                        autoFocus
                        className="w-full rounded-lg px-3 py-2.5 text-xs outline-none placeholder:text-[#4B5563] min-h-[44px]"
                        style={{
                          background: '#12121F',
                          color: '#F4F6FF',
                          border: '1px solid rgba(139,92,246,0.1)',
                        }}
                      />
                    </label>

                    {/* Submit button */}
                    <button
                      onClick={handleAssignTask}
                      disabled={!taskInput.trim()}
                      className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-40 min-h-[44px]"
                      style={{
                        backgroundColor: `${color}20`,
                        color,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      Assign to {id.charAt(0).toUpperCase() + id.slice(1)}
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
