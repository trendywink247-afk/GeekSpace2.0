// ============================================================
// Integrations module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routes from existing locations (shim pattern)
export { integrationsRouter } from '../../routes/integrations.js';
export { gmailRouter } from '../../routes/gmail.js';
export { calendarRouter } from '../../routes/calendar.js';
export { socialMediaRouter } from '../../routes/social-media.js';
export { customBotRouter } from '../../routes/custom-bot.js';

// Re-export services
export { syncUserGmail, getGmailMessages, startGmailSyncScheduler } from '../../services/gmail-sync.js';
export { syncUserCalendar, getUpcomingEvents, startCalendarSyncScheduler } from '../../services/calendar-sync.js';

// Types
export type {
  Integration,
  TelegramConfig,
  GmailConfig,
  CalendarConfig,
  SocialAccount,
  ChannelLink,
} from './types.js';

// Import for module registration
import { integrationsRouter } from '../../routes/integrations.js';
import { gmailRouter } from '../../routes/gmail.js';
import { calendarRouter } from '../../routes/calendar.js';
import { socialMediaRouter } from '../../routes/social-media.js';
import { customBotRouter } from '../../routes/custom-bot.js';

export const integrationsModule: AppModule = {
  name: 'integrations',

  registerRoutes(app: Application) {
    app.use('/api/integrations/telegram/custom', customBotRouter);
    app.use('/api/integrations', integrationsRouter);
    app.use('/api/gmail', gmailRouter);
    app.use('/api/calendar', calendarRouter);
    app.use('/api/social-media', socialMediaRouter);
  },
};
