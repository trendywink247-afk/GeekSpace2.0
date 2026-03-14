import { useState } from 'react';
import { Bot, MessageSquare, Code, Briefcase, Check, ChevronDown, Key } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTilt } from '@/hooks/useTilt';
import type { AgentMode } from '@/types';

const personalities = [
  { id: 'edith' as const, name: 'Edith', role: 'CTO', description: 'Sharp, efficient, no-nonsense technical partner', color: '#FF3366', price: '$3/mo | \u20B9300/mo', premium: true },
  { id: 'jarvis' as const, name: 'Jarvis', role: 'Butler', description: 'Polished, helpful, anticipates your needs', color: '#00F0FF', price: '$1/mo | \u20B9100/mo', premium: false },
  { id: 'weebo' as const, name: 'Weebo', role: 'Enthusiastic', description: 'Energetic, creative, loves learning together', color: '#00FF88', price: '$1/mo | \u20B9100/mo', premium: false },
];

const agentModes: { id: AgentMode; name: string; description: string; icon: typeof Bot; features: string[]; color: string }[] = [
  { id: 'minimal', name: 'Minimal', description: 'Clean, simple -- reminders and Q&A', icon: MessageSquare, features: ['Reminders', 'Q&A', 'Quick facts'], color: '#00F0FF' },
  { id: 'builder', name: 'Builder', description: 'Coding-focused with automation', icon: Code, features: ['Code help', 'API calls', 'Automation', 'Terminal'], color: '#00FF88' },
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
      <div className="flex items-center gap-3 mb-6">
        <Bot className="w-6 h-6 text-[#00F0FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
          Agent Preferences
        </h2>
      </div>

      {/* Personality picker */}
      <div>
        <label className="text-sm text-[#9CA3AF] mb-3 block">Choose your agent's personality</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {personalities.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPersonalityChange(p.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                personality === p.id
                  ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                  : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${p.color}20` }}>
                  <span className="text-sm font-bold" style={{ color: p.color }}>{p.name[0]}</span>
                </div>
                {personality === p.id && (
                  <div className="w-5 h-5 rounded-full bg-[#00F0FF] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-[#E8E8F0] text-sm">{p.name}</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">{p.role}</p>
              <p className="text-xs text-[#6B7280]/70 mt-1">{p.description}</p>
              <div className="mt-2 pt-2 border-t border-[#00F0FF]/10">
                <span className={`text-[10px] font-medium ${p.premium ? 'text-[#FFB800]' : 'text-[#00FF88]'}`}>
                  {p.price}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent mode picker */}
      <div>
        <label className="text-sm text-[#9CA3AF] mb-3 block">Choose your agent's mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {agentModes.map((mode) => (
            <TiltCard key={mode.id}>
              <button
                type="button"
                onClick={() => onAgentModeChange(mode.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                  agentMode === mode.id
                    ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                    : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${mode.color}20` }}>
                    <mode.icon className="w-4 h-4" style={{ color: mode.color }} />
                  </div>
                  {agentMode === mode.id && (
                    <div className="w-5 h-5 rounded-full bg-[#00F0FF] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-[#E8E8F0] text-sm">{mode.name}</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">{mode.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {mode.features.map((f) => (
                    <span key={f} className="px-2 py-0.5 text-xs rounded-full bg-[#0C0C18] text-[#6B7280]">{f}</span>
                  ))}
                </div>
              </button>
            </TiltCard>
          ))}
        </div>
      </div>

      {/* API Key section */}
      <div className="border border-[#00F0FF]/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowApiKey(!showApiKey)}
          className="w-full px-4 py-3 min-h-[44px] flex items-center justify-between text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
        >
          <span className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Have your own API key? (Optional)
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showApiKey ? 'rotate-180' : ''}`} />
        </button>
        {showApiKey && (
          <div className="px-4 pb-4 space-y-2">
            <p className="text-xs text-[#6B7280]/70">Add your OpenRouter API key to use your own credits. You can skip this and add it later in settings.</p>
            <Input
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-or-v1-..."
              type="password"
              className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] text-sm"
            />
            <p className="text-[10px] text-[#6B7280]/50">Get a free key at openrouter.ai/keys</p>
          </div>
        )}
      </div>
    </div>
  );
}
