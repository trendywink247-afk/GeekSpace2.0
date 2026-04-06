// ─── RemindersPage — composes sub-components, owns all state & handlers ──────
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader, DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { useSearchParams } from 'react-router-dom';
import { Bell, Plus, Calendar, AlarmClock, CheckCheck, X, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/stores/dashboard-store';
import { reminderService } from '@/services/api';
import type { ParsedReminder } from '@/utils/reminder-parser';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import type { ReminderPriority, Reminder } from '@/types';
import {
  ReminderList, CompletedList, AddEditDialog, StatsBar, QuickAdd,
} from './reminders';
import type {
  NewReminderForm, ReminderCardState, ReminderCardHandlers,
  SnoozeHistoryEntry, FilterStatus, FilterRecurrence, FilterCategory,
  FilterPriority, SortMode, GroupMode, ViewMode,
} from './reminders/types';
import { priorityOrder } from './reminders/helpers';

const LS_KEY = 'agentin:reminders:filters';
const loadFilters = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
const persistFilters = (updates: Record<string, string>) =>
  localStorage.setItem(LS_KEY, JSON.stringify({ ...loadFilters(), ...updates }));

export function RemindersPage() {
  const {
    reminders, addReminder, updateReminder, toggleReminder,
    snoozeReminder, deleteReminder, loadReminders, bulkSnoozeReminders,
  } = useDashboardStore();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'cal', page: 'reminders' });
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filters (persisted) ──────────────────────────────────────────────────────
  const saved = loadFilters();
  const [filter,           setFilterRaw]          = useState<FilterStatus>(saved.filter ?? 'all');
  const [recurrenceFilter, setRecurrenceFilterRaw] = useState<FilterRecurrence>(saved.recurrenceFilter ?? 'all');
  const [categoryFilter,   setCategoryFilterRaw]   = useState<FilterCategory>(saved.categoryFilter ?? 'all');
  const [priorityFilter,   setPriorityFilterRaw]   = useState<FilterPriority>(saved.priorityFilter ?? 'all');

  const setFilter           = (v: FilterStatus)     => { setFilterRaw(v);           persistFilters({ filter: v }); };
  const setRecurrenceFilter = (v: FilterRecurrence) => { setRecurrenceFilterRaw(v); persistFilters({ recurrenceFilter: v }); };
  const setCategoryFilter   = (v: FilterCategory)   => { setCategoryFilterRaw(v);   persistFilters({ categoryFilter: v }); };
  const setPriorityFilter   = (v: FilterPriority)   => { setPriorityFilterRaw(v);   persistFilters({ priorityFilter: v }); };

  const [searchQuery,      setSearchQuery]      = useState('');
  const [sortMode,         setSortMode]         = useState<SortMode>('priority');
  const [groupMode,        setGroupMode]        = useState<GroupMode>('date');
  const [viewMode,         setViewMode]         = useState<ViewMode>('list');
  const [isAddDialogOpen,  setIsAddDialogOpen]  = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const emptyForm: NewReminderForm = { text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' };
  const [newReminder,      setNewReminder]      = useState<NewReminderForm>(emptyForm);
  const [editingReminder,  setEditingReminder]  = useState<Reminder | null>(null);
  const [recurringEditChoice, setRecurringEditChoice] = useState<Reminder | null>(null);
  const [editAsOneOff,     setEditAsOneOff]     = useState(false);

  // ── Streak + celebration ─────────────────────────────────────────────────────
  const [streak,           setStreak]           = useState<{ streak: number } | null>(null);
  const [showCelebration,  setShowCelebration]  = useState(false);
  const prevActiveCountRef = useRef<number | null>(null);

  useEffect(() => {
    reminderService.getStreak().then(res => setStreak(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const activeCount    = reminders.filter(r => !r.completed).length;
    const completedCount = reminders.filter(r =>  r.completed).length;
    if (prevActiveCountRef.current !== null && prevActiveCountRef.current > 0 && activeCount === 0 && completedCount > 0) {
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(t);
    }
    prevActiveCountRef.current = activeCount;
  }, [reminders]);

  // ── Polling + URL open ───────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => loadReminders(), 30_000);
    return () => clearInterval(id);
  }, [loadReminders]);

  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsAddDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ── Card interaction state ───────────────────────────────────────────────────
  const [completingIds,    setCompletingIds]    = useState<Set<string>>(new Set());
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  const [snoozeOpenId,     setSnoozeOpenId]     = useState<string | null>(null);
  const [snoozeCustomId,   setSnoozeCustomId]   = useState<string | null>(null);
  const [snoozeCustomValue, setSnoozeCustomValue] = useState('');
  const [snoozeToast,      setSnoozeToast]      = useState<string | null>(null);
  const [snoozeHistoryId,  setSnoozeHistoryId]  = useState<string | null>(null);
  const [snoozeHistory,    setSnoozeHistory]    = useState<SnoozeHistoryEntry[]>([]);
  const [snoozeHistoryLoading, setSnoozeHistoryLoading] = useState(false);
  const [duplicatingId,    setDuplicatingId]    = useState<string | null>(null);
  const [inlineEditId,     setInlineEditId]     = useState<string | null>(null);
  const [inlineEditValue,  setInlineEditValue]  = useState('');

  // ── Bulk state ───────────────────────────────────────────────────────────────
  const [selectedIds,         setSelectedIds]         = useState<Set<string>>(new Set());
  const [selectedActiveIds,   setSelectedActiveIds]   = useState<Set<string>>(new Set());
  const [isBulkDeleting,      setIsBulkDeleting]      = useState(false);
  const [isBulkRestoringSnooze, setIsBulkRestoringSnooze] = useState(false);
  const [isBatchEditing,      setIsBatchEditing]      = useState(false);
  const [isBulkSnoozing,      setIsBulkSnoozing]      = useState(false);
  const [isBulkCompleting,    setIsBulkCompleting]    = useState(false);
  const [isBulkDeletingActive, setIsBulkDeletingActive] = useState(false);
  const [undoToast,            setUndoToast]          = useState<{ ids: string[]; count: number } | null>(null);
  const [isMarkingAllOverdue,  setIsMarkingAllOverdue] = useState(false);

  // ── Derived state ────────────────────────────────────────────────────────────
  const activeReminders    = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r =>  r.completed);
  const overdueReminders   = activeReminders.filter(r => new Date(r.datetime) < new Date());

  const baseFiltered = reminders
    .filter(r => recurrenceFilter === 'recurring' ? !!r.recurrence : recurrenceFilter === 'one-off' ? !r.recurrence : true)
    .filter(r => categoryFilter !== 'all' ? r.category === categoryFilter : true)
    .filter(r => priorityFilter !== 'all' ? (r.priority ?? 'normal') === priorityFilter : true)
    .filter(r => r.text.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const now   = Date.now();
      const aOver = !a.completed && new Date(a.datetime).getTime() < now;
      const bOver = !b.completed && new Date(b.datetime).getTime() < now;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      if (sortMode === 'due') return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      return (priorityOrder[a.priority ?? 'normal'] ?? 2) - (priorityOrder[b.priority ?? 'normal'] ?? 2);
    });

  const showActive    = filter === 'active' || filter === 'all';
  const showCompleted = filter === 'completed' || filter === 'all';
  const activeFiltered    = showActive    ? baseFiltered.filter(r => !r.completed) : [];
  const completedFiltered = showCompleted ? baseFiltered.filter(r =>  r.completed) : [];
  const isEmpty           = activeFiltered.length === 0 && completedFiltered.length === 0;
  const hasActiveFilters  = filter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || recurrenceFilter !== 'all' || searchQuery !== '';

  // ── Snooze helpers ───────────────────────────────────────────────────────────
  const showSnoozeToast = (newDatetime: string) => {
    const dt        = new Date(newDatetime);
    const formatted = dt.toLocaleString('en', { hour: '2-digit', minute: '2-digit', weekday: 'short', month: 'short', day: 'numeric' });
    setSnoozeToast(`Snoozed until ${formatted}`);
    setTimeout(() => setSnoozeToast(null), 3000);
  };

  // ── Card handlers ────────────────────────────────────────────────────────────
  const handleComplete = async (id: string) => {
    setCompletingIds(prev => new Set(prev).add(id));
    await new Promise(r => setTimeout(r, 500));
    try { await toggleReminder(id); void notifyDone('reminder completed'); }
    catch { void notifyFail('failed to complete reminder'); }
    setCompletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setJustCompletedIds(prev => new Set(prev).add(id));
    setTimeout(() => setJustCompletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 600);
  };

  const handleDelete = async (id: string) => {
    try { await deleteReminder(id); void notifyDone('reminder deleted'); }
    catch { void notifyFail('failed to delete reminder'); }
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try { await reminderService.duplicate(id); await loadReminders(); }
    catch { /* non-fatal */ } finally { setDuplicatingId(null); }
  };

  const handleSnooze = async (id: string, preset: '1h' | 'tomorrow' | 'next-week') => {
    try { const res = await reminderService.snooze(id, preset); await snoozeReminder(id, res.data.newDatetime); showSnoozeToast(res.data.newDatetime); }
    catch { /* ignore */ }
    setSnoozeOpenId(null);
  };

  const handleSnoozeCustom = async (id: string) => {
    if (!snoozeCustomValue) return;
    try {
      const res = await reminderService.snooze(id, undefined, snoozeCustomValue);
      await snoozeReminder(id, res.data.newDatetime);
      showSnoozeToast(res.data.newDatetime);
      setSnoozeCustomId(null); setSnoozeCustomValue(''); setSnoozeOpenId(null);
    } catch { /* ignore */ }
  };

  const handleShowSnoozeHistory = async (id: string) => {
    if (snoozeHistoryId === id) { setSnoozeHistoryId(null); return; }
    setSnoozeHistoryId(id); setSnoozeHistoryLoading(true);
    try { const res = await reminderService.getSnoozeHistory(id); setSnoozeHistory(res.data.history); }
    catch { setSnoozeHistory([]); } finally { setSnoozeHistoryLoading(false); }
  };

  const handleInlineEditSave = async (id: string) => {
    const trimmed = inlineEditValue.trim();
    if (trimmed && trimmed !== reminders.find(r => r.id === id)?.text)
      await updateReminder(id, { text: trimmed }).catch(() => {});
    setInlineEditId(null); setInlineEditValue('');
  };

  const handleUpdatePriority = (id: string, priority: ReminderPriority) => {
    void updateReminder(id, { priority });
  };

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const handleEditClick = (reminder: Reminder, skipChoiceDialog = false) => {
    if (reminder.recurrence && !skipChoiceDialog) { setRecurringEditChoice(reminder); return; }
    const pad   = (n: number) => String(n).padStart(2, '0');
    const d     = new Date(reminder.datetime);
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const validP: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
    const safePriority: ReminderPriority = validP.includes(reminder.priority as ReminderPriority) ? (reminder.priority as ReminderPriority) : 'normal';
    setEditingReminder(reminder);
    setNewReminder({ text: reminder.text, datetime: local, channel: reminder.channel, recurring: reminder.recurring || '', recurrence: (reminder.recurrence as 'daily' | 'weekly' | 'monthly' | undefined) || '', category: reminder.category, priority: safePriority });
    setIsAddDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingReminder || !newReminder.text || !newReminder.datetime) return;
    if (editAsOneOff) {
      await addReminder({ text: newReminder.text, datetime: new Date(newReminder.datetime).toISOString(), channel: newReminder.channel, category: newReminder.category, priority: newReminder.priority });
    } else {
      await updateReminder(editingReminder.id, { text: newReminder.text, datetime: new Date(newReminder.datetime).toISOString(), channel: newReminder.channel, recurring: (newReminder.recurring || undefined) as Reminder['recurring'], recurrence: (newReminder.recurrence || undefined) as Reminder['recurrence'], category: newReminder.category, priority: newReminder.priority });
    }
    setNewReminder(emptyForm); setEditingReminder(null); setEditAsOneOff(false); setIsAddDialogOpen(false);
  };

  const handleLegacyAdd = async () => {
    if (!newReminder.text || !newReminder.datetime) return;
    void notifyStart('creating reminder');
    try {
      await addReminder({ text: newReminder.text, datetime: newReminder.datetime, channel: newReminder.channel, recurring: newReminder.recurring || undefined, recurrence: newReminder.recurrence || undefined, category: newReminder.category, priority: newReminder.priority });
      void notifyDone(`reminder created: ${newReminder.text}`);
    } catch { void notifyFail('failed to create reminder'); }
    setNewReminder(emptyForm); setIsAddDialogOpen(false);
  };

  const handleQuickAdd = async (parsed: ParsedReminder) => {
    void notifyStart('creating reminder');
    try {
      await addReminder({ text: parsed.text, datetime: parsed.datetime.toISOString(), channel: 'telegram', recurring: parsed.recurring, category: 'personal' });
      void notifyDone(`reminder created: ${parsed.text}`);
    } catch { void notifyFail('failed to create reminder'); }
  };

  const handleDialogNaturalAdd = async (parsed: ParsedReminder) => {
    void notifyStart('creating reminder');
    try {
      await addReminder({ text: parsed.text, datetime: parsed.datetime.toISOString(), channel: 'telegram', recurring: parsed.recurring, category: 'personal' });
      void notifyDone(`reminder created: ${parsed.text}`);
    } catch { void notifyFail('failed to create reminder'); }
    setIsAddDialogOpen(false);
  };

  // ── Bulk handlers ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try { await reminderService.bulkDelete(Array.from(selectedIds)); setSelectedIds(new Set()); await loadReminders(); }
    finally { setIsBulkDeleting(false); }
  };

  const handleBulkRestoreSnooze = async (preset: '1h' | 'tomorrow' | 'next-week') => {
    if (selectedIds.size === 0) return;
    setIsBulkRestoringSnooze(true);
    try { await reminderService.bulkRestoreSnooze(Array.from(selectedIds), preset); setSelectedIds(new Set()); await loadReminders(); }
    finally { setIsBulkRestoringSnooze(false); }
  };

  const handleBulkSnooze = async (preset: '1h' | 'tomorrow' | 'next-week') => {
    if (selectedActiveIds.size === 0) return;
    setIsBulkSnoozing(true);
    try { await bulkSnoozeReminders(Array.from(selectedActiveIds), preset); setSelectedActiveIds(new Set()); }
    finally { setIsBulkSnoozing(false); }
  };

  const handleBulkComplete = async () => {
    if (selectedActiveIds.size === 0) return;
    const ids = Array.from(selectedActiveIds);
    setIsBulkCompleting(true);
    try {
      await reminderService.bulkComplete(ids); setSelectedActiveIds(new Set()); await loadReminders();
      setUndoToast({ ids, count: ids.length }); setTimeout(() => setUndoToast(null), 5000);
    } finally { setIsBulkCompleting(false); }
  };

  const handleUndoBulkComplete = async () => {
    if (!undoToast) return;
    setUndoToast(null);
    await Promise.allSettled(undoToast.ids.map(id => reminderService.update(id, { completed: false })));
    await loadReminders();
  };

  const handleBulkDeleteActive = async () => {
    if (selectedActiveIds.size === 0) return;
    setIsBulkDeletingActive(true);
    try { await reminderService.bulkDelete(Array.from(selectedActiveIds)); setSelectedActiveIds(new Set()); await loadReminders(); }
    finally { setIsBulkDeletingActive(false); }
  };

  const handleBatchEdit = async (ids: string[], fields: { priority?: string; category?: string }) => {
    if (ids.length === 0) return;
    setIsBatchEditing(true);
    try { await reminderService.batchEdit(ids, fields); await loadReminders(); }
    finally { setIsBatchEditing(false); }
  };

  const handleMarkAllOverdueComplete = async () => {
    if (overdueReminders.length === 0) return;
    setIsMarkingAllOverdue(true);
    try { await reminderService.bulkComplete(overdueReminders.map(r => r.id)); await loadReminders(); }
    finally { setIsMarkingAllOverdue(false); }
  };

  // ── Export handlers ──────────────────────────────────────────────────────────
  const handleExportCsv = async () => {
    try {
      const { data } = await reminderService.exportCsv(filter);
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = `reminders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handleExportIcs = async () => {
    try {
      const { data } = await reminderService.exportIcs('active');
      const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar' }));
      const a = document.createElement('a'); a.href = url; a.download = `reminders-${new Date().toISOString().slice(0, 10)}.ics`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  // ── Shared card state / handlers bags ────────────────────────────────────────
  const cardState: ReminderCardState = {
    selectedActiveIds, selectedIds, completingIds, justCompletedIds,
    snoozeOpenId, snoozeCustomId, snoozeCustomValue,
    snoozeHistoryId, snoozeHistory, snoozeHistoryLoading,
    inlineEditId, inlineEditValue, duplicatingId,
  };

  const cardHandlers: ReminderCardHandlers = {
    onToggleSelectActive: id => setSelectedActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    onToggleSelect:       id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    onComplete:           handleComplete,
    onSnooze:             handleSnooze,
    onSnoozeCustom:       handleSnoozeCustom,
    onDuplicate:          handleDuplicate,
    onEditClick:          (r: Reminder) => handleEditClick(r),
    onDelete:             handleDelete,
    onSetSnoozeOpenId:    setSnoozeOpenId,
    onSetSnoozeCustomId:  setSnoozeCustomId,
    onSetSnoozeCustomValue: setSnoozeCustomValue,
    onSetInlineEditId:    setInlineEditId,
    onSetInlineEditValue: setInlineEditValue,
    onInlineEditSave:     handleInlineEditSave,
    onShowSnoozeHistory:  handleShowSnoozeHistory,
    onUpdatePriority:     handleUpdatePriority,
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PullToRefreshWrapper onRefresh={() => loadReminders()}>
        <div className="space-y-5 pb-24 md:pb-6" data-testid="reminders-page" style={{ WebkitFontSmoothing: 'antialiased' }}>

          {/* Floating toasts */}
          <AnimatePresence>
            {snoozeToast && (
              <motion.div key="snooze-toast"
                initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }} exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.2 } }}
                data-testid="snooze-toast"
                className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl backdrop-blur-xl text-[#F59E0B] text-sm font-medium"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.2)', background: 'var(--ag-bg-elevated)' }}
              >
                <AlarmClock className="w-4 h-4 flex-shrink-0" />{snoozeToast}
              </motion.div>
            )}
            {undoToast && (
              <motion.div key="undo-toast"
                initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }} exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.2 } }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl text-[#10B981] text-sm font-medium whitespace-nowrap"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.2)', background: 'var(--ag-bg-elevated)' }}
              >
                <CheckCheck className="w-4 h-4 flex-shrink-0" />
                <span>{undoToast.count} reminder{undoToast.count > 1 ? 's' : ''} done</span>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => void handleUndoBulkComplete()} className="underline text-[#10B981]/70 hover:text-[#10B981] transition-colors text-xs font-semibold min-h-[44px] px-2">Undo</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setUndoToast(null)} className="text-[#10B981]/40 hover:text-[#10B981] ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-3.5 h-3.5" /></motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banners */}
          <AnimatePresence>
            {showCelebration && (
              <motion.div key="celebration"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.4, bounce: 0 } }} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl backdrop-blur-xl"
                style={{ background: 'rgba(16,185,129,0.08)', boxShadow: '0 0 0 1px rgba(16,185,129,0.2), 0 4px 16px rgba(16,185,129,0.06)' }}
              >
                <span className="text-sm font-semibold text-[#10B981]">🎉 All caught up for today!</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCelebration(false)} className="text-[#10B981]/50 hover:text-[#10B981] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl" aria-label="Dismiss"><X className="w-4 h-4" /></motion.button>
              </motion.div>
            )}
            {!showCelebration && overdueReminders.length > 3 && (
              <motion.div key="overdue-banner"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.4, bounce: 0 } }} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl backdrop-blur-xl"
                style={{ background: 'rgba(255,45,120,0.07)', boxShadow: '0 0 0 1px rgba(255,45,120,0.2), 0 4px 16px rgba(255,45,120,0.06)' }}
              >
                <span className="text-sm font-medium text-[#FF2D78] flex items-center gap-2">
                  <AlarmClock className="w-4 h-4" />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{overdueReminders.length}</span> overdue reminders
                </span>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => void handleMarkAllOverdueComplete()} disabled={isMarkingAllOverdue}
                  className="text-xs font-semibold px-3 py-2 rounded-xl text-white transition-opacity disabled:opacity-50 min-h-[44px]"
                  style={{ background: 'linear-gradient(135deg, #FF2D78, #F59E0B)' }}
                >
                  {isMarkingAllOverdue ? 'Marking…' : 'Mark all complete'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Page header */}
          <BlurFade delay={0.05} inView>
            <PageHeader
              icon={Bell}
              title="Reminders"
              subtitle={`${activeReminders.length} active · ${completedReminders.length} completed`}
              badge={
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.3)', color: '#84CC16' }}>
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-[#84CC16] opacity-75 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#84CC16]" /></span>
                  Cal
                </span>
              }
              actions={
                <div className="flex items-center gap-2">
                  {streak && streak.streak > 0 && (
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl" style={{ background: 'rgba(245,158,11,0.08)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }}>
                      <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span className="text-sm font-semibold text-[#F59E0B]" style={{ fontVariantNumeric: 'tabular-nums' }}>{streak.streak}</span>
                      <span className="text-xs text-[var(--ag-text-muted)]">day streak</span>
                    </div>
                  )}
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button data-testid="create-reminder-button" onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }}
                      className="text-white min-h-[44px] transition-[box-shadow] duration-300 hover:shadow-[var(--ag-glow-sm)]"
                      style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />Add Reminder
                    </Button>
                  </motion.div>
                </div>
              }
            />
          </BlurFade>

          {/* Stats + filters */}
          <StatsBar
            activeCount={activeReminders.length} overdueCount={overdueReminders.length}
            completedCount={completedReminders.length} streak={streak?.streak ?? 0}
            filter={filter} recurrenceFilter={recurrenceFilter}
            categoryFilter={categoryFilter} priorityFilter={priorityFilter}
            searchQuery={searchQuery} sortMode={sortMode} groupMode={groupMode} viewMode={viewMode}
            hasActiveFilters={hasActiveFilters}
            onFilterChange={setFilter} onRecurrenceFilterChange={setRecurrenceFilter}
            onCategoryFilterChange={setCategoryFilter} onPriorityFilterChange={setPriorityFilter}
            onSearchQueryChange={setSearchQuery} onSortModeChange={setSortMode}
            onGroupModeChange={setGroupMode} onViewModeChange={setViewMode}
            onClearFilters={() => { setFilter('all'); setCategoryFilter('all'); setPriorityFilter('all'); setRecurrenceFilter('all'); setSearchQuery(''); }}
            onExportCsv={() => void handleExportCsv()}
            onExportIcs={() => void handleExportIcs()}
          />

          {/* Quick add */}
          <QuickAdd onAdd={handleQuickAdd} />

          {/* Main content */}
          {viewMode === 'list' ? (
            isEmpty ? (
              <BlurFade delay={0.32} inView>
                <div className="text-center py-20 flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: 'rgba(132,204,22,0.08)', boxShadow: '0 0 40px rgba(132,204,22,0.1), 0 0 0 1px rgba(132,204,22,0.12)' }}>
                      <Bell className="w-9 h-9 text-[#84CC16]/60" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#84CC16]/20 animate-ping" />
                  </div>
                  <p className="text-lg font-semibold text-[var(--ag-text-primary)] mb-1">No reminders yet</p>
                  <p className="text-sm text-[var(--ag-text-muted)] mt-1 max-w-xs">
                    Try: <span className="text-[#84CC16]/80 font-mono text-xs">&ldquo;Remind me tomorrow at 3pm to call mom&rdquo;</span>
                  </p>
                  <motion.div whileTap={{ scale: 0.96 }} className="mt-6">
                    <Button onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }}
                      className="text-white font-semibold px-6 py-2.5 min-h-[44px] transition-[box-shadow] duration-300"
                      style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.3)' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />Create your first reminder
                    </Button>
                  </motion.div>
                </div>
              </BlurFade>
            ) : (
              <div className="space-y-5">
                {showActive && activeFiltered.length > 0 && (
                  <ReminderList
                    reminders={activeFiltered} allActiveReminders={activeReminders}
                    groupMode={groupMode} isGrouped={filter === 'active'}
                    selectedActiveIds={selectedActiveIds}
                    isBulkSnoozing={isBulkSnoozing} isBulkCompleting={isBulkCompleting}
                    isBulkDeletingActive={isBulkDeletingActive} isBatchEditing={isBatchEditing}
                    cardState={cardState} cardHandlers={cardHandlers}
                    onSelectAllActive={checked => checked ? setSelectedActiveIds(new Set(activeReminders.map(r => r.id))) : setSelectedActiveIds(new Set())}
                    onBulkSnooze={handleBulkSnooze} onBulkComplete={handleBulkComplete}
                    onBulkDeleteActive={handleBulkDeleteActive} onBatchEdit={handleBatchEdit}
                  />
                )}
                {showCompleted && completedFiltered.length > 0 && (
                  <CompletedList
                    reminders={completedFiltered} selectedIds={selectedIds}
                    isBulkDeleting={isBulkDeleting} isBulkRestoringSnooze={isBulkRestoringSnooze}
                    cardState={cardState} cardHandlers={cardHandlers}
                    onSelectAll={checked => checked ? setSelectedIds(new Set(completedReminders.map(r => r.id))) : setSelectedIds(new Set())}
                    onBulkDelete={handleBulkDelete} onBulkRestoreSnooze={handleBulkRestoreSnooze}
                  />
                )}
              </div>
            )
          ) : (
            <BlurFade delay={0.32} inView>
              <div className="rounded-2xl p-5 backdrop-blur-xl" style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-[#84CC16]" />
                  <h3 className="text-base font-semibold text-[var(--ag-text-primary)]">Calendar View</h3>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => (
                    <div key={day} className="text-[10px] font-semibold text-[var(--ag-text-muted)] uppercase tracking-wide py-2">{day}</div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-xl flex items-center justify-center text-xs text-[var(--ag-text-muted)] transition-colors hover:bg-[var(--ag-bg-elevated)]" style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.06)' }}>{i + 1}</div>
                  ))}
                </div>
              </div>
            </BlurFade>
          )}

          {/* Add/Edit dialog */}
          <AddEditDialog
            open={isAddDialogOpen}
            onOpenChange={open => { setIsAddDialogOpen(open); if (!open) { setEditingReminder(null); setNewReminder(emptyForm); } }}
            editingReminder={editingReminder}
            newReminder={newReminder} setNewReminder={setNewReminder}
            onNaturalAdd={handleDialogNaturalAdd}
            onLegacyAdd={handleLegacyAdd}
            onEditSave={handleEditSave}
          />

          {/* Mobile FAB */}
          <motion.button whileTap={{ scale: 0.92 }}
            onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }}
            className="md:hidden fixed bottom-[88px] right-4 w-14 h-14 rounded-full text-white flex items-center justify-center z-40 min-h-[44px]"
            aria-label="Add reminder"
            style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.4), 0 0 0 1px rgba(139,92,246,0.2)' }}
          >
            <Plus className="w-6 h-6" />
          </motion.button>

          {/* Recurring edit choice modal */}
          <AnimatePresence>
            {recurringEditChoice && (
              <motion.div key="recurring-modal"
                initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2 } }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', duration: 0.35, bounce: 0 } }} exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.2 } }}
                  className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl"
                  style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.15)' }}
                >
                  <h3 className="text-base font-bold text-[var(--ag-text-primary)] mb-1">Edit recurring reminder</h3>
                  <p className="text-sm text-[var(--ag-text-muted)] mb-5">
                    This is a <span className="text-[var(--ag-violet)]">{recurringEditChoice.recurrence}</span> reminder. What would you like to edit?
                  </p>
                  <div className="flex flex-col gap-2">
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => { const r = recurringEditChoice; setRecurringEditChoice(null); setEditAsOneOff(true); handleEditClick(r, true); }}
                      className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px] text-[#A78BFA]"
                      style={{ background: 'rgba(167,139,250,0.1)', boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}
                    >This occurrence only</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => { const r = recurringEditChoice; setRecurringEditChoice(null); setEditAsOneOff(false); handleEditClick(r, true); }}
                      className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px] text-[#84CC16]"
                      style={{ background: 'rgba(132,204,22,0.1)', boxShadow: '0 0 0 1px rgba(132,204,22,0.25)' }}
                    >All future occurrences</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => setRecurringEditChoice(null)}
                      className="w-full py-2.5 text-sm text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors min-h-[44px]"
                    >Cancel</motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </PullToRefreshWrapper>
    </DashboardPageWrapper>
  );
}
