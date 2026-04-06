import type React from 'react';

// ---------------------------------------------------------------------------
// Overview helpers — pure functions, no React deps
// ---------------------------------------------------------------------------

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Detect Indian festivals and notable holidays (approximate fixed dates, 2026 calendar) */
export function getFestivalGreeting(): string | null {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  if (month === 1 && day === 1) return 'Happy New Year!';
  if (month === 1 && day === 14) return 'Happy Makar Sankranti / Pongal!';
  if (month === 1 && day === 26) return 'Happy Republic Day!';
  if (month === 3 && day >= 9 && day <= 11) return 'Happy Maha Shivaratri!';
  if (month === 3 && day >= 14 && day <= 16) return 'Happy Holi!';
  if (month === 4 && day === 2) return 'Happy Ugadi / Gudi Padwa!';
  if (month === 4 && day === 6) return 'Happy Ram Navami!';
  if (month === 4 && day === 14) return 'Happy Baisakhi!';
  if (month === 5 && day === 1) return 'Happy May Day!';
  if (month === 5 && day === 12) return 'Happy Buddha Purnima!';
  if (month === 6 && day >= 26 && day <= 28) return 'Happy Eid al-Adha!';
  if (month === 7 && day >= 17 && day <= 19) return 'Happy Muharram!';
  if (month === 8 && day === 12) return 'Happy Raksha Bandhan!';
  if (month === 8 && day === 14) return 'Happy Janmashtami!';
  if (month === 8 && day === 15) return 'Happy Independence Day!';
  if (month === 8 && day >= 22 && day <= 31) return 'Happy Ganesh Chaturthi!';
  if (month === 9 && day >= 17 && day <= 26) return 'Happy Navratri!';
  if (month === 10 && day >= 2 && day <= 3) return 'Happy Dussehra!';
  if (month === 10 && day >= 20 && day <= 22) return 'Happy Diwali!';
  if (month === 10 && day === 23) return 'Happy Bhai Dooj!';
  if (month === 11 && day >= 1 && day <= 3) return 'Happy Diwali!';
  if (month === 11 && day >= 12 && day <= 15) return 'Happy Chhath Puja!';
  if (month === 11 && day === 24) return 'Happy Guru Nanak Jayanti!';
  if (month === 12 && day === 25) return 'Merry Christmas!';
  if (month === 12 && day === 31) return 'Happy New Year Eve!';
  return null;
}

/** Calculate estimated hours saved by AI: each message interaction saves ~2 minutes on avg */
export function computeTimeSaved(totalMessages: number): { hours: number; minutes: number } {
  const totalMinutes = totalMessages * 2;
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** Check if user account is less than 7 days old */
export function isNewUser(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}

export function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface OverviewReminder {
  id: string;
  text: string;
  datetime: string;
  category: string;
  recurring: string;
  priority: string;
  overdue: boolean;
}

export interface OverviewHabit {
  id: number;
  name: string;
  icon: string;
  streak: number;
  loggedToday: boolean;
}

export interface OverviewCalendarEvent {
  id: number;
  title: string;
  start_time: number;
  end_time: number | null;
}

export interface OverviewWeeklyStats {
  messagesThisWeek: number;
  remindersCompleted: number;
  habitsLogged: number;
}

export interface OverviewRecentConversation {
  id: string;
  content: string;
  created_at: string;
}

export interface OverviewData {
  greeting: string;
  remindersDueToday: OverviewReminder[];
  habitsToday: OverviewHabit[];
  calendarEventsToday: OverviewCalendarEvent[];
  weeklyStats: OverviewWeeklyStats;
  recentConversations: OverviewRecentConversation[];
}

export interface GlanceCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bgColor: string;
}

// ---------------------------------------------------------------------------
// iOS Install Banner helpers
// ---------------------------------------------------------------------------

export const IOS_DISMISS_KEY = 'ios-install-dismissed-at';
const IOS_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowIOSBanner(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari =
    /Safari/i.test(navigator.userAgent) &&
    !/Chrome|CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!isIOS || !isSafari || isStandalone) return false;

  const dismissedAt = localStorage.getItem(IOS_DISMISS_KEY);
  if (dismissedAt) {
    const elapsed = Date.now() - parseInt(dismissedAt, 10);
    if (elapsed < IOS_DISMISS_TTL_MS) return false;
  }
  return true;
}
