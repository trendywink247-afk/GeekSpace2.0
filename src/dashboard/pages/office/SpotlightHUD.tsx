// src/dashboard/pages/office/SpotlightHUD.tsx
import { useState } from 'react';
import { AGENT_COLORS } from './constants';
import type { CanvasAgent } from './types';

interface Props {
  agent: CanvasAgent;
  taskCount: number;
  onChat: (message?: string) => void;
  onAssignTask: (title?: string) => void;
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

  const [showChatInput, setShowChatInput] = useState(false);
  const [chatText, setChatText] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [taskText, setTaskText] = useState('');

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = chatText.trim();
    if (msg) {
      onChat(msg);
      setChatText('');
      setShowChatInput(false);
    }
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = taskText.trim();
    if (title) {
      onAssignTask(title);
      setTaskText('');
      setShowTaskInput(false);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-xl">
      <div
        className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl px-4 py-2 bg-black/60 backdrop-blur-xl"
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
              <span className="text-[10px] text-[#9CA3AF]">{stateLabel}</span>
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
          {showChatInput ? (
            <form onSubmit={handleChatSubmit} className="flex gap-1">
              <input
                autoFocus
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowChatInput(false); setChatText(''); } }}
                placeholder={`Ask ${agent.name}...`}
                className="px-2 py-1 text-xs rounded bg-black/40 border text-white flex-1 min-w-[150px] outline-none"
                style={{ borderColor: `${color}30` }}
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs rounded font-medium"
                style={{ background: `${color}20`, color }}
              >
                Send
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setShowChatInput(true); setShowTaskInput(false); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors min-h-[44px] min-w-[44px]"
              style={{ borderColor: `${color}40`, color }}
            >
              Chat
            </button>
          )}

          {showTaskInput ? (
            <form onSubmit={handleTaskSubmit} className="flex gap-1">
              <input
                autoFocus
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowTaskInput(false); setTaskText(''); } }}
                placeholder="Task description..."
                className="px-2 py-1 text-xs rounded bg-black/40 border text-white flex-1 min-w-[140px] outline-none"
                style={{ borderColor: `${color}30` }}
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs rounded font-medium"
                style={{ background: `${color}20`, color }}
              >
                Create
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setShowTaskInput(true); setShowChatInput(false); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors min-h-[44px] min-w-[44px]"
              style={{ borderColor: `${color}40`, color }}
            >
              Assign Task
            </button>
          )}

          <button
            onClick={onDismiss}
            className="px-1.5 py-1 rounded-lg text-[11px] text-[#4B5563] hover:text-[#9CA3AF] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
