// AgentList.tsx — 6-slot agent grid (filled cards + create form + empty slots)
import type { PicoAgentFull } from '@/services/api';
import { AgentCard } from './AgentCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2 } from 'lucide-react';

const PERSONALITIES = [
  { id: 'weebo' as const, letter: 'W', label: 'Weebo', color: 'var(--ag-cyan)' },
  { id: 'jarvis' as const, letter: 'J', label: 'Jarvis', color: '#ADFF2F' },
  { id: 'edith' as const, letter: 'E', label: 'Edith', color: 'var(--ag-violet)' },
];

interface AgentListProps {
  slots: Array<{ slotNum: number; agent: PicoAgentFull | undefined }>;
  agents: PicoAgentFull[];
  creatingSlot: number | null;
  newAgentName: string;
  newAgentPersonality: 'edith' | 'jarvis' | 'weebo';
  savingAgent: boolean;
  isMobile: boolean;
  onSetCreatingSlot: (slot: number | null) => void;
  onSetNewAgentName: (name: string) => void;
  onSetNewAgentPersonality: (p: 'edith' | 'jarvis' | 'weebo') => void;
  onCreateAgent: () => void;
  onDeleteAgent: (agent: PicoAgentFull) => void;
  onToggleEnabled: (agent: PicoAgentFull) => void;
  onConfigure: (agentId: string) => void;
}

export function AgentList({
  slots, agents, creatingSlot, newAgentName, newAgentPersonality, savingAgent, isMobile,
  onSetCreatingSlot, onSetNewAgentName, onSetNewAgentPersonality, onCreateAgent,
  onDeleteAgent, onToggleEnabled, onConfigure,
}: AgentListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {slots.map(({ slotNum, agent }) => {
        // Filled slot — delegate to AgentCard
        if (agent) {
          return (
            <AgentCard
              key={slotNum}
              agent={agent}
              agents={agents}
              slotNum={slotNum}
              onDelete={onDeleteAgent}
              onToggleEnabled={onToggleEnabled}
              onConfigure={onConfigure}
            />
          );
        }

        // Inline create form for selected slot
        if (creatingSlot === slotNum) {
          return (
            <Card key={slotNum} className="border-[rgba(139,92,246,0.15)] border-dashed">
              <CardContent className={`flex flex-col items-center gap-3 min-h-[180px] ${isMobile ? 'p-3' : 'p-4'}`}>
                <p className="text-sm text-[var(--ag-text-muted)]">Choose personality</p>
                <div className="flex gap-2">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSetNewAgentPersonality(p.id)}
                      className="flex flex-col items-center gap-1 p-3 sm:p-2 rounded-lg border transition-all min-w-[60px] min-h-[44px]"
                      style={{
                        borderColor: newAgentPersonality === p.id ? p.color : 'rgba(123,97,255,0.2)',
                        backgroundColor: newAgentPersonality === p.id ? `${p.color}10` : 'transparent',
                      }}
                    >
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: `${p.color}20`,
                          border: `2px solid ${newAgentPersonality === p.id ? p.color : 'transparent'}`,
                          color: p.color,
                        }}
                      >
                        {p.letter}
                      </span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: newAgentPersonality === p.id ? p.color : '#6B7280' }}
                      >
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
                <Input
                  value={newAgentName}
                  onChange={(e) => onSetNewAgentName(e.target.value)}
                  placeholder="Agent name..."
                  className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] max-w-[200px]"
                  onKeyDown={(e) => e.key === 'Enter' && onCreateAgent()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onSetCreatingSlot(null);
                      onSetNewAgentName('');
                      onSetNewAgentPersonality('weebo');
                    }}
                    className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-muted)]"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={onCreateAgent}
                    disabled={!newAgentName.trim() || savingAgent}
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px]"
                  >
                    {savingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deploy'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }

        // Empty slot — click to begin creating
        return (
          <Card
            key={slotNum}
            className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.08)] border-dashed hover:border-[rgba(139,92,246,0.15)] transition-all cursor-pointer group press-scale"
            onClick={() => onSetCreatingSlot(slotNum)}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center gap-3 min-h-[180px]">
              <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center group-hover:bg-[#8B5CF6]/10 transition-colors">
                <Plus className="w-6 h-6 text-[var(--ag-violet)]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--ag-text-primary)]">Deploy Agent</p>
                <p className="text-xs text-[var(--ag-text-muted)]">Slot {slotNum} available</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
