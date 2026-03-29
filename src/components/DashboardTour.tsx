/* eslint-disable react-refresh/only-export-components */
// ============================================================
// Dashboard Tour — First-Use Guided Discovery
//
// A floating card that appears on first dashboard visit and
// walks new users through 6 key features with contextual tips.
// Dismissible and stored in localStorage so it only shows once.
// ============================================================

import { useState, useEffect } from 'react';
import {
  X, ChevronRight, MessageSquare, Code, Bell, Link2,
  Sparkles, CheckCircle2, Brain, Zap
} from 'lucide-react';

interface TourStep {
  icon: typeof MessageSquare;
  color: string;
  title: string;
  description: string;
  action?: { label: string; page: string };
  tip?: string;
}

const tourSteps: TourStep[] = [
  {
    icon: Sparkles,
    color: '#8B5CF6',
    title: 'Welcome to your AI command center',
    description: 'Your agent can chat, build websites, set reminders, automate tasks, and represent you 24/7 on your portfolio. Here\'s a quick tour.',
    tip: 'This tour only shows once — but you can always visit "What Can I Do?" in the sidebar.',
  },
  {
    icon: MessageSquare,
    color: '#BF5FFF',
    title: 'Start by chatting with your agent',
    description: 'Click the glowing orb in the bottom-right corner anytime. Ask it to build something, set a reminder, or just have a conversation.',
    tip: 'Tip: Type "what can you do?" for a quick capabilities rundown.',
  },
  {
    icon: Code,
    color: '#BF5FFF',
    title: 'Build real web pages in seconds',
    description: 'Ask: "Build me a pricing page for a SaaS" — your agent generates complete HTML/CSS/JS and gives you a live preview link.',
    action: { label: 'Open Website Builder', page: 'website-builder' },
    tip: 'Every generated site is auto-saved to your Projects.',
  },
  {
    icon: Bell,
    color: '#00FF88',
    title: 'Reminders that actually work',
    description: 'Just type naturally: "Remind me tomorrow at 9am to review the PR." The agent parses time, sets the reminder, and delivers it where you are.',
    action: { label: 'View Reminders', page: 'reminders' },
    tip: 'Tip: Connect Telegram to get reminders on your phone.',
  },
  {
    icon: Link2,
    color: '#F59E0B',
    title: 'Connect Telegram for full power',
    description: 'Link your Telegram and get voice notes, reminders, code generation, and your full agent in your pocket — no browser needed.',
    action: { label: 'Set Up Connections', page: 'connections' },
    tip: 'Voice notes use speech-to-speech — speak, get audio back.',
  },
  {
    icon: Brain,
    color: '#EC4899',
    title: 'Explore everything it can do',
    description: 'Visit "What Can I Do?" in the sidebar to see all 20+ capabilities — with example prompts you can copy and try instantly.',
    action: { label: 'See All Capabilities', page: 'capabilities' },
    tip: 'Your agent is already learning from every conversation.',
  },
];

const TOUR_STORAGE_KEY = 'gs_dashboard_tour_seen';

interface DashboardTourProps {
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

export function DashboardTour({ onNavigate, onOpenChat }: DashboardTourProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Only show on first visit — check after a short delay so page renders first
    const seen = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(TOUR_STORAGE_KEY, '1');
    }, 300);
  };

  const next = () => {
    if (step < tourSteps.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const handleAction = (page: string) => {
    if (page === 'chat') {
      onOpenChat?.();
    } else {
      onNavigate?.(page);
    }
    dismiss();
  };

  if (!visible) return null;

  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;

  return (
    <div
      className={`fixed bottom-28 md:bottom-10 left-4 md:left-auto md:right-24 z-50 w-[320px] transition-all duration-300 ${
        exiting ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
      }`}
      role="dialog"
      aria-label="Dashboard feature tour"
    >
      <div
        className="rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(12,12,24,0.97) 0%, rgba(8,8,16,0.99) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.04)',
        }}
      >
        {/* Progress bar */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((step + 1) / tourSteps.length) * 100}%`,
              background: `linear-gradient(90deg, ${current.color}, ${current.color}80)`,
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <div className="flex items-center gap-1.5">
            {tourSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className="transition-all duration-200"
                aria-label={`Go to step ${i + 1}`}
              >
                <div
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === step ? '16px' : '6px',
                    height: '6px',
                    backgroundColor: i === step ? current.color : i < step ? `${current.color}40` : 'rgba(255,255,255,0.15)',
                  }}
                />
              </button>
            ))}
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E8E8F0] hover:bg-white/8 transition-all"
            aria-label="Close tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 pt-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
            style={{
              background: `${current.color}12`,
              boxShadow: `0 0 0 1px ${current.color}25, 0 0 20px ${current.color}15`,
            }}
          >
            <current.icon className="w-5 h-5" style={{ color: current.color }} />
          </div>

          {/* Step counter */}
          <div className="text-[10px] font-mono mb-1.5" style={{ color: current.color }}>
            Step {step + 1} of {tourSteps.length}
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-[#E8E8F0] mb-2 leading-snug">{current.title}</h3>

          {/* Description */}
          <p className="text-xs text-[#9BA3C9] leading-relaxed mb-3">{current.description}</p>

          {/* Tip */}
          {current.tip && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/4 border border-white/6 mb-3">
              <Zap className="w-3 h-3 mt-0.5 flex-shrink-0 text-[#F59E0B]" />
              <span className="text-[11px] text-[#9BA3C9] leading-relaxed">{current.tip}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {current.action && (
              <button
                onClick={() => handleAction(current.action!.page)}
                className="w-full py-2 rounded-xl text-xs font-semibold text-[#05050A] transition-all hover:opacity-90 active:scale-98"
                style={{ backgroundColor: current.color }}
              >
                {current.action.label}
              </button>
            )}

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="flex-none px-3 py-2 rounded-xl text-xs text-[#6B7280] border border-white/8 hover:border-white/20 hover:text-[#E8E8F0] transition-all"
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-white/10 text-[#9BA3C9] hover:border-white/20 hover:text-[#E8E8F0] transition-all"
              >
                {isLast ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Got it!
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Call this to manually reset the tour (for testing or re-showing) */
export function resetDashboardTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}
