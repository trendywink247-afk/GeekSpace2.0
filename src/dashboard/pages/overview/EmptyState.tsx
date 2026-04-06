import { Sparkles, Send, Bell, Link2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

export function EmptyState({ onNavigate, onOpenChat }: EmptyStateProps) {
  return (
    <Card className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(173,255,47,0.1))' }}
          >
            <Sparkles className="w-6 h-6 text-[var(--ag-cyan)]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--ag-text-primary)] font-heading">
              Welcome to Agentin!
            </h3>
            <p className="text-sm text-[var(--ag-text-secondary)] mt-1 leading-relaxed">
              Start by chatting with Weebo, setting a reminder, or connecting Telegram.
              Your dashboard will light up as you go.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onOpenChat?.()}
            className="flex items-center gap-3 p-3 rounded-xl border-0 transition-all hover:scale-[1.02] active:scale-95 min-h-[44px] bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white hover:opacity-90"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--ag-jarvis)]/10 flex-shrink-0">
              <Send className="w-4 h-4 text-[var(--ag-jarvis)]" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-white">Chat with Weebo</div>
              <div className="text-xs text-white/80">Ask anything</div>
            </div>
          </button>
          <button
            onClick={() => onNavigate?.('reminders?openAdd=true')}
            className="flex items-center gap-3 p-3 rounded-xl border border-[var(--ag-border-default)] transition-all hover:border-[var(--ag-border-glow)] hover:scale-[1.02] active:scale-95 min-h-[44px]"
            style={{ background: 'rgba(139,92,246,0.06)' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--ag-cyan)]/10 flex-shrink-0">
              <Bell className="w-4 h-4 text-[var(--ag-cyan)]" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-[var(--ag-text-primary)]">Set a Reminder</div>
              <div className="text-xs text-[var(--ag-text-secondary)]">Stay on track</div>
            </div>
          </button>
          <button
            onClick={() => onNavigate?.('connections')}
            className="flex items-center gap-3 p-3 rounded-xl border border-[var(--ag-violet)]/15 transition-all hover:border-[var(--ag-violet)]/30 hover:scale-[1.02] active:scale-95 min-h-[44px]"
            style={{ background: 'rgba(139,92,246,0.06)' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--ag-violet)]/10 flex-shrink-0">
              <Link2 className="w-4 h-4 text-[var(--ag-violet)]" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-[var(--ag-text-primary)]">Connect Telegram</div>
              <div className="text-xs text-[var(--ag-text-secondary)]">Chat on the go</div>
            </div>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
