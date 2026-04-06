// AgentCard.tsx — single deployed Pico agent slot
import type { PicoAgentFull } from '@/services/api';
import { getAgentColor, getStatusColor, parseAssignedTools, TOOL_OPTIONS } from './helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, Trash2, Settings2 } from 'lucide-react';

interface AgentCardProps {
  agent: PicoAgentFull;
  agents: PicoAgentFull[];
  slotNum: number;
  onDelete: (agent: PicoAgentFull) => void;
  onToggleEnabled: (agent: PicoAgentFull) => void;
  onConfigure: (agentId: string) => void;
}

export function AgentCard({ agent, agents, slotNum, onDelete, onToggleEnabled, onConfigure }: AgentCardProps) {
  const color = getStatusColor(agent.enabled ? agent.status : 'disabled');
  const isPermanent = slotNum === 1;
  const tools = parseAssignedTools(agent.assigned_tools);
  const activeCount = agents.filter(a => a.enabled).length;
  const agentColor = getAgentColor(agent.personality);
  const personalityLetter = agent.personality === 'edith' ? 'E' : agent.personality === 'jarvis' ? 'J' : 'W';

  return (
    <Card className={`border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all press-scale ${!agent.enabled ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[var(--ag-text-primary)] flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                backgroundColor: `${agentColor}20`,
                border: `2px solid ${agentColor}`,
                color: agentColor,
              }}
            >
              {personalityLetter}
            </span>
            {agent.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              checked={!!agent.enabled}
              onCheckedChange={() => onToggleEnabled(agent)}
              disabled={!!agent.enabled && activeCount <= 1}
              title={!!agent.enabled && activeCount <= 1 ? 'At least one Weebo must remain active' : ''}
              className="data-[state=checked]:bg-[#00FF88] data-[state=unchecked]:bg-[#FF6161]/40 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Badge
              variant="outline"
              className="text-xs capitalize"
              style={{ borderColor: `${color}40`, color }}
            >
              {agent.enabled ? agent.status : 'disabled'}
            </Badge>
            {!isPermanent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(agent)}
                aria-label={`Remove ${agent.name}`}
                className="text-[var(--ag-text-muted)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-10 w-10 p-0 press-scale"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Tool badges */}
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tools.map(toolId => {
              const tool = TOOL_OPTIONS.find(t => t.id === toolId);
              if (!tool) return null;
              return (
                <span
                  key={toolId}
                  className="px-2 py-0.5 rounded text-xs font-bold tracking-wide border"
                  style={{ borderColor: `${tool.color}40`, color: tool.color, backgroundColor: `${tool.color}10` }}
                >
                  {tool.short}
                </span>
              );
            })}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-[var(--ag-bg-deep)] shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_1px_4px_rgba(0,0,0,0.18)]">
            <div className="text-xs text-[var(--ag-text-muted)] mb-1">Completed</div>
            <div className="text-xl font-bold text-[#00FF88] font-mono tabular-nums">{agent.tasks_completed}</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--ag-bg-deep)] shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_1px_4px_rgba(0,0,0,0.18)]">
            <div className="text-xs text-[var(--ag-text-muted)] mb-1">Failed</div>
            <div className="text-xl font-bold text-[#FF6161] font-mono tabular-nums">{agent.tasks_failed}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[var(--ag-text-muted)] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Slot {slotNum}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfigure(agent.id)}
            aria-label={`Configure ${agent.name}`}
            className="text-xs text-[var(--ag-violet)] hover:text-[var(--ag-violet)] hover:bg-[#8B5CF6]/10 min-h-[44px] px-3"
          >
            <Settings2 className="w-3 h-3 mr-1" />
            Config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
