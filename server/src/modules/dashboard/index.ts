// ============================================================
// Dashboard module — barrel export + AppModule registration
//
// Groups all UI data-feed routes: dashboard, activity,
// analytics, report, inbox, and recommendations.
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export route routers
export { dashboardRouter } from '../../routes/dashboard.js';
export { activityRouter, pushActivityEvent, invalidateActivityCache } from '../../routes/activity.js';
export { analyticsRouter } from '../../routes/analytics.js';
export { reportRouter } from '../../routes/report.js';
export { inboxRouter } from '../../routes/inbox.js';
export { recommendationsRouter } from '../../routes/recommendations.js';

// Re-export types
export type {
  DashboardStats,
  QuickStats,
  DashboardOverview,
  WeeklyChartPoint,
  HourlyActivityPoint,
  ReminderBreakdown,
  OverviewReminder,
  OverviewHabit,
  OverviewCalendarEvent,
  OverviewWeeklyStats,
  OverviewConversation,
  ContactSubmission,
  ActivityEntry,
  ActivityFeed,
  HeatmapPoint,
  ActivityDayStats,
  ActivitySSEEvent,
  InsightItem,
  AnalyticsInsightsResponse,
  ReportReason,
  ReportSubmission,
  ReportSummary,
  InboxSource,
  InboxMessage,
  InboxCreateBody,
  Recommendation,
  RecommendationDismissBody,
} from './types.js';

// Import routers for module registration
import { dashboardRouter } from '../../routes/dashboard.js';
import { activityRouter } from '../../routes/activity.js';
import { analyticsRouter } from '../../routes/analytics.js';
import { reportRouter } from '../../routes/report.js';
import { inboxRouter } from '../../routes/inbox.js';
import { recommendationsRouter } from '../../routes/recommendations.js';

export const dashboardModule: AppModule = {
  name: 'dashboard',

  registerRoutes(app: Application) {
    app.use('/api/dashboard', dashboardRouter);
    app.use('/api/activity', activityRouter);
    app.use('/api/analytics', analyticsRouter);
    app.use('/api/report', reportRouter);
    app.use('/api/inbox', inboxRouter);
    app.use('/api/recommendations', recommendationsRouter);
  },
};
