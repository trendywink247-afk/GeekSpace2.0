import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, User, Bot, Link2, Eye, ArrowRight, ArrowLeft, Check,
  MessageSquare, Code, Briefcase, Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import type { AgentMode, IntegrationType } from '@/types';

const STEPS = ['Profile', 'Agent Mode', 'Integrations', 'Visibility'];

const agentModes: { id: AgentMode; name: string; description: string; icon: typeof Bot; features: string[]; color: string }[] = [
  { id: 'minimal', name: 'Minimal', description: 'Clean, simple — reminders and Q&A', icon: MessageSquare, features: ['Reminders', 'Q&A', 'Quick facts'], color: '#7B61FF' },
  { id: 'builder', name: 'Builder', description: 'Coding-focused with automation', icon: Code, features: ['Code help', 'API calls', 'Automation', 'Terminal'], color: '#61FF7B' },
  { id: 'operator', name: 'Operator', description: 'Daily planning and life management', icon: Briefcase, features: ['Planning', 'Routines', 'Scheduling', 'Goals'], color: '#FFD761' },
];

const integrationOptions: { id: IntegrationType; name: string; description: string }[] = [
  { id: 'telegram', name: 'Telegram', description: 'Chat with your agent via Telegram' },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Sync events and schedules' },
  { id: 'github', name: 'GitHub', description: 'Showcase repos in portfolio' },
  { id: 'n8n', name: 'n8n', description: 'Advanced workflow automation' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { onboarding, updateOnboarding, completeOnboarding } = useAuthStore();
  const [step, setStep] = useState(0);

  const profile = onboarding.profile;

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      await completeOnboarding();
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-[#7B61FF]" />
            <span className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              GeekSpace
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Set up your AI space
          </h1>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                i < step ? 'bg-[#61FF7B] text-[#05050A]' :
                i === step ? 'bg-[#7B61FF] text-white' :
                'bg-[#0B0B10] border border-[#7B61FF]/30 text-[#A7ACB8]'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 ${i < step ? 'bg-[#61FF7B]' : 'bg-[#7B61FF]/20'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-8 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20 mb-6">
          {step === 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-6 h-6 text-[#7B61FF]" />
                <h2 className="text-xl font-semibold">Profile Basics</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#A7ACB8] mb-2 block">Display Name</label>
                  <Input
                    value={profile.name}
                    onChange={(e) => updateOnboarding({ profile: { ...profile, name: e.target.value } })}
                    placeholder="Alex Chen"
                    className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#A7ACB8] mb-2 block">Username</label>
                  <Input
                    value={profile.username}
                    onChange={(e) => updateOnboarding({ profile: { ...profile, username: e.target.value } })}
                    placeholder="alex"
                    className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
                  />
                  <p className="text-xs text-[#A7ACB8] mt-1">
                    URL: <span className="text-[#7B61FF]">{profile.username || 'you'}.geekspace.space</span>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Short Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => updateOnboarding({ profile: { ...profile, bio: e.target.value } })}
                  placeholder="What do you do? What are you into?"
                  className="w-full p-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF] min-h-[80px] resize-none focus:outline-none focus:border-[#7B61FF]"
                />
              </div>
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Tags (select up to 3)</label>
                <div className="flex flex-wrap gap-2">
                  {['AI Engineer', 'No-Code Automation', 'Designer', 'Founder', 'Data Scientist', 'DevOps', 'Content Creator', 'Marketer'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        const tags = profile.tags.includes(tag)
                          ? profile.tags.filter((t) => t !== tag)
                          : profile.tags.length < 3 ? [...profile.tags, tag] : profile.tags;
                        updateOnboarding({ profile: { ...profile, tags } });
                      }}
                      className={`px-4 py-2 rounded-full text-sm transition-all ${
                        profile.tags.includes(tag)
                          ? 'bg-[#7B61FF]/20 border border-[#7B61FF] text-[#7B61FF]'
                          : 'bg-[#05050A] border border-[#7B61FF]/20 text-[#A7ACB8] hover:border-[#7B61FF]/50'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Bot className="w-6 h-6 text-[#7B61FF]" />
                <h2 className="text-xl font-semibold">Choose Agent Mode</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {agentModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateOnboarding({ agentMode: mode.id })}
                    className={`p-5 rounded-xl border-2 transition-all text-left ${
                      onboarding.agentMode === mode.id
                        ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                        : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${mode.color}20` }}>
                        <mode.icon className="w-5 h-5" style={{ color: mode.color }} />
                      </div>
                      {onboarding.agentMode === mode.id && (
                        <div className="w-6 h-6 rounded-full bg-[#7B61FF] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-[#F4F6FF] mb-1">{mode.name}</h3>
                    <p className="text-sm text-[#A7ACB8] mb-3">{mode.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {mode.features.map((f) => (
                        <span key={f} className="px-2 py-0.5 text-xs rounded-full bg-[#0B0B10] text-[#A7ACB8]">{f}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-[#05050A] border border-[#7B61FF]/20">
                <div className="flex items-center gap-3 mb-2">
                  <Key className="w-5 h-5 text-[#7B61FF]" />
                  <h3 className="font-medium text-[#F4F6FF]">AI Credits</h3>
                </div>
                <div className="flex gap-3">
                  {(['geekspace', 'own'] as const).map((choice) => (
                    <button
                      key={choice}
                      onClick={() => updateOnboarding({ apiKeyChoice: choice })}
                      className={`flex-1 p-3 rounded-lg border text-sm transition-all ${
                        onboarding.apiKeyChoice === choice
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10 text-[#7B61FF]'
                          : 'border-[#7B61FF]/20 text-[#A7ACB8]'
                      }`}
                    >
                      {choice === 'geekspace' ? 'Use GeekSpace Credits' : 'Bring My Own API Keys'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Link2 className="w-6 h-6 text-[#7B61FF]" />
                <h2 className="text-xl font-semibold">Connect Integrations</h2>
              </div>
              <p className="text-[#A7ACB8] text-sm">Optional — you can add these later from the dashboard.</p>
              <div className="space-y-3">
                {integrationOptions.map((opt) => {
                  const selected = onboarding.integrations.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        const integrations = selected
                          ? onboarding.integrations.filter((i) => i !== opt.id)
                          : [...onboarding.integrations, opt.id];
                        updateOnboarding({ integrations });
                      }}
                      className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between ${
                        selected
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                          : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium text-[#F4F6FF]">{opt.name}</div>
                        <div className="text-sm text-[#A7ACB8]">{opt.description}</div>
                      </div>
                      {selected && (
                        <div className="w-6 h-6 rounded-full bg-[#7B61FF] flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Eye className="w-6 h-6 text-[#7B61FF]" />
                <h2 className="text-xl font-semibold">Portfolio Visibility</h2>
              </div>
              <p className="text-[#A7ACB8] text-sm">Control what's visible on your public page.</p>
              <div className="space-y-3">
                {(['public', 'private'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => updateOnboarding({ visibility: v })}
                    className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                      onboarding.visibility === v
                        ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                        : 'border-[#7B61FF]/20 bg-[#05050A]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-[#F4F6FF] capitalize">{v} Profile</h3>
                        <p className="text-sm text-[#A7ACB8] mt-1">
                          {v === 'public'
                            ? 'Show in directory, allow "Ask my agent" chat, display projects'
                            : 'Hidden from directory, portfolio only accessible by direct link'}
                        </p>
                      </div>
                      {onboarding.visibility === v && (
                        <div className="w-6 h-6 rounded-full bg-[#7B61FF] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-4 rounded-xl bg-[#61FF7B]/10 border border-[#61FF7B]/30">
                <p className="text-sm text-[#F4F6FF]">
                  You can fine-tune visibility for each section later in Settings &rarr; Privacy.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            className="border-[#7B61FF]/30 text-[#A7ACB8]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <span className="text-sm text-[#A7ACB8]">
            Step {step + 1} of {STEPS.length}
          </span>
          <Button onClick={handleNext} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
            {step === STEPS.length - 1 ? 'Launch My Space' : 'Next'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
