// src/dashboard/pages/office/SpotlightHUD.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
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
  const color = AGENT_COLORS[agent.id] ?? '#8B5CF6';
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
    <motion.div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div
        className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl px-4 py-2.5"
        style={{
          background: 'rgba(6,6,26,0.65)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${color}30`,
          boxShadow: `0 0 30px ${color}10, 0 8px 32px rgba(0,0,0,0.3)`,
        }}
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
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}60`,
                }}
              />
              <span className="text-[10px] text-[#9CA3AF]">{stateLabel}</span>
            </div>
            <span className="text-[10px] text-[#4B5563]">
              {taskCount} task{taskCount !== 1 ? 's' : ''} today
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-6" style={{ background: `${color}20` }} />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {showChatInput ? (
            <form onSubmit={handleChatSubmit} className="flex gap-1">
              <input
                autoFocus
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowChatInput(false); setChatText(''); } }}
                placeholder={`Quick message to ${agent.name.split(' ').pop()}...`}
                className="px-2.5 py-1.5 text-xs rounded-lg flex-1 min-w-[150px] outline-none placeholder:text-[#4B5563]"
                style={{
                  background: 'rgba(12,12,30,0.6)',
                  color: '#F4F6FF',
                  border: `1px solid ${color}30`,
                  boxShadow: `0 0 8px ${color}10`,
                }}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-2.5 py-1.5 text-xs rounded-lg font-medium"
                style={{
                  background: `linear-gradient(135deg, ${color}25, ${color}15)`,
                  color,
                  border: `1px solid ${color}30`,
                }}
              >
                Send
              </motion.button>
            </form>
          ) : (
            <motion.button
              onClick={() => { setShowChatInput(true); setShowTaskInput(false); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors min-h-[44px] min-w-[44px]"
              style={{
                background: `${color}10`,
                border: `1px solid ${color}30`,
                color,
              }}
            >
              Chat
            </motion.button>
          )}

          {showTaskInput ? (
            <form onSubmit={handleTaskSubmit} className="flex gap-1">
              <input
                autoFocus
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowTaskInput(false); setTaskText(''); } }}
                placeholder="Assign a task..."
                className="px-2.5 py-1.5 text-xs rounded-lg flex-1 min-w-[140px] outline-none placeholder:text-[#4B5563]"
                style={{
                  background: 'rgba(12,12,30,0.6)',
                  color: '#F4F6FF',
                  border: '1px dashed rgba(139,92,246,0.3)',
                }}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-2.5 py-1.5 text-xs rounded-lg font-medium"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  color: '#8B5CF6',
                  border: '1px solid rgba(139,92,246,0.3)',
                }}
              >
                Create
              </motion.button>
            </form>
          ) : (
            <motion.button
              onClick={() => { setShowTaskInput(true); setShowChatInput(false); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors min-h-[44px] min-w-[44px]"
              style={{
                background: 'rgba(139,92,246,0.08)',
                border: '1px dashed rgba(139,92,246,0.25)',
                color: '#8B5CF6',
              }}
            >
              Assign Task
            </motion.button>
          )}

          <motion.button
            onClick={onDismiss}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="px-1.5 py-1 rounded-lg text-[11px] text-[#4B5563] hover:text-[#9CA3AF] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ✕
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
