import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Target, Bell, Zap, Brain, Shield, Wand2, PartyPopper } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { goalsService } from '@/services/api';
import api from '@/services/api';
import type { AgentPersonality } from '@/types';

// ── Use case definitions ───────────────────────────────────────────────────────

interface PersonalityOption {
  id: AgentPersonality;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
}

const PERSONALITIES: PersonalityOption[] = [
  { id: 'jarvis', label: 'Jarvis', emoji: '🤵', tagline: 'Sharp & Direct', description: 'Gets straight to the point. No fluff, just results.' },
  { id: 'edith', label: 'Edith', emoji: '🔬', tagline: 'Analytical & Thorough', description: 'Methodical thinker. Breaks complex problems down clearly.' },
  { id: 'weebo', label: 'Weebo', emoji: '🌟', tagline: 'Warm & Creative', description: 'Enthusiastic and encouraging. Makes ideas come alive.' },
  { id: 'aria', label: 'Aria', emoji: '🎨', tagline: 'Social & Expressive', description: 'Communicator who connects ideas and people.' },
  { id: 'forge', label: 'Forge', emoji: '🔧', tagline: 'Builder & Maker', description: 'Hands-on problem solver. Loves building things.' },
  { id: 'cal', label: 'Cal', emoji: '📅', tagline: 'Organized & Reliable', description: 'Keeps everything on track. Never misses a deadline.' },
];

const AUTONOMY_LEVELS = [
  { value: 'manual', label: 'Manual', icon: Shield, description: 'I approve every action', color: 'var(--ag-text-muted)' },
  { value: 'suggest', label: 'Suggest', icon: Brain, description: 'Suggest actions, I decide', color: '#3B82F6' },
  { value: 'semi_auto', label: 'Semi-Auto', icon: Zap, description: 'Auto for small tasks, ask for big ones', color: '#F59E0B' },
  { value: 'full_auto', label: 'Full Auto', icon: Wand2, description: 'Handle everything autonomously', color: '#10B981' },
];

const GOAL_SUGGESTIONS = [
  { title: 'Learn a new programming language', category: 'learning', emoji: '💻' },
  { title: 'Build a personal portfolio website', category: 'creative', emoji: '🌐' },
  { title: 'Establish a daily exercise routine', category: 'health', emoji: '🏃' },
  { title: 'Read 12 books this year', category: 'personal', emoji: '📖' },
  { title: 'Launch a side project', category: 'career', emoji: '🚀' },
  { title: 'Save $5,000 this quarter', category: 'finance', emoji: '💰' },
];

type Step = 1 | 2 | 3 | 4 | 5;
const TOTAL_STEPS = 5;

// ── Component ──────────────────────────────────────────────────────────────────

interface AgentSetupWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function AgentSetupWizard({ onComplete, onSkip }: AgentSetupWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [personality, setPersonality] = useState<AgentPersonality>('jarvis');
  const [autonomy, setAutonomy] = useState('suggest');
  const [goalTitle, setGoalTitle] = useState('');
  const [autoPlanGoal, setAutoPlanGoal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goalCreated, setGoalCreated] = useState(false);
  const updateAgent = useDashboardStore((s) => s.updateAgent);

  const progressPercent = (step / TOTAL_STEPS) * 100;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAgent({ personality });
      // Save autonomy level via config endpoint
      await api.patch('/agent/config', { autonomy_level: autonomy }).catch(() => {});
    } catch { /* proceed regardless */ }
    setSaving(false);
  };

  const handleCreateGoal = async () => {
    if (!goalTitle.trim()) return;
    try {
      const res = await goalsService.create({ title: goalTitle.trim(), category: 'general' });
      if (autoPlanGoal && res.data.goal?.id) {
        goalsService.plan(res.data.goal.id).catch(() => {}); // fire-and-forget
      }
      setGoalCreated(true);
    } catch { /* ignore */ }
  };

  const handleFinish = async () => {
    await handleSave();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0C0C18 0%, #06060f 100%)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--ag-cyan)]" />
            <span className="text-sm font-semibold text-[#E8E8F0]">
              Set up Agentin · Step {step} of {TOTAL_STEPS}
            </span>
          </div>
          <button onClick={onSkip} className="p-1.5 rounded-lg text-[var(--ag-text-muted)] hover:text-[#E8E8F0] hover:bg-white/5 transition-colors" aria-label="Skip setup">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-6 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #A78BFA, #8B5CF6)' }} />
        </div>

        {/* Body */}
        <div className="p-6">
          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-3">🤖</div>
                <h2 className="text-xl font-bold text-[var(--ag-text-primary)]">Meet Agentin</h2>
                <p className="text-sm text-[var(--ag-text-muted)] mt-2 max-w-sm mx-auto">
                  Your personal AI that plans goals, delegates tasks to specialist agents, and works proactively in the background.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Target, label: 'Goals & Planning', color: 'var(--ag-cyan)' },
                  { icon: Zap, label: 'Auto Delegation', color: 'var(--ag-violet)' },
                  { icon: Bell, label: 'Smart Alerts', color: '#F59E0B' },
                ].map(f => (
                  <div key={f.label} className="flex flex-col items-center gap-2 p-3 rounded-xl" style={{ background: `${f.color}08`, border: `1px solid ${f.color}15` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                    <span className="text-[10px] text-gray-400 text-center leading-tight">{f.label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors text-black"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' }}
              >
                Let's set you up <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 2: Personality ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#E8E8F0]">Choose a personality</h2>
                <p className="text-sm text-[var(--ag-text-muted)] mt-1">How should your AI communicate?</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                {PERSONALITIES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPersonality(p.id)}
                    className="flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all"
                    style={{
                      borderColor: personality === p.id ? '#A78BFA' : 'rgba(255,255,255,0.08)',
                      background: personality === p.id ? 'rgba(139,92,246,0.08)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-sm font-semibold text-[#E8E8F0]">{p.label}</span>
                      {personality === p.id && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ag-cyan)] ml-auto" />}
                    </div>
                    <span className="text-[10px] text-[var(--ag-text-muted)]">{p.tagline} — {p.description}</span>
                  </button>
                ))}
              </div>
              <NavButtons back={() => setStep(1)} next={() => setStep(3)} />
            </div>
          )}

          {/* ── Step 3: Set First Goal ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#E8E8F0]">Set your first goal</h2>
                <p className="text-sm text-[var(--ag-text-muted)] mt-1">What do you want to achieve? AI will plan the steps for you.</p>
              </div>
              {!goalCreated ? (
                <>
                  <input
                    type="text"
                    placeholder="e.g. Learn TypeScript in 30 days"
                    value={goalTitle}
                    onChange={e => setGoalTitle(e.target.value)}
                    className="w-full rounded-xl bg-[#10101E] border border-white/10 px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    {GOAL_SUGGESTIONS.map(g => (
                      <button
                        key={g.title}
                        onClick={() => setGoalTitle(g.title)}
                        className="px-3 py-1.5 rounded-full text-xs border border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
                      >
                        {g.emoji} {g.title}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={autoPlanGoal} onChange={e => setAutoPlanGoal(e.target.checked)} className="rounded border-gray-600" />
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs text-gray-400">Let AI plan this automatically</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-[var(--ag-text-muted)] hover:text-[#E8E8F0] transition-colors">
                      <ArrowLeft className="w-4 h-4 inline mr-1" />Back
                    </button>
                    {goalTitle.trim() ? (
                      <button onClick={handleCreateGoal} className="flex-[2] py-3 rounded-xl text-sm font-semibold text-black transition-colors" style={{ background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' }}>
                        <Target className="w-4 h-4 inline mr-1" /> Create Goal
                      </button>
                    ) : (
                      <button onClick={() => setStep(4)} className="flex-[2] py-3 rounded-xl border border-white/10 text-sm text-[var(--ag-text-muted)] hover:text-[#E8E8F0] transition-colors">
                        Skip for now <ArrowRight className="w-4 h-4 inline ml-1" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">🎯</div>
                  <p className="text-sm text-emerald-400 font-medium">Goal created! AI is planning your steps...</p>
                  <p className="text-xs text-gray-500 mt-1">You can track progress in the Goals page.</p>
                  <button onClick={() => setStep(4)} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' }}>
                    Continue <ArrowRight className="w-4 h-4 inline ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Autonomy Level ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#E8E8F0]">How autonomous should your agent be?</h2>
                <p className="text-sm text-[var(--ag-text-muted)] mt-1">You can change this anytime in settings.</p>
              </div>
              <div className="space-y-2">
                {AUTONOMY_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setAutonomy(level.value)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all"
                    style={{
                      borderColor: autonomy === level.value ? level.color : 'rgba(255,255,255,0.08)',
                      background: autonomy === level.value ? `${level.color}10` : 'transparent',
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${level.color}15` }}>
                      <level.icon className="w-4.5 h-4.5" style={{ color: level.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#E8E8F0]">{level.label}</div>
                      <div className="text-xs text-[var(--ag-text-muted)]">{level.description}</div>
                    </div>
                    {autonomy === level.value && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: level.color }} />}
                  </button>
                ))}
              </div>
              <NavButtons back={() => setStep(3)} next={() => setStep(5)} />
            </div>
          )}

          {/* ── Step 5: Connect & Finish ── */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-[var(--ag-text-primary)]">You're all set!</h2>
                <p className="text-sm text-[var(--ag-text-muted)] mt-2">
                  Your agent is ready. Connect Telegram for on-the-go access, or dive straight in.
                </p>
              </div>
              <div className="rounded-xl border border-[#0088cc]/30 bg-[#0088cc]/5 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0088cc]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#E8E8F0]">@agentinchatbot</span>
                    <p className="text-xs text-[var(--ag-text-muted)]">Chat with your agent on Telegram</p>
                  </div>
                </div>
                <a
                  href="https://t.me/agentinchatbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-semibold transition-colors text-center"
                >
                  Connect Telegram
                </a>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-black transition-colors"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' }}
                >
                  {saving ? 'Saving...' : (<><PartyPopper className="w-4 h-4" /> Start Using Agentin</>)}
                </button>
                <button onClick={() => setStep(4)} className="text-xs text-[var(--ag-text-muted)] hover:text-[#E8E8F0] transition-colors py-1">
                  <ArrowLeft className="w-3 h-3 inline mr-1" />Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Nav Buttons Helper ──────────────────────────────────────────────────────

function NavButtons({ back, next }: { back: () => void; next: () => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={back} className="flex-1 py-3 rounded-xl border border-white/10 text-sm text-[var(--ag-text-muted)] hover:text-[#E8E8F0] hover:border-white/20 transition-colors">
        <ArrowLeft className="w-4 h-4 inline mr-1" />Back
      </button>
      <button onClick={next} className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-black transition-colors" style={{ background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' }}>
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
