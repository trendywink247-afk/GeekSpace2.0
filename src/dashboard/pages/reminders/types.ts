// ─── Shared prop interfaces for Reminders sub-components ────────────────────
import type { ReminderChannel, ReminderCategory, ReminderPriority, Reminder } from '@/types';

export interface SnoozeHistoryEntry {
  id: string;
  snoozed_at: number;
  preset: string;
  new_datetime: string;
}

// ─── Form state for Add/Edit dialog ──────────────────────────────────────────

export interface NewReminderForm {
  text: string;
  datetime: string;
  channel: ReminderChannel;
  recurring: string;
  recurrence: 'daily' | 'weekly' | 'monthly' | '';
  category: ReminderCategory;
  priority: ReminderPriority;
}

// ─── State bag passed into ReminderCard ──────────────────────────────────────

export interface ReminderCardState {
  selectedActiveIds: Set<string>;
  selectedIds: Set<string>;
  completingIds: Set<string>;
  justCompletedIds: Set<string>;
  snoozeOpenId: string | null;
  snoozeCustomId: string | null;
  snoozeCustomValue: string;
  snoozeHistoryId: string | null;
  snoozeHistory: SnoozeHistoryEntry[];
  snoozeHistoryLoading: boolean;
  inlineEditId: string | null;
  inlineEditValue: string;
  duplicatingId: string | null;
}

// ─── Handlers bag passed into ReminderCard ───────────────────────────────────

export interface ReminderCardHandlers {
  onToggleSelectActive: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onComplete: (id: string) => Promise<void>;
  onSnooze: (id: string, preset: '1h' | 'tomorrow' | 'next-week') => Promise<void>;
  onSnoozeCustom: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onEditClick: (reminder: Reminder) => void;
  onDelete: (id: string) => Promise<void>;
  onSetSnoozeOpenId: (id: string | null) => void;
  onSetSnoozeCustomId: (id: string | null) => void;
  onSetSnoozeCustomValue: (v: string) => void;
  onSetInlineEditId: (id: string | null) => void;
  onSetInlineEditValue: (v: string) => void;
  onInlineEditSave: (id: string) => Promise<void>;
  onShowSnoozeHistory: (id: string) => Promise<void>;
  onUpdatePriority: (id: string, priority: ReminderPriority) => void;
}

// ─── Filter state/handlers for StatsBar ──────────────────────────────────────

export type FilterStatus     = 'all' | 'active' | 'completed';
export type FilterRecurrence = 'all' | 'recurring' | 'one-off';
export type FilterCategory   = 'all' | 'personal' | 'work' | 'health' | 'other';
export type FilterPriority   = 'all' | 'urgent' | 'high' | 'normal' | 'low';
export type SortMode         = 'priority' | 'due';
export type GroupMode        = 'date' | 'category';
export type ViewMode         = 'list' | 'calendar';

export interface StatsBarProps {
  activeCount: number;
  overdueCount: number;
  completedCount: number;
  streak: number;
  filter: FilterStatus;
  recurrenceFilter: FilterRecurrence;
  categoryFilter: FilterCategory;
  priorityFilter: FilterPriority;
  searchQuery: string;
  sortMode: SortMode;
  groupMode: GroupMode;
  viewMode: ViewMode;
  hasActiveFilters: boolean;
  onFilterChange: (v: FilterStatus) => void;
  onRecurrenceFilterChange: (v: FilterRecurrence) => void;
  onCategoryFilterChange: (v: FilterCategory) => void;
  onPriorityFilterChange: (v: FilterPriority) => void;
  onSearchQueryChange: (v: string) => void;
  onSortModeChange: (v: SortMode) => void;
  onGroupModeChange: (v: GroupMode) => void;
  onViewModeChange: (v: ViewMode) => void;
  onClearFilters: () => void;
  onExportCsv: () => void;
  onExportIcs: () => void;
}
