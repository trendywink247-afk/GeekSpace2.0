import { useState } from 'react';
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
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

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
    color: '#7B61FF',
  },
  {
    id: 'builder',
    name: 'Builder',
    description: 'Coding-focused with automation and API integration',
    icon: Code,
    features: ['Code help', 'API calls', 'Automation', 'Terminal access'],
    color: '#61FF7B',
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Daily planning, routines, and life management',
    icon: Briefcase,
    features: ['Daily planning', 'Routines', 'Schedule management', 'Goal tracking'],
    color: '#FFD761',
  },
];

const voiceOptions = [
  { id: 'professional', name: 'Professional', description: 'Formal and concise' },
  { id: 'friendly', name: 'Friendly', description: 'Warm and conversational' },
  { id: 'witty', name: 'Witty', description: 'Casual with humor' },
];

export function AgentSettingsPage() {
  const [selectedStyle, setSelectedStyle] = useState<AgentStyle>('builder');
  const [selectedVoice, setSelectedVoice] = useState('friendly');
  const [creativity, setCreativity] = useState([70]);
  const [formality, setFormality] = useState([50]);
  const [systemPrompt, setSystemPrompt] = useState(
    `You are Alex's personal AI assistant. You help with coding, reminders, and daily tasks. Be helpful, concise, and proactive. When uncertain, ask for clarification.`
  );
  const [agentName, setAgentName] = useState('Geek');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Agent Settings
        </h1>
        <p className="text-[#A7ACB8]">
          Customize how your AI assistant behaves and responds
        </p>
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
              onChange={(e) => setAgentName(e.target.value)}
              className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
              placeholder="What should I call your agent?"
            />
          </div>
          <div>
            <label className="text-sm text-[#A7ACB8] mb-2 block">Public Display Name</label>
            <Input
              value="Alex's AI"
              disabled
              className="bg-[#05050A] border-[#7B61FF]/20 text-[#A7ACB8]"
            />
          </div>
        </div>
      </div>

      {/* Agent Style Selection */}
      <div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#7B61FF]" />
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
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${style.color}20` }}
                >
                  <style.icon className="w-5 h-5" style={{ color: style.color }} />
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
                onClick={() => setSelectedVoice(voice.id)}
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
          <Image className="w-5 h-5 text-[#7B61FF]" />
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
      <div className="flex justify-end">
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