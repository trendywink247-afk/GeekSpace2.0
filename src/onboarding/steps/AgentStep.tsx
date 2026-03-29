import { useState } from 'react';
import { Bot, MessageSquare, Code, Briefcase, Check, ChevronDown, Key } from 'lucide-react';
import { useTilt } from '@/hooks/useTilt';
import type { AgentMode } from '@/types';

const personalities = [
  { id: 'edith' as const, name: 'Edith', role: 'CTO', description: 'Sharp, efficient, no-nonsense technical partner', color: '#FF3366', price: '$3/mo | \u20B9300/mo', premium: true },
  { id: 'jarvis' as const, name: 'Jarvis', role: 'Butler', description: 'Polished, helpful, anticipates your needs', color: '#8B5CF6', price: '$1/mo | \u20B9100/mo', premium: false },
  { id: 'weebo' as const, name: 'Weebo', role: 'Enthusiastic', description: 'Energetic, creative, loves learning together', color: '#10B981', price: '$1/mo | \u20B9100/mo', premium: false },
];

const agentModes: { id: AgentMode; name: string; description: string; icon: typeof Bot; features: string[]; color: string }[] = [
  { id: 'minimal', name: 'Minimal', description: 'Clean, simple -- reminders and Q&A', icon: MessageSquare, features: ['Reminders', 'Q&A', 'Quick facts'], color: '#8B5CF6' },
  { id: 'builder', name: 'Builder', description: 'Coding-focused with automation', icon: Code, features: ['Code help', 'API calls', 'Automation', 'Terminal'], color: '#10B981' },
  { id: 'operator', name: 'Operator', description: 'Daily planning and life management', icon: Briefcase, features: ['Planning', 'Routines', 'Scheduling', 'Goals'], color: '#FFB800' },
];

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useTilt();
  return <div ref={ref} className="transition-transform duration-200">{children}</div>;
}

interface AgentStepProps {
  personality: 'edith' | 'jarvis' | 'weebo';
  agentMode: AgentMode;
  apiKey: string;
  onPersonalityChange: (personality: 'edith' | 'jarvis' | 'weebo') => void;
  onAgentModeChange: (mode: AgentMode) => void;
  onApiKeyChange: (key: string) => void;
}

export function AgentStep({ personality, agentMode, apiKey, onPersonalityChange, onAgentModeChange, onApiKeyChange }: AgentStepProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="gs-icon-pill gs-icon-pill-violet">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <p className="gs-section-label">Configure</p>
          <h2 className="text-xl font-semibold font-heading text-[var(--ag-text-primary,#F4F6FF)]">
            Agent Preferences
          </h2>
        </div>
      </div>

      {/* Personality picker */}
      <div>
        <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-3 block">Choose your agent's personality</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {personalities.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPersonalityChange(p.id)}
              className={`gs-card p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                personality === p.id
                  ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/[0.08]'
                  : 'hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${p.color}20` }}>
                  <span className="text-sm font-bold" style={{ color: p.color }}>{p.name[0]}</span>
                </div>
                {personality === p.id && (
                  <div className="w-5 h-5 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-[var(--ag-text-primary,#F4F6FF)] text-sm">{p.name}</h3>
              <p className="text-xs text-[var(--ag-text-muted,#9CA3AF)] mt-0.5">{p.role}</p>
              <p className="text-xs text-[var(--ag-text-muted,#9CA3AF)]/70 mt-1">{p.description}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.06]">
                <span className={`text-[10px] font-medium ${p.premium ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {p.price}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent mode picker */}
      <div>
        <label className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mb-3 block">Choose your agent's mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {agentModes.map((mode) => (
            <TiltCard key={mode.id}>
              <button
                type="button"
                onClick={() => onAgentModeChange(mode.id)}
                className={`gs-card w-full p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                  agentMode === mode.id
                    ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/[0.08]'
                    : 'hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${mode.color}20` }}>
                    <mode.icon className="w-4 h-4" style={{ color: mode.color }} />
                  </div>
                  {agentMode === mode.id && (
                    <div className="w-5 h-5 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-[var(--ag-text-primary,#F4F6FF)] text-sm">{mode.name}</h3>
                <p className="text-xs text-[var(--ag-text-muted,#9CA3AF)] mt-0.5">{mode.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {mode.features.map((f) => (
                    <span key={f} className="gs-pill text-[10px] px-2 py-0.5">{f}</span>
                  ))}
                </div>
              </button>
            </TiltCard>
          ))}
        </div>
      </div>

      {/* API Key section */}
      <div className="gs-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowApiKey(!showApiKey)}
          className="w-full px-4 py-3 min-h-[44px] flex items-center justify-between text-sm text-[var(--ag-text-muted,#9CA3AF)] hover:text-[var(--ag-text-primary,#F4F6FF)] transition-colors"
        >
          <span className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Have your own API key? (Optional)
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showApiKey ? 'rotate-180' : ''}`} />
        </button>
        {showApiKey && (
          <div className="px-4 pb-4 space-y-2 border-t border-white/[0.06] pt-3">
            <p className="text-xs text-[var(--ag-text-muted,#9CA3AF)]/70">Add your OpenRouter API key to use your own credits. You can skip this and add it later in settings.</p>
            <input
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-or-v1-..."
              type="password"
              className="gs-input w-full text-sm"
            />
            <p className="text-[10px] text-[var(--ag-text-muted,#9CA3AF)]/50">Get a free key at openrouter.ai/keys</p>
          </div>
        )}
      </div>
    </div>
  );
}
