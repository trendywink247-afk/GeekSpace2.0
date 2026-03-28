import { useState, useEffect } from 'react';
import { Bell, CalendarCheck, Target, Sparkles, Image as ImageIcon, Mic, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { BlurFade } from '@/components/magicui/blur-fade';

interface Suggestion {
  id: string;
  label: string;
  page: string;
  icon: LucideIcon;
  badge?: string;
  agentColor?: string;
}

interface SmartSuggestionsProps {
  onNavigate: (page: string) => void;
}

export function SmartSuggestions({ onNavigate }: SmartSuggestionsProps) {
  const reminders = useDashboardStore(s => s.reminders);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const items: Suggestion[] = [];
    const now = Date.now();

    // 1. Reminders due
    const dueCount = reminders.filter(r => !r.completed && new Date(r.datetime).getTime() <= now).length;
    if (dueCount > 0) {
      items.push({
        id: 'reminders-due',
        label: `${dueCount} reminder${dueCount > 1 ? 's' : ''} due`,
        page: 'reminders',
        icon: Bell,
        badge: `${dueCount}`,
        agentColor: '#F59E0B',
      });
    }

    // 2. Time-based suggestions
    const hour = new Date().getHours();
    if (hour < 10) {
      items.push({
        id: 'morning-calendar',
        label: 'Check your calendar',
        page: 'calendar',
        icon: CalendarCheck,
        agentColor: '#84CC16',
      });
    } else if (hour >= 21) {
      items.push({
        id: 'evening-review',
        label: 'Review today\'s activity',
        page: 'activity',
        icon: Target,
        agentColor: '#8B5CF6',
      });
    }

    // 3. Feature discovery (rotate daily)
    const discoveryFeatures = [
      { id: 'discover-creative', label: 'Try Creative Studio', page: 'creative-studio', icon: ImageIcon, agentColor: '#FF6B9D' },
      { id: 'discover-voice', label: 'Try Voice Chat', page: 'voice', icon: Mic, agentColor: '#00F0FF' },
      { id: 'discover-docs', label: 'Try Docs Workspace', page: 'docs', icon: FileText, agentColor: '#10B981' },
      { id: 'discover-focus', label: 'Track your habits', page: 'focus', icon: Target, agentColor: '#F59E0B' },
    ];
    const dayIndex = Math.floor(Date.now() / 86400000) % discoveryFeatures.length;
    // Only show if user hasn't visited (check localStorage)
    let visited: string[] = [];
    try { visited = JSON.parse(localStorage.getItem('agentin_visited_pages') || '[]'); } catch { /* private browsing */ }
    const discovery = discoveryFeatures[dayIndex];
    if (!visited.includes(discovery.page)) {
      items.push(discovery);
    }

    setSuggestions(items.slice(0, 3));
  }, [reminders]);

  if (suggestions.length === 0) return null;

  return (
    <BlurFade delay={0.2}>
      <div className="px-3 pt-2 pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ag-text-muted,#6B7280)] px-2 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Suggested
        </div>
        <div className="space-y-0.5">
          {suggestions.map(s => (
            <button
              key={s.id}
              onClick={() => onNavigate(s.page)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-200 hover:bg-[var(--ag-bg-surface-hover,rgba(20,20,40,0.8))] group"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-[1.02]"
                style={{
                  background: `${s.agentColor}15`,
                  border: `1px solid ${s.agentColor}30`,
                }}
              >
                <s.icon className="w-3.5 h-3.5" style={{ color: s.agentColor }} />
              </div>
              <span className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] group-hover:text-[var(--ag-text-primary,#F4F6FF)] flex-1 truncate">
                {s.label}
              </span>
              {s.badge && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${s.agentColor}20`,
                    color: s.agentColor,
                    boxShadow: `0 0 6px ${s.agentColor}40`,
                  }}
                >
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="h-px bg-[var(--ag-border-subtle,rgba(139,92,246,0.08))] mx-2 mt-2" />
      </div>
    </BlurFade>
  );
}
