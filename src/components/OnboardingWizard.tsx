import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { AgentPersonality } from '@/types';

// ── Use case definitions ───────────────────────────────────────────────────────

type UseCase = 'creator' | 'student' | 'developer' | 'business' | 'productivity' | 'personal';

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
  {
    id: 'productivity',
    label: 'Productivity',
    emoji: '⚡',
    description: 'Workflows, task management, automation',
  },
  {
    id: 'personal',
    label: 'Personal',
    emoji: '🏠',
    description: 'Reminders, habits, daily planning',
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

interface AgentSetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function AgentSetupWizard({ onComplete, onSkip }: AgentSetupWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [personality, setPersonality] = useState<AgentPersonality>('jarvis');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
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
                <h2 className="text-lg font-bold text-[#E8E8F0]">Connect on Telegram</h2>
                <p className="text-sm text-[#6B7280] mt-1">
                  Chat with your AI agent on the go. You can always connect later in Settings.
                </p>
              </div>
              <div className="rounded-xl border border-[#0088cc]/30 bg-[#0088cc]/5 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0088cc]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#E8E8F0]">@agentinchatbot</span>
                    <p className="text-xs text-[#6B7280] mt-0.5">Your personal AI on Telegram</p>
                  </div>
                </div>
                <ul className="text-xs text-[#9CA3AF] space-y-1 ml-1">
                  <li className="flex items-center gap-2"><span className="text-[#00FF88]">*</span> Send messages and get AI responses</li>
                  <li className="flex items-center gap-2"><span className="text-[#00FF88]">*</span> Set reminders from your phone</li>
                  <li className="flex items-center gap-2"><span className="text-[#00FF88]">*</span> Generate images on the go</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href="https://t.me/agentinchatbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={async () => { await handleSave(); }}
                  className="w-full py-3 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-semibold transition-colors text-center"
                >
                  Open @agentinchatbot in Telegram
                </a>
                <button
                  onClick={async () => {
                    await handleSave();
                    navigate('/dashboard/connections');
                  }}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-[#00F0FF] hover:bg-[#00D4E0] disabled:opacity-50 text-black text-sm font-semibold transition-colors"
                >
                  Connect via Dashboard
                </button>
                <button
                  onClick={async () => {
                    await handleSave();
                    onComplete();
                  }}
                  disabled={saving}
                  className="w-full py-3 rounded-xl border border-white/10 text-sm text-[#6B7280] hover:text-[#E8E8F0] hover:border-white/20 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving\u2026' : 'Skip for now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
