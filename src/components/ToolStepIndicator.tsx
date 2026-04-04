// ============================================================
// ToolStepIndicator — Real-time tool execution steps in chat
//
// Renders SSE-driven agent state events (thinking, tool_call,
// tool_result, delegating, done) as compact animated cards
// between the user message and the agent response.
// ============================================================

import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

export interface ToolStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'responding' | 'delegating' | 'done'
    | 'comm_sent' | 'task_started' | 'task_completed' | 'task_failed';
  tool?: string;
  content: string;
  status: 'active' | 'done' | 'error';
  timestamp: string;
  durationMs?: number;
}

interface ToolStepIndicatorProps {
  steps: ToolStep[];
  isActive: boolean;
}

// ── Icon helpers ─────────────────────────────────────────────

/** Pick an icon string for a tool name */
function getToolIcon(type: ToolStep['type'], tool?: string): string {
  if (type === 'thinking') return '\u{1F9E0}';        // brain
  if (type === 'delegating') return '\u{1F91D}';       // handshake
  if (type === 'comm_sent') return '\u{1F4E8}';        // envelope
  if (type === 'task_started') return '\u{1F680}';     // rocket
  if (type === 'task_completed') return '\u{2705}';    // check mark
  if (type === 'task_failed') return '\u{274C}';       // cross mark
  if (type === 'responding') return '\u{270D}\u{FE0F}'; // writing hand
  if (type === 'done') return '\u{2728}';              // sparkles

  // tool_call / tool_result — pick icon by tool name
  if (!tool) return '\u{1F527}';  // wrench
  if (tool.includes('search') || tool.includes('browse')) return '\u{1F50D}';
  if (tool.includes('reminder') || tool.includes('alarm') || tool.includes('schedule')) return '\u{23F0}';
  if (tool.includes('image') || tool.includes('photo')) return '\u{1F3A8}';
  if (tool.includes('code') || tool.includes('generate')) return '\u{1F4BB}';
  if (tool.includes('note') || tool.includes('doc')) return '\u{1F4DD}';
  if (tool.includes('telegram') || tool.includes('send') || tool.includes('email')) return '\u{1F4E9}';
  if (tool.includes('screenshot') || tool.includes('camera')) return '\u{1F4F7}';
  if (tool.includes('expense') || tool.includes('track')) return '\u{1F4B0}';
  if (tool.includes('habit')) return '\u{1F3AF}';
  if (tool.includes('focus')) return '\u{1F3AF}';
  if (tool.includes('calendar')) return '\u{1F4C5}';
  return '\u{1F527}';
}

/** Format duration as human-readable */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Component ────────────────────────────────────────────────

export function ToolStepIndicator({ steps, isActive }: ToolStepIndicatorProps) {
  if (steps.length === 0) return null;

  // Count completed tool steps for the summary
  const toolStepCount = steps.filter(
    (s) => s.type === 'tool_call' || s.type === 'tool_result',
  ).length;
  const doneSteps = steps.filter((s) => s.status === 'done');
  const showSummary = !isActive && doneSteps.length > 0;

  return (
    <div className="w-full max-h-[200px] overflow-y-auto scrollbar-hide space-y-1 my-2">
      <AnimatePresence mode="popLayout">
        {steps.map((step) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            layout
          >
            <StepCard step={step} />
          </motion.div>
        ))}

        {/* Summary line when done */}
        {showSummary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[#8892A4]"
          >
            <span>{'\u{2728}'}</span>
            <span>
              {toolStepCount > 0
                ? `${Math.ceil(toolStepCount / 2)} tool${Math.ceil(toolStepCount / 2) !== 1 ? 's' : ''} used`
                : 'Processing complete'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Step Card ────────────────────────────────────────────────

function StepCard({ step }: { step: ToolStep }) {
  const icon = getToolIcon(step.type, step.tool);
  const isActive = step.status === 'active';
  const isError = step.status === 'error';

  return (
    <div
      className={[
        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all',
        'bg-[#0C0C18]/50 border',
        isActive
          ? 'border-[#00F0FF]/15'
          : isError
            ? 'border-[#FF2D78]/15'
            : 'border-[#00F0FF]/5',
        isActive ? '' : 'opacity-70',
      ].join(' ')}
    >
      {/* Icon */}
      <span className="shrink-0 text-sm leading-none">{icon}</span>

      {/* Content */}
      <span
        className={[
          'flex-1 min-w-0 truncate',
          isActive ? 'text-[#E8E8F0]' : isError ? 'text-[#FF2D78]' : 'text-[var(--ag-text-secondary)]',
        ].join(' ')}
      >
        {step.content}
      </span>

      {/* Status indicator */}
      <span className="shrink-0 flex items-center gap-1">
        {step.durationMs != null && (
          <span className="text-[10px] text-[#4B5563] tabular-nums">
            {formatDuration(step.durationMs)}
          </span>
        )}
        {isActive && (
          <Loader2 className="w-3 h-3 text-[var(--ag-cyan)] animate-spin" />
        )}
        {step.status === 'done' && (
          <Check className="w-3 h-3 text-[#ADFF2F]" />
        )}
        {isError && (
          <X className="w-3 h-3 text-[#FF2D78]" />
        )}
      </span>
    </div>
  );
}
