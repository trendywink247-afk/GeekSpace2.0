// ============================================================
// AgentPicker — dropdown to assign a fleet agent to this page
// ============================================================

import { Bot, Check, ChevronDown, Wifi, WifiOff, X } from 'lucide-react';
import { STATUS_COLOR, type FleetAgent } from './helpers';

interface AgentPickerProps {
  assignedAgent:    FleetAgent | null;
  fleetAgents:      FleetAgent[];
  agentLoading:     boolean;
  showAgentPicker:  boolean;
  setShowAgentPicker: (v: boolean) => void;
  onAssign:         (agent: FleetAgent | null) => void;
}

export function AgentPicker({
  assignedAgent, fleetAgents, agentLoading,
  showAgentPicker, setShowAgentPicker, onAssign,
}: AgentPickerProps) {
  function emoji(personality: string) {
    if (personality === 'edith')  return '⚡';
    if (personality === 'jarvis') return '🎩';
    return '🤖';
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      {assignedAgent ? (
        <button
          onClick={() => setShowAgentPicker(!showAgentPicker)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#00FF88]/20 bg-[#00FF88]/5 hover:border-[#00FF88]/40 transition-colors"
        >
          <span className="text-lg">{emoji(assignedAgent.personality)}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-[var(--ag-text-primary)]">{assignedAgent.name}</div>
            <div className="text-xs text-[var(--ag-text-secondary)]">Assigned agent</div>
          </div>
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_COLOR[assignedAgent.status] ?? '#6B7280' }}
          />
          <ChevronDown className="w-3.5 h-3.5 text-[var(--ag-text-secondary)]" />
        </button>
      ) : (
        <button
          onClick={() => setShowAgentPicker(!showAgentPicker)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[var(--ag-border-default)] hover:border-[var(--ag-violet)]/40 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors text-sm"
        >
          <Bot className="w-4 h-4" />
          {agentLoading ? 'Loading…' : 'Assign Agent'}
        </button>
      )}

      {/* Dropdown */}
      {showAgentPicker && (
        <div
          className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] shadow-2xl z-30 overflow-hidden"
          style={{ backdropFilter: 'blur(var(--ag-glass-blur))' }}
        >
          <div className="p-3 border-b border-[var(--ag-border-subtle)]">
            <p className="text-xs text-[var(--ag-text-secondary)]">Choose an agent from your fleet</p>
          </div>

          {fleetAgents.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--ag-text-secondary)]">
              No agents in your fleet. Deploy one from the Fleet page.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {/* Unassign row */}
              {assignedAgent && (
                <button
                  onClick={() => { onAssign(null); setShowAgentPicker(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/5 transition-colors text-left border-b border-[var(--ag-border-subtle)]"
                >
                  <X className="w-4 h-4 text-[#FF6161]" />
                  <span className="text-sm text-[#FF6161]">Unassign agent</span>
                </button>
              )}

              {/* Agent rows */}
              {fleetAgents.map(agent => {
                const isAssigned = assignedAgent?.id === agent.id;
                const color      = STATUS_COLOR[agent.status] ?? '#6B7280';
                return (
                  <button
                    key={agent.id}
                    onClick={() => { onAssign(agent); setShowAgentPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#8B5CF6]/5 transition-colors text-left ${isAssigned ? 'bg-[#00FF88]/5' : ''}`}
                  >
                    <span className="text-lg">{emoji(agent.personality)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--ag-text-primary)]">{agent.name}</div>
                      <div className="text-xs text-[var(--ag-text-secondary)]">
                        Slot {agent.slot} · {agent.tasks_completed} tasks
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {agent.status === 'active'
                        ? <Wifi    className="w-3 h-3" style={{ color }} />
                        : <WifiOff className="w-3 h-3" style={{ color }} />}
                      <span className="text-xs capitalize" style={{ color }}>{agent.status}</span>
                    </div>
                    {isAssigned && <Check className="w-4 h-4 text-[#00FF88]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
