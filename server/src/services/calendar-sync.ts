// ============================================================
// SHIM — re-exports from modules/integrations/services/calendar-sync
// This file exists for backward compatibility. New code should
// import from '../modules/integrations/services/calendar-sync.js'.
// ============================================================
export {
  getOAuth2Client,
  getUserCalendarToken,
  syncUserCalendar,
  getTodayEvents,
  getUpcomingEvents,
  createCalendarEvent,
  startCalendarSyncScheduler,
  _resetCalendarSyncTimer,
} from '../modules/integrations/services/calendar-sync.js';
