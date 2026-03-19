// src/dashboard/pages/office/SpotlightHUD.tsx
import { AGENT_COLORS } from './constants';
import type { CanvasAgent } from './types';

interface Props {
  agent: CanvasAgent;
  taskCount: number;
  onChat: () => void;
  onAssignTask: () => void;
  onDismiss: () => void;
}

const STATE_LABELS: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking...',
  typing: 'Typing...',
  tool_call: 'Using tool',
  tool_result: 'Processing result',
  responding: 'Responding',
  done: 'Done',
  delegating: 'Delegating',
  comm_sent: 'Message sent',
  comm_received: 'Message received',
  task_started: 'Working',
  task_completed: 'Task done',
  task_failed: 'Task failed',
};

export function SpotlightHUD({ agent, taskCount, onChat, onAssignTask, onDismiss }: Props) {
  const color = AGENT_COLORS[agent.id] ?? '#00F0FF';
  const stateLabel = STATE_LABELS[agent.state] ?? agent.state;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-2 bg-black/60 backdrop-blur-xl"
        style={{ borderWidth: 1, borderStyle: 'solid', borderColor: `${color}33` }}
      >
        {/* Agent info */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{agent.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-[#F4F6FF] truncate">
                {agent.name}
              </span>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-[#8892A4]">{stateLabel}</span>
            </div>
            <span className="text-[10px] text-[#4B5563]">
              {taskCount} task{taskCount !== 1 ? 's' : ''} today
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onChat}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors"
            style={{
              borderColor: `${color}40`,
              color,
            }}
          >
            Chat
          </button>
          <button
            onClick={onAssignTask}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors"
            style={{
              borderColor: `${color}40`,
              color,
            }}
          >
            Assign Task
          </button>
          <button
            onClick={onDismiss}
            className="px-1.5 py-1 rounded-lg text-[11px] text-[#4B5563] hover:text-[#8892A4] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
