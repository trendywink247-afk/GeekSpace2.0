import { useState, useEffect } from 'react';
import {
  Bot,
  Check,
  Volume2,
  Brain,
  Save,
  Shield,
  Cpu,
  Heart,
  Sparkles,
  MessageSquare,
  Code,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useDashboardStore } from '@/stores/dashboardStore';

// ---- Persona cards ----

type PersonaKey = 'edith' | 'jarvis' | 'weebo';

interface PersonaOption {
  id: PersonaKey;
  name: string;
  tagline: string;
  description: string;
  icon: typeof Bot;
  color: string;
  tier: string;
}

const personaOptions: PersonaOption[] = [
  {
    id: 'edith',
    name: 'Edith',
    tagline: 'Premium Intelligence',
    description: 'Competent, direct, and efficient. Handles complex reasoning, code architecture, and deep analysis.',
    icon: Shield,
    color: '#7B61FF',
    tier: 'Premium',
  },
  {
    id: 'jarvis',
    name: 'Jarvis',
    tagline: 'Reliable Assistant',
    description: 'Formal but warm, like a trusted butler. Great for daily tasks, writing, and planning.',
    icon: Cpu,
    color: '#61B3FF',
    tier: 'Included',
  },
  {
    id: 'weebo',
    name: 'Weebo',
    tagline: 'Quick Companion',
    description: 'Playful and fast. Perfect for quick questions, brainstorming, and casual chat.',
    icon: Heart,
    color: '#61FF7B',
    tier: 'Included',
  },
];

// ---- Agent style cards (mode) ----

type AgentStyle = 'minimal' | 'builder' | 'operator';

interface StyleOption {
  id: AgentStyle;
  name: string;
  description: string;
  icon: typeof Bot;
  features: string[];
}

const styleOptions: StyleOption[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, simple responses focused on reminders and Q&A',
    icon: MessageSquare,
    features: ['Reminders', 'Q&A', 'Quick facts'],
  },
  {
    id: 'builder',
    name: 'Builder',
    description: 'Coding-focused with automation and API integration',
    icon: Code,
    features: ['Code help', 'API calls', 'Automation', 'Terminal access'],
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Daily planning, routines, and life management',
    icon: Briefcase,
    features: ['Daily planning', 'Routines', 'Schedule management', 'Goal tracking'],
  },
];

const voiceOptions = [
  { id: 'professional', name: 'Professional', description: 'Formal and concise' },
  { id: 'friendly', name: 'Friendly', description: 'Warm and conversational' },
  { id: 'witty', name: 'Witty', description: 'Casual with humor' },
];

function resolvePersonaFromName(name: string): PersonaKey | null {
  const lower = name.toLowerCase();
  if (lower.includes('edith')) return 'edith';
  if (lower.includes('jarvis')) return 'jarvis';
  if (lower.includes('weebo')) return 'weebo';
  return null;
}

export function AgentSettingsPage() {
  const { agent, updateAgent } = useDashboardStore();

  // Initialize from store
  const [selectedPersona, setSelectedPersona] = useState<PersonaKey | null>(
    resolvePersonaFromName(agent.name || '')
  );
  const [selectedStyle, setSelectedStyle] = useState<AgentStyle>(agent.mode || 'builder');
  const [selectedVoice, setSelectedVoice] = useState(agent.voice || 'friendly');
  const [creativity, setCreativity] = useState([agent.creativity ?? 70]);
  const [formality, setFormality] = useState([agent.formality ?? 50]);
  const [systemPrompt, setSystemPrompt] = useState(
    agent.systemPrompt || 'You are a helpful personal AI assistant. Be helpful, concise, and proactive. When uncertain, ask for clarification.'
  );
  const [agentName, setAgentName] = useState(agent.name || 'Geek');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync from store when agent data loads/changes
  useEffect(() => {
    if (agent.id) {
      setSelectedPersona(resolvePersonaFromName(agent.name || ''));
      setSelectedStyle(agent.mode || 'builder');
      setSelectedVoice(agent.voice || 'friendly');
      setCreativity([agent.creativity ?? 70]);
      setFormality([agent.formality ?? 50]);
      setSystemPrompt(agent.systemPrompt || '');
      setAgentName(agent.name || 'Geek');
    }
  }, [agent.id, agent.mode, agent.voice, agent.creativity, agent.formality, agent.systemPrompt, agent.name]);

  const handlePersonaSelect = (id: PersonaKey) => {
    setSelectedPersona(id);
    const persona = personaOptions.find((p) => p.id === id)!;
    setAgentName(persona.name);
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
        <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Agent Settings
        </h1>
        <p className="text-[#A7ACB8]">
          Choose your AI persona and customize how it behaves
        </p>
      </div>

      {/* Persona Picker */}
      <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#7B61FF]" />
          AI Persona
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {personaOptions.map((p) => {
            const isActive = selectedPersona === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handlePersonaSelect(p.id)}
                className={`p-5 rounded-xl border-2 transition-all duration-300 text-left ${
                  isActive
                    ? 'bg-[#05050A]'
                    : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                }`}
                style={isActive ? { borderColor: p.color, backgroundColor: `${p.color}08` } : undefined}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${p.color}20` }}
                  >
                    <p.icon className="w-5 h-5" style={{ color: p.color }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ color: p.color, backgroundColor: `${p.color}15` }}
                    >
                      {p.tier}
                    </span>
                    {isActive && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: p.color }}>
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-[#F4F6FF] mb-0.5">{p.name}</h3>
                <p className="text-xs mb-2" style={{ color: p.color }}>{p.tagline}</p>
                <p className="text-sm text-[#A7ACB8]">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent Identity */}
      <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#7B61FF]" />
          Agent Identity
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-[#A7ACB8] mb-2 block">Agent Name</label>
            <Input
              value={agentName}
              onChange={(e) => {
                setAgentName(e.target.value);
                setSelectedPersona(resolvePersonaFromName(e.target.value));
              }}
              className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
              placeholder="Edith, Jarvis, Weebo, or your own name"
            />
            <p className="text-xs text-[#A7ACB8]/60 mt-1">
              Use Edith, Jarvis, or Weebo for a preset persona, or enter a custom name
            </p>
          </div>
          <div>
            <label className="text-sm text-[#A7ACB8] mb-2 block">Public Display Name</label>
            <Input
              value={agent.displayName || `${agentName}'s AI`}
              disabled
              className="bg-[#05050A] border-[#7B61FF]/20 text-[#A7ACB8]"
            />
          </div>
        </div>
      </div>

      {/* Agent Style Selection */}
      <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-[#7B61FF]" />
          Agent Style
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {styleOptions.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`p-5 rounded-xl border-2 transition-all duration-300 text-left ${
                selectedStyle === style.id
                  ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                  : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#7B61FF]/10">
                  <style.icon className="w-5 h-5 text-[#7B61FF]" />
                </div>
                {selectedStyle === style.id && (
                  <div className="w-6 h-6 rounded-full bg-[#7B61FF] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-[#F4F6FF] mb-1">{style.name}</h3>
              <p className="text-sm text-[#A7ACB8] mb-3">{style.description}</p>
              <div className="flex flex-wrap gap-1">
                {style.features.map((feature, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded-full bg-[#0B0B10] text-[#A7ACB8]"
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
        <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-[#7B61FF]" />
            Voice & Tone
          </h2>
          <div className="space-y-2">
            {voiceOptions.map((voice) => (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id as 'professional' | 'friendly' | 'witty')}
                className={`w-full p-4 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                  selectedVoice === voice.id
                    ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                    : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium text-[#F4F6FF]">{voice.name}</div>
                  <div className="text-sm text-[#A7ACB8]">{voice.description}</div>
                </div>
                {selectedVoice === voice.id && (
                  <div className="w-5 h-5 rounded-full bg-[#7B61FF] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20 space-y-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#7B61FF]" />
            Behavior
          </h2>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#A7ACB8]">Creativity</label>
              <span className="text-sm text-[#F4F6FF] font-mono">{creativity[0]}%</span>
            </div>
            <Slider
              value={creativity}
              onValueChange={setCreativity}
              max={100}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[#A7ACB8] mt-1">
              <span>Conservative</span>
              <span>Creative</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[#A7ACB8]">Formality</label>
              <span className="text-sm text-[#F4F6FF] font-mono">{formality[0]}%</span>
            </div>
            <Slider
              value={formality}
              onValueChange={setFormality}
              max={100}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[#A7ACB8] mt-1">
              <span>Casual</span>
              <span>Formal</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#7B61FF]" />
          System Instructions
        </h2>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF] min-h-[120px] resize-none"
          placeholder="Instructions for how your agent should behave..."
        />
        <p className="text-xs text-[#A7ACB8] mt-2">
          These instructions guide your agent's behavior. Be specific about what you want.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end items-center gap-3">
        {saveSuccess && (
          <span className="text-sm text-[#61FF7B] flex items-center gap-1">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
        <Button
          size="lg"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#7B61FF] hover:bg-[#6B51EF] px-8"
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
