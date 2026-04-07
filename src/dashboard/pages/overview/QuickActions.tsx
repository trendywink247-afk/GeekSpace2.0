/**
 * QuickActions — horizontally scrollable tappable action tiles.
 *
 * Landing-page aesthetic:
 * - Glass cards with icon in violet/accent circle
 * - Hover lifts card
 * - Mono uppercase eyebrow above row
 * - Scrolls on mobile, wraps on md:+
 */

import { Bell, MessageSquare, Timer, Target, FileText } from 'lucide-react';
import { MobileSection } from '@/components/mobile';

interface QuickActionsProps {
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
  onNotifyStart?: (name: string) => void;
}

const ACTIONS = [
  {
    label: 'New Reminder',
    icon: Bell,
    color: 'var(--ag-cyan)',
    bg: 'rgba(167,139,250,0.12)',
    action: (nav?: (p: string) => void) => nav?.('reminders?openAdd=true'),
  },
  {
    label: 'Chat with Weebo',
    icon: MessageSquare,
    color: '#ADFF2F',
    bg: 'rgba(173,255,47,0.1)',
    action: (_nav?: (p: string) => void, chat?: () => void) => chat?.(),
  },
  {
    label: 'Start Focus',
    icon: Timer,
    color: 'var(--ag-violet)',
    bg: 'rgba(139,92,246,0.12)',
    action: (nav?: (p: string) => void) => nav?.('focus'),
  },
  {
    label: 'Log Habit',
    icon: Target,
    color: 'var(--ag-pink)',
    bg: 'rgba(255,45,120,0.1)',
    action: (nav?: (p: string) => void) => nav?.('reminders'),
  },
  {
    label: 'New Note',
    icon: FileText,
    color: 'var(--ag-amber)',
    bg: 'rgba(245,158,11,0.1)',
    action: (nav?: (p: string) => void) => nav?.('docs'),
  },
];

export function QuickActions({
  onNavigate,
  onOpenChat,
  onNotifyStart,
}: QuickActionsProps) {
  return (
    <MobileSection noPadding className="pt-5">
      {/* Mono eyebrow */}
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]/60 px-4 mb-3">
        Quick Actions
      </p>

      {/* Horizontally scrollable strip */}
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-none">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              if (action.label === 'Chat with Weebo') {
                onNotifyStart?.('open-chat');
              }
              action.action(onNavigate, onOpenChat);
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm whitespace-nowrap snap-start text-sm font-medium text-[var(--ag-text-primary)] transition-all duration-150 hover:bg-white/[0.05] hover:border-white/[0.12] hover:-translate-y-0.5 active:scale-95 active:translate-y-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40 shrink-0"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: action.bg }}
              aria-hidden
            >
              <action.icon className="w-3.5 h-3.5" style={{ color: action.color }} aria-hidden />
            </span>
            {action.label}
          </button>
        ))}
      </div>
    </MobileSection>
  );
}
