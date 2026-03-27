// ============================================================
// Focus module types
// ============================================================

// ---- Focus sessions ----

/** A focus session record. */
export interface FocusSession {
  id: string;
  user_id: string;
  goal?: string;
  duration_min?: number;
  started_at: string;
  ended_at?: string;
  completed: boolean;
}

/** Aggregate summary of a user's focus history. */
export interface FocusSummary {
  total_sessions: number;
  completed_sessions: number;
  total_minutes: number;
  average_duration_min: number;
}

/** A message deferred while the user was in focus mode. */
export interface DeferredMessage {
  id: string;
  user_id: string;
  content: string;
  source: string;
  received_at: string;
}

/** User notification / DND settings for focus mode. */
export interface NotificationSettings {
  dnd_start?: string;
  dnd_end?: string;
  urgent_bypass: boolean;
  batch_interval_min: number;
  focus_mode_active: boolean;
}

/** Body for POST /api/focus/start. */
export interface StartFocusBody {
  goal?: string;
  /** Duration in minutes (1-480). */
  durationMin?: number;
}

/** Body for POST /api/focus/end. */
export interface EndFocusBody {
  completed?: boolean;
}

/** Partial update payload for PATCH /api/focus/settings. */
export interface NotificationSettingsUpdate {
  dnd_start?: string;
  dnd_end?: string;
  urgent_bypass?: boolean;
  batch_interval_min?: number;
  focus_mode_active?: boolean;
}

// ---- Habits ----

/** Supported habit frequencies. */
export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'weekdays';

/** A habit record. */
export interface Habit {
  id: number;
  user_id: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  target_time?: string;
  icon?: string;
  current_streak: number;
  created_at: string;
}

/** A single habit log entry. */
export interface HabitLog {
  id: number;
  habit_id: number;
  user_id: string;
  note?: string;
  logged_at: string;
}

/** Aggregate statistics for a habit. */
export interface HabitStats {
  habit_id: number;
  total_logs: number;
  current_streak: number;
  longest_streak: number;
  completion_rate: number;
}

/** Body for POST /api/habits. */
export interface CreateHabitBody {
  name: string;
  description?: string;
  frequency?: HabitFrequency;
  targetTime?: string;
  icon?: string;
}

/** Body for POST /api/habits/:id/log. */
export interface LogHabitBody {
  note?: string;
}
