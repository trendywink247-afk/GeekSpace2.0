import { Sparkles, Link2, Target, Mic, Brain, ArrowRight, CheckSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface OnboardingChecklistProps {
  hasReminders: boolean;
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

export function OnboardingChecklist({ hasReminders, onNavigate, onOpenChat }: OnboardingChecklistProps) {
  const steps = [
    {
      label: 'Connect Telegram',
      desc: 'Chat with your AI on the go',
      icon: Link2,
      color: 'var(--ag-violet)',
      done: false,
      action: () => onNavigate?.('connections'),
    },
    {
      label: 'Set up habits',
      desc: 'Track your daily goals',
      icon: Target,
      color: '#ADFF2F',
      done: hasReminders,
      action: () => onNavigate?.('reminders'),
    },
    {
      label: 'Try voice input',
      desc: 'Talk to Weebo hands-free',
      icon: Mic,
      color: '#FF2D78',
      done: false,
      action: () => onOpenChat?.(),
    },
    {
      label: 'Add a memory',
      desc: 'Teach your AI about you',
      icon: Brain,
      color: 'var(--ag-cyan)',
      done: false,
      action: () => onNavigate?.('memory'),
    },
  ];

  return (
    <>
      <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider mb-3 font-heading">
        Get started
      </h2>
      <Card className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(173,255,47,0.1))' }}
            >
              <Sparkles className="w-5 h-5 text-[var(--ag-cyan)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ag-text-primary)] font-heading">
                Welcome to Agentin!
              </h3>
              <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                Complete these steps to unlock your full AI experience.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {steps.map((step) => (
              <button
                key={step.label}
                onClick={step.action}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] min-h-[44px] ${
                  step.done
                    ? 'border-[var(--ag-jarvis)]/20 bg-[var(--ag-jarvis)]/5'
                    : 'border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)]'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${step.color}15` }}
                >
                  {step.done
                    ? <CheckSquare className="w-4 h-4 text-[var(--ag-jarvis)]" />
                    : <step.icon className="w-4 h-4" style={{ color: step.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${step.done ? 'text-[var(--ag-jarvis)] line-through' : 'text-[var(--ag-text-primary)]'}`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-[var(--ag-text-secondary)]">{step.desc}</div>
                </div>
                {!step.done && (
                  <ArrowRight className="w-4 h-4 text-[var(--ag-text-secondary)]/40 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
