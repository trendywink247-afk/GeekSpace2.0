// ─── Barrel export for reminders sub-components ──────────────────────────────
export { ReminderCard }  from './ReminderCard';
export { ReminderList }  from './ReminderList';
export { CompletedList } from './CompletedList';
export { AddEditDialog } from './AddEditDialog';
export { StatsBar }      from './StatsBar';
export { QuickAdd }      from './QuickAdd';

export { RemindersHeader }  from './components/RemindersHeader';
export { ReminderFilters }  from './components/ReminderFilters';
export { EmptyReminders }   from './components/EmptyReminders';
export { ReminderComposer } from './components/ReminderComposer';

export { useReminders }       from './hooks/useReminders';
export { useReminderFilters } from './hooks/useReminderFilters';

export { useRemindersUI } from './state/reminders-store';
export type { UndoToast } from './state/reminders-store';

export * from './helpers';
export type * from './types';
