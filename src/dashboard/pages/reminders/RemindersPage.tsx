import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlarmClock, CheckCheck, X, Calendar, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import { useReminders } from './hooks/useReminders';
import { useReminderFilters } from './hooks/useReminderFilters';
import { useRemindersUI } from './state/reminders-store';
import { RemindersHeader } from './components/RemindersHeader';
import { ReminderFilters } from './components/ReminderFilters';
import { EmptyReminders } from './components/EmptyReminders';
import { ReminderComposer } from './components/ReminderComposer';
import { ReminderList } from './ReminderList';
import { CompletedList } from './CompletedList';
import { QuickAdd } from './QuickAdd';
import type { ReminderCardState, ReminderCardHandlers } from './types';

export function RemindersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const actions = useReminders();
  const { reminders, loadReminders } = actions;
  const filters = useReminderFilters(reminders);
  const ui = useRemindersUI();

  const activeReminders    = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r =>  r.completed);
  const overdueReminders   = activeReminders.filter(r => new Date(r.datetime) < new Date());
  const streak             = actions.streakRef.current?.streak ?? 0;

  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      ui.openComposer();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, ui]);

  const cardState: ReminderCardState = {
    selectedActiveIds: ui.selectedActiveIds, selectedIds: ui.selectedIds,
    completingIds: ui.completingIds, justCompletedIds: ui.justCompletedIds,
    snoozeOpenId: ui.snoozeOpenId, snoozeCustomId: ui.snoozeCustomId, snoozeCustomValue: ui.snoozeCustomValue,
    snoozeHistoryId: ui.snoozeHistoryId, snoozeHistory: ui.snoozeHistory, snoozeHistoryLoading: ui.snoozeHistoryLoading,
    inlineEditId: ui.inlineEditId, inlineEditValue: ui.inlineEditValue, duplicatingId: ui.duplicatingId,
  };

  const cardHandlers: ReminderCardHandlers = {
    onToggleSelectActive: ui.toggleSelectActive, onToggleSelect: ui.toggleSelect,
    onComplete: actions.handleComplete, onSnooze: actions.handleSnooze, onSnoozeCustom: actions.handleSnoozeCustom,
    onDuplicate: actions.handleDuplicate, onEditClick: (r) => actions.handleEditClick(r), onDelete: actions.handleDelete,
    onSetSnoozeOpenId: ui.setSnoozeOpenId, onSetSnoozeCustomId: ui.setSnoozeCustomId, onSetSnoozeCustomValue: ui.setSnoozeCustomValue,
    onSetInlineEditId: ui.setInlineEditId, onSetInlineEditValue: ui.setInlineEditValue,
    onInlineEditSave: actions.handleInlineEditSave, onShowSnoozeHistory: actions.handleShowSnoozeHistory, onUpdatePriority: actions.handleUpdatePriority,
  };

  return (
    <DashboardPageWrapper>
      <PullToRefreshWrapper onRefresh={loadReminders}>
        <div className="space-y-5 pb-24 md:pb-6" data-testid="reminders-page" style={{ WebkitFontSmoothing: 'antialiased' }}>

          <AnimatePresence>
            {ui.snoozeToast && (
              <motion.div key="snooze-toast" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }} exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.2 } }}
                data-testid="snooze-toast" className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl backdrop-blur-xl text-sm font-medium"
                style={{ color: 'var(--ag-amber)', boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.2)', background: 'var(--ag-bg-elevated)' }}>
                <AlarmClock className="w-4 h-4 flex-shrink-0" />{ui.snoozeToast}
              </motion.div>
            )}
            {ui.undoToast && (
              <motion.div key="undo-toast" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }} exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.2 } }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl text-sm font-medium whitespace-nowrap"
                style={{ color: 'var(--ag-emerald)', boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.2)', background: 'var(--ag-bg-elevated)' }}>
                <CheckCheck className="w-4 h-4 flex-shrink-0" />
                <span>{ui.undoToast.count} reminder{ui.undoToast.count > 1 ? 's' : ''} done</span>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => void actions.handleUndoBulkComplete()} className="underline opacity-70 hover:opacity-100 transition-opacity text-xs font-semibold min-h-[44px] px-2" style={{ color: 'var(--ag-emerald)' }}>Undo</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => ui.setUndoToast(null)} className="opacity-40 hover:opacity-100 transition-opacity ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center" style={{ color: 'var(--ag-emerald)' }}><X className="w-3.5 h-3.5" /></motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {ui.showCelebration && (
              <motion.div key="celebration" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.4, bounce: 0 } }} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl backdrop-blur-xl"
                style={{ background: 'rgba(16,185,129,0.08)', boxShadow: '0 0 0 1px rgba(16,185,129,0.2), 0 4px 16px rgba(16,185,129,0.06)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--ag-emerald)' }}>🎉 All caught up for today!</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => ui.setShowCelebration(false)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-opacity opacity-50 hover:opacity-100" style={{ color: 'var(--ag-emerald)' }} aria-label="Dismiss"><X className="w-4 h-4" /></motion.button>
              </motion.div>
            )}
            {!ui.showCelebration && overdueReminders.length > 3 && (
              <motion.div key="overdue-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.4, bounce: 0 } }} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl backdrop-blur-xl"
                style={{ background: 'rgba(251,146,60,0.07)', boxShadow: '0 0 0 1px rgba(251,146,60,0.2), 0 4px 16px rgba(251,146,60,0.06)' }}>
                <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--ag-coral)' }}>
                  <AlarmClock className="w-4 h-4" />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{overdueReminders.length}</span> overdue
                </span>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => void actions.handleMarkAllOverdueComplete(overdueReminders.map(r => r.id))} disabled={ui.isMarkingAllOverdue}
                  className="text-xs font-semibold px-3 py-2 rounded-xl text-white transition-opacity disabled:opacity-50 min-h-[44px]"
                  style={{ background: 'linear-gradient(135deg, var(--ag-coral), var(--ag-amber))' }}>
                  {ui.isMarkingAllOverdue ? 'Marking…' : 'Mark all complete'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <RemindersHeader activeCount={activeReminders.length} completedCount={completedReminders.length} streak={streak} onAdd={() => ui.openComposer()} />

          <ReminderFilters
            activeCount={activeReminders.length} overdueCount={overdueReminders.length}
            completedCount={completedReminders.length} streak={streak}
            filter={filters.filter} recurrenceFilter={filters.recurrenceFilter}
            categoryFilter={filters.categoryFilter} priorityFilter={filters.priorityFilter}
            searchQuery={filters.searchQuery} sortMode={filters.sortMode}
            groupMode={filters.groupMode} viewMode={filters.viewMode} hasActiveFilters={filters.hasActiveFilters}
            onFilterChange={filters.setFilter} onRecurrenceFilterChange={filters.setRecurrenceFilter}
            onCategoryFilterChange={filters.setCategoryFilter} onPriorityFilterChange={filters.setPriorityFilter}
            onSearchQueryChange={filters.setSearchQuery} onSortModeChange={filters.setSortMode}
            onGroupModeChange={filters.setGroupMode} onViewModeChange={filters.setViewMode}
            onClearFilters={filters.clearFilters}
            onExportCsv={() => void actions.handleExportCsv(filters.filter)}
            onExportIcs={() => void actions.handleExportIcs()}
          />

          <QuickAdd onAdd={actions.handleQuickAdd} />

          {filters.viewMode === 'list' ? (
            filters.isEmpty ? (
              <EmptyReminders onAdd={() => ui.openComposer()} />
            ) : (
              <div className="space-y-5">
                {filters.showActive && filters.activeFiltered.length > 0 && (
                  <ReminderList reminders={filters.activeFiltered} allActiveReminders={activeReminders}
                    groupMode={filters.groupMode} isGrouped={filters.filter === 'active'}
                    selectedActiveIds={ui.selectedActiveIds} isBulkSnoozing={ui.isBulkSnoozing}
                    isBulkCompleting={ui.isBulkCompleting} isBulkDeletingActive={ui.isBulkDeletingActive}
                    isBatchEditing={ui.isBatchEditing} cardState={cardState} cardHandlers={cardHandlers}
                    onSelectAllActive={checked => checked ? ui.selectAllActive(activeReminders.map(r => r.id)) : ui.clearSelectActive()}
                    onBulkSnooze={actions.handleBulkSnooze} onBulkComplete={actions.handleBulkComplete}
                    onBulkDeleteActive={actions.handleBulkDeleteActive} onBatchEdit={actions.handleBatchEdit} />
                )}
                {filters.showCompleted && filters.completedFiltered.length > 0 && (
                  <CompletedList reminders={filters.completedFiltered} selectedIds={ui.selectedIds}
                    isBulkDeleting={ui.isBulkDeleting} isBulkRestoringSnooze={ui.isBulkRestoringSnooze}
                    cardState={cardState} cardHandlers={cardHandlers}
                    onSelectAll={checked => checked ? ui.selectAll(completedReminders.map(r => r.id)) : ui.clearSelect()}
                    onBulkDelete={actions.handleBulkDelete} onBulkRestoreSnooze={actions.handleBulkRestoreSnooze} />
                )}
              </div>
            )
          ) : (
            <BlurFade delay={0.32} inView>
              <div className="rounded-2xl p-5 backdrop-blur-xl"
                style={{ background: 'var(--ag-bg-surface)', border: '1px solid var(--ag-border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5" style={{ color: 'var(--ag-indigo)' }} />
                  <h3 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ag-text-primary)' }}>Calendar View</h3>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-[10px] font-mono uppercase tracking-wide py-2" style={{ color: 'var(--ag-text-muted)' }}>{day}</div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-xl flex items-center justify-center text-xs transition-colors" style={{ color: 'var(--ag-text-muted)', boxShadow: '0 0 0 1px rgba(139,92,246,0.06)' }}>{i + 1}</div>
                  ))}
                </div>
              </div>
            </BlurFade>
          )}

          <ReminderComposer open={ui.isComposerOpen} editingReminder={ui.editingReminder}
            recurringEditChoice={ui.recurringEditChoice} editAsOneOff={ui.editAsOneOff}
            onOpenChange={v => { if (!v) ui.closeComposer(); else ui.openComposer(); }}
            onRecurringEditChoiceChange={ui.setRecurringEditChoice} onEditAsOneOffChange={ui.setEditAsOneOff}
            onNaturalAdd={actions.handleDialogNaturalAdd} onLegacyAdd={actions.handleLegacyAdd}
            onEditSave={actions.handleEditSave} onEditClick={actions.handleEditClick} />

          <motion.button whileTap={{ scale: 0.92 }} onClick={() => ui.openComposer()}
            className="md:hidden fixed bottom-[88px] right-4 w-14 h-14 rounded-full text-white flex items-center justify-center z-40"
            aria-label="Add reminder"
            style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-violet-deep))', boxShadow: '0 4px 20px rgba(139,92,246,0.4), 0 0 0 1px rgba(139,92,246,0.2)' }}>
            <Plus className="w-6 h-6" />
          </motion.button>

        </div>
      </PullToRefreshWrapper>
    </DashboardPageWrapper>
  );
}
