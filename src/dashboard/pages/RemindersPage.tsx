// ============================================================
// RemindersPage — Full Redesign v2
// Principles: concentric radii, shadows > borders, scale-on-press,
// stagger enter, tabular-nums, text-wrap: balance, font-smoothing
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader, DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  Plus,
  Calendar,
  Clock,
  Trash2,
  Check,
  CheckCheck,
  Repeat,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  Mic,
  Wand2,
  AlarmClock,
  Pencil,
  Download,
  Copy,
  X,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useDashboardStore } from '@/stores/dashboardStore';
import { reminderService } from '@/services/api';
import { parseNaturalLanguageReminder } from '@/utils/reminderParser';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import type { ReminderChannel, ReminderCategory, ReminderPriority, Reminder } from '@/types';

// ─── Design constants ───────────────────────────────────────────────────────
const categoryHex: Record<string, string> = {
  personal: '#A78BFA',
  work:     '#10B981',
  health:   '#FF2D78',
  other:    '#F59E0B',
};

const priorityConfig: Record<string, { label: string; color: string; hex: string; bg: string }> = {
  low:    { label: 'Low',    color: 'var(--ag-text-muted)', hex: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  normal: { label: 'Normal', color: 'var(--ag-cyan)',       hex: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  high:   { label: 'High',   color: 'var(--ag-amber)',      hex: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  urgent: { label: 'Urgent', color: 'var(--ag-pink)',       hex: '#FF2D78', bg: 'rgba(255,45,120,0.12)'  },
};

const examples = [
  'Remind me tomorrow at 3pm to call mom',
  'Every Monday at 9am team standup',
  'In 2 hours take a break',
  'Daily at 8am drink water',
  'Next Tuesday submit report',
];

// ─── Animation variants ──────────────────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring' as const, duration: 0.35, bounce: 0 },
  },
  exit: {
    opacity: 0, y: -4, filter: 'blur(2px)',
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const },
  },
};

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRelativeTime(datetime: string): string {
  const ms = new Date(datetime).getTime() - Date.now();
  const abs = Math.abs(ms);
  const mins  = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days  = Math.floor(abs / 86_400_000);
  const past  = ms < 0;
  if (abs < 60_000)  return past ? 'just now' : 'in a moment';
  if (mins  < 60)    return past ? `${mins}m ago`  : `in ${mins}m`;
  if (hours < 24)    return past ? `${hours}h ago` : `in ${hours}h`;
  if (days  === 1)   return past ? 'yesterday'     : 'tomorrow';
  return past ? `${days}d ago` : `in ${days}d`;
}

function humanDue(datetime: string): string {
  const d   = new Date(datetime);
  const now = new Date();
  const ms  = d.getTime() - now.getTime();
  if (ms < 0) {
    const abs  = Math.abs(ms);
    const hours = Math.floor(abs / 3_600_000);
    const days  = Math.floor(abs / 86_400_000);
    if (hours < 24) return `Overdue ${hours}h`;
    return `Overdue ${days}d`;
  }
  const todayEnd    = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  if (d <= todayEnd) return 'Today';
  const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  if (d <= tomorrowEnd) return 'Tomorrow';
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 7) return `in ${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupRemindersByCategory(reminders: Reminder[]) {
  const order = ['work', 'personal', 'health', 'other', 'general'];
  const map   = new Map<string, Reminder[]>();
  for (const r of reminders) {
    const cat = r.category ?? 'general';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(r);
  }
  return order
    .filter(cat => map.has(cat))
    .concat([...map.keys()].filter(k => !order.includes(k)))
    .map(cat => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), items: map.get(cat)! }));
}

function groupRemindersByDate(reminders: Reminder[]) {
  const now          = Date.now();
  const todayEnd     = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const tomorrowStart = new Date(todayEnd); tomorrowStart.setDate(tomorrowStart.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd  = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999);
  const weekEnd      = new Date(todayEnd); weekEnd.setDate(weekEnd.getDate() + 7);
  const groups: { label: string; items: Reminder[] }[] = [
    { label: 'Overdue',   items: [] },
    { label: 'Today',     items: [] },
    { label: 'Tomorrow',  items: [] },
    { label: 'This Week', items: [] },
    { label: 'Later',     items: [] },
  ];
  for (const r of reminders) {
    const dueMs = new Date(r.datetime).getTime();
    if      (dueMs < now)                         groups[0].items.push(r);
    else if (dueMs <= todayEnd.getTime())          groups[1].items.push(r);
    else if (dueMs <= tomorrowEnd.getTime())       groups[2].items.push(r);
    else if (dueMs <= weekEnd.getTime())           groups[3].items.push(r);
    else                                           groups[4].items.push(r);
  }
  return groups.filter(g => g.items.length > 0);
}

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const groupHeaderAccent: Record<string, string> = {
  Overdue: '#FF2D78',
  Today:   '#84CC16',
  Tomorrow:'#A78BFA',
  'This Week': '#6B7280',
  Later:   '#4B5563',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function RemindersPage() {
  const {
    reminders,
    addReminder,
    updateReminder,
    toggleReminder,
    snoozeReminder,
    deleteReminder,
    loadReminders,
    bulkSnoozeReminders,
  } = useDashboardStore();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'cal', page: 'reminders' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode]         = useState<'list' | 'calendar'>('list');

  // ── Persisted filters ───────────────────────────────────────────────────────
  const LS_KEY      = 'agentin:reminders:filters';
  const loadFilters = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
  const savedFilters = loadFilters();
  const [filter,           setFilterRaw]          = useState<'all' | 'active' | 'completed'>(savedFilters.filter ?? 'all');
  const [recurrenceFilter, setRecurrenceFilterRaw] = useState<'all' | 'recurring' | 'one-off'>(savedFilters.recurrenceFilter ?? 'all');
  const [categoryFilter,   setCategoryFilterRaw]   = useState<'all' | 'personal' | 'work' | 'health' | 'other'>(savedFilters.categoryFilter ?? 'all');
  const [priorityFilter,   setPriorityFilterRaw]   = useState<'all' | 'urgent' | 'high' | 'normal' | 'low'>(savedFilters.priorityFilter ?? 'all');

  const persistFilters = (updates: Record<string, string>) => {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...loadFilters(), ...updates }));
  };
  const setFilter           = (v: 'all' | 'active' | 'completed')              => { setFilterRaw(v);          persistFilters({ filter: v }); };
  const setRecurrenceFilter = (v: 'all' | 'recurring' | 'one-off')             => { setRecurrenceFilterRaw(v); persistFilters({ recurrenceFilter: v }); };
  const setCategoryFilter   = (v: 'all' | 'personal' | 'work' | 'health' | 'other') => { setCategoryFilterRaw(v);  persistFilters({ categoryFilter: v }); };
  const setPriorityFilter   = (v: 'all' | 'urgent' | 'high' | 'normal' | 'low')    => { setPriorityFilterRaw(v);  persistFilters({ priorityFilter: v }); };

  const [searchQuery,    setSearchQuery]    = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Auto-open dialog from URL param
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsAddDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ── Natural language quick-add ───────────────────────────────────────────────
  const [naturalInput,  setNaturalInput]  = useState('');
  const [parsedReminder, setParsedReminder] = useState<ReturnType<typeof parseNaturalLanguageReminder> | null>(null);
  const [showExamples,  setShowExamples]  = useState(false);
  const [isListening,   setIsListening]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Manual form state ───────────────────────────────────────────────────────
  const [newReminder, setNewReminder] = useState<{
    text: string; datetime: string; channel: ReminderChannel;
    recurring: string; recurrence: 'daily' | 'weekly' | 'monthly' | '';
    category: ReminderCategory; priority: ReminderPriority;
  }>({ text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' });

  // ── Streak ──────────────────────────────────────────────────────────────────
  const [streak, setStreak] = useState<{ streak: number; longestStreak: number; completedToday: boolean } | null>(null);
  useEffect(() => {
    reminderService.getStreak().then(res => setStreak(res.data)).catch(() => {});
  }, []);

  // ── Celebration banner ──────────────────────────────────────────────────────
  const [showCelebration, setShowCelebration] = useState(false);
  const prevActiveCountRef = useRef<number | null>(null);
  useEffect(() => {
    const activeCount    = reminders.filter(r => !r.completed).length;
    const completedCount = reminders.filter(r =>  r.completed).length;
    if (
      prevActiveCountRef.current !== null &&
      prevActiveCountRef.current > 0 &&
      activeCount === 0 &&
      completedCount > 0
    ) {
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(t);
    }
    prevActiveCountRef.current = activeCount;
  }, [reminders]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => loadReminders(), 30_000);
    return () => clearInterval(id);
  }, [loadReminders]);

  // ── Parse NL as user types ───────────────────────────────────────────────────
  useEffect(() => {
    if (naturalInput.trim()) {
      setParsedReminder(parseNaturalLanguageReminder(naturalInput));
    } else {
      setParsedReminder(null);
    }
  }, [naturalInput]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleNaturalAdd = async () => {
    if (!parsedReminder) return;
    void notifyStart('creating reminder');
    try {
      await addReminder({
        text:      parsedReminder.text,
        datetime:  parsedReminder.datetime.toISOString(),
        channel:   'telegram',
        recurring: parsedReminder.recurring,
        category:  'personal',
      });
      void notifyDone(`reminder created: ${parsedReminder.text}`);
    } catch {
      void notifyFail('failed to create reminder');
    }
    setNaturalInput('');
    setParsedReminder(null);
    setIsAddDialogOpen(false);
  };

  const handleExampleClick = (example: string) => {
    setNaturalInput(example);
    inputRef.current?.focus();
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setNaturalInput('(Voice input not supported in this browser)');
      return;
    }
    const SR = (
      (window as unknown as { SpeechRecognition: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition
    );
    const recognition = new SR();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setNaturalInput(Array.from(event.results).map(r => r[0].transcript).join(''));
    };
    recognition.onend  = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const handleLegacyAdd = async () => {
    if (!newReminder.text || !newReminder.datetime) return;
    void notifyStart('creating reminder');
    try {
      await addReminder({
        text:      newReminder.text,
        datetime:  newReminder.datetime,
        channel:   newReminder.channel,
        recurring: newReminder.recurring || undefined,
        recurrence: newReminder.recurrence || undefined,
        category:  newReminder.category,
        priority:  newReminder.priority,
      });
      void notifyDone(`reminder created: ${newReminder.text}`);
    } catch {
      void notifyFail('failed to create reminder');
    }
    setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' });
    setIsAddDialogOpen(false);
  };

  // ── Snooze & toast state ─────────────────────────────────────────────────────
  const [snoozeOpenId,   setSnoozeOpenId]  = useState<string | null>(null);
  const [snoozeToast,    setSnoozeToast]   = useState<string | null>(null);
  const showSnoozeToast = (newDatetime: string) => {
    const dt        = new Date(newDatetime);
    const formatted = dt.toLocaleString('en', { hour: '2-digit', minute: '2-digit', weekday: 'short', month: 'short', day: 'numeric' });
    setSnoozeToast(`Snoozed until ${formatted}`);
    setTimeout(() => setSnoozeToast(null), 3000);
  };
  const [completingIds,    setCompletingIds]    = useState<Set<string>>(new Set());
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  const [editingReminder,  setEditingReminder]  = useState<Reminder | null>(null);
  const [recurringEditChoice, setRecurringEditChoice] = useState<Reminder | null>(null);
  const [editAsOneOff,     setEditAsOneOff]     = useState(false);
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [isBulkDeleting,   setIsBulkDeleting]   = useState(false);
  const [isBulkRestoringSnooze, setIsBulkRestoringSnooze] = useState(false);
  const [isBatchEditing,   setIsBatchEditing]   = useState(false);
  const [groupMode,        setGroupMode]        = useState<'date' | 'category'>('date');
  const [sortMode,         setSortMode]         = useState<'priority' | 'due'>('priority');
  const [selectedActiveIds, setSelectedActiveIds] = useState<Set<string>>(new Set());
  const [isBulkSnoozing,   setIsBulkSnoozing]   = useState(false);
  const [isBulkCompleting, setIsBulkCompleting] = useState(false);
  const [undoToast,        setUndoToast]        = useState<{ ids: string[]; count: number } | null>(null);
  const [isBulkDeletingActive, setIsBulkDeletingActive] = useState(false);

  // ── Inline editing ───────────────────────────────────────────────────────────
  const [inlineEditId,    setInlineEditId]    = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const inlineEditRef = useRef<HTMLInputElement>(null);

  const handleInlineEditSave = async (id: string) => {
    const trimmed = inlineEditValue.trim();
    if (trimmed && trimmed !== reminders.find(r => r.id === id)?.text) {
      await updateReminder(id, { text: trimmed }).catch(() => {});
    }
    setInlineEditId(null);
    setInlineEditValue('');
  };

  // ── Snooze history ───────────────────────────────────────────────────────────
  const [snoozeHistoryId,      setSnoozeHistoryId]      = useState<string | null>(null);
  const [snoozeHistory,        setSnoozeHistory]        = useState<Array<{ id: string; snoozed_at: number; preset: string; new_datetime: string }>>([]);
  const [snoozeHistoryLoading, setSnoozeHistoryLoading] = useState(false);
  const [snoozeCustomId,       setSnoozeCustomId]       = useState<string | null>(null);
  const [snoozeCustomValue,    setSnoozeCustomValue]    = useState('');

  const handleShowSnoozeHistory = async (id: string) => {
    if (snoozeHistoryId === id) { setSnoozeHistoryId(null); return; }
    setSnoozeHistoryId(id);
    setSnoozeHistoryLoading(true);
    try {
      const res = await reminderService.getSnoozeHistory(id);
      setSnoozeHistory(res.data.history);
    } catch { setSnoozeHistory([]); } finally { setSnoozeHistoryLoading(false); }
  };

  const handleSnoozeCustom = async (id: string) => {
    if (!snoozeCustomValue) return;
    try {
      const res = await reminderService.snooze(id, undefined, snoozeCustomValue);
      await snoozeReminder(id, res.data.newDatetime);
      showSnoozeToast(res.data.newDatetime);
      setSnoozeCustomId(null);
      setSnoozeCustomValue('');
      setSnoozeOpenId(null);
    } catch { /* ignore */ }
  };

  // ── Complete / Delete ────────────────────────────────────────────────────────
  const handleComplete = async (id: string) => {
    setCompletingIds(prev => new Set(prev).add(id));
    await new Promise(r => setTimeout(r, 500));
    try {
      await toggleReminder(id);
      void notifyDone('reminder completed');
    } catch {
      void notifyFail('failed to complete reminder');
    }
    setCompletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setJustCompletedIds(prev => new Set(prev).add(id));
    setTimeout(() => setJustCompletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 600);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReminder(id);
      void notifyDone('reminder deleted');
    } catch {
      void notifyFail('failed to delete reminder');
    }
  };

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try {
      await reminderService.duplicate(id);
      await loadReminders();
    } catch { /* non-fatal */ } finally {
      setDuplicatingId(null);
    }
  };

  const handleSnooze = async (id: string, preset: '1h' | 'tomorrow' | 'next-week') => {
    try {
      const res = await reminderService.snooze(id, preset);
      await snoozeReminder(id, res.data.newDatetime);
      showSnoozeToast(res.data.newDatetime);
    } catch { /* ignore */ }
    setSnoozeOpenId(null);
  };

  const handleEditClick = (reminder: Reminder, skipChoiceDialog = false) => {
    if (reminder.recurrence && !skipChoiceDialog) { setRecurringEditChoice(reminder); return; }
    const pad   = (n: number) => String(n).padStart(2, '0');
    const d     = new Date(reminder.datetime);
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const validP: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
    const safePriority: ReminderPriority = validP.includes(reminder.priority as ReminderPriority)
      ? (reminder.priority as ReminderPriority) : 'normal';
    setEditingReminder(reminder);
    setNewReminder({
      text: reminder.text, datetime: local, channel: reminder.channel,
      recurring: reminder.recurring || '', recurrence: (reminder.recurrence as 'daily' | 'weekly' | 'monthly' | undefined) || '',
      category: reminder.category, priority: safePriority,
    });
    setNaturalInput('');
    setParsedReminder(null);
    setIsAddDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingReminder || !newReminder.text || !newReminder.datetime) return;
    if (editAsOneOff) {
      await addReminder({
        text: newReminder.text,
        datetime: new Date(newReminder.datetime).toISOString(),
        channel: newReminder.channel,
        category: newReminder.category,
        priority: newReminder.priority,
      });
    } else {
      await updateReminder(editingReminder.id, {
        text:      newReminder.text,
        datetime:  new Date(newReminder.datetime).toISOString(),
        channel:   newReminder.channel,
        recurring: (newReminder.recurring || undefined) as Reminder['recurring'],
        recurrence: (newReminder.recurrence || undefined) as Reminder['recurrence'],
        category:  newReminder.category,
        priority:  newReminder.priority,
      });
    }
    setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' });
    setEditingReminder(null);
    setEditAsOneOff(false);
    setIsAddDialogOpen(false);
  };

  // ── Bulk handlers ─────────────────────────────────────────────────────────────
  const handleToggleSelect       = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const handleSelectAllCompleted = (checked: boolean) => setSelectedIds(checked ? new Set(completedReminders.map(r => r.id)) : new Set());
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try { await reminderService.bulkDelete(Array.from(selectedIds)); setSelectedIds(new Set()); await loadReminders(); }
    finally { setIsBulkDeleting(false); }
  };
  const handleBatchEdit = async (ids: string[], fields: { priority?: string; category?: string }) => {
    if (ids.length === 0) return;
    setIsBatchEditing(true);
    try { await reminderService.batchEdit(ids, fields); await loadReminders(); }
    finally { setIsBatchEditing(false); }
  };
  const handleBulkRestoreSnooze = async (preset: '1h' | 'tomorrow' | 'next-week') => {
    if (selectedIds.size === 0) return;
    setIsBulkRestoringSnooze(true);
    try { await reminderService.bulkRestoreSnooze(Array.from(selectedIds), preset); setSelectedIds(new Set()); await loadReminders(); }
    finally { setIsBulkRestoringSnooze(false); }
  };
  const handleToggleSelectActive = (id: string) => setSelectedActiveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
      await reminderService.bulkComplete(ids);
      setSelectedActiveIds(new Set());
      await loadReminders();
      setUndoToast({ ids, count: ids.length });
      setTimeout(() => setUndoToast(null), 5000);
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

  // ── Overdue batch complete ────────────────────────────────────────────────────
  const [isMarkingAllOverdue, setIsMarkingAllOverdue] = useState(false);
  const handleMarkAllOverdueComplete = async () => {
    if (overdueReminders.length === 0) return;
    setIsMarkingAllOverdue(true);
    try { await reminderService.bulkComplete(overdueReminders.map(r => r.id)); await loadReminders(); }
    finally { setIsMarkingAllOverdue(false); }
  };

  // ── Date formatting ───────────────────────────────────────────────────────────
  const formatDateTime = (datetime: string) => {
    const d = new Date(datetime);
    return {
      date:    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time:    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      day:     d.getDate(),
      month:   d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    };
  };

  const isOverdue = (datetime: string, completed?: boolean | number) => {
    if (completed === true || completed === 1) return false;
    const t = new Date(datetime).getTime();
    if (isNaN(t)) return false;
    return t < Date.now();
  };

  const isDueSoon = (datetime: string, completed: boolean) => {
    if (completed) return false;
    const ms = new Date(datetime).getTime() - Date.now();
    return ms > 0 && ms <= 24 * 60 * 60 * 1000;
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  const activeReminders    = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r =>  r.completed);
  const overdueReminders   = activeReminders.filter(r => new Date(r.datetime) < new Date());

  const filteredReminders = reminders
    .filter(r => filter === 'active' ? !r.completed : filter === 'completed' ? r.completed : true)
    .filter(r => recurrenceFilter === 'recurring' ? !!r.recurrence : recurrenceFilter === 'one-off' ? !r.recurrence : true)
    .filter(r => categoryFilter !== 'all' ? r.category === categoryFilter : true)
    .filter(r => priorityFilter !== 'all' ? (r.priority ?? 'normal') === priorityFilter : true)
    .filter(r => r.text.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const now     = Date.now();
      const aOver   = !a.completed && new Date(a.datetime).getTime() < now;
      const bOver   = !b.completed && new Date(b.datetime).getTime() < now;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      if (sortMode === 'due') return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      return (priorityOrder[a.priority ?? 'normal'] ?? 2) - (priorityOrder[b.priority ?? 'normal'] ?? 2);
    });

  const handlePullRefresh = async () => { await loadReminders(); };

  const hasActiveFilters = filter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || recurrenceFilter !== 'all' || searchQuery !== '';

  // ── Reminder card renderer ────────────────────────────────────────────────────
  const renderReminderCard = (reminder: Reminder) => {
    const formatted      = formatDateTime(reminder.datetime);
    const overdue        = isOverdue(reminder.datetime, reminder.completed);
    const dueSoon        = isDueSoon(reminder.datetime, reminder.completed);
    const isCompleting   = completingIds.has(reminder.id);
    const isJustComplete = justCompletedIds.has(reminder.id);

    const stripeHex = overdue && !reminder.completed
      ? '#FF2D78'
      : (priorityConfig[reminder.priority ?? 'normal']?.hex ?? '#A78BFA');

    const catHex = categoryHex[reminder.category] ?? '#6B7280';

    return (
      <motion.div
        key={reminder.id}
        variants={cardVariants}
        layout
        data-testid={`reminder-card-${reminder.id}`}
        className={[
          'rounded-2xl transition-[background-color,opacity] duration-300',
          'bg-[var(--ag-bg-surface)] backdrop-blur-xl',
          reminder.completed ? 'opacity-55' : '',
          isJustComplete     ? 'bg-[rgba(16,185,129,0.06)]' : '',
        ].join(' ')}
        style={{
          borderLeft: `3px solid ${stripeHex}`,
          boxShadow: isCompleting
            ? `inset 3px 0 0 #10B981, 0 0 0 1px rgba(16,185,129,0.2), 0 4px 16px rgba(16,185,129,0.1)`
            : overdue && !reminder.completed
            ? `inset 3px 0 0 #FF2D78, 0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,45,120,0.08)`
            : `inset 3px 0 0 ${stripeHex}, 0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        <div className="p-4 flex items-start gap-3">
          {/* Bulk checkbox */}
          {!reminder.completed ? (
            <Checkbox
              checked={selectedActiveIds.has(reminder.id)}
              onCheckedChange={() => handleToggleSelectActive(reminder.id)}
              aria-label="Select reminder for bulk snooze"
              className="mt-1 flex-shrink-0"
            />
          ) : (
            <Checkbox
              checked={selectedIds.has(reminder.id)}
              onCheckedChange={() => handleToggleSelect(reminder.id)}
              aria-label="Select reminder for bulk delete"
              className="mt-1 flex-shrink-0"
            />
          )}

          {/* Date chip */}
          <div
            className="flex-shrink-0 w-12 rounded-xl flex flex-col items-center justify-center py-2 text-center"
            style={{
              background: overdue && !reminder.completed
                ? 'rgba(255,45,120,0.1)'
                : `rgba(${stripeHex.replace('#','').match(/.{2}/g)!.map(h=>parseInt(h,16)).join(',')},0.1)`,
            }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-wider leading-none mb-0.5"
              style={{ color: overdue && !reminder.completed ? '#FF2D78' : stripeHex, fontVariantNumeric: 'tabular-nums' }}
            >
              {formatted.month}
            </span>
            <span
              className="text-xl font-bold leading-none"
              style={{ color: overdue && !reminder.completed ? '#FF2D78' : 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatted.day}
            </span>
            <span className="text-[10px] text-[var(--ag-text-muted)] leading-none mt-0.5">
              {formatted.weekday}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {inlineEditId === reminder.id ? (
                  <input
                    ref={inlineEditRef}
                    autoFocus
                    className="w-full bg-white/[0.05] border border-[var(--ag-border-default)] rounded-lg px-2 py-1 text-[var(--ag-text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ag-violet)]/40 min-h-[44px]"
                    value={inlineEditValue}
                    onChange={e => setInlineEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  void handleInlineEditSave(reminder.id);
                      if (e.key === 'Escape') { setInlineEditId(null); setInlineEditValue(''); }
                    }}
                    onBlur={() => void handleInlineEditSave(reminder.id)}
                  />
                ) : (
                  <p
                    title="Click to edit"
                    onClick={() => { if (!reminder.completed) { setInlineEditId(reminder.id); setInlineEditValue(reminder.text); } }}
                    className={[
                      'text-sm font-medium cursor-text rounded-lg px-1 -mx-1 transition-colors duration-200',
                      'hover:bg-white/[0.04]',
                      isCompleting ? 'line-through text-[var(--ag-text-muted)] opacity-60' : reminder.completed ? 'line-through text-[var(--ag-text-muted)]' : 'text-[var(--ag-text-primary)]',
                    ].join(' ')}
                    style={{ textDecorationColor: isCompleting ? '#10B981' : undefined }}
                  >
                    {reminder.text}
                  </p>
                )}

                {/* Metadata row */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {/* Time */}
                  <span
                    className={`text-xs flex items-center gap-1 ${overdue ? 'text-[#FF2D78]' : 'text-[var(--ag-text-muted)]'}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    {formatted.time}
                  </span>

                  {/* Status badge */}
                  {overdue && !reminder.completed ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FF2D78]/12 text-[#FF2D78]">
                      Overdue
                    </span>
                  ) : !reminder.completed ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#84CC16]/10 text-[#84CC16]">
                      {humanDue(reminder.datetime)}
                    </span>
                  ) : null}

                  {/* Relative time */}
                  <span
                    className="text-[10px] text-[var(--ag-text-muted)]/50"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatRelativeTime(reminder.datetime)}
                  </span>

                  {/* Due soon */}
                  {dueSoon && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#10B981]/12 text-[#10B981]">
                      due in {Math.ceil((new Date(reminder.datetime).getTime() - Date.now()) / 3_600_000)}h
                    </span>
                  )}

                  {/* Category dot + label */}
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1"
                    style={{ backgroundColor: `${catHex}18`, color: catHex }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: catHex }} />
                    {reminder.category}
                  </span>

                  {/* Recurrence */}
                  {reminder.recurring && (
                    <Badge
                      className="text-[10px] px-1.5 py-0 bg-[#84CC16]/12 text-[#84CC16] border-[#84CC16]/20"
                    >
                      <Repeat className="w-2.5 h-2.5 mr-0.5" />
                      {reminder.recurring}
                    </Badge>
                  )}
                  {reminder.recurrence && !reminder.recurring && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-[#A78BFA]/12 text-[#A78BFA] border-[#A78BFA]/20">
                      ↺ {reminder.recurrence}
                    </Badge>
                  )}

                  {/* Priority quick-edit */}
                  {!reminder.completed && (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        const order: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
                        const cur  = order.indexOf((reminder.priority || 'normal') as ReminderPriority);
                        const next = order[(cur + 1) % order.length];
                        void updateReminder(reminder.id, { priority: next });
                      }}
                      title="Click to change priority"
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: priorityConfig[reminder.priority ?? 'normal']?.bg,
                        color:           priorityConfig[reminder.priority ?? 'normal']?.color,
                        borderColor:     `${priorityConfig[reminder.priority ?? 'normal']?.hex}40`,
                      }}
                    >
                      {priorityConfig[reminder.priority ?? 'normal']?.label}
                    </motion.button>
                  )}

                  {/* Snooze count + history popover */}
                  {(reminder.snoozeCount ?? 0) > 0 && (
                    <div className="relative">
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => void handleShowSnoozeHistory(reminder.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/25 hover:bg-[#F59E0B]/20 transition-colors"
                        aria-label="Show snooze history"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        Snoozed {reminder.snoozeCount}×
                      </motion.button>
                      {snoozeHistoryId === reminder.id && (
                        <div className="absolute left-0 top-full mt-1.5 z-20 rounded-xl p-3 min-w-[220px]"
                          style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.2)' }}
                        >
                          <p className="text-xs font-semibold text-[#F59E0B] mb-2">Snooze history</p>
                          {snoozeHistoryLoading ? (
                            <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin mx-auto" />
                          ) : snoozeHistory.length === 0 ? (
                            <p className="text-xs text-[var(--ag-text-muted)]">No history yet</p>
                          ) : (
                            <>
                              <div className="space-y-1.5">
                                {snoozeHistory.map(h => (
                                  <div key={h.id} className="text-xs text-[var(--ag-text-muted)]">
                                    <span className="text-[var(--ag-text-primary)]">{h.preset}</span>{' → '}
                                    {new Date(h.new_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                ))}
                              </div>
                              {(() => {
                                const counts: Record<string, number> = {};
                                snoozeHistory.forEach(h => { counts[h.preset] = (counts[h.preset] ?? 0) + 1; });
                                const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                                return (
                                  <p className="text-[10px] text-[var(--ag-text-muted)]/60 border-t border-[#F59E0B]/15 pt-1.5 mt-1.5">
                                    {snoozeHistory.length} snooze{snoozeHistory.length !== 1 ? 's' : ''}
                                    {mostUsed && <> · <span className="text-[#F59E0B]">{mostUsed}</span> most used</>}
                                  </p>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Complete */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void handleComplete(reminder.id)}
                  aria-label={reminder.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  className={[
                    'p-2.5 rounded-xl transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center',
                    isCompleting          ? 'bg-[#10B981]/25 text-[#10B981]'
                    : reminder.completed  ? 'bg-[#10B981]/15 text-[#10B981]'
                    : 'text-[var(--ag-text-muted)] hover:bg-[#10B981]/10 hover:text-[#10B981]',
                  ].join(' ')}
                >
                  <Check className={`w-4 h-4 ${isCompleting ? 'scale-125' : ''} transition-transform duration-200`} />
                </motion.button>

                {/* Snooze */}
                {!reminder.completed && (
                  <div className="relative">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSnoozeOpenId(snoozeOpenId === reminder.id ? null : reminder.id)}
                      aria-label="Snooze reminder"
                      className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#F59E0B]/10 hover:text-[#F59E0B] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <AlarmClock className="w-4 h-4" />
                    </motion.button>
                    <AnimatePresence>
                      {snoozeOpenId === reminder.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.25, bounce: 0 } }}
                          exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.15 } }}
                          className="absolute right-0 top-full mt-1.5 z-10 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[140px]"
                          style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.15)' }}
                        >
                          {(['1h', 'tomorrow', 'next-week'] as const).map(p => (
                            <button key={p} onClick={() => void handleSnooze(reminder.id, p)}
                              className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#F59E0B]/10 text-[var(--ag-text-primary)] whitespace-nowrap transition-colors"
                            >
                              {p === '1h' ? '+1 hour' : p === 'tomorrow' ? 'Tomorrow 9am' : 'Next week'}
                            </button>
                          ))}
                          <button onClick={() => setSnoozeCustomId(snoozeCustomId === reminder.id ? null : reminder.id)}
                            className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#F59E0B]/10 text-[#F59E0B] whitespace-nowrap transition-colors"
                          >
                            Custom time…
                          </button>
                          {snoozeCustomId === reminder.id && (
                            <div className="flex gap-1 mt-1 px-1 pb-1">
                              <input type="datetime-local"
                                className="text-xs border border-[#F59E0B]/25 rounded-lg px-2 py-1 bg-transparent text-[var(--ag-text-primary)] flex-1 min-w-0 focus:outline-none focus:border-[#F59E0B]/60"
                                value={snoozeCustomValue}
                                onChange={e => setSnoozeCustomValue(e.target.value)}
                              />
                              <button onClick={() => void handleSnoozeCustom(reminder.id)}
                                className="text-xs px-2 py-1 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] hover:bg-[#F59E0B]/25 whitespace-nowrap transition-colors"
                              >Set</button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Duplicate */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void handleDuplicate(reminder.id)}
                  aria-label="Duplicate reminder"
                  disabled={duplicatingId === reminder.id}
                  className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#84CC16]/10 hover:text-[#84CC16] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40"
                >
                  <Copy className="w-4 h-4" />
                </motion.button>

                {/* Edit */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleEditClick(reminder)}
                  aria-label="Edit reminder"
                  className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#A78BFA]/10 hover:text-[#A78BFA] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Pencil className="w-4 h-4" />
                </motion.button>

                {/* Delete */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void handleDelete(reminder.id)}
                  aria-label="Delete reminder"
                  className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#FF2D78]/10 hover:text-[#FF2D78] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PullToRefreshWrapper onRefresh={handlePullRefresh}>
        <div
          className="space-y-5 pb-24 md:pb-6"
          data-testid="reminders-page"
          style={{ WebkitFontSmoothing: 'antialiased' }}
        >

          {/* ── Floating toasts ───────────────────────────────────────────── */}
          <AnimatePresence>
            {snoozeToast && (
              <motion.div
                key="snooze-toast"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }}
                exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.2 } }}
                data-testid="snooze-toast"
                className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl backdrop-blur-xl text-[#F59E0B] text-sm font-medium"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.2)', background: 'var(--ag-bg-elevated)' }}
              >
                <AlarmClock className="w-4 h-4 flex-shrink-0" />
                {snoozeToast}
              </motion.div>
            )}
            {undoToast && (
              <motion.div
                key="undo-toast"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }}
                exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.2 } }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl text-[#10B981] text-sm font-medium whitespace-nowrap"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.2)', background: 'var(--ag-bg-elevated)' }}
              >
                <CheckCheck className="w-4 h-4 flex-shrink-0" />
                <span>{undoToast.count} reminder{undoToast.count > 1 ? 's' : ''} done</span>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => void handleUndoBulkComplete()}
                  className="underline text-[#10B981]/70 hover:text-[#10B981] transition-colors text-xs font-semibold min-h-[44px] px-2"
                >Undo</motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setUndoToast(null)}
                  className="text-[#10B981]/40 hover:text-[#10B981] ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Banners ───────────────────────────────────────────────────── */}
          <AnimatePresence>
            {showCelebration && (
              <motion.div
                key="celebration"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.4, bounce: 0 } }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl backdrop-blur-xl"
                style={{ background: 'rgba(16,185,129,0.08)', boxShadow: '0 0 0 1px rgba(16,185,129,0.2), 0 4px 16px rgba(16,185,129,0.06)' }}
              >
                <span className="text-sm font-semibold text-[#10B981]" style={{ textWrap: 'balance' } as React.CSSProperties}>
                  🎉 All caught up for today!
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowCelebration(false)}
                  className="text-[#10B981]/50 hover:text-[#10B981] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}
            {!showCelebration && overdueReminders.length > 3 && (
              <motion.div
                key="overdue-banner"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.4, bounce: 0 } }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl backdrop-blur-xl"
                style={{ background: 'rgba(255,45,120,0.07)', boxShadow: '0 0 0 1px rgba(255,45,120,0.2), 0 4px 16px rgba(255,45,120,0.06)' }}
              >
                <span className="text-sm font-medium text-[#FF2D78] flex items-center gap-2">
                  <AlarmClock className="w-4 h-4" />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{overdueReminders.length}</span>
                  overdue reminders
                </span>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => void handleMarkAllOverdueComplete()}
                  disabled={isMarkingAllOverdue}
                  className="text-xs font-semibold px-3 py-2 rounded-xl text-white transition-opacity disabled:opacity-50 min-h-[44px]"
                  style={{ background: 'linear-gradient(135deg, #FF2D78, #F59E0B)' }}
                >
                  {isMarkingAllOverdue ? 'Marking…' : 'Mark all complete'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Page header ───────────────────────────────────────────────── */}
          <BlurFade delay={0.05} inView>
            <PageHeader
              icon={Bell}
              title="Reminders"
              subtitle={`${activeReminders.length} active · ${completedReminders.length} completed`}
              badge={
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.3)', color: '#84CC16' }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#84CC16] opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#84CC16]" />
                  </span>
                  Cal
                </span>
              }
              actions={
                <div className="flex items-center gap-2">
                  {streak && streak.streak > 0 && (
                    <div
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl"
                      style={{ background: 'rgba(245,158,11,0.08)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }}
                    >
                      <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span className="text-sm font-semibold text-[#F59E0B]" style={{ fontVariantNumeric: 'tabular-nums' }}>{streak.streak}</span>
                      <span className="text-xs text-[var(--ag-text-muted)]">day streak</span>
                    </div>
                  )}
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      data-testid="create-reminder-button"
                      onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }}
                      className="text-white min-h-[44px] transition-[box-shadow] duration-300 hover:shadow-[var(--ag-glow-sm)]"
                      style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Reminder
                    </Button>
                  </motion.div>
                </div>
              }
            />
          </BlurFade>

          {/* ── Stats row ──────────────────────────────────────────────────── */}
          <BlurFade delay={0.12} inView>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Active',    value: activeReminders.length,    color: '#A78BFA', glow: 'rgba(167,139,250,0.1)' },
                { label: 'Overdue',   value: overdueReminders.length,   color: overdueReminders.length > 0 ? '#FF2D78' : '#6B7280', glow: overdueReminders.length > 0 ? 'rgba(255,45,120,0.08)' : 'transparent' },
                { label: 'Completed', value: completedReminders.length, color: '#10B981', glow: 'rgba(16,185,129,0.08)' },
                { label: 'Streak',    value: streak?.streak ?? 0,       color: '#F59E0B', glow: 'rgba(245,158,11,0.08)', suffix: 'd' },
              ].map(({ label, value, color, glow, suffix }) => (
                <div key={label}
                  className="rounded-2xl px-4 py-3 backdrop-blur-xl"
                  style={{ background: 'var(--ag-bg-surface)', boxShadow: `0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px ${glow === 'transparent' ? 'rgba(139,92,246,0.06)' : color + '22'}, ${glow !== 'transparent' ? `0 0 20px ${glow}` : ''}` }}
                >
                  <p className="text-xs text-[var(--ag-text-muted)] mb-0.5">{label}</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                    {value}{suffix ?? ''}
                  </p>
                </div>
              ))}
            </div>
          </BlurFade>

          {/* ── Quick Add ──────────────────────────────────────────────────── */}
          <BlurFade delay={0.18} inView>
            <div
              className="rounded-2xl p-4 backdrop-blur-xl"
              style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(132,204,22,0.12)' }}>
                  <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" />
                </div>
                <span className="text-sm font-semibold text-[var(--ag-text-primary)]" style={{ textWrap: 'balance' } as React.CSSProperties}>Quick Add</span>
                <span className="text-xs text-[var(--ag-text-muted)]">— type naturally</span>
              </div>

              {/* Input row */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder='Remind me tomorrow at 3pm…'
                    value={naturalInput}
                    onChange={e => setNaturalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && parsedReminder) void handleNaturalAdd(); }}
                    className="w-full px-4 py-3 min-h-[44px] rounded-xl text-sm text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)] bg-transparent focus:outline-none transition-[box-shadow] duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      boxShadow: naturalInput
                        ? '0 0 0 1.5px rgba(132,204,22,0.4), 0 0 12px rgba(132,204,22,0.08)'
                        : '0 0 0 1px rgba(139,92,246,0.12)',
                    }}
                  />
                  {parsedReminder && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#10B981]">✓ Parsed</span>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleVoiceInput}
                  aria-label={isListening ? 'Listening… tap to stop' : 'Voice input'}
                  className="p-3 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-200"
                  style={{
                    background: isListening ? 'rgba(255,45,120,0.15)' : 'rgba(255,255,255,0.04)',
                    boxShadow: isListening ? '0 0 0 1px rgba(255,45,120,0.3)' : '0 0 0 1px rgba(139,92,246,0.1)',
                    color: isListening ? '#FF2D78' : 'var(--ag-text-muted)',
                  }}
                >
                  <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => void handleNaturalAdd()}
                  disabled={!parsedReminder}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-white min-h-[44px] disabled:opacity-40 transition-[box-shadow,opacity] duration-200"
                  style={{ background: 'linear-gradient(135deg, #84CC16, #65A30D)', boxShadow: parsedReminder ? '0 4px 16px rgba(132,204,22,0.25)' : 'none' }}
                >
                  <Wand2 className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Parsed preview */}
              <AnimatePresence>
                {parsedReminder && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                    className="mt-3 p-3.5 rounded-xl"
                    style={{ background: 'rgba(132,204,22,0.05)', boxShadow: '0 0 0 1px rgba(132,204,22,0.15)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ag-text-muted)]">Preview</span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: parsedReminder.confidence > 0.8 ? '#10B981' : parsedReminder.confidence > 0.5 ? '#F59E0B' : '#FF2D78',
                          background: parsedReminder.confidence > 0.8 ? 'rgba(16,185,129,0.1)' : parsedReminder.confidence > 0.5 ? 'rgba(245,158,11,0.1)' : 'rgba(255,45,120,0.1)',
                        }}
                      >
                        {parsedReminder.confidence > 0.8 ? 'High' : parsedReminder.confidence > 0.5 ? 'Medium' : 'Low'} confidence
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)] mb-1.5">{parsedReminder.text}</p>
                    <div className="flex items-center gap-2 text-xs text-[#F59E0B]">
                      <Calendar className="w-3 h-3" />
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {parsedReminder.datetime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {parsedReminder.recurring && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-[#84CC16]/12 text-[#84CC16] border-[#84CC16]/20">
                          <Repeat className="w-2.5 h-2.5 mr-0.5" />{parsedReminder.recurring}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Examples */}
              <div className="mt-3">
                <button
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-colors min-h-[44px] px-2 -ml-2"
                >
                  {showExamples ? 'Hide' : 'Show'} examples
                </button>
                <AnimatePresence>
                  {showExamples && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto', transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 flex flex-wrap gap-2">
                        {examples.map(ex => (
                          <motion.button
                            key={ex}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleExampleClick(ex)}
                            className="text-xs px-3 py-2 rounded-xl text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-[background-color,color,box-shadow] duration-200 min-h-[44px]"
                            style={{ background: 'rgba(255,255,255,0.03)', boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                          >
                            {ex}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </BlurFade>

          {/* ── Search & Filters ───────────────────────────────────────────── */}
          <BlurFade delay={0.24} inView>
            <div
              className="rounded-2xl p-3 backdrop-blur-xl space-y-2.5"
              style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.06)' }}
            >
              {/* Search + view controls */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)] pointer-events-none" />
                  <Input
                    placeholder="Search reminders…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 min-h-[44px] bg-transparent border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)] transition-[border-color,box-shadow]"
                    style={{ boxShadow: searchQuery ? '0 0 0 1px rgba(139,92,246,0.2)' : undefined }}
                  />
                </div>
                {/* Sort mode */}
                <div className="flex items-center rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}>
                  {(['priority', 'due'] as const).map(mode => (
                    <motion.button key={mode} whileTap={{ scale: 0.94 }}
                      onClick={() => setSortMode(mode)}
                      aria-label={`Sort by ${mode}`}
                      className={`px-3 min-h-[44px] text-xs font-medium transition-[background-color,color] duration-150 ${sortMode === mode ? 'text-[#A78BFA]' : 'text-[var(--ag-text-muted)]'}`}
                      style={{ background: sortMode === mode ? 'rgba(167,139,250,0.12)' : 'transparent' }}
                    >
                      {mode === 'priority' ? 'P↑' : 'Due↑'}
                    </motion.button>
                  ))}
                </div>
                {/* Group mode */}
                <div className="flex items-center rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setGroupMode('date')} aria-label="Group by date"
                    className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${groupMode === 'date' ? 'text-[#84CC16]' : 'text-[var(--ag-text-muted)]'}`}
                    style={{ background: groupMode === 'date' ? 'rgba(132,204,22,0.1)' : 'transparent' }}
                  >
                    <Calendar className="w-4 h-4" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setGroupMode('category')} aria-label="Group by category"
                    className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${groupMode === 'category' ? 'text-[#A78BFA]' : 'text-[var(--ag-text-muted)]'}`}
                    style={{ background: groupMode === 'category' ? 'rgba(167,139,250,0.1)' : 'transparent' }}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </motion.button>
                </div>
                {/* View mode */}
                <div className="flex items-center rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setViewMode('list')} aria-label="List view"
                    className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${viewMode === 'list' ? 'text-[#84CC16]' : 'text-[var(--ag-text-muted)]'}`}
                    style={{ background: viewMode === 'list' ? 'rgba(132,204,22,0.1)' : 'transparent' }}
                  >
                    <List className="w-4 h-4" />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setViewMode('calendar')} aria-label="Calendar view"
                    className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${viewMode === 'calendar' ? 'text-[#84CC16]' : 'text-[var(--ag-text-muted)]'}`}
                    style={{ background: viewMode === 'calendar' ? 'rgba(132,204,22,0.1)' : 'transparent' }}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Status tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {(['all', 'active', 'completed'] as const).map(v => (
                  <motion.button key={v} whileTap={{ scale: 0.96 }}
                    onClick={() => setFilter(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150 ${filter === v ? 'text-[var(--ag-text-primary)]' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)]'}`}
                    style={{ background: filter === v ? 'rgba(167,139,250,0.15)' : 'transparent', boxShadow: filter === v ? '0 0 0 1px rgba(167,139,250,0.25)' : 'none' }}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </motion.button>
                ))}
                <div className="w-px h-5 bg-[var(--ag-border-subtle)] mx-1 flex-shrink-0" />
                {(['all', 'recurring', 'one-off'] as const).map(v => (
                  <motion.button key={v} whileTap={{ scale: 0.96 }}
                    onClick={() => setRecurrenceFilter(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150 ${recurrenceFilter === v ? 'text-[#F59E0B]' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)]'}`}
                    style={{ background: recurrenceFilter === v ? 'rgba(245,158,11,0.1)' : 'transparent', boxShadow: recurrenceFilter === v ? '0 0 0 1px rgba(245,158,11,0.25)' : 'none' }}
                  >
                    {v === 'all' ? 'All types' : v === 'recurring' ? '↺ Recurring' : '• One-off'}
                  </motion.button>
                ))}
                {/* Export buttons */}
                <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                  <motion.button whileTap={{ scale: 0.94 }}
                    className="px-2 py-1.5 rounded-lg text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-colors min-h-[36px] flex items-center gap-1"
                    style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                    aria-label="Export reminders as CSV"
                    onClick={async () => {
                      try {
                        const { data } = await reminderService.exportCsv(filter);
                        const blob = new Blob([data], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url;
                        a.download = `reminders-${new Date().toISOString().slice(0,10)}.csv`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch { /* ignore */ }
                    }}
                  >
                    <Download className="w-3 h-3" />CSV
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.94 }}
                    className="px-2 py-1.5 rounded-lg text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-colors min-h-[36px] flex items-center gap-1"
                    style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                    aria-label="Export reminders as iCalendar"
                    onClick={async () => {
                      try {
                        const { data } = await reminderService.exportIcs('active');
                        const blob = new Blob([data], { type: 'text/calendar' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url;
                        a.download = `reminders-${new Date().toISOString().slice(0,10)}.ics`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch { /* ignore */ }
                    }}
                  >
                    <Download className="w-3 h-3" />iCal
                  </motion.button>
                </div>
              </div>

              {/* Category + Priority filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                {(['all', 'personal', 'work', 'health', 'other'] as const).map(cat => {
                  const hex = cat === 'all' ? '#A78BFA' : (categoryHex[cat] ?? '#6B7280');
                  const on  = categoryFilter === cat;
                  return (
                    <motion.button key={cat} whileTap={{ scale: 0.94 }}
                      onClick={() => setCategoryFilter(cat)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150"
                      style={{
                        color:      on ? hex : 'var(--ag-text-muted)',
                        background: on ? `${hex}18` : 'transparent',
                        boxShadow:  on ? `0 0 0 1px ${hex}44` : '0 0 0 1px rgba(139,92,246,0.08)',
                      }}
                    >
                      {cat === 'all' ? 'All cats' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </motion.button>
                  );
                })}
                <div className="w-px h-5 bg-[var(--ag-border-subtle)] mx-1 flex-shrink-0" />
                {(['all', 'urgent', 'high', 'normal', 'low'] as const).map(pri => {
                  const cfg = pri === 'all' ? null : priorityConfig[pri];
                  const hex = cfg?.hex ?? '#A78BFA';
                  const on  = priorityFilter === pri;
                  return (
                    <motion.button key={pri} whileTap={{ scale: 0.94 }}
                      onClick={() => setPriorityFilter(pri)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150"
                      style={{
                        color:      on ? hex : 'var(--ag-text-muted)',
                        background: on ? `${hex}18` : 'transparent',
                        boxShadow:  on ? `0 0 0 1px ${hex}44` : '0 0 0 1px rgba(139,92,246,0.08)',
                      }}
                    >
                      {pri === 'all' ? 'All priorities' : cfg?.label ?? pri}
                    </motion.button>
                  );
                })}
                {hasActiveFilters && (
                  <motion.button whileTap={{ scale: 0.94 }}
                    onClick={() => { setFilter('all'); setCategoryFilter('all'); setPriorityFilter('all'); setRecurrenceFilter('all'); setSearchQuery(''); }}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap min-h-[36px] transition-colors ml-1"
                    style={{ color: '#FF2D78', background: 'rgba(255,45,120,0.08)', boxShadow: '0 0 0 1px rgba(255,45,120,0.2)' }}
                  >
                    <X className="w-3 h-3" /> Clear all
                  </motion.button>
                )}
              </div>
            </div>
          </BlurFade>

          {/* ── Bulk action bars ───────────────────────────────────────────── */}
          {activeReminders.length > 0 && (filter === 'active' || filter === 'all') && (
            <BlurFade delay={0.28} inView>
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap backdrop-blur-xl"
                data-testid="bulk-snooze-bar"
                style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.06)' }}
              >
                <Checkbox
                  id="select-all-active"
                  checked={selectedActiveIds.size > 0 && activeReminders.every(r => selectedActiveIds.has(r.id))}
                  onCheckedChange={checked => checked ? setSelectedActiveIds(new Set(activeReminders.map(r => r.id))) : setSelectedActiveIds(new Set())}
                  aria-label="Select all active reminders"
                />
                <label htmlFor="select-all-active" className="text-sm text-[var(--ag-text-muted)] cursor-pointer select-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  Active ({activeReminders.length})
                </label>
                {selectedActiveIds.size > 0 && (
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[var(--ag-text-muted)]">Snooze {selectedActiveIds.size}:</span>
                    {(['1h', 'tomorrow', 'next-week'] as const).map(p => (
                      <motion.button key={p} whileTap={{ scale: 0.94 }}
                        onClick={() => void handleBulkSnooze(p)} disabled={isBulkSnoozing}
                        className="text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                        style={{ background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 0 1px rgba(245,158,11,0.25)', color: '#F59E0B' }}
                      >
                        {p === '1h' ? '+1h' : p === 'tomorrow' ? 'Tomorrow' : 'Next week'}
                      </motion.button>
                    ))}
                    <motion.button whileTap={{ scale: 0.94 }}
                      onClick={() => void handleBulkComplete()} disabled={isBulkCompleting}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                      style={{ background: 'rgba(16,185,129,0.1)', boxShadow: '0 0 0 1px rgba(16,185,129,0.25)', color: '#10B981' }}
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Done
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.94 }}
                      onClick={() => void handleBulkDeleteActive()} disabled={isBulkDeletingActive}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                      style={{ background: 'rgba(255,45,120,0.1)', boxShadow: '0 0 0 1px rgba(255,45,120,0.25)', color: '#FF2D78' }}
                      aria-label="Delete selected active reminders"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedActiveIds.size})
                    </motion.button>
                    <select disabled={isBatchEditing}
                      onChange={e => { if (e.target.value) { void handleBatchEdit(Array.from(selectedActiveIds), { priority: e.target.value }); e.target.value = ''; } }}
                      className="text-xs px-2 py-2 rounded-lg bg-[var(--ag-bg-surface)] disabled:opacity-50 min-h-[36px] text-[#A78BFA]"
                      style={{ boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}
                      aria-label="Set priority for selected reminders"
                    >
                      <option value="">Priority…</option>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <select disabled={isBatchEditing}
                      onChange={e => { if (e.target.value) { void handleBatchEdit(Array.from(selectedActiveIds), { category: e.target.value }); e.target.value = ''; } }}
                      className="text-xs px-2 py-2 rounded-lg bg-[var(--ag-bg-surface)] disabled:opacity-50 min-h-[36px] text-[#A78BFA]"
                      style={{ boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}
                      aria-label="Set category for selected reminders"
                    >
                      <option value="">Category…</option>
                      <option value="personal">Personal</option>
                      <option value="work">Work</option>
                      <option value="health">Health</option>
                      <option value="finance">Finance</option>
                      <option value="general">General</option>
                    </select>
                    {isBulkSnoozing && <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" />}
                  </div>
                )}
              </div>
            </BlurFade>
          )}

          {completedReminders.length > 0 && (filter === 'completed' || filter === 'all') && (
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap backdrop-blur-xl"
              style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.06)' }}
            >
              <Checkbox
                id="select-all-completed"
                checked={selectedIds.size > 0 && completedReminders.every(r => selectedIds.has(r.id))}
                onCheckedChange={handleSelectAllCompleted}
                aria-label="Select all completed reminders"
              />
              <label htmlFor="select-all-completed" className="text-sm text-[var(--ag-text-muted)] cursor-pointer select-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                Completed ({completedReminders.length})
              </label>
              {selectedIds.size > 0 && (
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--ag-text-muted)]">Restore {selectedIds.size}:</span>
                  {(['1h', 'tomorrow', 'next-week'] as const).map(p => (
                    <motion.button key={p} whileTap={{ scale: 0.94 }}
                      onClick={() => void handleBulkRestoreSnooze(p)} disabled={isBulkRestoringSnooze}
                      className="text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                      style={{ background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 0 1px rgba(245,158,11,0.25)', color: '#F59E0B' }}
                    >
                      {p === '1h' ? '+1h' : p === 'tomorrow' ? 'Tomorrow' : 'Next week'}
                    </motion.button>
                  ))}
                  {isBulkRestoringSnooze && <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" />}
                  <motion.button whileTap={{ scale: 0.94 }}
                    onClick={() => void handleBulkDelete()} disabled={isBulkDeleting}
                    className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg disabled:opacity-50 min-h-[36px]"
                    style={{ background: 'rgba(255,45,120,0.1)', boxShadow: '0 0 0 1px rgba(255,45,120,0.25)', color: '#FF2D78' }}
                  >
                    {isBulkDeleting
                      ? <div className="w-3.5 h-3.5 border-2 border-[#FF2D78]/30 border-t-[#FF2D78] rounded-full animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                    Delete ({selectedIds.size})
                  </motion.button>
                </div>
              )}
            </div>
          )}

          {/* ── Reminder list / Calendar ───────────────────────────────────── */}
          {viewMode === 'list' ? (
            filteredReminders.length === 0 ? (
              <BlurFade delay={0.32} inView>
                <div className="text-center py-20 flex flex-col items-center">
                  <div className="relative mb-6">
                    <div
                      className="w-20 h-20 rounded-3xl flex items-center justify-center mb-2"
                      style={{ background: 'rgba(132,204,22,0.08)', boxShadow: '0 0 40px rgba(132,204,22,0.1), 0 0 0 1px rgba(132,204,22,0.12)' }}
                    >
                      <Bell className="w-9 h-9 text-[#84CC16]/60" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#84CC16]/20 animate-ping" />
                  </div>
                  <p className="text-lg font-semibold text-[var(--ag-text-primary)] mb-1" style={{ textWrap: 'balance' } as React.CSSProperties}>
                    No reminders yet
                  </p>
                  <p className="text-sm text-[var(--ag-text-muted)] mt-1 max-w-xs" style={{ textWrap: 'pretty' } as React.CSSProperties}>
                    Try: <span className="text-[#84CC16]/80 font-mono text-xs">&ldquo;Remind me tomorrow at 3pm to call mom&rdquo;</span>
                  </p>
                  <motion.div whileTap={{ scale: 0.96 }} className="mt-6">
                    <Button
                      onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }}
                      className="text-white font-semibold px-6 py-2.5 min-h-[44px] transition-[box-shadow] duration-300"
                      style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.3)' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create your first reminder
                    </Button>
                  </motion.div>
                </div>
              </BlurFade>
            ) : filter === 'active' ? (
              // Grouped active view
              <div className="space-y-5">
                {(groupMode === 'category' ? groupRemindersByCategory(filteredReminders) : groupRemindersByDate(filteredReminders)).map(({ label, items }) => {
                  const accent = groupMode === 'date'
                    ? (groupHeaderAccent[label] ?? '#6B7280')
                    : (categoryHex[label.toLowerCase()] ?? '#A78BFA');
                  return (
                    <div key={label}>
                      {/* Group header */}
                      <div className="flex items-center gap-2.5 mb-3 px-1">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}80` }} />
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent, textWrap: 'balance' } as React.CSSProperties}>
                          {label}
                        </span>
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded-full ml-0.5"
                          style={{ color: accent, background: `${accent}18`, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {items.length}
                        </span>
                        <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accent}20, transparent)` }} />
                      </div>
                      {/* Items with stagger */}
                      <motion.div
                        variants={listVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-2"
                      >
                        {items.map(r => renderReminderCard(r))}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Flat view (all / completed)
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredReminders.map(r => renderReminderCard(r))}
                </AnimatePresence>
              </motion.div>
            )
          ) : (
            // Calendar view
            <BlurFade delay={0.32} inView>
              <div
                className="rounded-2xl p-5 backdrop-blur-xl"
                style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-[#84CC16]" />
                  <h3 className="text-base font-semibold text-[var(--ag-text-primary)]" style={{ textWrap: 'balance' } as React.CSSProperties}>
                    Calendar View
                  </h3>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-[10px] font-semibold text-[var(--ag-text-muted)] uppercase tracking-wide py-2">{day}</div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i}
                      className="aspect-square rounded-xl flex items-center justify-center text-xs text-[var(--ag-text-muted)] transition-colors hover:bg-[var(--ag-bg-elevated)]"
                      style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.06)' }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>
          )}

          {/* ── Add / Edit Dialog ──────────────────────────────────────────── */}
          <Dialog open={isAddDialogOpen} onOpenChange={open => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingReminder(null);
              setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' });
            }
          }}>
            <DialogContent
              className="border-[var(--ag-border-subtle)] backdrop-blur-xl max-h-[90vh] overflow-y-auto"
              style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.12)' }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-[var(--ag-text-primary)]" style={{ textWrap: 'balance' } as React.CSSProperties}>
                  {editingReminder ? 'Edit Reminder' : 'Add Reminder'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* NL input — new mode only */}
                {!editingReminder && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-2 block">
                        Type naturally (e.g., "tomorrow at 3pm call mom")
                      </label>
                      <div className="flex gap-2">
                        <Input
                          ref={inputRef}
                          data-testid="reminder-text"
                          placeholder="Remind me…"
                          value={naturalInput}
                          onChange={e => setNaturalInput(e.target.value)}
                          className="flex-1 min-h-[44px] border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)]"
                          autoFocus
                        />
                        <motion.button whileTap={{ scale: 0.9 }}
                          onClick={() => void handleNaturalAdd()} disabled={!parsedReminder}
                          className="p-3 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
                          style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)' }}
                        >
                          <Wand2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                      <AnimatePresence>
                        {parsedReminder && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                            exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                            className="mt-3 p-3.5 rounded-xl"
                            style={{ background: 'rgba(16,185,129,0.06)', boxShadow: '0 0 0 1px rgba(16,185,129,0.15)' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ag-text-muted)]">Will create</span>
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  color: parsedReminder.confidence > 0.8 ? '#10B981' : parsedReminder.confidence > 0.5 ? '#F59E0B' : '#FF2D78',
                                  background: parsedReminder.confidence > 0.8 ? 'rgba(16,185,129,0.1)' : parsedReminder.confidence > 0.5 ? 'rgba(245,158,11,0.1)' : 'rgba(255,45,120,0.1)',
                                }}
                              >
                                {Math.round(parsedReminder.confidence * 100)}%
                              </span>
                            </div>
                            <p className="text-sm font-medium text-[var(--ag-text-primary)]">{parsedReminder.text}</p>
                            <p className="text-xs text-[#F59E0B] mt-1 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {parsedReminder.datetime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {parsedReminder.recurring && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-[#84CC16]/12 text-[#84CC16] border-[#84CC16]/20 ml-1">
                                  <Repeat className="w-2.5 h-2.5 mr-0.5" />{parsedReminder.recurring}
                                </Badge>
                              )}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-px" style={{ background: 'var(--ag-border-subtle)' }} />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-3 text-xs text-[var(--ag-text-muted)]" style={{ background: 'var(--ag-bg-elevated)' }}>Or manually</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Manual form */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-1.5 block">What to remind?</label>
                    <Input
                      placeholder="Enter reminder text…"
                      value={newReminder.text}
                      onChange={e => setNewReminder({ ...newReminder, text: e.target.value })}
                      className="min-h-[44px] border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-1.5 block">When?</label>
                      <Input
                        type="datetime-local"
                        value={newReminder.datetime}
                        onChange={e => setNewReminder({ ...newReminder, datetime: e.target.value })}
                        className="min-h-[44px] border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)]"
                      />
                      {editingReminder && newReminder.datetime && (
                        <p className="text-xs text-[#84CC16] mt-1.5 font-medium">
                          {humanDue(new Date(newReminder.datetime).toISOString())}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { label: '+1h',      fn: () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 16) },
                          { label: 'Tmrw 9am', fn: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString().slice(0, 16); } },
                          { label: 'Mon 9am',  fn: () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day)); d.setHours(9, 0, 0, 0); return d.toISOString().slice(0, 16); } },
                          { label: '+1 week',  fn: () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16) },
                        ].map(({ label, fn }) => (
                          <motion.button key={label} whileTap={{ scale: 0.94 }}
                            type="button"
                            onClick={() => setNewReminder({ ...newReminder, datetime: fn() })}
                            className="px-2.5 py-2 rounded-lg text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-[color,box-shadow] min-h-[36px]"
                            style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                          >
                            {label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-1.5 block">Category</label>
                      <select
                        value={newReminder.category}
                        onChange={e => setNewReminder({ ...newReminder, category: e.target.value as ReminderCategory })}
                        className="w-full px-3 py-2 rounded-xl text-sm min-h-[44px] focus:outline-none text-[var(--ag-text-primary)]"
                        style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 0 0 1px rgba(139,92,246,0.12)' }}
                      >
                        <option value="personal">Personal</option>
                        <option value="work">Work</option>
                        <option value="health">Health</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Recurrence */}
                  <div>
                    <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-2 block">Recurrence</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { label: 'Never',   value: '' as const,       desc: 'One-time'   },
                        { label: 'Daily',   value: 'daily' as const,   desc: 'Every day'  },
                        { label: 'Weekly',  value: 'weekly' as const,  desc: 'Every week' },
                        { label: 'Monthly', value: 'monthly' as const, desc: 'Every month'},
                      ] as { label: string; value: 'daily' | 'weekly' | 'monthly' | ''; desc: string }[]).map(({ label, value, desc }) => {
                        const active = (newReminder.recurrence || '') === value;
                        return (
                          <motion.button
                            key={value || 'never'}
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => setNewReminder({ ...newReminder, recurrence: value, recurring: value })}
                            className="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl text-center transition-[background-color,color,box-shadow] duration-150 min-h-[56px]"
                            style={{
                              background: active ? 'rgba(132,204,22,0.1)' : 'rgba(255,255,255,0.03)',
                              boxShadow: active ? '0 0 0 1.5px #84CC1680' : '0 0 0 1px rgba(139,92,246,0.1)',
                              color: active ? '#84CC16' : 'var(--ag-text-muted)',
                            }}
                          >
                            <span className="text-xs font-semibold">{label}</span>
                            <span className="text-[10px] opacity-60">{desc}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority */}
                  <div data-testid="priority-selector">
                    <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-2 block">Priority</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['low', 'normal', 'high', 'urgent'] as const).map(p => {
                        const cfg    = priorityConfig[p];
                        const active = newReminder.priority === p;
                        return (
                          <motion.button
                            key={p}
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => setNewReminder({ ...newReminder, priority: p })}
                            className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-[background-color,box-shadow] duration-150 min-h-[52px]"
                            style={{
                              background: active ? cfg.bg : 'rgba(255,255,255,0.03)',
                              boxShadow: active ? `0 0 0 1.5px ${cfg.hex}60` : '0 0 0 1px rgba(139,92,246,0.1)',
                            }}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.hex }} />
                            <span className="text-xs font-medium" style={{ color: active ? cfg.color : 'var(--ag-text-muted)' }}>{cfg.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-2" style={{ borderTop: '1px solid var(--ag-border-subtle)' }}>
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}
                    className="border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[44px]"
                  >
                    Cancel
                  </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button
                    data-testid="submit-reminder-btn"
                    onClick={editingReminder ? () => void handleEditSave() : () => void handleLegacyAdd()}
                    disabled={!newReminder.text || !newReminder.datetime}
                    className="text-white min-h-[44px] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)' }}
                  >
                    {editingReminder ? 'Save Changes' : 'Add Reminder'}
                  </Button>
                </motion.div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Mobile FAB ─────────────────────────────────────────────────── */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }}
            className="md:hidden fixed bottom-[88px] right-4 w-14 h-14 rounded-full text-white flex items-center justify-center z-40 text-xl font-bold min-h-[44px]"
            aria-label="Add reminder"
            style={{
              background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)',
              boxShadow: '0 4px 20px rgba(139,92,246,0.4), 0 0 0 1px rgba(139,92,246,0.2)',
            }}
          >
            <Plus className="w-6 h-6" />
          </motion.button>

          {/* ── Recurring edit choice modal ───────────────────────────────── */}
          <AnimatePresence>
            {recurringEditChoice && (
              <motion.div
                key="recurring-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', duration: 0.35, bounce: 0 } }}
                  exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.2 } }}
                  className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl"
                  style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.15)' }}
                >
                  <h3 className="text-base font-bold text-[var(--ag-text-primary)] mb-1" style={{ textWrap: 'balance' } as React.CSSProperties}>
                    Edit recurring reminder
                  </h3>
                  <p className="text-sm text-[var(--ag-text-muted)] mb-5" style={{ textWrap: 'pretty' } as React.CSSProperties}>
                    This is a <span className="text-[var(--ag-violet)]">{recurringEditChoice.recurrence}</span> reminder. What would you like to edit?
                  </p>
                  <div className="flex flex-col gap-2">
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const r = recurringEditChoice;
                        setRecurringEditChoice(null);
                        setEditAsOneOff(true);
                        handleEditClick(r, true);
                      }}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-[background-color] duration-150 min-h-[44px] text-[#A78BFA]"
                      style={{ background: 'rgba(167,139,250,0.1)', boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}
                    >
                      This occurrence only
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const r = recurringEditChoice;
                        setRecurringEditChoice(null);
                        setEditAsOneOff(false);
                        handleEditClick(r, true);
                      }}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition-[background-color] duration-150 min-h-[44px] text-[#84CC16]"
                      style={{ background: 'rgba(132,204,22,0.1)', boxShadow: '0 0 0 1px rgba(132,204,22,0.25)' }}
                    >
                      All future occurrences
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => setRecurringEditChoice(null)}
                      className="w-full py-2.5 text-sm text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors min-h-[44px]"
                    >
                      Cancel
                    </motion.button>
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