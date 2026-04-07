// src/dashboard/pages/office/TasksTab.tsx
import { useState, useEffect } from 'react';
import { agentTasksService, type AgentTask } from '@/services/api';
import { AGENT_COLORS, AGENT_META, C, CORE_AGENTS } from '../constants';
import type { AgentId, CoreAgentId } from '../entities/types';

interface Props {
  taskBoard?: Record<string, unknown[]>;
  onCreateTask: (agentId: string, title: string) => void;
}

type Column = 'pending' | 'running' | 'completed';
const COLUMNS: { key: Column; label: string; accent: string }[] = [
  { key: 'pending', label: 'Pending', accent: '#F59E0B' },
  { key: 'running', label: 'Running', accent: C.cyan },
  { key: 'completed', label: 'Completed', accent: C.green },
];

function elapsedSince(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function priorityLabel(p: number): { text: string; color: string } {
  if (p >= 8) return { text: 'Critical', color: '#EF4444' };
  if (p >= 5) return { text: 'High', color: '#F59E0B' };
  if (p >= 3) return { text: 'Medium', color: C.cyan };
  return { text: 'Low', color: C.dim };
}

export default function TasksTab({ onCreateTask, taskBoard }: Props) {
  // Derive board from the unified polling prop
  const board: Record<string, AgentTask[]> = (taskBoard as Record<string, AgentTask[]>) ?? { pending: [], running: [], completed: [] };

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Column | null>(null);

  // Create form state
  const [formAgent, setFormAgent] = useState<CoreAgentId>('weebo');
  const [formTitle, setFormTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Elapsed-time ticker for running tasks
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Drag handlers
  const handleDragStart = (taskId: string, sourceCol: Column) => {
    if (sourceCol === 'completed') return; // can't drag completed
    setDragId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, col: Column) => {
    e.preventDefault();
    setDragOver(col);
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = async (targetCol: Column) => {
    setDragOver(null);
    if (!dragId) return;

    // Find source column
    let sourceCol: Column | null = null;
    for (const col of COLUMNS) {
      if ((board[col.key] ?? []).some((t) => t.id === dragId)) {
        sourceCol = col.key;
        break;
      }
    }
    if (!sourceCol) return;

    // Validate transitions
    const valid =
      (sourceCol === 'pending' && targetCol === 'running') ||
      (sourceCol === 'running' && targetCol === 'completed');
    if (!valid) {
      setDragId(null);
      return;
    }

    try {
      const action = targetCol === 'running' ? 'start' : 'complete';
      await agentTasksService.update(dragId, action);
      // The 2s unified poll will pick up the change
    } catch {
      // silent
    }
    setDragId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      onCreateTask(formAgent, title);
      await agentTasksService.create({ agent_id: formAgent, title });
      setFormTitle('');
      // The 2s unified poll will pick up the new task
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  // Show loading only if taskBoard prop hasn't arrived yet
  if (!taskBoard) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#A78BFA]/30 border-t-[#A78BFA] rounded-full animate-spin" />
      </div>
    );
  }

  // Task count summary
  const pendingCount = (board.pending ?? []).length;
  const runningCount = (board.running ?? []).length;
  const completedCount = (board.completed ?? []).length;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Summary counts */}
      <div className="flex items-center gap-3 text-[10px] px-1">
        <span style={{ color: '#F59E0B' }}>{pendingCount} pending</span>
        <span className="text-[#4B5563]">&middot;</span>
        <span style={{ color: C.cyan }}>{runningCount} running</span>
        <span className="text-[#4B5563]">&middot;</span>
        <span style={{ color: C.green }}>{completedCount} done</span>
      </div>
      {/* Kanban Board — horizontal scroll on mobile, grid on desktop */}
      <div className="flex overflow-x-auto gap-3 md:grid md:grid-cols-3 md:overflow-visible pb-2 md:pb-0 snap-x snap-mandatory">
        {COLUMNS.map(({ key, label, accent }) => {
          const tasks = board[key] ?? [];
          return (
            <div
              key={key}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(key)}
              className="rounded-lg p-2 transition-colors min-w-[220px] flex-shrink-0 md:min-w-0 md:flex-shrink snap-center"
              style={{
                background: dragOver === key ? 'rgba(139,92,246,0.04)' : 'transparent',
                border: `1px solid ${dragOver === key ? accent : 'rgba(139,92,246,0.05)'}`,
                minHeight: 100,
              }}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                  <span className="text-xs font-medium" style={{ color: C.text }}>{label}</span>
                </div>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: `${accent}20`, color: accent }}
                >
                  {tasks.length}
                </span>
              </div>

              {/* Task Cards */}
              <div className="flex flex-col gap-1.5">
                {tasks.map((task) => {
                  const meta = AGENT_META[task.agent_id as AgentId];
                  const color = AGENT_COLORS[task.agent_id as AgentId] ?? C.cyan;
                  const prio = priorityLabel(task.priority);

                  return (
                    <div
                      key={task.id}
                      draggable={key !== 'completed'}
                      onDragStart={() => handleDragStart(task.id, key)}
                      className="rounded-lg p-2 cursor-grab active:cursor-grabbing transition-all hover:border-[#A78BFA]/20 min-h-[44px]"
                      style={{
                        background: C.card,
                        border: `1px solid rgba(139,92,246,0.05)`,
                        borderLeft: `3px solid ${color}`,
                        opacity: dragId === task.id ? 0.5 : 1,
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm flex-shrink-0">{meta?.emoji ?? '?'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" style={{ color: C.text }}>{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="text-[9px] px-1 py-0.5 rounded"
                              style={{ background: `${prio.color}20`, color: prio.color }}
                            >
                              {prio.text}
                            </span>
                            {key === 'running' && task.started_at && (
                              <span className="text-[9px] font-mono" style={{ color: C.cyan }}>
                                {elapsedSince(task.started_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <p className="text-[10px] text-center py-4" style={{ color: C.dim }}>No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Form */}
      <form
        onSubmit={handleCreate}
        className="flex flex-nowrap items-center gap-1.5 rounded-lg p-2"
        style={{ background: C.card, border: `1px solid rgba(139,92,246,0.05)` }}
      >
        <select
          value={formAgent}
          onChange={(e) => setFormAgent(e.target.value as CoreAgentId)}
          className="text-xs rounded px-2 py-1.5 outline-none"
          style={{ background: C.elevated, color: C.text, border: `1px solid rgba(139,92,246,0.1)` }}
        >
          {CORE_AGENTS.map((id) => (
            <option key={id} value={id}>{AGENT_META[id].emoji} {id}</option>
          ))}
        </select>
        <input
          type="text"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder="Task title..."
          className="flex-1 text-xs rounded px-2 py-1.5 outline-none placeholder:text-[#4B5563]"
          style={{ background: C.elevated, color: C.text, border: `1px solid rgba(139,92,246,0.1)` }}
        />
        <button
          type="submit"
          disabled={creating || !formTitle.trim()}
          className="text-xs font-medium rounded px-3 py-1.5 transition-opacity disabled:opacity-40"
          style={{ background: `${C.cyan}20`, color: C.cyan }}
        >
          {creating ? '...' : 'Create'}
        </button>
      </form>
    </div>
  );
}
