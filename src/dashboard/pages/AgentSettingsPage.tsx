import { useState, useEffect } from 'react';
import {
  Bot,
  MessageSquare,
  Code,
  Briefcase,
  Check,
  Sparkles,
  Volume2,
  Image,
  Brain,
  Save,
  Users,
  ChevronRight
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useDashboardStore } from '@/stores/dashboardStore';
import { agentService, memoryService } from '@/services/api';
import { useTilt } from '@/hooks/useTilt';
import type { Personality, AgentPersonality, ModelPreference } from '@/types';

type AgentStyle = 'minimal' | 'builder' | 'operator';

interface StyleOption {
  id: AgentStyle;
  name: string;
  description: string;
  icon: typeof Bot;
  features: string[];
  color: string;
}

const styleOptions: StyleOption[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, simple responses focused on reminders and Q&A',
    icon: MessageSquare,
    features: ['Reminders', 'Q&A', 'Quick facts'],
    color: '#00F0FF',
  },
  {
    id: 'builder',
    name: 'Builder',
    description: 'Coding-focused with automation and API integration',
    icon: Code,
    features: ['Code help', 'API calls', 'Automation', 'Terminal access'],
    color: '#00FF88',
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Daily planning, routines, and life management',
    icon: Briefcase,
    features: ['Daily planning', 'Routines', 'Schedule management', 'Goal tracking'],
    color: '#FFB800',
  },
];

const voiceOptions = [
  { id: 'professional', name: 'Professional', description: 'Formal and concise' },
  { id: 'friendly', name: 'Friendly', description: 'Warm and conversational' },
  { id: 'witty', name: 'Witty', description: 'Casual with humor' },
];

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useTilt();
  return <div ref={ref} className="transition-transform duration-200">{children}</div>;
}

export function AgentSettingsPage() {
  const { agent, updateAgent } = useDashboardStore();

  // Initialize from store
  const [selectedStyle, setSelectedStyle] = useState<AgentStyle>(agent.mode || 'builder');
  const [selectedVoice, setSelectedVoice] = useState(agent.voice || 'friendly');
  const [creativity, setCreativity] = useState([agent.creativity ?? 70]);
  const [formality, setFormality] = useState([agent.formality ?? 50]);
  const [systemPrompt, setSystemPrompt] = useState(
    agent.systemPrompt || `You are a helpful personal AI assistant. Be helpful, concise, and proactive. When uncertain, ask for clarification.`
  );
  const [agentName, setAgentName] = useState(agent.name || 'Geek');
  const [selectedPersonality, setSelectedPersonality] = useState<AgentPersonality>(agent.personality || 'jarvis');
  const [selectedModelPref, setSelectedModelPref] = useState<ModelPreference>(agent.model_preference || 'auto');
  const [personalities, setPersonalities] = useState<Record<string, Personality>>({});
  const [personalityToast, setPersonalityToast] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Memory summary state
  const [topMemories, setTopMemories] = useState<Array<{ id: string; category: string; key: string; value: string }>>([]);

  // Fetch personalities on mount
  useEffect(() => {
    agentService.getPersonalities().then(({ data }) => setPersonalities(data)).catch(() => {});
  }, []);

  // Fetch top memory entries for summary card
  useEffect(() => {
    memoryService.list().then(({ data }) => {
      if (Array.isArray(data)) setTopMemories(data.slice(0, 5));
    }).catch(() => {});
  }, []);

  // Sync from store when agent data loads/changes
  useEffect(() => {
    if (agent.id) {
      setSelectedStyle(agent.mode || 'builder');
      setSelectedVoice(agent.voice || 'friendly');
      setCreativity([agent.creativity ?? 70]);
      setFormality([agent.formality ?? 50]);
      setSystemPrompt(agent.systemPrompt || '');
      setAgentName(agent.name || 'Geek');
      setSelectedPersonality(agent.personality || 'jarvis');
      setSelectedModelPref(agent.model_preference || 'auto');
    }
  }, [agent.id, agent.mode, agent.voice, agent.creativity, agent.formality, agent.systemPrompt, agent.name, agent.personality, agent.model_preference]);

  const handlePersonalitySwitch = async (id: AgentPersonality) => {
    const prev = selectedPersonality;
    setSelectedPersonality(id);
    const p = personalities[id];
    try {
      await updateAgent({ personality: id });
      if (p) {
        setPersonalityToast(`Switched to ${p.name}! ${p.greeting}`);
        setTimeout(() => setPersonalityToast(''), 3000);
      }
    } catch {
      setSelectedPersonality(prev);
      setPersonalityToast('Failed to switch personality. Try again.');
      setTimeout(() => setPersonalityToast(''), 3000);
    }
  };


  const handleSavePref = async (field: string, value: string) => {
    if (field === 'model_preference') {
      const prev = selectedModelPref;
      setSelectedModelPref(value as ModelPreference);
      try {
        await updateAgent({ model_preference: value as ModelPreference });
      } catch {
        setSelectedModelPref(prev);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateAgent({
        name: agentName,
        mode: selectedStyle,
        voice: selectedVoice as 'professional' | 'friendly' | 'witty',
        creativity: creativity[0],
        formality: formality[0],
        systemPrompt,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // keep local state on error
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Agent Settings
        </h1>
        <p className="text-[#6B7280]">
          Customize how your AI assistant behaves and responds
        </p>
      </div>

      {/* Agent Identity */}
      <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#00F0FF]" />
          Agent Identity
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-[#6B7280] mb-2 block">Agent Name</label>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
              placeholder="What should I call your agent?"
            />
          </div>
          <div>
            <label className="text-sm text-[#6B7280] mb-2 block">Public Display Name</label>
            <Input
              value={agent.displayName || `${agentName}'s AI`}
              disabled
              className="bg-[#06060B] border-[#00F0FF]/20 text-[#6B7280]"
            />
          </div>
        </div>
      </div>

      {/* AI Personality */}
      {Object.keys(personalities).length > 0 && (
        <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00F0FF]" />
            Choose Your AI Personality
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Object.values(personalities).map((p) => (
              <TiltCard key={p.id}>
                <button
                  onClick={() => handlePersonalitySwitch(p.id as AgentPersonality)}
                  className={`w-full p-5 rounded-xl border-2 transition-all duration-300 text-center ${
                    selectedPersonality === p.id
                      ? 'border-[#00F0FF] bg-[#00F0FF]/10 shadow-[0_0_20px_rgba(123,97,255,0.15)]'
                      : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
                  }`}
                >
                  <div className="text-4xl mb-3">{p.emoji}</div>
                  <h3 className="font-semibold text-[#E8E8F0] mb-1">{p.name}</h3>
                  <p className="text-sm text-[#6B7280]">{p.description}</p>
                  {selectedPersonality === p.id && (
                    <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] text-xs">
                      <Check className="w-3 h-3" /> Active
                    </div>
                  )}
                </button>
              </TiltCard>
            ))}
          </div>
          {personalityToast && (
            <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-sm text-[#E8E8F0] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00F0FF]" />
              {personalityToast}
            </div>
          )}
        </div>
      )}

      {/* Model Preference */}
      <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#00F0FF]" />
          AI Engine Preference
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'auto', label: 'Auto', desc: 'Weebo picks the best engine for your request' },
            { value: 'local', label: 'Local AI Engine', desc: 'Always runs locally — fastest, most private' },
            { value: 'cloud', label: 'Cloud Engine', desc: 'OpenRouter free tier — stronger reasoning' },
            { value: 'premium', label: 'Premium Engine', desc: 'Kimi K2 — best results, uses more credits' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSavePref('model_preference', opt.value)}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedModelPref === opt.value
                  ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                  : 'border-[#00F0FF]/20 hover:border-[#00F0FF]/40'
              }`}
            >
              <div className="text-sm font-medium text-[#E8E8F0]">{opt.label}</div>
              <div className="text-xs text-[#6B7280]">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent Style Selection */}
      <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#00F0FF]" />
          Agent Style
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {styleOptions.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`p-5 rounded-xl border-2 transition-all duration-300 text-left ${
                selectedStyle === style.id
                  ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                  : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${style.color}20` }}
                >
                  <style.icon className="w-5 h-5" style={{ color: style.color }} />
                </div>
                {selectedStyle === style.id && (
                  <div className="w-6 h-6 rounded-full bg-[#00F0FF] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-[#E8E8F0] mb-1">{style.name}</h3>
              <p className="text-sm text-[#6B7280] mb-3">{style.description}</p>
              <div className="flex flex-wrap gap-1">
                {style.features.map((feature, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded-full bg-[#06060B] text-[#6B7280]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Personality Settings */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Voice/Tone */}
        <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#00F0FF]" />
            Voice & Tone
          </h2>
          <div className="space-y-2">
            {voiceOptions.map((voice) => (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id as 'professional' | 'friendly' | 'witty')}
                className={`w-full p-4 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                  selectedVoice === voice.id
                    ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                    : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium text-[#E8E8F0]">{voice.name}</div>
                  <div className="text-sm text-[#6B7280]">{voice.description}</div>
                </div>
                {selectedVoice === voice.id && (
                  <div className="w-5 h-5 rounded-full bg-[#00F0FF] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20 space-y-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#00F0FF]" />
            Behavior
          </h2>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#6B7280]">Creativity</label>
              <span className="text-sm text-[#E8E8F0] font-mono">{creativity[0]}%</span>
            </div>
            <Slider
              value={creativity}
              onValueChange={setCreativity}
              max={100}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[#6B7280] mt-1">
              <span>Conservative</span>
              <span>Creative</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#6B7280]">Formality</label>
              <span className="text-sm text-[#E8E8F0] font-mono">{formality[0]}%</span>
            </div>
            <Slider
              value={formality}
              onValueChange={setFormality}
              max={100}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[#6B7280] mt-1">
              <span>Casual</span>
              <span>Formal</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="p-6 rounded-2xl glass-card-v2 border border-[#00F0FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-[#00F0FF]" />
          System Instructions
        </h2>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[120px] resize-none"
          placeholder="Instructions for how your agent should behave..."
        />
        <p className="text-xs text-[#6B7280] mt-2">
          These instructions guide your agent's behavior. Be specific about what you want.
        </p>
      </div>

      {/* Memory Summary Card */}
      {topMemories.length > 0 && (
        <div className="p-6 rounded-2xl glass-card-v2 border border-[#BF5FFF]/20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#BF5FFF]" />
            What Your Agent Remembers
          </h2>
          <div className="flex flex-wrap gap-2">
            {topMemories.map((mem) => (
              <Popover key={mem.id}>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[#BF5FFF]/10 border border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/20 transition-colors">
                    {mem.key.length > 24 ? mem.key.slice(0, 24) + '…' : mem.key}
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 bg-[#0C0C18] border border-[#BF5FFF]/30 text-[#E8E8F0] p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#BF5FFF]/20 text-[#BF5FFF]">{mem.category}</span>
                      <span className="text-sm font-medium">{mem.key}</span>
                    </div>
                    <p className="text-sm text-[#6B7280] leading-relaxed">{mem.value}</p>
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
          <p className="text-xs text-[#6B7280] mt-3">
            Click any tag to see the full memory. Manage all memories in{' '}
            <a href="/dashboard/memory" className="text-[#BF5FFF] hover:underline">Memory Manager</a>.
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end items-center gap-3">
        {saveSuccess && (
          <span className="text-sm text-[#00FF88] flex items-center gap-1">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
        <Button
          size="lg"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#00F0FF] hover:bg-[#00D4B0] px-8"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
