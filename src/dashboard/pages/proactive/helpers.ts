// helpers.ts — shared types, constants, and utilities for the Proactive page
import { AlertTriangle, CalendarClock, TrendingUp, Lightbulb, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---- Types ---------------------------------------------------------------

export interface ProactiveMessage {
  id: number;
  type: string;
  sent_at: number;
  message: string;
}

export interface ProactiveSettings {
  enabled: boolean;
}

export interface FeedbackRecord {
  messageId: number;
  helpful: boolean;
}

export type MessageCategory = "urgent" | "upcoming" | "insights" | "suggestions" | "celebrations";

export type AutonomyLevel = "manual" | "assisted" | "proactive" | "autonomous";

export interface QuietHours {
  start: string; // "22:00"
  end: string;   // "07:00"
}

export interface TypeToggles {
  reminders: boolean;
  insights: boolean;
  suggestions: boolean;
  celebrations: boolean;
}

export interface PlannedMessage {
  time: string;
  label: string;
  type: MessageCategory;
}

// ---- Category config -----------------------------------------------------

export const CATEGORY_CONFIG: Record<MessageCategory, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
}> = {
  urgent: {
    label: "Urgent",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
  },
  upcoming: {
    label: "Upcoming",
    color: "text-[var(--ag-violet)]",
    bgColor: "bg-[var(--ag-violet)]/10",
    borderColor: "border-[var(--ag-violet)]/20",
    icon: CalendarClock,
  },
  insights: {
    label: "Insights",
    color: "text-[var(--ag-green)]",
    bgColor: "bg-[var(--ag-green)]/10",
    borderColor: "border-[var(--ag-green)]/20",
    icon: TrendingUp,
  },
  suggestions: {
    label: "Suggestions",
    color: "text-[var(--ag-violet)]",
    bgColor: "bg-[var(--ag-violet)]/10",
    borderColor: "border-[var(--ag-violet)]/20",
    icon: Lightbulb,
  },
  celebrations: {
    label: "Celebrations",
    color: "text-[var(--ag-amber)]",
    bgColor: "bg-[var(--ag-amber)]/10",
    borderColor: "border-[var(--ag-amber)]/20",
    icon: Trophy,
  },
};

// ---- Type helpers --------------------------------------------------------

export function categorize(type: string): MessageCategory {
  if (type === "overdue_alert" || type === "expense_spike") return "urgent";
  if (type === "daily_briefing") return "upcoming";
  if (type === "weekly_report") return "insights";
  if (type === "idle_check_in") return "suggestions";
  if (type === "streak_milestone") return "celebrations";
  // Fallback heuristics
  if (type.includes("alert") || type.includes("overdue")) return "urgent";
  if (type.includes("streak") || type.includes("milestone") || type.includes("celebrate")) return "celebrations";
  if (type.includes("insight") || type.includes("report") || type.includes("digest")) return "insights";
  if (type.includes("suggest") || type.includes("nudge") || type.includes("check")) return "suggestions";
  return "upcoming";
}

export const BACKEND_TYPE_LABEL: Record<string, string> = {
  daily_briefing: "Daily Briefing",
  overdue_alert: "Overdue Alert",
  idle_check_in: "Idle Check-in",
  weekly_report: "Weekly Report",
  streak_milestone: "Streak Milestone",
  expense_spike: "Expense Spike",
};

// ---- Date formatting -----------------------------------------------------

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(navigator.language, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ms);
}

// ---- Local-storage persistence -------------------------------------------

const STORAGE_PREFIX = "proactive_";

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

export function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch { /* ignore */ }
}
