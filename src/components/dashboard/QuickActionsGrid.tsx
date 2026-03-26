import {
  MessageSquare,
  Sparkles,
  GitBranch,
  Bell,
  ArrowRight,
} from 'lucide-react';

interface QuickActionsGridProps {
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

const actions = [
  {
    label: 'Chat with Agent',
    desc: 'Ask anything, get instant help',
    icon: MessageSquare,
    color: '#00F0FF',
    bgColor: 'rgba(0,240,255,0.08)',
    borderColor: 'rgba(0,240,255,0.15)',
    page: 'chat',
    useChat: true,
  },
  {
    label: 'Creative Studio',
    desc: 'Images, video, design',
    icon: Sparkles,
    color: '#BF5FFF',
    bgColor: 'rgba(191,95,255,0.08)',
    borderColor: 'rgba(191,95,255,0.15)',
    page: 'creative-studio',
    useChat: false,
  },
  {
    label: 'New Workflow',
    desc: 'Automate repetitive tasks',
    icon: GitBranch,
    color: '#00FF88',
    bgColor: 'rgba(0,255,136,0.08)',
    borderColor: 'rgba(0,255,136,0.15)',
    page: 'workflows',
    useChat: false,
  },
  {
    label: 'Reminders',
    desc: 'Stay on track with alerts',
    icon: Bell,
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.15)',
    page: 'reminders',
    useChat: false,
  },
] as const;

export function QuickActionsGrid({ onNavigate, onOpenChat }: QuickActionsGridProps) {
  return (
    <section>
      <h2
        className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider mb-3"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              if (action.useChat) onOpenChat?.();
              else onNavigate?.(action.page);
            }}
            className="group relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] min-h-[120px]"
            style={{
              background: action.bgColor,
              borderColor: action.borderColor,
            }}
          >
            {/* Glow effect on hover */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                boxShadow: `0 0 24px ${action.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
              }}
            />
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${action.color}18` }}
            >
              <action.icon className="w-5 h-5" style={{ color: action.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#F4F6FF] group-hover:text-white transition-colors">
                {action.label}
              </div>
              <div className="text-xs text-[#8892A4] mt-0.5 leading-relaxed">
                {action.desc}
              </div>
            </div>
            <ArrowRight
              className="w-4 h-4 text-[#8892A4]/30 group-hover:text-[#8892A4]/70 transition-all group-hover:translate-x-0.5 absolute top-4 right-4"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
