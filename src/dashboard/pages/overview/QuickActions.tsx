import { Bell, MessageSquare, Timer, Target, FileText } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';

interface QuickActionsProps {
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
  onNotifyStart?: (name: string) => void;
}

export function QuickActions({ onNavigate, onOpenChat, onNotifyStart }: QuickActionsProps) {
  const actions = [
    {
      label: 'New Reminder',
      icon: Bell,
      color: 'var(--ag-cyan)',
      bgColor: 'rgba(139,92,246,0.1)',
      action: () => onNavigate?.('reminders?openAdd=true'),
    },
    {
      label: 'Chat with Weebo',
      icon: MessageSquare,
      color: '#ADFF2F',
      bgColor: 'rgba(173,255,47,0.1)',
      action: () => {
        onNotifyStart?.('open-chat');
        onOpenChat?.();
      },
    },
    {
      label: 'Start Focus',
      icon: Timer,
      color: 'var(--ag-violet)',
      bgColor: 'rgba(139,92,246,0.1)',
      action: () => onNavigate?.('focus'),
    },
    {
      label: 'Log Habit',
      icon: Target,
      color: '#FF2D78',
      bgColor: 'rgba(255,45,120,0.1)',
      action: () => onNavigate?.('reminders'),
    },
    {
      label: 'New Note',
      icon: FileText,
      color: '#FFB800',
      bgColor: 'rgba(255,184,0,0.1)',
      action: () => onNavigate?.('docs'),
    },
  ];

  return (
    <BlurFade delay={0.40}>
      <section>
        <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider mb-3 font-heading">
          Quick actions
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.action}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium text-[var(--ag-text-primary)] whitespace-nowrap snap-start transition-all hover:scale-[1.03] active:scale-95 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50"
              style={{
                background: action.bgColor,
                borderColor: `${action.color}20`,
              }}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: action.bgColor }}
              >
                <action.icon className="w-3.5 h-3.5" style={{ color: action.color }} />
              </div>
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </BlurFade>
  );
}
