// ============================================================
// Planner — shared types, constants, and pure utility functions
// ============================================================

import { DateTime } from 'luxon';
import type { PlannerBlock } from '@/services/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TimeBlock {
  id: string;
  title: string;
  startHour: number;  // 6–23, decimal for sub-hour (e.g. 6.5 = 6:30)
  duration: number;    // hours (0.25, 0.5, 1, 2)
  type: 'reminder' | 'habit' | 'custom';
  color: string;
  reminderId?: string;
  habitId?: number;
}

export interface HabitItem {
  id: number;
  name: string;
  icon: string;
  description: string | null;
  frequency: string;
  current_streak: number;
  longest_streak: number;
  logged_today: boolean;
}

export interface BacklogItem {
  id: string;
  title: string;
  type: 'reminder' | 'habit';
  priority?: string;
  icon: 'bell' | 'flame';
  sourceId: string | number;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM – 11 PM

export const LS_KEY = 'agentin:planner:blocks';

export const DURATION_OPTIONS = [
  { label: '15m', value: 0.25 },
  { label: '30m', value: 0.5 },
  { label: '1h', value: 1 },
  { label: '2h', value: 2 },
];

export const TYPE_COLORS: Record<string, string> = {
  reminder: '#A78BFA',
  habit: '#22C55E',
  custom: '#8B5CF6',
};

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  normal: '#A78BFA',
  low: '#6B7280',
};

// ── Utility Functions ──────────────────────────────────────────────────────

export function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${min.toString().padStart(2, '0')} ${ampm}`;
}

export function formatDate(d: Date): string {
  return DateTime.fromJSDate(d).toLocaleString({
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return dateKey(d1) === dateKey(d2);
}

// ── API ↔ Local conversion ──────────────────────────────────────────────────

export function apiBlockToLocal(b: PlannerBlock): TimeBlock {
  const startHour = b.sort_order > 0 ? b.sort_order / 100 : 9;
  const category = b.category as TimeBlock['type'];
  const type = (['reminder', 'habit', 'custom'].includes(category)) ? category : 'custom';
  return {
    id: b.id,
    title: b.title,
    startHour,
    duration: b.duration / 60,
    type,
    color: b.color,
    reminderId: b.source === 'reminder' ? (b.source_id ?? undefined) : undefined,
    habitId: b.source === 'habit' && b.source_id ? Number(b.source_id) : undefined,
  };
}

export function localBlockToApi(b: TimeBlock, date: string): {
  title: string; date: string; duration: number; color: string;
  category: string; sort_order: number; source: string; source_id?: string;
} {
  return {
    title: b.title,
    date,
    duration: Math.round(b.duration * 60),
    color: b.color,
    category: b.type,
    sort_order: Math.round(b.startHour * 100),
    source: b.reminderId ? 'reminder' : b.habitId ? 'habit' : 'manual',
    source_id: b.reminderId ?? (b.habitId ? String(b.habitId) : undefined),
  };
}

export function generateId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
