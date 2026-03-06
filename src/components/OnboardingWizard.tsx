import { useState } from 'react';
import { X, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { AgentPersonality } from '@/types';

// ── Use case definitions ───────────────────────────────────────────────────────

type UseCase = 'creator' | 'student' | 'developer' | 'business';

interface UseCaseOption {
  id: UseCase;
  label: string;
  emoji: string;
  description: string;
}

interface PersonalityOption {
  id: AgentPersonality;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
}

const USE_CASES: UseCaseOption[] = [
  {
    id: 'creator',
    label: 'Creator',
    emoji: '🎨',
    description: 'Make content, write scripts, generate images',
  },
  {
    id: 'student',
    label: 'Student',
    emoji: '📚',
    description: 'Study, get explanations, quiz yourself',
  },
  {
    id: 'developer',
    label: 'Developer',
    emoji: '💻',
    description: 'Code reviews, scripts, debugging',
  },
  {
    id: 'business',
    label: 'Business',
    emoji: '💼',
    description: 'Emails, meeting notes, scheduling',
  },
];

const PERSONALITIES: PersonalityOption[] = [
  {
    id: 'jarvis',
    label: 'Jarvis',
    emoji: '🤵',
    tagline: 'Sharp & Direct',
    description: 'Gets straight to the point. No fluff, just results.',
  },
  {
    id: 'edith',
    label: 'Edith',
    emoji: '🔬',
    tagline: 'Analytical & Thorough',
    description: 'Methodical thinker. Breaks complex problems down clearly.',
  },
  {
    id: 'weebo',
    label: 'Weebo',
    emoji: '🌟',
    tagline: 'Warm & Creative',
    description: 'Enthusiastic and encouraging. Makes ideas come alive.',
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [personality, setPersonality] = useState<AgentPersonality>('jarvis');
  const [saving, setSaving] = useState(false);
  const updateAgent = useDashboardStore((s) => s.updateAgent);

  const handleSave = async () => {
    if (!useCase) return;
    setSaving(true);
    try {
      await updateAgent({ use_case: useCase, personality });
    } catch {
      // updateAgent already handles errors — proceed regardless
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-card-v2 border border-[#00F0FF]/20 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-sm font-semibold text-[#E8E8F0]">
              Set up your AI · Step {step} of 3
            </span>
          </div>
          <button
            onClick={onSkip}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E8E8F0] hover:bg-white/5 transition-colors"
            aria-label="Skip setup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-[#00F0FF] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6">
          {/* ── Step 1: Use Case ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#E8E8F0]">What will you use it for?</h2>
                <p className="text-sm text-[#6B7280] mt-1">Pick your main use case so your AI can tailor suggestions.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {USE_CASES.map((uc) => (
                  <button
                    key={uc.id}
                    onClick={() => setUseCase(uc.id)}
                    className={[
                      'flex flex-col gap-2 p-4 rounded-xl border text-left transition-all',
                      useCase === uc.id
                        ? 'border-[#00F0FF] bg-[#00F0FF]/10 text-[#E8E8F0]'
                        : 'border-white/10 hover:border-white/20 text-[#9CA3AF]',
                    ].join(' ')}
                  >
                    <span className="text-2xl">{uc.emoji}</span>
                    <div>
                      <div className="text-sm font-semibold text-[#E8E8F0]">{uc.label}</div>
                      <div className="text-xs text-[#6B7280] mt-0.5">{uc.description}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!useCase}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#00D4E0] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold transition-colors"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Personality ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#E8E8F0]">Choose a personality</h2>
                <p className="text-sm text-[#6B7280] mt-1">How should your AI communicate with you?</p>
              </div>
              <div className="space-y-2">
                {PERSONALITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPersonality(p.id)}
                    className={[
                      'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                      personality === p.id
                        ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                        : 'border-white/10 hover:border-white/20',
                    ].join(' ')}
                  >
                    <span className="text-2xl flex-shrink-0">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#E8E8F0]">{p.label}</span>
                        <span className="text-xs text-[#6B7280]">· {p.tagline}</span>
                      </div>
                      <div className="text-xs text-[#6B7280] mt-0.5">{p.description}</div>
                    </div>
                    {personality === p.id && (
                      <CheckCircle2 className="w-4 h-4 text-[#00F0FF] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-[#6B7280] hover:text-[#E8E8F0] hover:border-white/20 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00F0FF] hover:bg-[#00D4E0] text-black text-sm font-semibold transition-colors"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Telegram ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#E8E8F0]">Connect Telegram</h2>
                <p className="text-sm text-[#6B7280] mt-1">
                  Chat with your AI on the go. You can always connect later in Settings → Connections.
                </p>
              </div>
              <div className="rounded-xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📱</span>
                  <span className="text-sm font-semibold text-[#E8E8F0]">Telegram Bot</span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Send messages, set reminders, and get AI responses — right from your phone.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={async () => {
                    await handleSave();
                    window.location.href = '/dashboard/connections';
                  }}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-[#00F0FF] hover:bg-[#00D4E0] disabled:opacity-50 text-black text-sm font-semibold transition-colors"
                >
                  Connect Telegram
                </button>
                <button
                  onClick={async () => {
                    await handleSave();
                    onComplete();
                  }}
                  disabled={saving}
                  className="w-full py-3 rounded-xl border border-white/10 text-sm text-[#6B7280] hover:text-[#E8E8F0] hover:border-white/20 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Skip for now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
