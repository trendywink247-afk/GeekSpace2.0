// ============================================================
// Dashboard module types
// ============================================================

// ── Dashboard Stats (/api/dashboard/stats) ───────────────────

/** Weekly chart data point (messages + API calls per day). */
export interface WeeklyChartPoint {
  name: string;
  messages: number;
  api: number;
}

/** Hourly activity block (4-hour groupings). */
export interface HourlyActivityPoint {
  hour: string;
  activity: number;
}

/** Reminder breakdown for pie charts. */
export interface ReminderBreakdown {
  completed: number;
  pending: number;
  overdue: number;
}

/** Full response payload from GET /api/dashboard/stats. */
export interface DashboardStats {
  messagesSent: number;
  messagesChange: number;
  remindersActive: number;
  remindersChange: number;
  apiCalls: number;
  apiCallsChange: number;
  responseTimeMs: number;
  responseTimeChange: number;
  agentStatus: string;
  agentModel: string;
  agentName: string;
  agentUptime: string;
  credits: number;
  plan: string;
  integrationsConnected: number;
  recentActivity: unknown[];
  connectedServices: unknown[];
  weeklyChartData: WeeklyChartPoint[];
  hourlyActivity: HourlyActivityPoint[];
  reminderBreakdown: ReminderBreakdown;
}

/** Lightweight quick-stats payload (GET /api/dashboard/quick-stats). */
export interface QuickStats {
  remindersActive: number;
  messagesToday: number;
  automationsActive: number;
}

/** Single reminder item in the overview response. */
export interface OverviewReminder {
  id: string;
  text: string;
  datetime: string;
  category: string;
  recurring: string;
  priority: string;
  overdue: boolean;
}

/** Single habit item in the overview response. */
export interface OverviewHabit {
  id: number;
  name: string;
  icon: string;
  streak: number;
  loggedToday: boolean;
}

/** Calendar event in the overview response. */
export interface OverviewCalendarEvent {
  id: number;
  title: string;
  start_time: number;
  end_time: number | null;
}

/** Weekly stats summary in the overview response. */
export interface OverviewWeeklyStats {
  messagesThisWeek: number;
  remindersCompleted: number;
  habitsLogged: number;
}

/** Recent conversation snippet in the overview response. */
export interface OverviewConversation {
  id: string;
  content: string;
  created_at: string;
}

/** Full response payload from GET /api/dashboard/overview. */
export interface DashboardOverview {
  greeting: string;
  remindersDueToday: OverviewReminder[];
  habitsToday: OverviewHabit[];
  calendarEventsToday: OverviewCalendarEvent[];
  weeklyStats: OverviewWeeklyStats;
  recentConversations: OverviewConversation[];
}

/** Contact form submission body (POST /api/dashboard/contact). */
export interface ContactSubmission {
  name: string;
  email: string;
  company?: string;
  message: string;
}

// ── Activity (/api/activity) ─────────────────────────────────

/** Single activity log entry. */
export interface ActivityEntry {
  id: string;
  action: string;
  details: string;
  icon: string;
  created_at: string;
}

/** Paginated activity feed response. */
export interface ActivityFeed {
  activity: ActivityEntry[];
  total: number;
}

/** Heatmap data point (date + count). */
export interface HeatmapPoint {
  date: string;
  count: number;
}

/** 7-day daily stats point. */
export interface ActivityDayStats {
  date: string;
  messages: number;
  reminders: number;
}

/** SSE event pushed to activity stream subscribers. */
export interface ActivitySSEEvent {
  action: string;
  details: string;
  icon: string;
}

// ── Analytics (/api/analytics) ───────────────────────────────

/** AI-generated insight item. */
export interface InsightItem {
  icon: string;
  text: string;
  type: 'positive' | 'warning' | 'tip' | 'achievement';
}

/** Response payload from GET /api/analytics/insights. */
export interface AnalyticsInsightsResponse {
  insights: InsightItem[];
  generatedAt: string;
}

// ── Report (/api/report) ─────────────────────────────────────

/** Valid report reasons. */
export type ReportReason = 'harmful' | 'inaccurate' | 'inappropriate' | 'other';

/** Report submission body (POST /api/report). */
export interface ReportSubmission {
  messageContent: string;
  reason: ReportReason;
  additionalInfo?: string;
}

/** Summary of a submitted report (GET /api/report). */
export interface ReportSummary {
  id: string;
  reason: ReportReason;
  status: string;
  created_at: string;
}

// ── Inbox (/api/inbox) ───────────────────────────────────────

/** Valid inbox message sources. */
export type InboxSource = 'telegram' | 'whatsapp' | 'system' | 'agent';

/** Inbox message returned by the API. */
export interface InboxMessage {
  id: number;
  source: InboxSource;
  sender: string | null;
  content: string;
  suggested_reply: string | null;
  read: boolean;
  archived: boolean;
  created_at: string;
}

/** Body for POST /api/inbox (manual message creation). */
export interface InboxCreateBody {
  source: InboxSource;
  sender?: string;
  content: string;
}

// ── Recommendations (/api/recommendations) ───────────────────

/** A single feature recommendation. */
export interface Recommendation {
  feature: string;
  title: string;
  description: string;
  icon: string;
  priority: number;
}

/** Body for POST /api/recommendations/dismiss. */
export interface RecommendationDismissBody {
  feature: string;
}
