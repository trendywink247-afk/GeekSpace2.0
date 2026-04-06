// social-media/helpers.tsx
// Shared types, constants, and display utilities for the Social Media section
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import {
  CheckCircle, XCircle, Clock, Loader2, AlertCircle,
  Twitter, Linkedin, Instagram,
  CalendarDays, ChevronLeft, ChevronRight,
  Users, Megaphone, TrendingUp,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { SocialAccount, ContentPlanItem } from '@/services/api';

// ---- Status helpers ----

export const statusColors: Record<string, string> = {
  active: 'var(--ag-success)',
  paused: 'var(--ag-warning)',
  draft: 'var(--ag-text-muted)',
  scheduled: 'var(--ag-violet)',
  posting: 'var(--ag-warning)',
  posted: 'var(--ag-success)',
  failed: 'var(--ag-error)',
  completed: 'var(--ag-success)',
  cancelled: 'var(--ag-text-muted)',
};

export function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] || '#6B7280';
  return (
    <Badge variant="outline" className="text-xs border-current" style={{ color }}>
      {status}
    </Badge>
  );
}

export function StatusIcon({ status }: { status: string }) {
  const color = statusColors[status] || '#6B7280';
  switch (status) {
    case 'posted':
    case 'completed':
    case 'active':
      return <CheckCircle className="w-4 h-4" style={{ color }} />;
    case 'failed':
      return <XCircle className="w-4 h-4" style={{ color }} />;
    case 'posting':
      return <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />;
    case 'scheduled':
      return <Clock className="w-4 h-4" style={{ color }} />;
    default:
      return <AlertCircle className="w-4 h-4" style={{ color }} />;
  }
}

// ---- Tone & Platform types ----

export type Tone =
  | 'informative'
  | 'inspirational'
  | 'behind-the-scenes'
  | 'educational'
  | 'promotional'
  | 'casual';

export type Platform = 'twitter' | 'linkedin' | 'instagram';

export const TONES: { value: Tone; label: string }[] = [
  { value: 'informative', label: 'Informative' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'behind-the-scenes', label: 'Behind-the-scenes' },
  { value: 'educational', label: 'Educational' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'casual', label: 'Casual' },
];

export const PLATFORMS: { value: Platform; label: string; limit: number; color: string }[] = [
  { value: 'twitter', label: 'Twitter / X', limit: 280, color: 'var(--ag-blue)' },
  { value: 'linkedin', label: 'LinkedIn', limit: 3000, color: 'var(--ag-blue)' },
  { value: 'instagram', label: 'Instagram', limit: 2200, color: 'var(--ag-pink)' },
];

export function PlatformIcon({
  platform,
  className,
  style,
}: {
  platform: Platform;
  className?: string;
  style?: CSSProperties;
}) {
  switch (platform) {
    case 'twitter':
      return <Twitter className={className} style={style} />;
    case 'linkedin':
      return <Linkedin className={className} style={style} />;
    case 'instagram':
      return <Instagram className={className} style={style} />;
  }
}

// ---- Tone Selector Pills ----

export function TonePills({
  selected,
  onChange,
}: {
  selected: Tone;
  onChange: (t: Tone) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TONES.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium transition-[transform,background-color,color,box-shadow] active:scale-[0.96] ${
            selected === t.value
              ? 'bg-[var(--ag-violet)]/20 text-[var(--ag-violet)] border border-[var(--ag-violet)]/40 shadow-[0_0_8px_var(--ag-violet-glow)]'
              : 'bg-[var(--ag-bg-deep)] text-[var(--ag-text-muted)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-violet)]/20 hover:text-[var(--ag-text-primary)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---- Thread splitter utility ----

export function splitIntoThread(text: string): string[] {
  if (text.length <= 280) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const tweets: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    // Reserve space for "N/ " prefix (up to "99/ " = 4 chars)
    const maxLen = 280 - 4;
    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) tweets.push(current);
      if (trimmed.length > maxLen) {
        const words = trimmed.split(/\s+/);
        let chunk = '';
        for (const word of words) {
          if ((chunk + ' ' + word).trim().length <= maxLen) {
            chunk = (chunk + ' ' + word).trim();
          } else {
            if (chunk) tweets.push(chunk);
            chunk = word;
          }
        }
        if (chunk) current = chunk;
      } else {
        current = trimmed;
      }
    }
  }
  if (current) tweets.push(current);

  return tweets;
}

// ---- Stats Summary Bar ----

export function StatsSummary({
  accounts,
  items,
}: {
  accounts: SocialAccount[];
  items: ContentPlanItem[];
}) {
  const totalPosts = accounts.reduce((sum, a) => sum + a.posts_count, 0);
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const postsThisWeek = items.filter(
    (i) => i.posted_at && new Date(i.posted_at) >= weekAgo
  ).length;
  const scheduledCount = items.filter((i) => i.status === 'scheduled').length;

  const stats = [
    { label: 'Active Accounts', value: activeAccounts, icon: Users, color: 'var(--ag-success)' },
    { label: 'Total Posts', value: totalPosts, icon: Megaphone, color: 'var(--ag-violet)' },
    { label: 'This Week', value: postsThisWeek, icon: TrendingUp, color: 'var(--ag-warning)' },
    { label: 'Scheduled', value: scheduledCount, icon: Clock, color: 'var(--ag-violet)' },
  ];

  return (
    <BlurFade delay={0.1}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <SectionCard key={s.label} padding="sm">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}15` }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--ag-text-primary)] leading-none">
                  {s.value}
                </p>
                <p className="text-[10px] text-[var(--ag-text-muted)] mt-0.5">{s.label}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </BlurFade>
  );
}

// ---- Mini Calendar ----

export function MiniCalendar({ items }: { items: ContentPlanItem[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const dayCountMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      if (!item.scheduled_at) continue;
      const d = new Date(item.scheduled_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(d.getDate(), (map.get(d.getDate()) || 0) + 1);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, monthOffset]);

  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold font-heading text-[var(--ag-text-primary)]">
          <CalendarDays className="w-4 h-4 text-[var(--ag-violet)]" />
          Content Calendar
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 min-h-[44px] min-w-[44px]"
            onClick={() => setMonthOffset((o) => o - 1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-[var(--ag-text-muted)]" />
          </Button>
          <span className="text-xs text-[var(--ag-text-muted)] min-w-[120px] text-center">
            {monthLabel}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 min-h-[44px] min-w-[44px]"
            onClick={() => setMonthOffset((o) => o + 1)}
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4 text-[var(--ag-text-muted)]" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] text-[var(--ag-text-muted)] font-medium py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const count = dayCountMap.get(day) || 0;
          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
          return (
            <div
              key={day}
              className={`aspect-square rounded-md flex flex-col items-center justify-center text-[11px] relative transition-colors ${
                isToday
                  ? 'bg-[var(--ag-violet)]/10 border border-[var(--ag-violet)]/30 text-[var(--ag-violet)] font-bold'
                  : count > 0
                    ? 'bg-[var(--ag-success)]/5 text-[var(--ag-text-primary)]'
                    : 'text-[var(--ag-text-muted)]'
              }`}
            >
              {day}
              {count > 0 && (
                <span className="absolute bottom-0.5 text-[8px] font-bold text-[var(--ag-success)]">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[var(--ag-border-subtle)]">
        <span className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)]">
          <span className="w-2 h-2 rounded-sm bg-[var(--ag-violet)]/40" /> Today
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)]">
          <span className="w-2 h-2 rounded-sm bg-[var(--ag-success)]/40" /> Scheduled
        </span>
      </div>
    </SectionCard>
  );
}
