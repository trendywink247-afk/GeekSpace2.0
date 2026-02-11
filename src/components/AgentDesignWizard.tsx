import { useState } from 'react';
import {
  X, Bot, MessageSquare, Code, Briefcase, Check, Sparkles,
  Upload, Github, FileText, Palette,
  ArrowRight, ArrowLeft, Zap, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { AgentConfig } from '@/types';

interface AgentDesignWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3;

const voiceOptions = [
  { id: 'friendly', label: 'Friendly', description: 'Warm and conversational', emoji: '😊' },
  { id: 'professional', label: 'Professional', description: 'Formal and concise', emoji: '💼' },
  { id: 'witty', label: 'Witty', description: 'Casual with humor', emoji: '😄' },
  { id: 'chill', label: 'Chill', description: 'Relaxed and easygoing', emoji: '😎' },
] as const;

const speedOptions = [
  { id: 'fast', label: 'Fast', icon: Zap, description: 'Quick, concise responses' },
  { id: 'balanced', label: 'Balanced', icon: Bot, description: 'Thoughtful but efficient' },
  { id: 'thorough', label: 'Thorough', icon: Eye, description: 'Detailed analysis' },
] as const;

const styleOptions = [
  {
    id: 'minimal' as const,
    name: 'Minimal',
    icon: MessageSquare,
    features: ['Reminders', 'Q&A', 'Quick facts'],
    color: '#7B61FF',
  },
  {
    id: 'builder' as const,
    name: 'Builder',
    icon: Code,
    features: ['Code help', 'API calls', 'Automation', 'Terminal'],
    color: '#61FF7B',
  },
  {
    id: 'operator' as const,
    name: 'Operator',
    icon: Briefcase,
    features: ['Daily planning', 'Routines', 'Schedule', 'Goals'],
    color: '#FFD761',
  },
];

const avatarOptions = ['🤖', '🎭', '👤', '🧠', '🦊', '🐱'];

const chatBubbleStyles = [
  { id: 'modern', label: 'Modern', class: 'rounded-2xl' },
  { id: 'terminal', label: 'Terminal', class: 'rounded-md font-mono' },
  { id: 'minimal', label: 'Minimal', class: 'rounded-lg' },
];

const accentColors = ['#7B61FF', '#61FF7B', '#FF61DC', '#61B5FF', '#FFD761', '#FF6161'];

const specialties = [
  'React', 'TypeScript', 'Python', 'AI/ML', 'Design', 'DevOps',
  'Marketing', 'Writing', 'Data Science', 'Blockchain', 'Mobile', 'Backend',
];

export function AgentDesignWizard({ isOpen, onClose }: AgentDesignWizardProps) {
  const updateAgent = useDashboardStore((s) => s.updateAgent);
  const agent = useDashboardStore((s) => s.agent);

  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 - Personality
  const [agentName, setAgentName] = useState(agent.name);
  const [selectedStyle, setSelectedStyle] = useState(agent.mode);
  const [selectedVoice, setSelectedVoice] = useState<string>(agent.voice);
  const [creativity, setCreativity] = useState([agent.creativity]);
  const [formality, setFormality] = useState([agent.formality]);
  const [responseSpeed, setResponseSpeed] = useState('balanced');

  // Step 2 - Knowledge
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [toneExample, setToneExample] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);

  // Step 3 - Appearance
  const [selectedAvatar, setSelectedAvatar] = useState('🤖');
  const [selectedColor, setSelectedColor] = useState('#7B61FF');
  const [selectedBubbleStyle, setSelectedBubbleStyle] = useState('modern');

  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const toggleSpecialty = (s: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSave = () => {
    setIsSaving(true);
    const updates: Partial<AgentConfig> = {
      name: agentName,
      mode: selectedStyle,
      voice: selectedVoice as AgentConfig['voice'],
      creativity: creativity[0],
      formality: formality[0],
      systemPrompt,
    };
    updateAgent(updates);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0B0B10] border border-[#7B61FF]/30 rounded-2xl shadow-2xl shadow-[#7B61FF]/10">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 border-b border-[#7B61FF]/20 bg-[#0B0B10]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Design Your Assistant
              </h2>
              <p className="text-xs text-[#A7ACB8]">Step {step} of 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors">
            <X className="w-5 h-5 text-[#A7ACB8]" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    s <= step
                      ? 'bg-[#7B61FF] text-white'
                      : 'bg-[#05050A] text-[#A7ACB8] border border-[#7B61FF]/20'
                  }`}
                >
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-0.5 rounded ${s < step ? 'bg-[#7B61FF]' : 'bg-[#7B61FF]/20'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-[#A7ACB8]">
            <span>Personality</span>
            <span>Knowledge</span>
            <span>Appearance</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* ─── Step 1: Personality ─── */}
          {step === 1 && (
            <>
              {/* Agent Name */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Agent Name</label>
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
                  placeholder="Give your agent a name..."
                />
              </div>

              {/* Voice/Tone */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Voice</label>
                <div className="grid grid-cols-2 gap-2">
                  {voiceOptions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`p-3 rounded-xl border transition-all text-left ${
                        selectedVoice === v.id
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                          : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                      }`}
                    >
                      <span className="text-lg">{v.emoji}</span>
                      <div className="font-medium text-sm text-[#F4F6FF] mt-1">{v.label}</div>
                      <div className="text-xs text-[#A7ACB8]">{v.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Style */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Agent Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {styleOptions.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedStyle === style.id
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                          : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${style.color}20` }}
                        >
                          <style.icon className="w-4 h-4" style={{ color: style.color }} />
                        </div>
                        {selectedStyle === style.id && (
                          <div className="w-5 h-5 rounded-full bg-[#7B61FF] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="font-medium text-sm text-[#F4F6FF]">{style.name}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {style.features.slice(0, 2).map((f) => (
                          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0B0B10] text-[#A7ACB8]">{f}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Creativity & Formality Sliders */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-[#A7ACB8]">Creativity</label>
                    <span className="text-sm text-[#F4F6FF] font-mono">{creativity[0]}%</span>
                  </div>
                  <Slider value={creativity} onValueChange={setCreativity} max={100} step={10} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm text-[#A7ACB8]">Formality</label>
                    <span className="text-sm text-[#F4F6FF] font-mono">{formality[0]}%</span>
                  </div>
                  <Slider value={formality} onValueChange={setFormality} max={100} step={10} />
                </div>
              </div>

              {/* Response Speed */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Response Speed</label>
                <div className="grid grid-cols-3 gap-2">
                  {speedOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setResponseSpeed(opt.id)}
                      className={`p-3 rounded-xl border transition-all text-center ${
                        responseSpeed === opt.id
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                          : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                      }`}
                    >
                      <opt.icon className="w-5 h-5 mx-auto mb-1 text-[#7B61FF]" />
                      <div className="text-xs font-medium text-[#F4F6FF]">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ─── Step 2: Knowledge ─── */}
          {step === 2 && (
            <>
              {/* Knowledge Sources */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Upload Knowledge</label>
                <div className="grid grid-cols-3 gap-3">
                  <button className="p-4 rounded-xl border border-dashed border-[#7B61FF]/30 bg-[#05050A] hover:border-[#7B61FF]/50 transition-colors flex flex-col items-center gap-2 text-center">
                    <FileText className="w-6 h-6 text-[#7B61FF]" />
                    <span className="text-xs text-[#A7ACB8]">Resume.pdf</span>
                  </button>
                  <button className="p-4 rounded-xl border border-dashed border-[#7B61FF]/30 bg-[#05050A] hover:border-[#7B61FF]/50 transition-colors flex flex-col items-center gap-2 text-center">
                    <Github className="w-6 h-6 text-[#7B61FF]" />
                    <span className="text-xs text-[#A7ACB8]">GitHub Profile</span>
                  </button>
                  <button className="p-4 rounded-xl border border-dashed border-[#7B61FF]/30 bg-[#05050A] hover:border-[#7B61FF]/50 transition-colors flex flex-col items-center gap-2 text-center">
                    <Upload className="w-6 h-6 text-[#7B61FF]" />
                    <span className="text-xs text-[#A7ACB8]">Custom File</span>
                  </button>
                </div>
              </div>

              {/* Specialties */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSpecialty(s)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                        selectedSpecialties.includes(s)
                          ? 'bg-[#7B61FF] text-white'
                          : 'bg-[#05050A] border border-[#7B61FF]/20 text-[#A7ACB8] hover:border-[#7B61FF]/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone Example */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Describe your tone</label>
                <Input
                  value={toneExample}
                  onChange={(e) => setToneExample(e.target.value)}
                  className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
                  placeholder='e.g. "I explain complex things simply"'
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">System Instructions</label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF] min-h-[100px] resize-none"
                  placeholder="Instructions for how your agent should behave..."
                />
              </div>
            </>
          )}

          {/* ─── Step 3: Appearance ─── */}
          {step === 3 && (
            <>
              {/* Avatar */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Avatar</label>
                <div className="flex gap-3">
                  {avatarOptions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all ${
                        selectedAvatar === emoji
                          ? 'bg-[#7B61FF]/20 border-2 border-[#7B61FF] scale-110'
                          : 'bg-[#05050A] border border-[#7B61FF]/20 hover:border-[#7B61FF]/40'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button className="w-14 h-14 rounded-xl flex items-center justify-center bg-[#05050A] border border-dashed border-[#7B61FF]/30 hover:border-[#7B61FF]/50 transition-colors">
                    <Upload className="w-5 h-5 text-[#A7ACB8]" />
                  </button>
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Color Theme</label>
                <div className="flex gap-3">
                  {accentColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-full transition-all ${
                        selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0B0B10] scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Chat Bubble Style */}
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Chat Bubble Style</label>
                <div className="grid grid-cols-3 gap-3">
                  {chatBubbleStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedBubbleStyle(style.id)}
                      className={`p-4 rounded-xl border transition-all text-center ${
                        selectedBubbleStyle === style.id
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                          : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                      }`}
                    >
                      <div
                        className={`mx-auto mb-2 px-3 py-1.5 text-xs text-white max-w-fit ${style.class}`}
                        style={{ backgroundColor: selectedColor }}
                      >
                        Hello!
                      </div>
                      <div className="text-xs text-[#A7ACB8]">{style.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Toggle */}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full p-4 rounded-xl border border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40 transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-[#7B61FF]" />
                <span className="text-sm text-[#A7ACB8]">{showPreview ? 'Hide Preview' : 'Preview Conversation'}</span>
              </button>

              {showPreview && (
                <div className="p-4 rounded-xl bg-[#05050A] border border-[#7B61FF]/20 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{selectedAvatar}</span>
                    <span className="font-medium text-sm text-[#F4F6FF]">{agentName || 'Agent'}</span>
                    <span className="text-xs text-[#61FF7B]">Online</span>
                  </div>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 text-sm text-white ${chatBubbleStyles.find((s) => s.id === selectedBubbleStyle)?.class}`}
                    style={{ backgroundColor: selectedColor }}
                  >
                    Hey there! I'm {agentName || 'your AI'}. I specialize in {selectedSpecialties.slice(0, 2).join(' and ') || 'helping you get things done'}. What can I do for you?
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[75%] px-4 py-2.5 text-sm bg-[#0B0B10] border border-[#7B61FF]/20 rounded-2xl text-[#F4F6FF]">
                      Can you help me with my React project?
                    </div>
                  </div>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 text-sm text-white ${chatBubbleStyles.find((s) => s.id === selectedBubbleStyle)?.class}`}
                    style={{ backgroundColor: selectedColor }}
                  >
                    Absolutely! I'd love to help. What specifically are you working on?
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="sticky bottom-0 p-6 pt-4 border-t border-[#7B61FF]/20 bg-[#0B0B10] flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => setStep((step - 1) as WizardStep)}
              className="border-[#7B61FF]/30 text-[#A7ACB8]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep((step + 1) as WizardStep)}
              className="bg-[#7B61FF] hover:bg-[#6B51EF]"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-[#7B61FF] to-[#FF61DC] hover:opacity-90"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isSaving ? 'Deploying...' : 'Save & Deploy'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
