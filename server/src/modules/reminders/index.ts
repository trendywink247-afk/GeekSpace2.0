/**
 * Reminders Domain — Barrel Export
 *
 * Re-exports for reminder CRUD, scheduling, recurrence computation,
 * and multi-channel delivery.
 *
 * @module reminders
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 1 extraction candidate
 */

// ── Routes ──────────────────────────────────────────────────────────
export { remindersRouter, computeNextOccurrence } from '../../routes/reminders.js';

// ── Services ────────────────────────────────────────────────────────
export {
  startReminderScheduler,
  stopReminderScheduler,
  scheduleNextRecurrence,
  scheduleTestReminder,
  getReminderDriftStats,
} from '../../services/reminder-scheduler.js';
