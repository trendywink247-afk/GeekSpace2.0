// ============================================================
// Reminders module types
// ============================================================

/** Supported snooze presets. */
export type SnoozePreset = '1h' | 'tomorrow' | 'next-week';

/** Priority levels for a reminder. */
export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Reminder category tags. */
export type ReminderCategory = 'personal' | 'work' | 'health' | 'finance' | 'general';

/** Delivery channel for reminder notifications. */
export type ReminderChannel = 'push' | 'telegram' | 'email';

/**
 * Recurrence pattern string — either a named preset or a natural-language
 * rule handled by `computeNextOccurrence`.
 *
 * Named presets: daily, weekly, monthly, weekdays, biweekly
 * Interval:      "every N days"
 * Ordinal:       "every Nth weekday" (e.g. "2nd Tuesday")
 */
export type RecurrencePattern = string;

/** Row shape returned from the `reminders` SQLite table. */
export interface Reminder {
  id: string;
  user_id: string;
  text: string;
  datetime: string;
  channel: ReminderChannel;
  category: ReminderCategory;
  recurring: string;
  recurrence: RecurrencePattern | null;
  priority: ReminderPriority;
  completed: 0 | 1;
  completed_at: number | null;
  created_by: string;
  created_at: string;
  scheduled_for: number;
  snooze_until: number | null;
  snooze_count: number;
  remind_before_sent_at: number | null;
  pico_task_id: string | null;
}

/** Camel-cased shape returned by the GET /reminders endpoint. */
export interface ReminderResponse extends Reminder {
  createdBy: string;
  createdAt: string;
  userId: string;
  picoTaskId: string | null;
}

/** Body for POST /reminders. */
export interface CreateReminderBody {
  text: string;
  datetime?: string;
  channel?: ReminderChannel;
  category?: ReminderCategory;
  recurring?: string;
  recurrence?: RecurrencePattern;
  priority?: ReminderPriority;
}

/** Body for PATCH /reminders/:id. */
export interface UpdateReminderBody {
  text?: string;
  datetime?: string;
  channel?: ReminderChannel;
  category?: ReminderCategory;
  recurring?: string;
  completed?: boolean;
  priority?: ReminderPriority;
  recurrence?: RecurrencePattern;
}

/** Body for POST /reminders/:id/snooze. */
export interface SnoozeReminderBody {
  preset?: SnoozePreset;
  customDatetime?: string;
}

/** Body for DELETE /reminders/bulk. */
export interface BulkDeleteBody {
  ids: string[];
}
