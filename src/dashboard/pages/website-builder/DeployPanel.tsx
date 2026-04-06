import { AlertCircle, Bot, CheckCircle, Clock, Loader2, Plus, Send, Sparkles, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import {
  formatTimeAgo,
  getPersonalityEmoji,
  getStatusColor,
  MAX_ASSIGNED,
  statusMeta,
  type FleetAgent,
  type FleetTask,
} from './helpers';

interface DeployPanelProps {
  fleetAgents: FleetAgent[];
  fleetTasks: FleetTask[];
  fleetLoading: boolean;
  assignedSlots: Set<number>;
  creatingSlot: number | null;
  newAgentName: string;
  newAgentPersonality: 'edith' | 'jarvis' | 'weebo';
  savingAgent: boolean;
  taskInput: string;
  planningTask: boolean;
  onToggleAssign: (slot: number) => void;
  onDeployAgent: () => void;
  onAssignTask: () => void;
  onDeleteAgent: (agent: FleetAgent) => void;
  setCreatingSlot: (slot: number | null) => void;
  setNewAgentName: (name: string) => void;
  setNewAgentPersonality: (p: 'edith' | 'jarvis' | 'weebo') => void;
  setTaskInput: (v: string) => void;
}

export function DeployPanel({
  fleetAgents,
  fleetTasks,
  fleetLoading,
  assignedSlots,
  creatingSlot,
  newAgentName,
  newAgentPersonality,
  savingAgent,
  taskInput,
  planningTask,
  onToggleAssign,
  onDeployAgent,
  onAssignTask,
  onDeleteAgent,
  setCreatingSlot,
  setNewAgentName,
  setNewAgentPersonality,
  setTaskInput,
}: DeployPanelProps) {
  const assignedAgents = fleetAgents.filter((a) => assignedSlots.has(a.slot));
  const unassignedAgents = fleetAgents.filter((a) => !assignedSlots.has(a.slot));
  const emptySlots = [1, 2, 3, 4, 5, 6].filter((s) => !fleetAgents.some((a) => a.slot === s));

  if (fleetLoading) {
    return (
      <BlurFade delay={0.2}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--ag-violet)] border-t-transparent rounded-full animate-spin" />
        </div>
      </BlurFade>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Assigned Weebos ---- */}
      <BlurFade delay={0.2}>
        <SectionCard padding="lg" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-semibold text-[var(--ag-text-primary)] flex items-center gap-2">
              <Bot className="w-5 h-5 text-[var(--ag-violet)]" />
              Assigned Weebos
              <span className="text-xs text-[var(--ag-text-secondary)] font-normal ml-1">
                {assignedAgents.length}/{MAX_ASSIGNED} max
              </span>
            </h3>
          </div>

          {assignedAgents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--ag-border-glow)] p-10 text-center bg-[var(--ag-active-bg)] shadow-[inset_0_0_40px_rgba(139,92,246,0.03)]">
              <div className="w-14 h-14 rounded-2xl bg-[var(--ag-violet)]/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_0_1px_rgba(139,92,246,0.15)]">
                <Bot className="w-7 h-7 text-[var(--ag-violet)]/50" />
              </div>
              <p className="text-[var(--ag-text-primary)] font-medium text-sm mb-1">No agents assigned yet</p>
              <p className="text-[var(--ag-text-secondary)] text-xs max-w-xs mx-auto">
                Assign agents from your fleet below, or deploy a new one to start automating website tasks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedAgents.map((agent) => {
                const color = getStatusColor(agent.status);
                const agentTasks = fleetTasks.filter(
                  (t) => t.agent_slot === agent.slot && (t.status === 'running' || t.status === 'queued'),
                );
                const emoji = getPersonalityEmoji(agent.personality);
                return (
                  <div
                    key={agent.id}
                    className="rounded-2xl p-5 transition-[box-shadow,border-color] duration-200 bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_8px_32px_rgba(0,0,0,0.45)] hover:border-[var(--ag-border-active)]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{emoji}</span>
                        <div>
                          <div className="font-semibold text-[var(--ag-text-primary)] text-sm">{agent.name}</div>
                          <div className="text-xs text-[var(--ag-text-secondary)] capitalize">
                            Slot {agent.slot} &middot; {agent.personality}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: `${color}15`, color }}
                        >
                          {agent.status === 'active' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {statusMeta[agent.status]?.label ?? agent.status}
                        </div>
                        <button
                          onClick={() => onToggleAssign(agent.slot)}
                          className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--ag-text-secondary)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 transition-[transform,color,background-color] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                          aria-label={`Unassign ${agent.name} from Builder`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1 p-2.5 rounded-lg bg-[var(--ag-bg-base)] border border-[var(--ag-green)]/10">
                        <div className="text-xs text-[var(--ag-text-secondary)]">Completed</div>
                        <div className="text-lg font-bold text-[var(--ag-green)] font-mono tabular-nums">
                          {agent.tasks_completed}
                        </div>
                      </div>
                      <div className="flex-1 p-2.5 rounded-lg bg-[var(--ag-bg-base)] border border-[#FF6161]/10">
                        <div className="text-xs text-[var(--ag-text-secondary)]">Failed</div>
                        <div className="text-lg font-bold text-[#FF6161] font-mono tabular-nums">
                          {agent.tasks_failed}
                        </div>
                      </div>
                    </div>

                    {/* Active tasks */}
                    {agentTasks.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs text-[var(--ag-text-secondary)] font-medium">Current Work</div>
                        {agentTasks.slice(0, 2).map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)]"
                          >
                            {task.status === 'running' ? (
                              <Loader2 className="w-3.5 h-3.5 text-[var(--ag-amber)] animate-spin shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-[var(--ag-cyan)] shrink-0" />
                            )}
                            <span className="text-xs text-[var(--ag-text-primary)] truncate flex-1">
                              {task.description}
                            </span>
                            <span
                              className="text-xs capitalize shrink-0"
                              style={{ color: task.status === 'running' ? 'var(--ag-amber)' : 'var(--ag-cyan)' }}
                            >
                              {task.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.08)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--ag-text-secondary)]" />
                        <span className="text-xs text-[var(--ag-text-secondary)]">No active tasks — ready for work</span>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-[var(--ag-text-secondary)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Created {formatTimeAgo(agent.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </BlurFade>

      {/* ---- Quick task input ---- */}
      {assignedAgents.length > 0 && (
        <BlurFade delay={0.3}>
          <SectionCard padding="lg" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]">
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-[var(--ag-violet)]" />
              <h3 className="text-sm font-semibold text-[var(--ag-text-primary)]">Assign Task</h3>
            </div>
            <div className="flex gap-3">
              <input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Describe a website task for your agents..."
                className="flex-1 bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] rounded-xl px-4 py-2.5 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 text-sm focus:border-[var(--ag-violet)]/50 outline-none min-h-[44px]"
                onKeyDown={(e) => e.key === 'Enter' && !planningTask && onAssignTask()}
                disabled={planningTask}
              />
              <button
                onClick={onAssignTask}
                disabled={!taskInput.trim() || planningTask}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white font-semibold text-sm hover:bg-[#8B5CF6]/90 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none min-h-[44px] shadow-[0_4px_16px_rgba(139,92,246,0.25)]"
              >
                {planningTask ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Plan
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-[var(--ag-text-secondary)] mt-2">
              The planner will break your request into tasks and assign them to available agents.
            </p>
          </SectionCard>
        </BlurFade>
      )}

      {/* ---- Assign from fleet ---- */}
      {unassignedAgents.length > 0 && assignedSlots.size < MAX_ASSIGNED && (
        <BlurFade delay={0.4}>
          <div>
            <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--ag-violet)]" />
              Assign from Fleet
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {unassignedAgents.map((agent) => {
                const color = getStatusColor(agent.status);
                const emoji = getPersonalityEmoji(agent.personality);
                return (
                  <button
                    key={agent.id}
                    onClick={() => onToggleAssign(agent.slot)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] hover:border-[var(--ag-border-active)] hover:bg-[var(--ag-active-bg)] transition-[transform,box-shadow,border-color,background-color] duration-150 active:scale-[0.96] text-left cursor-pointer group min-h-[44px] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                  >
                    <span className="text-lg">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--ag-text-primary)] truncate">{agent.name}</div>
                      <div className="text-xs text-[var(--ag-text-secondary)]">Slot {agent.slot}</div>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                      style={{ background: `${color}15`, color }}
                    >
                      {statusMeta[agent.status]?.label ?? agent.status}
                    </div>
                    <Plus className="w-4 h-4 text-[var(--ag-violet)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </div>
        </BlurFade>
      )}

      {/* ---- Deploy new agent ---- */}
      {emptySlots.length > 0 && (
        <BlurFade delay={0.5}>
          <div>
            <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--ag-violet)]" />
              Deploy New Agent
            </h3>

            {creatingSlot !== null ? (
              <SectionCard padding="lg" className="max-w-md">
                <p className="text-sm text-[var(--ag-text-secondary)] mb-3">
                  Choose personality for Slot {creatingSlot}
                </p>
                <div className="flex gap-2 mb-3">
                  {(
                    [
                      { id: 'weebo' as const, emoji: '🤖', label: 'Weebo', color: '#00FF88' },
                      { id: 'jarvis' as const, emoji: '🎩', label: 'Jarvis', color: 'var(--ag-cyan)' },
                      { id: 'edith' as const, emoji: '⚡', label: 'Edith', color: 'var(--ag-violet)' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setNewAgentPersonality(p.id)}
                      className="flex flex-col items-center gap-1 p-3 rounded-lg border transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] min-w-[60px] min-h-[44px]"
                      style={{
                        borderColor:
                          newAgentPersonality === p.id ? p.color : 'rgba(139, 92, 246, 0.15)',
                        backgroundColor:
                          newAgentPersonality === p.id ? `${p.color}10` : 'transparent',
                      }}
                    >
                      <span className="text-lg">{p.emoji}</span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: newAgentPersonality === p.id ? p.color : '#6B7280' }}
                      >
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Agent name..."
                  className="w-full bg-[var(--ag-bg-base)] border border-[rgba(139,92,246,0.15)] rounded-xl px-4 py-2.5 text-[var(--ag-text-primary)] placeholder-[#6B7280]/50 text-sm focus:border-[var(--ag-violet)]/50 outline-none mb-3 min-h-[44px]"
                  onKeyDown={(e) => e.key === 'Enter' && onDeployAgent()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCreatingSlot(null);
                      setNewAgentName('');
                    }}
                    className="px-4 py-2 rounded-xl border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] text-sm hover:text-[var(--ag-text-primary)] transition-[transform,color,border-color] duration-150 active:scale-[0.96] min-h-[44px] shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onDeployAgent}
                    disabled={!newAgentName.trim() || savingAgent}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#8B5CF6] text-white font-semibold text-sm hover:bg-[#8B5CF6]/90 transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] shadow-[0_4px_16px_rgba(139,92,246,0.25)]"
                  >
                    {savingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deploy'}
                  </button>
                </div>
              </SectionCard>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {emptySlots.slice(0, 3).map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setCreatingSlot(slot)}
                    className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-[var(--ag-border-default)] hover:border-[var(--ag-border-active)] hover:bg-[var(--ag-active-bg)] transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] cursor-pointer group min-h-[44px] backdrop-blur-xl"
                  >
                    <Plus className="w-5 h-5 text-[var(--ag-violet)]" />
                    <span className="text-sm text-[var(--ag-text-secondary)] group-hover:text-[var(--ag-text-primary)]">
                      Slot {slot}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </BlurFade>
      )}

      {/* ---- Manage / remove assigned agents ---- */}
      {assignedAgents.length > 0 && (
        <BlurFade delay={0.6}>
          <div className="pt-4 border-t border-[var(--ag-border-subtle)]">
            <details className="group">
              <summary className="text-xs text-[var(--ag-text-secondary)] cursor-pointer hover:text-[var(--ag-text-primary)] transition-colors flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Manage assigned agents
              </summary>
              <div className="mt-3 space-y-2">
                {assignedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)]"
                  >
                    <span className="text-sm text-[var(--ag-text-primary)]">
                      {getPersonalityEmoji(agent.personality)} {agent.name} (Slot {agent.slot})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onToggleAssign(agent.slot)}
                        className="px-3 py-1 rounded-lg text-xs text-[var(--ag-text-secondary)] border border-[var(--ag-border-subtle)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] transition-colors min-h-[44px] flex items-center"
                      >
                        Unassign
                      </button>
                      {agent.slot !== 1 && (
                        <button
                          onClick={() => onDeleteAgent(agent)}
                          className="px-3 py-1 rounded-lg text-xs text-[#FF6161] border border-[#FF6161]/20 hover:bg-[#FF6161]/10 transition-colors flex items-center gap-1 min-h-[44px]"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
