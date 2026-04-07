/**
 * @fileoverview Proactive Suggestions Engine — context-aware agent insights.
 *
 * Analyzes polled API data to surface timely, actionable suggestions attributed
 * to specific agent personalities. Pure TypeScript, no side effects, no AI inference cost.
 *
 * **Suggestion sources:**
 * - Cal: Reminders due today (priority 1)
 * - Aria: Unread messages (priority 2)
 * - Pulse: Productivity streaks & activity milestones (priority 3)
 * - Jarvis: Time-based greetings (e.g., morning check-ins) (priority 3)
 *
 * **Lifecycle:**
 * 1. Called by OfficePage every 5-10 seconds
 * 2. Fetches data from `/api/reminders`, `/api/inbox/count`, `/api/activity`, `/api/habits`
 * 3. Generates suggestions matching agents to data (e.g., Cal for reminders)
 * 4. Returns array sorted by priority (1=highest first)
 * 5. Displayed in InsightToast for 5-minute window
 *
 * **Performance:** ~50–100ms per cycle (3 parallel fetches + suggestion generation)
 *
 * @example
 * ```typescript
 * const suggestions = await generateSuggestions();
 * suggestions.forEach(s => {
 *   console.log(`${s.agentId}: ${s.text} (priority ${s.priority})`);
 * });
 * ```
 */

import type { AgentId } from './entities/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A proactive suggestion surfaced by an agent based on real data.
 *
 * Suggestions are ephemeral — each expires after 5 minutes and are regenerated
 * on the next poll cycle. This prevents stale suggestions and keeps the UI fresh.
 *
 * @property id - Unique identifier for deduplication (format: `{agentId}-{type}-{timestamp}`)
 * @property agentId - The agent "speaking" this suggestion (determines icon, color, tone)
 * @property text - Suggestion text (e.g., "3 reminders due today")
 * @property actionLink - Optional deep-link (e.g., '/dashboard/reminders') for user to act on
 * @property priority - Urgency level (1=high, 2=medium, 3=low); sorted ascending
 * @property expiresAt - Absolute timestamp (ms) when this suggestion should be removed
 */
export interface ProactiveSuggestion {
  id: string;
  agentId: AgentId;
  /** Display name of the agent (e.g., "Cal", "Aria"). */
  agentName: string;
  text: string;
  actionLink?: string;
  /** Structured action: label for the button text + href for navigation. */
  action?: { label: string; href: string };
  priority: 1 | 2 | 3;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Resolves the API base URL from Vite environment or current domain.
 *
 * **Behavior:**
 * - Development: `http://localhost:3001`
 * - Production: empty string (use current domain)
 * - Can be overridden via `VITE_API_URL` environment variable
 *
 * @returns API base URL ending in `/api` (e.g., 'http://localhost:3001/api' or '/api')
 * @example
 * ```typescript
 * const url = `${apiBase()}/reminders`;
 * // Dev: 'http://localhost:3001/api/reminders'
 * // Prod: '/api/reminders'
 * ```
 */
function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
}

/**
 * Retrieves authentication token from localStorage or sessionStorage.
 *
 * **Lookup order:**
 * 1. `localStorage.getItem('gs_token')` — Agentin token
 * 2. `localStorage.getItem('token')` — Generic localStorage token
 * 3. `sessionStorage.getItem('token')` — Session token
 *
 * This flexibility supports multiple authentication methods (OAuth, JWT, etc).
 *
 * @returns JWT token string, or null if no token found
 * @example
 * ```typescript
 * const token = getToken();
 * if (!token) {
 *   console.warn('Not authenticated — cannot fetch suggestions');
 * }
 * ```
 */
function getToken(): string | null {
  return (
    localStorage.getItem('gs_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token')
  );
}

/**
 * Safely fetches JSON from an API endpoint with authentication.
 *
 * **Behavior:**
 * - Appends `Authorization: Bearer ${token}` header
 * - Returns parsed JSON on 2xx responses
 * - Returns null on 4xx/5xx errors (silent failure)
 * - Returns null if no authentication token available
 * - Returns null on network errors (exceptions caught)
 *
 * **Usage:** Prefer this over `fetch()` for API calls that may fail gracefully.
 *
 * @template T - Expected response type (auto-inferred from context)
 * @param path - API path (e.g., '/api/reminders')
 * @returns Parsed JSON response on success, or null on any error
 *
 * @example
 * ```typescript
 * const reminders = await safeFetch<ReminderData>('/api/reminders');
 * if (reminders) {
 *   console.log(`${reminders.count} reminders`);
 * } else {
 *   console.warn('Could not fetch reminders');
 * }
 * ```
 */
async function safeFetch<T>(path: string): Promise<T | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Suggestion generators
// ---------------------------------------------------------------------------

interface ReminderData {
  reminders?: Array<{ due_at?: string; title?: string }>;
  count?: number;
}

interface InboxData {
  unread?: number;
  total?: number;
}

interface ActivityData {
  activity?: Array<{ created_at?: string }>;
  total?: number;
}

/**
 * Fetches data from available API endpoints and generates contextual suggestions.
 * Each suggestion is attributed to the most relevant agent personality.
 *
 * Suggestions are ephemeral — they expire after 5 minutes and are regenerated
 * on the next poll cycle.
 *
 * @returns Array of proactive suggestions, sorted by priority (1=high first)
 */
interface HabitData {
  habits?: Array<{ name?: string; current_streak?: number; logged_today?: boolean }>;
}

interface GoalData {
  goals?: Array<{ title?: string; status?: string; progress?: number }>;
  stats?: { active?: number; completionRate?: number };
}

interface WorkspaceData {
  artifacts?: Array<{ title?: string; type?: string; created_at?: string; status?: string }>;
}

export async function generateSuggestions(): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];
  const now = Date.now();
  const expiry = now + 15 * 60 * 1000; // 15 minute TTL

  // Fetch data in parallel from available endpoints
  const [reminders, inbox, activity, habits, goals, workspace] = await Promise.all([
    safeFetch<ReminderData>('/reminders'),
    safeFetch<InboxData>('/inbox/count'),
    safeFetch<ActivityData>('/activity'),
    safeFetch<HabitData>('/habits'),
    safeFetch<GoalData>('/agent/goals?status=active'),
    safeFetch<WorkspaceData>('/agent/workspace?limit=5'),
  ]);

  // Cal: Reminder suggestions
  if (reminders) {
    const dueToday = reminders.reminders?.filter(r => {
      if (!r.due_at) return false;
      const due = new Date(r.due_at);
      const today = new Date();
      return due.toDateString() === today.toDateString();
    }) ?? [];
    const count = dueToday.length || reminders.count || 0;
    if (count > 0) {
      suggestions.push({
        id: `cal-reminders-${now}`,
        agentId: 'cal',
        agentName: 'Cal',
        text: `${count} reminder${count !== 1 ? 's' : ''} due today`,
        actionLink: '/dashboard/reminders',
        action: { label: 'View Reminders', href: '/dashboard/reminders' },
        priority: 1,
        expiresAt: expiry,
      });
    }
  }

  // Aria: Inbox suggestions
  if (inbox && (inbox.unread ?? 0) > 0) {
    suggestions.push({
      id: `aria-inbox-${now}`,
      agentId: 'aria',
      agentName: 'Aria',
      text: `${inbox.unread} unread message${inbox.unread !== 1 ? 's' : ''} waiting`,
      actionLink: '/dashboard/chat',
      action: { label: 'Open Chat', href: '/dashboard/chat' },
      priority: 2,
      expiresAt: expiry,
    });
  }

  // Pulse: Activity/productivity suggestions
  if (activity?.activity) {
    const todayStr = new Date().toDateString();
    const todayCount = activity.activity.filter(a =>
      a.created_at && new Date(a.created_at).toDateString() === todayStr
    ).length;
    if (todayCount > 10) {
      suggestions.push({
        id: `pulse-productivity-${now}`,
        agentId: 'pulse',
        agentName: 'Pulse',
        text: `Productivity up — ${todayCount} actions today`,
        actionLink: '/dashboard/metrics',
        action: { label: 'View Metrics', href: '/dashboard/metrics' },
        priority: 3,
        expiresAt: expiry,
      });
    }
  }

  // Echo: Habit nudges
  if (habits?.habits) {
    const unloggedHabits = habits.habits.filter(h => !h.logged_today);
    if (unloggedHabits.length > 0) {
      suggestions.push({
        id: `echo-habits-${now}`,
        agentId: 'echo',
        agentName: 'Echo',
        text: unloggedHabits.length > 1
          ? `${unloggedHabits.length} habits not logged today`
          : `"${unloggedHabits[0].name}" not logged today`,
        action: { label: 'Log Habits', href: '/dashboard/focus' },
        priority: 2,
        expiresAt: expiry,
      });
    }
  }

  // Weebo: Unfinished workspace artifacts
  if (workspace?.artifacts) {
    const drafts = workspace.artifacts.filter(a => a.status === 'draft' || a.status === 'in_progress');
    if (drafts.length > 0) {
      const title = drafts[0].title ? `"${drafts[0].title.slice(0, 30)}"` : 'a draft';
      suggestions.push({
        id: `weebo-draft-${now}`,
        agentId: 'weebo',
        agentName: 'Weebo',
        text: `You have ${title} unfinished — want to continue?`,
        action: { label: 'Open Workspace', href: '/dashboard/workspace' },
        priority: 2,
        expiresAt: expiry,
      });
    }
  }

  // Nova: Active goals context
  if (goals?.goals && goals.goals.length > 0) {
    const activeGoals = goals.goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      const goal = activeGoals[0];
      const progress = goal.progress ?? 0;
      suggestions.push({
        id: `nova-goals-${now}`,
        agentId: 'nova',
        agentName: 'Nova',
        text: progress > 0
          ? `Goal "${goal.title?.slice(0, 25)}" is ${progress}% complete`
          : `Goal "${goal.title?.slice(0, 25)}" needs attention`,
        action: { label: 'View Goals', href: '/dashboard/goals' },
        priority: progress > 50 ? 3 : 2,
        expiresAt: expiry,
      });
    }
  }

  // Time-based suggestions
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 10) {
    suggestions.push({
      id: `jarvis-morning-${now}`,
      agentId: 'jarvis',
      agentName: 'Jarvis',
      text: 'Good morning — ready to review today\'s tasks?',
      actionLink: '/dashboard/office',
      action: { label: 'Open Office', href: '/dashboard/office' },
      priority: 3,
      expiresAt: expiry,
    });
  } else if (hour >= 17 && hour <= 18) {
    suggestions.push({
      id: `jarvis-evening-${now}`,
      agentId: 'jarvis',
      agentName: 'Jarvis',
      text: 'Wrapping up — here\'s your day summary',
      action: { label: 'View Summary', href: '/dashboard/metrics' },
      priority: 3,
      expiresAt: expiry,
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}
