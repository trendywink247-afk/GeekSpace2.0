// ─── Shared constants & pure utility functions ──────────────────────────────
import type { Reminder } from '@/types';

export const categoryHex: Record<string, string> = {
  personal: '#A78BFA',
  work:     '#10B981',
  health:   '#FF2D78',
  other:    '#F59E0B',
};

export const priorityConfig: Record<string, { label: string; color: string; hex: string; bg: string }> = {
  low:    { label: 'Low',    color: 'var(--ag-text-muted)', hex: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  normal: { label: 'Normal', color: 'var(--ag-cyan)',       hex: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  high:   { label: 'High',   color: 'var(--ag-amber)',      hex: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  urgent: { label: 'Urgent', color: 'var(--ag-pink)',       hex: '#FF2D78', bg: 'rgba(255,45,120,0.12)'  },
};

export const NL_EXAMPLES = [
  'Remind me tomorrow at 3pm to call mom',
  'Every Monday at 9am team standup',
  'In 2 hours take a break',
  'Daily at 8am drink water',
  'Next Tuesday submit report',
];

export const cardVariants = {
  hidden:  { opacity: 0, y: 8,  filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { type: 'spring' as const, duration: 0.35, bounce: 0 } },
  exit:    { opacity: 0, y: -4, filter: 'blur(2px)', transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const } },
};

export const listVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

export const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const groupHeaderAccent: Record<string, string> = {
  Overdue:      '#FF2D78',
  Today:        '#84CC16',
  Tomorrow:     '#A78BFA',
  'This Week':  '#6B7280',
  Later:        '#4B5563',
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

export function formatRelativeTime(datetime: string): string {
  const ms    = new Date(datetime).getTime() - Date.now();
  const abs   = Math.abs(ms);
  const mins  = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days  = Math.floor(abs / 86_400_000);
  const past  = ms < 0;
  if (abs < 60_000) return past ? 'just now' : 'in a moment';
  if (mins  < 60)   return past ? `${mins}m ago`  : `in ${mins}m`;
  if (hours < 24)   return past ? `${hours}h ago` : `in ${hours}h`;
  if (days  === 1)  return past ? 'yesterday'     : 'tomorrow';
  return past ? `${days}d ago` : `in ${days}d`;
}

export function humanDue(datetime: string): string {
  const d   = new Date(datetime);
  const now = new Date();
  const ms  = d.getTime() - now.getTime();
  if (ms < 0) {
    const abs   = Math.abs(ms);
    const hours = Math.floor(abs / 3_600_000);
    const days  = Math.floor(abs / 86_400_000);
    if (hours < 24) return `Overdue ${hours}h`;
    return `Overdue ${days}d`;
  }
  const todayEnd    = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  if (d <= todayEnd) return 'Today';
  const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  if (d <= tomorrowEnd) return 'Tomorrow';
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 7) return `in ${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(datetime: string) {
  const d = new Date(datetime);
  return {
    date:    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    time:    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    day:     d.getDate(),
    month:   d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

export function isOverdue(datetime: string, completed?: boolean | number): boolean {
  if (completed === true || completed === 1) return false;
  const t = new Date(datetime).getTime();
  if (isNaN(t)) return false;
  return t < Date.now();
}

export function isDueSoon(datetime: string, completed: boolean): boolean {
  if (completed) return false;
  const ms = new Date(datetime).getTime() - Date.now();
  return ms > 0 && ms <= 24 * 60 * 60 * 1000;
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

export function groupRemindersByCategory(reminders: Reminder[]) {
  const order = ['work', 'personal', 'health', 'other', 'general'];
  const map   = new Map<string, Reminder[]>();
  for (const r of reminders) {
    const cat = r.category ?? 'general';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(r);
  }
  return order
    .filter(cat => map.has(cat))
    .concat([...map.keys()].filter(k => !order.includes(k)))
    .map(cat => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), items: map.get(cat)! }));
}

export function groupRemindersByDate(reminders: Reminder[]) {
  const now           = Date.now();
  const todayEnd      = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const tomorrowStart = new Date(todayEnd); tomorrowStart.setDate(tomorrowStart.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd   = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999);
  const weekEnd       = new Date(todayEnd); weekEnd.setDate(weekEnd.getDate() + 7);
  const groups: { label: string; items: Reminder[] }[] = [
    { label: 'Overdue',   items: [] },
    { label: 'Today',     items: [] },
    { label: 'Tomorrow',  items: [] },
    { label: 'This Week', items: [] },
    { label: 'Later',     items: [] },
  ];
  for (const r of reminders) {
    const dueMs = new Date(r.datetime).getTime();
    if      (dueMs < now)                    groups[0].items.push(r);
    else if (dueMs <= todayEnd.getTime())    groups[1].items.push(r);
    else if (dueMs <= tomorrowEnd.getTime()) groups[2].items.push(r);
    else if (dueMs <= weekEnd.getTime())     groups[3].items.push(r);
    else                                     groups[4].items.push(r);
  }
  return groups.filter(g => g.items.length > 0);
}

export function sortRemindersByPriorityAndOverdue(reminders: Reminder[], sortMode: 'priority' | 'due'): Reminder[] {
  const now = Date.now();
  return [...reminders].sort((a, b) => {
    const aOver = !a.completed && new Date(a.datetime).getTime() < now;
    const bOver = !b.completed && new Date(b.datetime).getTime() < now;
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    if (sortMode === 'due') return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
    return (priorityOrder[a.priority ?? 'normal'] ?? 2) - (priorityOrder[b.priority ?? 'normal'] ?? 2);
  });
}
