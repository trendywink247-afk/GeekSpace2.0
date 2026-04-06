import { Bot, Wifi, WifiOff, Check, ChevronDown, X } from 'lucide-react';
import { statusColor, type FleetAgent } from './helpers';

interface AgentPickerDropdownProps {
  assignedAgent: FleetAgent | null;
  fleetAgents: FleetAgent[];
  agentLoading: boolean;
  showPicker: boolean;
  onToggle: () => void;
  onAssign: (agent: FleetAgent) => void;
  onUnassign: () => void;
}

export function AgentPickerDropdown({
  assignedAgent,
  fleetAgents,
  agentLoading,
  showPicker,
  onToggle,
  onAssign,
  onUnassign,
}: AgentPickerDropdownProps) {
  const personalityIcon = (p: string) =>
    p === 'edith' ? '⚡' : p === 'jarvis' ? '🎩' : '🤖';

  return (
    <div className="relative">
      {assignedAgent ? (
        <button
          onClick={onToggle}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--ag-violet)]/20 bg-[#8B5CF6]/5 hover:border-[var(--ag-violet)]/40 transition-colors"
        >
          <span className="text-lg">{personalityIcon(assignedAgent.personality)}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-[var(--ag-text-primary)]">{assignedAgent.name}</div>
            <div className="text-xs text-[var(--ag-text-muted)]">Assigned agent</div>
          </div>
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColor[assignedAgent.status] || '#6B7280' }}
          />
          <ChevronDown className="w-3.5 h-3.5 text-[var(--ag-text-muted)]" />
        </button>
      ) : (
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[var(--ag-violet)]/20 hover:border-[var(--ag-violet)]/40 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors text-sm"
        >
          <Bot className="w-4 h-4" />
          {agentLoading ? 'Loading...' : 'Assign Agent'}
        </button>
      )}

      {showPicker && (
        <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-[var(--ag-cyan)]/20 bg-[var(--ag-bg-surface)] shadow-2xl z-30 overflow-hidden">
          <div className="p-3 border-b border-[var(--ag-cyan)]/10">
            <p className="text-xs text-[var(--ag-text-muted)]">Choose an agent from your fleet</p>
          </div>
          {fleetAgents.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--ag-text-muted)]">
              No agents in your fleet. Deploy one from the Fleet page.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {assignedAgent && (
                <button
                  onClick={onUnassign}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FF6161]/5 transition-colors text-left border-b border-[var(--ag-cyan)]/10"
                >
                  <X className="w-4 h-4 text-[#FF6161]" />
                  <span className="text-sm text-[#FF6161]">Unassign agent</span>
                </button>
              )}
              {fleetAgents.map((agent) => {
                const isAssigned = assignedAgent?.id === agent.id;
                const color = statusColor[agent.status] || '#6B7280';
                return (
                  <button
                    key={agent.id}
                    onClick={() => onAssign(agent)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#A78BFA]/5 transition-colors text-left ${
                      isAssigned ? 'bg-[#8B5CF6]/5' : ''
                    }`}
                  >
                    <span className="text-lg">{personalityIcon(agent.personality)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--ag-text-primary)]">{agent.name}</div>
                      <div className="text-xs text-[var(--ag-text-muted)]">
                        Slot {agent.slot} · {agent.tasks_completed} tasks done
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {agent.status === 'active' ? (
                        <Wifi className="w-3 h-3" style={{ color }} />
                      ) : (
                        <WifiOff className="w-3 h-3" style={{ color }} />
                      )}
                      <span className="text-xs capitalize" style={{ color }}>
                        {agent.status}
                      </span>
                    </div>
                    {isAssigned && <Check className="w-4 h-4 text-[var(--ag-violet)]" />}
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
