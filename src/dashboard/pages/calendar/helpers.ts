// calendar/helpers.ts — shared types, constants, and utility functions
import { DateTime } from 'luxon';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarStatus {
  available: boolean;
  connected: boolean;
  email: string | null;
  lastSync: number | null;
}

export interface CalendarEvent {
  id: string | number;
  title: string;
  start_time: string | number;
  end_time?: string | number | null;
  category?: string;
  isLocal?: boolean;
}

export interface ReminderItem {
  id: string;
  text: string;
  datetime: string;
  category?: string;
  completed?: number | boolean;
}

export type EventCategory = "work" | "personal" | "health" | "social";

export interface LocalEvent {
  id: string;
  title: string;
  start_time: number;
  end_time: number | null;
  category: EventCategory;
  isLocal: true;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<
  EventCategory,
  { dot: string; bg: string; text: string; label: string }
> = {
  work:     { dot: 'var(--ag-violet)', bg: 'rgba(139,92,246,0.12)', text: 'var(--ag-violet)', label: 'Work'     },
  personal: { dot: 'var(--ag-cyan)',   bg: 'rgba(167,139,250,0.12)',text: 'var(--ag-cyan)',   label: 'Personal' },
  health:   { dot: 'var(--ag-green)',  bg: 'rgba(16,185,129,0.12)', text: 'var(--ag-green)',  label: 'Health'   },
  social:   { dot: 'var(--ag-pink)',   bg: 'rgba(255,45,120,0.12)', text: 'var(--ag-pink)',   label: 'Social'   },
};

export const REMINDER_COLOR   = 'var(--ag-amber)';
export const DAY_NAMES_SHORT  = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_NAMES_FULL   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Utility functions ─────────────────────────────────────────────────────────

export function toMs(t: string | number): number {
  if (typeof t === "number") return t;
  const n = Number(t);
  if (!isNaN(n) && n > 1e12) return n;
  return new Date(t).getTime();
}

export function formatTime(t: string | number): string {
  return DateTime.fromJSDate(new Date(toMs(t))).toLocaleString(DateTime.TIME_SIMPLE);
}

export function formatLastSync(ms: number): string {
  return DateTime.fromMillis(ms).toLocaleString(DateTime.DATETIME_MED);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function relativeCountdown(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return "past";
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "now";
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return `tomorrow ${DateTime.fromMillis(ms).toLocaleString(DateTime.TIME_SIMPLE)}`;
  if (days < 7)  return `in ${days} days`;
  return `in ${Math.floor(days / 7)}w`;
}

export function parseNaturalLanguage(input: string): {
  title: string;
  date: Date | null;
  durationMinutes: number;
} {
  let title = input;
  let date: Date | null = null;
  let durationMinutes = 60;

  const durMatch = input.match(/\bfor\s+(\d+)\s*(min|minute|minutes|hr|hour|hours|h|m)\b/i);
  if (durMatch) {
    const val  = parseInt(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    durationMinutes = unit.startsWith("h") ? val * 60 : val;
    title = title.replace(durMatch[0], "").trim();
  }

  const timeMatch = input.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  let hour = 0, minute = 0, hasTime = false;
  if (timeMatch) {
    hour   = parseInt(timeMatch[1]);
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    hasTime = true;
    title = title.replace(timeMatch[0], "").trim();
  }

  const today = new Date();
  if (/\btomorrow\b/i.test(input)) {
    date = new Date(today);
    date.setDate(date.getDate() + 1);
    title = title.replace(/\btomorrow\b/i, "").trim();
  } else if (/\btoday\b/i.test(input)) {
    date = new Date(today);
    title = title.replace(/\btoday\b/i, "").trim();
  } else {
    const nextDayMatch = input.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (nextDayMatch) {
      const targetDay  = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"].indexOf(nextDayMatch[1].toLowerCase());
      date             = new Date(today);
      let daysToAdd    = targetDay - date.getDay();
      if (daysToAdd <= 0) daysToAdd += 7;
      date.setDate(date.getDate() + daysToAdd);
      title = title.replace(nextDayMatch[0], "").trim();
    }
  }

  if (date && hasTime) date.setHours(hour, minute, 0, 0);
  else if (date)       date.setHours(9, 0, 0, 0);

  title = title.replace(/\s{2,}/g, " ").trim();
  return { title, date, durationMinutes };
}
