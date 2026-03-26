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
 * 2. Fetches data from `/api/agent/reminders`, `/api/inbox/summary`, `/api/activity`
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

import type { AgentId } from './types';

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
 * @returns API base URL (e.g., 'http://localhost:3001' or '')
 * @example
 * ```typescript
 * const url = `${apiBase()}/api/reminders`;
 * // Dev: 'http://localhost:3001/api/reminders'
 * // Prod: '/api/reminders'
 * ```
 */
function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
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
 * @param path - API path (e.g., '/api/agent/reminders')
 * @returns Parsed JSON response on success, or null on any error
 *
 * @example
 * ```typescript
 * const reminders = await safeFetch<ReminderData>('/api/agent/reminders');
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
  todayCount?: number;
  streakDays?: number;
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
export async function generateSuggestions(): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];
  const now = Date.now();
  const expiry = now + 5 * 60 * 1000; // 5 minute TTL

  // Fetch data in parallel from available endpoints
  const [reminders, inbox, activity] = await Promise.all([
    safeFetch<ReminderData>('/api/agent/reminders'),
    safeFetch<InboxData>('/api/inbox/summary'),
    safeFetch<ActivityData>('/api/activity'),
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
  if (activity) {
    if ((activity.todayCount ?? 0) > 10) {
      suggestions.push({
        id: `pulse-productivity-${now}`,
        agentId: 'pulse',
        agentName: 'Pulse',
        text: `Productivity up — ${activity.todayCount} actions today`,
        actionLink: '/dashboard/metrics',
        action: { label: 'View Metrics', href: '/dashboard/metrics' },
        priority: 3,
        expiresAt: expiry,
      });
    }
    if ((activity.streakDays ?? 0) >= 3) {
      suggestions.push({
        id: `pulse-streak-${now}`,
        agentId: 'pulse',
        agentName: 'Pulse',
        text: `${activity.streakDays}-day activity streak`,
        priority: 3,
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
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}
