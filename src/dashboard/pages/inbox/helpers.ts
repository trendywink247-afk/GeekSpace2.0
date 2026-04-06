// inbox/helpers.ts — shared types, constants, animation variants, utility fns

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InboxMessage {
  id: number;
  source: string;
  sender: string | null;
  content: string;
  summary: string | null;
  priority: string;
  read: number;
  archived: number;
  suggested_reply: string | null;
  related_reminder_id: number | null;
  received_at: number;
}

export const FILTERS = ['all', 'unread', 'urgent', 'telegram', 'whatsapp', 'system'] as const;
export type Filter = (typeof FILTERS)[number];

// ─── Source / Priority pill maps ──────────────────────────────────────────────

export const SOURCE_LABELS: Record<string, string> = {
  telegram: 'TG',
  whatsapp: 'WA',
  system: 'SYS',
};

export const SOURCE_PILL: Record<string, string> = {
  telegram: 'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)]',
  whatsapp: 'bg-[var(--ag-green)]/10  text-[var(--ag-green)]',
  system:   'bg-[var(--ag-text-muted)]/10 text-[var(--ag-text-secondary)]',
};

export const PRIORITY_PILL: Record<string, string> = {
  urgent: 'bg-[var(--ag-pink)]/10  text-[var(--ag-pink)]',
  high:   'bg-[var(--ag-amber)]/10 text-[var(--ag-amber)]',
  normal: 'bg-[var(--ag-text-muted)]/8 text-[var(--ag-text-muted)]',
};

// ─── Shadow helpers (dark-mode pattern: white ring + depth) ──────────────────

export function cardShadow(priority: string, unread: boolean): string {
  const ring  = '0 0 0 1px rgba(255,255,255,0.06)';
  const depth = '0 1px 4px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)';
  const inset = 'inset 0 1px 0 rgba(255,255,255,0.04)';
  const glow  = unread ? ', var(--ag-glow-sm)' : '';
  const left  = priority === 'urgent' ? ', inset 3px 0 0 var(--ag-pink)'
              : priority === 'high'   ? ', inset 3px 0 0 var(--ag-amber)'
              : '';
  return `${ring}, ${depth}, ${inset}${left}${glow}`;
}

export function cardHoverShadow(priority: string, unread: boolean): string {
  const ring  = '0 0 0 1px rgba(255,255,255,0.10)';
  const depth = '0 4px 16px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.2)';
  const inset = 'inset 0 1px 0 rgba(255,255,255,0.06)';
  const glow  = unread ? ', var(--ag-glow-md)' : '';
  const left  = priority === 'urgent' ? ', inset 3px 0 0 var(--ag-pink)'
              : priority === 'high'   ? ', inset 3px 0 0 var(--ag-amber)'
              : '';
  return `${ring}, ${depth}, ${inset}${left}${glow}`;
}

// ─── Animation variants ───────────────────────────────────────────────────────

export const SPRING = { type: 'spring' as const, duration: 0.45, bounce: 0 };
export const FAST   = { duration: 0.18, ease: 'easeIn' as const };

export const FADE_UP = {
  hidden:  { opacity: 0, y: 14, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: SPRING },
  exit:    { opacity: 0, y: -8, scale: 0.97, filter: 'blur(4px)', transition: FAST },
};

export const EXPAND = {
  hidden:  { opacity: 0, height: 0,      filter: 'blur(4px)' },
  visible: { opacity: 1, height: 'auto', filter: 'blur(0px)', transition: { ...SPRING, duration: 0.3 } },
  exit:    { opacity: 0, height: 0,      filter: 'blur(4px)', transition: { duration: 0.2, ease: 'easeIn' as const } },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

import { timeAgo as luxonTimeAgo } from '@/utils/dateFormat';

export function formatTime(ms: number): string {
  return luxonTimeAgo(new Date(ms));
}

export function priorityWeight(p: string): number {
  return p === 'urgent' ? 0 : p === 'high' ? 1 : 2;
}
