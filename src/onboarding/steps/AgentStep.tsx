import { Bot, MessageSquare, Code, Briefcase, Check } from 'lucide-react';
import { useTilt } from '@/hooks/useTilt';
import type { AgentMode } from '@/types';

const personalities = [
  { id: 'edith' as const, name: 'Edith', role: 'CTO', description: 'Sharp, efficient, no-nonsense technical partner', color: '#FF6161' },
  { id: 'jarvis' as const, name: 'Jarvis', role: 'Butler', description: 'Polished, helpful, anticipates your needs', color: '#7B61FF' },
  { id: 'weebo' as const, name: 'Weebo', role: 'Enthusiastic', description: 'Energetic, creative, loves learning together', color: '#61FF7B' },
];

const agentModes: { id: AgentMode; name: string; description: string; icon: typeof Bot; features: string[]; color: string }[] = [
  { id: 'minimal', name: 'Minimal', description: 'Clean, simple -- reminders and Q&A', icon: MessageSquare, features: ['Reminders', 'Q&A', 'Quick facts'], color: '#7B61FF' },
  { id: 'builder', name: 'Builder', description: 'Coding-focused with automation', icon: Code, features: ['Code help', 'API calls', 'Automation', 'Terminal'], color: '#61FF7B' },
  { id: 'operator', name: 'Operator', description: 'Daily planning and life management', icon: Briefcase, features: ['Planning', 'Routines', 'Scheduling', 'Goals'], color: '#FFD761' },
];

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useTilt();
  return <div ref={ref} className="transition-transform duration-200">{children}</div>;
}

interface AgentStepProps {
  personality: 'edith' | 'jarvis' | 'weebo';
  agentMode: AgentMode;
  onPersonalityChange: (personality: 'edith' | 'jarvis' | 'weebo') => void;
  onAgentModeChange: (mode: AgentMode) => void;
}

export function AgentStep({ personality, agentMode, onPersonalityChange, onAgentModeChange }: AgentStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-6 h-6 text-[#7B61FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Agent Preferences
        </h2>
      </div>

      {/* Personality picker */}
      <div>
        <label className="text-sm text-[#A7ACB8] mb-3 block">Choose your agent's personality</label>
        <div className="grid md:grid-cols-3 gap-3">
          {personalities.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPersonalityChange(p.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                personality === p.id
                  ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                  : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${p.color}20` }}>
                  <span className="text-sm font-bold" style={{ color: p.color }}>{p.name[0]}</span>
                </div>
                {personality === p.id && (
                  <div className="w-5 h-5 rounded-full bg-[#7B61FF] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-[#F4F6FF] text-sm">{p.name}</h3>
              <p className="text-xs text-[#A7ACB8] mt-0.5">{p.role}</p>
              <p className="text-xs text-[#A7ACB8]/70 mt-1">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Agent mode picker */}
      <div>
        <label className="text-sm text-[#A7ACB8] mb-3 block">Choose your agent's mode</label>
        <div className="grid md:grid-cols-3 gap-3">
          {agentModes.map((mode) => (
            <TiltCard key={mode.id}>
              <button
                type="button"
                onClick={() => onAgentModeChange(mode.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  agentMode === mode.id
                    ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                    : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${mode.color}20` }}>
                    <mode.icon className="w-4 h-4" style={{ color: mode.color }} />
                  </div>
                  {agentMode === mode.id && (
                    <div className="w-5 h-5 rounded-full bg-[#7B61FF] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-[#F4F6FF] text-sm">{mode.name}</h3>
                <p className="text-xs text-[#A7ACB8] mt-0.5">{mode.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {mode.features.map((f) => (
                    <span key={f} className="px-2 py-0.5 text-[10px] rounded-full bg-[#0B0B10] text-[#A7ACB8]">{f}</span>
                  ))}
                </div>
              </button>
            </TiltCard>
          ))}
        </div>
      </div>
    </div>
  );
}
