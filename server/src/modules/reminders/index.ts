// ============================================================
// Reminders module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routes and services from existing locations (shim pattern)
export { remindersRouter, computeNextOccurrence } from '../../routes/reminders.js';

export {
  startReminderScheduler,
  stopReminderScheduler,
  scheduleNextRecurrence,
  scheduleTestReminder,
  getReminderDriftStats,
} from '../../services/reminder-scheduler.js';

// Types
export type {
  Reminder,
  ReminderResponse,
  RecurrencePattern,
  ReminderPriority,
  ReminderCategory,
  ReminderChannel,
  SnoozePreset,
  CreateReminderBody,
  UpdateReminderBody,
  SnoozeReminderBody,
  BulkDeleteBody,
} from './types.js';

// Import for module registration
import { remindersRouter } from '../../routes/reminders.js';
import { startReminderScheduler } from '../../services/reminder-scheduler.js';

export const remindersModule: AppModule = {
  name: 'reminders',

  registerRoutes(app: Application) {
    app.use('/api/reminders', remindersRouter);
  },

  async initialize() {
    startReminderScheduler();
  },
};
