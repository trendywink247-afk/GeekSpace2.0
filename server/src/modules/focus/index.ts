// ============================================================
// Focus module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routers from the route file
export { focusRouter, habitsRouter } from '../../routes/focus.js';

// Types
export type {
  FocusSession,
  FocusSummary,
  DeferredMessage,
  NotificationSettings,
  StartFocusBody,
  EndFocusBody,
  NotificationSettingsUpdate,
  HabitFrequency,
  Habit,
  HabitLog,
  HabitStats,
  CreateHabitBody,
  LogHabitBody,
} from './types.js';

// Import for module registration
import { focusRouter, habitsRouter } from '../../routes/focus.js';

export const focusModule: AppModule = {
  name: 'focus',

  registerRoutes(app: Application) {
    app.use('/api/focus', focusRouter);
    app.use('/api/habits', habitsRouter);
  },
};
