// ============================================================
// Enhanced Reminders Page with Natural Language Input
// ============================================================

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useDashboardStore } from '@/stores/dashboardStore';
import { reminderService } from '@/services/api';
import { Flame } from 'lucide-react';
import { parseNaturalLanguageReminder } from '@/utils/reminderParser';
import type { ReminderChannel, ReminderCategory, ReminderPriority, Reminder } from '@/types';

const categoryColors: Record<string, string> = {
  personal: '#00F0FF',
  work: '#00FF88',
  health: '#FF2D78',
  other: '#FFB800',
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: 'Low',    color: '#6B7280', bg: '#6B728020' },
  normal: { label: 'Normal', color: '#00F0FF', bg: '#00F0FF20' },
  high:   { label: 'High',   color: '#F59E0B', bg: '#F59E0B20' },
  urgent: { label: 'Urgent', color: '#FF2D78', bg: '#FF2D7820' },
};

const examples = [
  "Remind me tomorrow at 3pm to call mom",
  "Every Monday at 9am team standup",
  "In 2 hours take a break",
  "Daily at 8am drink water",
  "Next Tuesday submit report",
];

export function RemindersPage() {
  const { reminders, addReminder, updateReminder, toggleReminder, snoozeReminder, deleteReminder, loadReminders, bulkSnoozeReminders } = useDashboardStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  // 60.5: persist filters to localStorage
  const LS_KEY = 'geekspace:reminders:filters';
  const loadFilters = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };
  const savedFilters = loadFilters();
  const [filter, setFilterRaw] = useState<'all' | 'active' | 'completed'>(savedFilters.filter ?? 'all');
  const [recurrenceFilter, setRecurrenceFilterRaw] = useState<'all' | 'recurring' | 'one-off'>(savedFilters.recurrenceFilter ?? 'all');
  // 40.1: Category and priority filter pills
  const [categoryFilter, setCategoryFilterRaw] = useState<'all' | 'personal' | 'work' | 'health' | 'other'>(savedFilters.categoryFilter ?? 'all');
  const [priorityFilter, setPriorityFilterRaw] = useState<'all' | 'urgent' | 'high' | 'normal' | 'low'>(savedFilters.priorityFilter ?? 'all');

  const persistFilters = (updates: Record<string, string>) => {
    const current = loadFilters();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...current, ...updates }));
  };
  const setFilter = (v: 'all' | 'active' | 'completed') => { setFilterRaw(v); persistFilters({ filter: v }); };
  const setRecurrenceFilter = (v: 'all' | 'recurring' | 'one-off') => { setRecurrenceFilterRaw(v); persistFilters({ recurrenceFilter: v }); };
  const setCategoryFilter = (v: 'all' | 'personal' | 'work' | 'health' | 'other') => { setCategoryFilterRaw(v); persistFilters({ categoryFilter: v }); };
  const setPriorityFilter = (v: 'all' | 'urgent' | 'high' | 'normal' | 'low') => { setPriorityFilterRaw(v); persistFilters({ priorityFilter: v }); };
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // 48.4: Auto-open add dialog when navigated with ?openAdd=true
  useEffect(() => {
    if (searchParams.get('openAdd') === 'true') {
      setIsAddDialogOpen(true);
      setSearchParams({}, { replace: true }); // Clean URL after consuming
    }
  }, [searchParams, setSearchParams]);
  
  // Natural language input state
  const [naturalInput, setNaturalInput] = useState('');
  const [parsedReminder, setParsedReminder] = useState<ReturnType<typeof parseNaturalLanguageReminder> | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Legacy form state (for manual entry)
  const [newReminder, setNewReminder] = useState<{
    text: string;
    datetime: string;
    channel: ReminderChannel;
    recurring: string;
    recurrence: 'daily' | 'weekly' | 'monthly' | '';
    category: ReminderCategory;
    priority: ReminderPriority;
  }>({
    text: '',
    datetime: '',
    channel: 'telegram',
    recurring: '',
    recurrence: '',
    category: 'personal',
    priority: 'normal',
  });

  // 35.1: Streak counter
  const [streak, setStreak] = useState<{ streak: number; longestStreak: number; completedToday: boolean } | null>(null);
  useEffect(() => {
    reminderService.getStreak().then(res => setStreak(res.data)).catch(() => {});
  }, []);

  // 42.1: "All caught up for today!" celebration
  const [showCelebration, setShowCelebration] = useState(false);
  const prevActiveCountRef = useRef<number | null>(null);
  useEffect(() => {
    const activeCount = reminders.filter(r => !r.completed).length;
    const completedCount = reminders.filter(r => r.completed).length;
    // Show banner when transitioning from >0 active to 0 active, with at least 1 completed
    if (
      prevActiveCountRef.current !== null &&
      prevActiveCountRef.current > 0 &&
      activeCount === 0 &&
      completedCount > 0
    ) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(timer);
    }
    prevActiveCountRef.current = activeCount;
  }, [reminders]);

  // Poll for reminders every 30 seconds (targeted — only re-fetches reminders)
  useEffect(() => {
    const interval = setInterval(() => {
      loadReminders();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadReminders]);

  // Parse natural language as user types
  useEffect(() => {
    if (naturalInput.trim()) {
      const parsed = parseNaturalLanguageReminder(naturalInput);
      setParsedReminder(parsed);
    } else {
      setParsedReminder(null);
    }
  }, [naturalInput]);

  const handleNaturalAdd = async () => {
    if (!parsedReminder) return;
    
    await addReminder({
      text: parsedReminder.text,
      datetime: parsedReminder.datetime.toISOString(),
      channel: 'telegram',
      recurring: parsedReminder.recurring,
      category: 'personal',
    });
    
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
      // Voice not supported — show inline feedback instead of alert()
      setNaturalInput('(Voice input not supported in this browser)');
      return;
      return;
    }
    
    const SR = (window as unknown as { SpeechRecognition: new () => SpeechRecognition; webkitSpeechRecognition: new () => SpeechRecognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition: new () => SpeechRecognition }).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setNaturalInput(transcript);
    };
    
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.start();
    setIsListening(true);
  };

  const handleLegacyAdd = async () => {
    if (!newReminder.text || !newReminder.datetime) return;
    await addReminder({
      text: newReminder.text,
      datetime: newReminder.datetime,
      channel: newReminder.channel,
      recurring: newReminder.recurring || undefined,
      recurrence: newReminder.recurrence || undefined,
      category: newReminder.category,
      priority: newReminder.priority,
    });
    setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' });
    setIsAddDialogOpen(false);
  };

  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  // 61.5: snooze feedback toast
  const [snoozeToast, setSnoozeToast] = useState<string | null>(null);
  const showSnoozeToast = (newDatetime: string) => {
    const dt = new Date(newDatetime);
    const formatted = dt.toLocaleString('en', { hour: '2-digit', minute: '2-digit', weekday: 'short', month: 'short', day: 'numeric' });
    setSnoozeToast(`Snoozed until ${formatted}`);
    setTimeout(() => setSnoozeToast(null), 3000);
  };
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  // 51.2: Recurring reminder edit — choice dialog state
  const [recurringEditChoice, setRecurringEditChoice] = useState<Reminder | null>(null);
  const [editAsOneOff, setEditAsOneOff] = useState(false);

  // Bulk delete state (25.5)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  // 53.4: Bulk restore-snooze for completed reminders
  const [isBulkRestoringSnooze, setIsBulkRestoringSnooze] = useState(false);
  // 62.10: Batch edit state
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  // 63.3: Group-by mode toggle (date vs category)
  const [groupMode, setGroupMode] = useState<'date' | 'category'>('date');

  // Bulk snooze state (29.4)
  const [selectedActiveIds, setSelectedActiveIds] = useState<Set<string>>(new Set());
  const [isBulkSnoozing, setIsBulkSnoozing] = useState(false);
  const [isBulkCompleting, setIsBulkCompleting] = useState(false);
  // 58.2: bulk-delete for active reminders
  const [isBulkDeletingActive, setIsBulkDeletingActive] = useState(false);

  // 56.10: Reminder inline quick-edit
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
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

  // 36.1: Snooze history popover
  const [snoozeHistoryId, setSnoozeHistoryId] = useState<string | null>(null);
  const [snoozeHistory, setSnoozeHistory] = useState<Array<{ id: string; snoozed_at: number; preset: string; new_datetime: string }>>([]);
  const [snoozeHistoryLoading, setSnoozeHistoryLoading] = useState(false);

  // 37.2: Custom snooze datetime picker
  const [snoozeCustomId, setSnoozeCustomId] = useState<string | null>(null);
  const [snoozeCustomValue, setSnoozeCustomValue] = useState('');

  const handleShowSnoozeHistory = async (id: string) => {
    if (snoozeHistoryId === id) { setSnoozeHistoryId(null); return; }
    setSnoozeHistoryId(id);
    setSnoozeHistoryLoading(true);
    try {
      const res = await reminderService.getSnoozeHistory(id);
      setSnoozeHistory(res.data.history);
    } catch { setSnoozeHistory([]); } finally { setSnoozeHistoryLoading(false); }
  };

  // 37.2: Custom snooze submit
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

  const handleComplete = async (id: string) => {
    setCompletingIds((prev) => new Set(prev).add(id));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await toggleReminder(id);
    setCompletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleDelete = async (id: string) => {
    await deleteReminder(id);
  };

  // 64.4: Duplicate a reminder
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

  // 39.1: Use proper snooze endpoint so every preset is logged to snooze_log
  const handleSnooze = async (id: string, preset: '1h' | 'tomorrow' | 'next-week') => {
    try {
      const res = await reminderService.snooze(id, preset);
      await snoozeReminder(id, res.data.newDatetime);
      showSnoozeToast(res.data.newDatetime);
    } catch { /* ignore */ }
    setSnoozeOpenId(null);
  };

  const handleEditClick = (reminder: Reminder, skipChoiceDialog = false) => {
    // 51.2: If recurring and user hasn't chosen yet, show the choice dialog first
    if (reminder.recurrence && !skipChoiceDialog) {
      setRecurringEditChoice(reminder);
      return;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date(reminder.datetime);
    const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    // 47.2: Validate priority from DB explicitly — old rows may have null/invalid value
    const validPriorities: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
    const safePriority: ReminderPriority = validPriorities.includes(reminder.priority as ReminderPriority)
      ? (reminder.priority as ReminderPriority)
      : 'normal';
    setEditingReminder(reminder);
    setNewReminder({
      text: reminder.text,
      datetime: localStr,
      channel: reminder.channel,
      recurring: reminder.recurring || '',
      recurrence: (reminder.recurrence as 'daily' | 'weekly' | 'monthly' | undefined) || '',
      category: reminder.category,
      priority: safePriority,
    });
    setNaturalInput('');
    setParsedReminder(null);
    setIsAddDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingReminder || !newReminder.text || !newReminder.datetime) return;
    if (editAsOneOff) {
      // 51.2: "This occurrence only" — create a new one-off reminder; original recurring reminder is untouched
      await addReminder({
        text: newReminder.text,
        datetime: new Date(newReminder.datetime).toISOString(),
        channel: newReminder.channel,
        category: newReminder.category,
        priority: newReminder.priority,
      });
    } else {
      await updateReminder(editingReminder.id, {
        text: newReminder.text,
        datetime: new Date(newReminder.datetime).toISOString(),
        channel: newReminder.channel,
        recurring: (newReminder.recurring || undefined) as Reminder['recurring'],
        recurrence: (newReminder.recurrence || undefined) as Reminder['recurrence'],
        category: newReminder.category,
        priority: newReminder.priority,
      });
    }
    setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' });
    setEditingReminder(null);
    setEditAsOneOff(false);
    setIsAddDialogOpen(false);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleSelectAllCompleted = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(completedReminders.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await reminderService.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      await loadReminders();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // 62.10: Batch edit priority/category for selected reminders
  const handleBatchEdit = async (ids: string[], fields: { priority?: string; category?: string }) => {
    if (ids.length === 0) return;
    setIsBatchEditing(true);
    try {
      await reminderService.batchEdit(ids, fields);
      await loadReminders();
    } finally {
      setIsBatchEditing(false);
    }
  };

  // 53.4: Restore completed reminders back to active with a snooze preset
  const handleBulkRestoreSnooze = async (preset: '1h' | 'tomorrow' | 'next-week') => {
    if (selectedIds.size === 0) return;
    setIsBulkRestoringSnooze(true);
    try {
      await reminderService.bulkRestoreSnooze(Array.from(selectedIds), preset);
      setSelectedIds(new Set());
      await loadReminders();
    } finally {
      setIsBulkRestoringSnooze(false);
    }
  };

  const handleToggleSelectActive = (id: string) => {
    setSelectedActiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBulkSnooze = async (preset: '1h' | 'tomorrow' | 'next-week') => {
    if (selectedActiveIds.size === 0) return;
    setIsBulkSnoozing(true);
    try {
      await bulkSnoozeReminders(Array.from(selectedActiveIds), preset);
      setSelectedActiveIds(new Set());
    } finally {
      setIsBulkSnoozing(false);
    }
  };

  const handleBulkComplete = async () => {
    if (selectedActiveIds.size === 0) return;
    setIsBulkCompleting(true);
    try {
      await reminderService.bulkComplete(Array.from(selectedActiveIds));
      setSelectedActiveIds(new Set());
      await loadReminders();
    } finally {
      setIsBulkCompleting(false);
    }
  };

  // 58.2: Bulk-delete active reminders
  const handleBulkDeleteActive = async () => {
    if (selectedActiveIds.size === 0) return;
    setIsBulkDeletingActive(true);
    try {
      await reminderService.bulkDelete(Array.from(selectedActiveIds));
      setSelectedActiveIds(new Set());
      await loadReminders();
    } finally {
      setIsBulkDeletingActive(false);
    }
  };

  // ── Relative time helper ────────────────────────────────────────────────────
function formatRelativeTime(datetime: string): string {
  const ms = new Date(datetime).getTime() - Date.now();
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);
  const past = ms < 0;
  if (abs < 60000) return past ? 'just now' : 'in a moment';
  if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`;
  if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`;
  if (days === 1) return past ? 'yesterday' : 'tomorrow';
  return past ? `${days}d ago` : `in ${days}d`;
}
// ─────────────────────────────────────────────────────────────────────────────

  // ── Category grouping helper ────────────────────────────────────────────────
function groupRemindersByCategory(reminders: Reminder[]) {
  const order = ['work', 'personal', 'health', 'other', 'general'];
  const map = new Map<string, Reminder[]>();
  for (const r of reminders) {
    const cat = r.category ?? 'general';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(r);
  }
  return order
    .filter((cat) => map.has(cat))
    .concat([...map.keys()].filter((k) => !order.includes(k)))
    .map((cat) => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), items: map.get(cat)! }));
}
// ─────────────────────────────────────────────────────────────────────────────

  // ── Date grouping helper ─────────────────────────────────────────────────────
function groupRemindersByDate(reminders: Reminder[]) {
  const now = Date.now();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const tomorrowStart = new Date(todayEnd); tomorrowStart.setDate(tomorrowStart.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart); tomorrowEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayEnd); weekEnd.setDate(weekEnd.getDate() + 7);

  const groups: { label: string; items: Reminder[] }[] = [
    { label: 'Overdue',    items: [] },
    { label: 'Today',      items: [] },
    { label: 'Tomorrow',   items: [] },
    { label: 'This Week',  items: [] },
    { label: 'Later',      items: [] },
  ];

  for (const r of reminders) {
    const dueMs = new Date(r.datetime).getTime();
    if (dueMs < now)                          groups[0].items.push(r);
    else if (dueMs <= todayEnd.getTime())     groups[1].items.push(r);
    else if (dueMs <= tomorrowEnd.getTime())  groups[2].items.push(r);
    else if (dueMs <= weekEnd.getTime())      groups[3].items.push(r);
    else                                       groups[4].items.push(r);
  }

  return groups.filter(g => g.items.length > 0);
}
// ─────────────────────────────────────────────────────────────────────────────

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

  const filteredReminders = reminders.filter(r => {
    if (filter === 'active') return !r.completed;
    if (filter === 'completed') return r.completed;
    return true;
  }).filter(r => {
    if (recurrenceFilter === 'recurring') return !!r.recurrence;
    if (recurrenceFilter === 'one-off') return !r.recurrence;
    return true;
  }).filter(r => {
    // 40.1: Category filter
    if (categoryFilter !== 'all') return r.category === categoryFilter;
    return true;
  }).filter(r => {
    // 40.1: Priority filter
    if (priorityFilter !== 'all') return (r.priority ?? 'normal') === priorityFilter;
    return true;
  }).filter(r => r.text.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const pa = priorityOrder[a.priority ?? 'normal'] ?? 2;
      const pb = priorityOrder[b.priority ?? 'normal'] ?? 2;
      return pa - pb;
    });

  const activeReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);
  // 49.3: Overdue = active reminders whose datetime is in the past
  const overdueReminders = activeReminders.filter(r => new Date(r.datetime) < new Date());

  // 49.3: "Mark all overdue complete" batch handler
  const [isMarkingAllOverdue, setIsMarkingAllOverdue] = useState(false);
  const handleMarkAllOverdueComplete = async () => {
    if (overdueReminders.length === 0) return;
    setIsMarkingAllOverdue(true);
    try {
      await reminderService.bulkComplete(overdueReminders.map(r => r.id));
      await loadReminders();
    } finally {
      setIsMarkingAllOverdue(false);
    }
  };

  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  };

  const isOverdue = (datetime: string) => {
    return new Date(datetime) < new Date() && !reminders.find(r => r.datetime === datetime)?.completed;
  };

  // 39.2: "due soon" = active reminder within the next 24h but not yet overdue
  const isDueSoon = (datetime: string, completed: boolean) => {
    if (completed) return false;
    const ms = new Date(datetime).getTime() - Date.now();
    return ms > 0 && ms <= 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-6" data-testid="reminders-page">
      {/* 61.5: Snooze feedback toast */}
      {snoozeToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFB800]/15 border border-[#FFB800]/40 text-[#FFB800] text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="snooze-toast">
          <AlarmClock className="w-4 h-4" />
          {snoozeToast}
        </div>
      )}
      {/* 42.1: All caught up celebration banner */}
      {showCelebration && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300"
          style={{ background: 'rgba(0,255,136,0.12)', borderColor: 'rgba(0,255,136,0.4)' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#00FF88' }}>
            🎉 All caught up for today!
          </span>
          <button
            onClick={() => setShowCelebration(false)}
            className="text-[#00FF88]/60 hover:text-[#00FF88] transition-colors text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {/* 49.3: Mark all overdue complete banner — shown when 4+ overdue items accumulate */}
      {!showCelebration && overdueReminders.length > 3 && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-2xl border"
          style={{ background: 'rgba(255,45,120,0.08)', borderColor: 'rgba(255,45,120,0.35)' }}
        >
          <span className="text-sm font-medium" style={{ color: '#FF2D78' }}>
            <AlarmClock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {overdueReminders.length} overdue reminders
          </span>
          <button
            onClick={handleMarkAllOverdueComplete}
            disabled={isMarkingAllOverdue}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,45,120,0.18)', color: '#FF2D78', border: '1px solid rgba(255,45,120,0.4)' }}
          >
            {isMarkingAllOverdue ? 'Marking…' : 'Mark all complete'}
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Reminders
          </h1>
          <p className="text-[#6B7280]">
            {activeReminders.length} active, {completedReminders.length} completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          {streak && streak.streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-sm font-semibold text-[#F59E0B]">{streak.streak}</span>
              <span className="text-xs text-[#6B7280]">day streak</span>
            </div>
          )}
          <div className="px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30">
            <span className="text-sm text-[#00F0FF]">{activeReminders.length} active</span>
          </div>
          <Button data-testid="create-reminder-button" onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }} className="bg-[#00F0FF] hover:bg-[#00D4B0]">
            <Plus className="w-4 h-4 mr-2" />
            Add Reminder
          </Button>
        </div>
      </div>

      {/* Quick Add - Natural Language */}
      <Card className="bg-gradient-to-r from-[#00F0FF]/10 to-[#FF2D78]/5 border-[#00F0FF]/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#00F0FF]" />
            <span className="text-sm font-medium text-[#E8E8F0]">Quick Add</span>
            <span className="text-xs text-[#6B7280]">Type naturally like "tomorrow at 3pm call mom"</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                ref={inputRef}
                placeholder="Remind me..."
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parsedReminder) {
                    handleNaturalAdd();
                  }
                }}
                className="w-full px-4 py-3 bg-[#06060B] border border-[#00F0FF]/20 rounded-xl text-[#E8E8F0] placeholder-[#6B7280] focus:outline-none focus:border-[#00F0FF]/40"
              />
              {parsedReminder && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-xs text-[#00FF88]">✓ Parsed</span>
                </div>
              )}
            </div>
            <button
              onClick={handleVoiceInput}
              aria-label={isListening ? 'Listening... tap to stop' : 'Voice input'}
              className={`p-3 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
                isListening
                  ? 'bg-[#FF6161]/20 text-[#FF6161]'
                  : 'bg-[#06060B] border border-[#00F0FF]/20 text-[#6B7280] hover:text-white'
              }`}
            >
              <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
            </button>
            <Button
              onClick={handleNaturalAdd}
              disabled={!parsedReminder}
              className="bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
          
          {/* Parsed preview */}
          {parsedReminder && (
            <div className="mt-3 p-3 rounded-lg bg-[#06060B] border border-[#00FF88]/20">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#00FF88]">✓</span>
                <span className="text-[#E8E8F0]">{parsedReminder.text}</span>
                <span className="text-[#6B7280]">at</span>
                <span className="text-[#FFB800]">
                  {parsedReminder.datetime.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {parsedReminder.recurring && (
                  <Badge className="bg-[#00F0FF]/20 text-[#00F0FF]">
                    <Repeat className="w-3 h-3 mr-1" />
                    {parsedReminder.recurring}
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {/* Examples */}
          <div className="mt-3">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs text-[#6B7280] hover:text-[#00F0FF] transition-colors"
            >
              {showExamples ? 'Hide' : 'Show'} examples
            </button>
            {showExamples && (
              <div className="mt-2 flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    onClick={() => handleExampleClick(example)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#06060B] border border-[#00F0FF]/20 text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0C0C18] border-[#00F0FF]/20"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="bg-[#0C0C18] border border-[#00F0FF]/20">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
            {(['all', 'recurring', 'one-off'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setRecurrenceFilter(opt)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  recurrenceFilter === opt
                    ? opt === 'recurring'
                      ? 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#F59E0B]'
                      : 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]'
                    : 'border-[#00F0FF]/10 text-[#6B7280] hover:border-[#00F0FF]/20 hover:text-[#E8E8F0]'
                }`}
              >
                {opt === 'all' ? 'All types' : opt === 'recurring' ? '↺ Recurring' : '• One-off'}
              </button>
            ))}
            </div>
            {/* 38.3: CSV export button */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs border-[#00F0FF]/20 text-[#6B7280] hover:text-[#00F0FF] hover:border-[#00F0FF]/40"
              onClick={async () => {
                try {
                  const { data } = await reminderService.exportCsv(filter);
                  const blob = new Blob([data], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `reminders-${new Date().toISOString().slice(0, 10)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch { /* ignore */ }
              }}
              aria-label="Export reminders as CSV"
            >
              <Download className="w-3 h-3 mr-1" />CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] border-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/10 px-2"
              onClick={async () => {
                try {
                  const { data } = await reminderService.exportIcs('active');
                  const blob = new Blob([data], { type: 'text/calendar' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `reminders-${new Date().toISOString().slice(0, 10)}.ics`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch { /* ignore */ }
              }}
              aria-label="Export reminders as iCalendar"
            >
              <Download className="w-3 h-3 mr-1" />iCal
            </Button>
          </div>
          {/* 40.1: Category filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'personal', 'work', 'health', 'other'] as const).map((cat) => {
              const color = cat === 'all' ? '#00F0FF' : (categoryColors[cat] ?? '#6B7280');
              const isActive = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    isActive ? 'border-current' : 'border-[#00F0FF]/10 text-[#6B7280] hover:border-[#00F0FF]/20 hover:text-[#E8E8F0]'
                  }`}
                  style={isActive ? { color, backgroundColor: `${color}15`, borderColor: `${color}60` } : {}}
                >
                  {cat === 'all' ? 'All categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              );
            })}
          </div>
          {/* 40.1: Priority filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'urgent', 'high', 'normal', 'low'] as const).map((pri) => {
              const cfg = pri === 'all' ? null : priorityConfig[pri];
              const color = cfg?.color ?? '#00F0FF';
              const isActive = priorityFilter === pri;
              return (
                <button
                  key={pri}
                  onClick={() => setPriorityFilter(pri)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    isActive ? 'border-current' : 'border-[#00F0FF]/10 text-[#6B7280] hover:border-[#00F0FF]/20 hover:text-[#E8E8F0]'
                  }`}
                  style={isActive ? { color, backgroundColor: `${color}15`, borderColor: `${color}60` } : {}}
                >
                  {pri === 'all' ? 'All priorities' : cfg?.label ?? pri}
                </button>
              );
            })}
          </div>
          {/* 50.5: Clear all filters button — shown when any filter is non-default */}
          {(filter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all' || recurrenceFilter !== 'all' || searchQuery !== '') && (
            <button
              onClick={() => {
                setFilter('all');
                setCategoryFilter('all');
                setPriorityFilter('all');
                setRecurrenceFilter('all');
                setSearchQuery('');
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-[#FF2D78]/30 text-[#FF2D78] bg-[#FF2D78]/8 hover:bg-[#FF2D78]/15 transition-all"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 63.3: Group-by toggle */}
          <div className="flex items-center bg-[#0C0C18] border border-[#00F0FF]/20 rounded-lg p-1">
            <button
              onClick={() => setGroupMode('date')}
              aria-label="Group by date"
              title="Group by date"
              className={`p-2 rounded transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center text-xs font-medium ${groupMode === 'date' ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'text-[#6B7280]'}`}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGroupMode('category')}
              aria-label="Group by category"
              title="Group by category"
              className={`p-2 rounded transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center text-xs font-medium ${groupMode === 'category' ? 'bg-[#BF5FFF]/20 text-[#BF5FFF]' : 'text-[#6B7280]'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center bg-[#0C0C18] border border-[#00F0FF]/20 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-2.5 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${viewMode === 'list' ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'text-[#6B7280]'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              aria-label="Calendar view"
              className={`p-2.5 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${viewMode === 'calendar' ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'text-[#6B7280]'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Reminders List */}
      {/* Bulk snooze bar — shown when viewing active reminders (29.4) */}
      {activeReminders.length > 0 && (filter === 'active' || filter === 'all') && (
        <div className="flex items-center gap-3 px-1" data-testid="bulk-snooze-bar">
          <Checkbox
            id="select-all-active"
            checked={selectedActiveIds.size > 0 && activeReminders.every((r) => selectedActiveIds.has(r.id))}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedActiveIds(new Set(activeReminders.map((r) => r.id)));
              } else {
                setSelectedActiveIds(new Set());
              }
            }}
            aria-label="Select all active reminders"
          />
          <label htmlFor="select-all-active" className="text-sm text-[#6B7280] cursor-pointer select-none">
            Select active ({activeReminders.length})
          </label>
          {selectedActiveIds.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-[#6B7280]">Snooze {selectedActiveIds.size} selected:</span>
              <button
                onClick={() => handleBulkSnooze('1h')}
                disabled={isBulkSnoozing}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] hover:bg-[#FFB800]/20 disabled:opacity-50 transition-colors"
              >
                +1h
              </button>
              <button
                onClick={() => handleBulkSnooze('tomorrow')}
                disabled={isBulkSnoozing}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] hover:bg-[#FFB800]/20 disabled:opacity-50 transition-colors"
              >
                Tomorrow
              </button>
              <button
                onClick={() => handleBulkSnooze('next-week')}
                disabled={isBulkSnoozing}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] hover:bg-[#FFB800]/20 disabled:opacity-50 transition-colors"
              >
                Next week
              </button>
              <button
                onClick={handleBulkComplete}
                disabled={isBulkCompleting}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] hover:bg-[#00FF88]/20 disabled:opacity-50 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark Done
              </button>
              {/* 58.2: Bulk-delete active reminders */}
              <button
                onClick={() => void handleBulkDeleteActive()}
                disabled={isBulkDeletingActive}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#FF6161]/10 border border-[#FF6161]/30 text-[#FF6161] hover:bg-[#FF6161]/20 disabled:opacity-50 transition-colors"
                aria-label="Delete selected active reminders"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedActiveIds.size})
              </button>
              {/* 62.10: Batch edit priority/category */}
              <select
                disabled={isBatchEditing}
                onChange={(e) => { if (e.target.value) { void handleBatchEdit(Array.from(selectedActiveIds), { priority: e.target.value }); e.target.value = ''; } }}
                className="text-xs px-2 py-1 rounded-lg bg-[#0C0C18] border border-[#BF5FFF]/30 text-[#BF5FFF] disabled:opacity-50"
                aria-label="Set priority for selected reminders"
              >
                <option value="">Priority…</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                disabled={isBatchEditing}
                onChange={(e) => { if (e.target.value) { void handleBatchEdit(Array.from(selectedActiveIds), { category: e.target.value }); e.target.value = ''; } }}
                className="text-xs px-2 py-1 rounded-lg bg-[#0C0C18] border border-[#BF5FFF]/30 text-[#BF5FFF] disabled:opacity-50"
                aria-label="Set category for selected reminders"
              >
                <option value="">Category…</option>
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="health">Health</option>
                <option value="finance">Finance</option>
                <option value="general">General</option>
              </select>
              {isBulkSnoozing && (
                <div className="w-4 h-4 border-2 border-[#FFB800]/30 border-t-[#FFB800] rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk delete bar — shown when viewing completed reminders */}
      {completedReminders.length > 0 && (filter === 'completed' || filter === 'all') && (
        <div className="flex items-center gap-3 px-1">
          <Checkbox
            id="select-all-completed"
            checked={selectedIds.size > 0 && completedReminders.every((r) => selectedIds.has(r.id))}
            onCheckedChange={handleSelectAllCompleted}
            aria-label="Select all completed reminders"
          />
          <label htmlFor="select-all-completed" className="text-sm text-[#6B7280] cursor-pointer select-none">
            Select all completed ({completedReminders.length})
          </label>
          {selectedIds.size > 0 && (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* 53.4: Restore + Snooze completed reminders back to active */}
              <span className="text-xs text-[#6B7280]">Restore {selectedIds.size} selected:</span>
              <button
                onClick={() => handleBulkRestoreSnooze('1h')}
                disabled={isBulkRestoringSnooze}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] hover:bg-[#FFB800]/20 disabled:opacity-50 transition-colors"
              >+1h</button>
              <button
                onClick={() => handleBulkRestoreSnooze('tomorrow')}
                disabled={isBulkRestoringSnooze}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] hover:bg-[#FFB800]/20 disabled:opacity-50 transition-colors"
              >Tomorrow</button>
              <button
                onClick={() => handleBulkRestoreSnooze('next-week')}
                disabled={isBulkRestoringSnooze}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] hover:bg-[#FFB800]/20 disabled:opacity-50 transition-colors"
              >Next week</button>
              {isBulkRestoringSnooze && (
                <div className="w-4 h-4 border-2 border-[#FFB800]/30 border-t-[#FFB800] rounded-full animate-spin" />
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-[#FF6161]/20 border border-[#FF6161]/40 text-[#FF6161] hover:bg-[#FF6161]/30"
              >
                {isBulkDeleting ? (
                  <div className="w-4 h-4 border-2 border-[#FF6161]/30 border-t-[#FF6161] rounded-full animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredReminders.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-[#00F0FF]/30 mx-auto mb-4" />
              <p className="text-[#6B7280]">No reminders yet</p>
              <p className="text-sm text-[#6B7280]/70 mt-1">Use the quick add above to create your first reminder</p>
            </div>
          ) : filter === 'active' ? (
            // Grouped view for active reminders (date or category)
            (groupMode === 'category' ? groupRemindersByCategory(filteredReminders) : groupRemindersByDate(filteredReminders)).map(({ label, items }) => (
              <div key={label} className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8888AA]">{label}</span>
                  <span className="text-xs font-medium text-[#BF5FFF] bg-[#BF5FFF]/10 px-1.5 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((reminder) => {
                    const formatted = formatDateTime(reminder.datetime);
                    const overdue = isOverdue(reminder.datetime);
                    const dueSoon = isDueSoon(reminder.datetime, reminder.completed);
                    return (
                      <Card
                        key={reminder.id}
                        className={`bg-[#0C0C18] border transition-all duration-300 ${
                          completingIds.has(reminder.id)
                            ? 'border-[#00FF88] bg-[#00FF88]/10'
                            : reminder.completed
                            ? 'border-[#00F0FF]/10 opacity-60'
                            : overdue
                            ? 'border-[#FF6161]/30'
                            : 'border-[#00F0FF]/20'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Bulk select checkbox — active for snooze, completed for delete */}
                            {!reminder.completed && (
                              <Checkbox
                                checked={selectedActiveIds.has(reminder.id)}
                                onCheckedChange={() => handleToggleSelectActive(reminder.id)}
                                aria-label="Select reminder for bulk snooze"
                                className="mt-1 flex-shrink-0"
                              />
                            )}
                            {reminder.completed && (
                              <Checkbox
                                checked={selectedIds.has(reminder.id)}
                                onCheckedChange={() => handleToggleSelect(reminder.id)}
                                aria-label="Select reminder for bulk delete"
                                className="mt-1 flex-shrink-0"
                              />
                            )}

                            {/* Date badge */}
                            <div className={`flex-shrink-0 w-14 text-center p-2 rounded-xl ${
                              reminder.completed
                                ? 'bg-[#00F0FF]/10'
                                : overdue
                                ? 'bg-[#FF6161]/10'
                                : 'bg-[#00F0FF]/10'
                            }`}>
                              <div className={`text-xs ${overdue ? 'text-[#FF6161]' : 'text-[#00F0FF]'}`}>
                                {formatted.month}
                              </div>
                              <div className={`text-xl font-bold ${overdue ? 'text-[#FF6161]' : 'text-[#E8E8F0]'}`}>
                                {formatted.day}
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {/* 56.10: Inline quick-edit — click title to edit, Enter=save, Escape=cancel */}
                                  {inlineEditId === reminder.id ? (
                                    <input
                                      ref={inlineEditRef}
                                      autoFocus
                                      className="w-full bg-[#0A0A14] border border-[#00F0FF]/40 rounded px-2 py-0.5 text-[#E8E8F0] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/60"
                                      value={inlineEditValue}
                                      onChange={(e) => setInlineEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleInlineEditSave(reminder.id);
                                        if (e.key === 'Escape') { setInlineEditId(null); setInlineEditValue(''); }
                                      }}
                                      onBlur={() => handleInlineEditSave(reminder.id)}
                                    />
                                  ) : (
                                    <p
                                      className={`font-medium cursor-text hover:bg-[#00F0FF]/5 rounded px-1 -mx-1 transition-colors ${reminder.completed ? 'line-through text-[#6B7280]' : 'text-[#E8E8F0]'}`}
                                      title="Click to edit"
                                      onClick={() => { if (!reminder.completed) { setInlineEditId(reminder.id); setInlineEditValue(reminder.text); } }}
                                    >
                                      {reminder.text}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-[#FF6161]' : 'text-[#6B7280]'}`}>
                                      <Clock className="w-3 h-3" />
                                      {formatted.time}
                                    </span>
                                    {/* 63.10: relative time */}
                                    <span className={`text-[10px] font-medium ${overdue ? 'text-[#FF6161]/80' : 'text-[#6B7280]/60'}`}>
                                      {formatRelativeTime(reminder.datetime)}
                                    </span>
                                    {dueSoon && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30">
                                        due in {Math.ceil((new Date(reminder.datetime).getTime() - Date.now()) / 3600000)}h
                                      </Badge>
                                    )}
                                    <Badge
                                      style={{ backgroundColor: `${categoryColors[reminder.category]}20`, color: categoryColors[reminder.category], borderColor: `${categoryColors[reminder.category]}40` }}
                                      className="text-xs"
                                    >
                                      {reminder.category}
                                    </Badge>
                                    {reminder.recurring && (
                                      <Badge className="bg-[#00F0FF]/20 text-[#00F0FF] text-xs">
                                        <Repeat className="w-3 h-3 mr-1" />
                                        {reminder.recurring}
                                      </Badge>
                                    )}
                                    {reminder.recurrence && (
                                      <Badge className="bg-[#BF5FFF]/20 text-[#BF5FFF] text-xs">
                                        🔁 {reminder.recurrence}
                                      </Badge>
                                    )}
                                    {/* 39.5: priority quick-edit — click to cycle low→normal→high→urgent */}
                                    {!reminder.completed && (
                                      <button
                                        onClick={() => {
                                          const order: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
                                          const cur = order.indexOf((reminder.priority || 'normal') as ReminderPriority);
                                          const next = order[(cur + 1) % order.length];
                                          void updateReminder(reminder.id, { priority: next });
                                        }}
                                        title="Click to change priority"
                                        className="text-xs px-1.5 py-0 rounded-full border transition-colors hover:opacity-80"
                                        style={{
                                          backgroundColor: priorityConfig[reminder.priority ?? 'normal']?.bg,
                                          color: priorityConfig[reminder.priority ?? 'normal']?.color,
                                          borderColor: `${priorityConfig[reminder.priority ?? 'normal']?.color}40`,
                                        }}
                                      >
                                        {priorityConfig[reminder.priority ?? 'normal']?.label}
                                      </button>
                                    )}
                                    {(reminder.snoozeCount ?? 0) > 0 && (
                                      <div className="relative">
                                        <button
                                          onClick={() => handleShowSnoozeHistory(reminder.id)}
                                          className="text-xs px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/20 transition-colors"
                                          aria-label="Show snooze history"
                                        >
                                          Snoozed {reminder.snoozeCount}×
                                        </button>
                                        {snoozeHistoryId === reminder.id && (
                                          <div className="absolute left-0 top-full mt-1 z-20 bg-[#0C0C18] border border-[#F59E0B]/30 rounded-xl shadow-lg p-3 min-w-[200px]">
                                            <p className="text-xs font-medium text-[#F59E0B] mb-2">Snooze history</p>
                                            {snoozeHistoryLoading ? (
                                              <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin mx-auto" />
                                            ) : snoozeHistory.length === 0 ? (
                                              <p className="text-xs text-[#6B7280]">No history yet</p>
                                            ) : (
                                              <>
                                                <div className="space-y-1.5">
                                                  {snoozeHistory.map((h) => (
                                                    <div key={h.id} className="text-xs text-[#6B7280]">
                                                      <span className="text-[#E8E8F0]">{h.preset}</span>
                                                      {' → '}
                                                      {new Date(h.new_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                  ))}
                                                </div>
                                                {/* 40.5: Snooze analytics summary */}
                                                {(() => {
                                                  const counts: Record<string, number> = {};
                                                  snoozeHistory.forEach((h) => { counts[h.preset] = (counts[h.preset] ?? 0) + 1; });
                                                  const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                                                  return (
                                                    <p className="text-[10px] text-[#6B7280]/70 border-t border-[#F59E0B]/20 pt-1.5 mt-1.5">
                                                      Total {snoozeHistory.length} snooze{snoozeHistory.length !== 1 ? 's' : ''}
                                                      {mostUsed ? <>{' · Most used: '}<span className="text-[#F59E0B]">{mostUsed}</span></> : null}
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
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleComplete(reminder.id)}
                                    aria-label={reminder.completed ? 'Mark as incomplete' : 'Mark as complete'}
                                    className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                      reminder.completed
                                        ? 'bg-[#00FF88]/20 text-[#00FF88]'
                                        : 'bg-[#06060B] text-[#6B7280] hover:text-[#00FF88]'
                                    }`}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  {!reminder.completed && (
                                    <div className="relative">
                                      <button
                                        onClick={() => setSnoozeOpenId(snoozeOpenId === reminder.id ? null : reminder.id)}
                                        aria-label="Snooze reminder"
                                        className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#FFB800] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                      >
                                        <AlarmClock className="w-4 h-4" />
                                      </button>
                                      {snoozeOpenId === reminder.id && (
                                        <div className="absolute right-0 top-full mt-1 z-10 bg-[#0C0C18] border border-[#FFB800]/30 rounded-xl shadow-lg p-2 flex flex-col gap-1 min-w-[120px]">
                                          <button onClick={() => handleSnooze(reminder.id, '1h')} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#E8E8F0] whitespace-nowrap">+1 hour</button>
                                          <button onClick={() => handleSnooze(reminder.id, 'tomorrow')} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#E8E8F0] whitespace-nowrap">Tomorrow 9am</button>
                                          <button onClick={() => handleSnooze(reminder.id, 'next-week')} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#E8E8F0] whitespace-nowrap">Next week</button>
                                          <button onClick={() => setSnoozeCustomId(snoozeCustomId === reminder.id ? null : reminder.id)} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#FFB800] whitespace-nowrap">Custom time…</button>
                                          {snoozeCustomId === reminder.id && (
                                            <div className="flex gap-1 mt-1 px-1">
                                              <input
                                                type="datetime-local"
                                                className="text-xs bg-[#06060B] border border-[#FFB800]/30 rounded-lg px-2 py-1 text-[#E8E8F0] flex-1 min-w-0"
                                                value={snoozeCustomValue}
                                                onChange={(e) => setSnoozeCustomValue(e.target.value)}
                                              />
                                              <button
                                                onClick={() => handleSnoozeCustom(reminder.id)}
                                                className="text-xs px-2 py-1 rounded-lg bg-[#FFB800]/20 text-[#FFB800] hover:bg-[#FFB800]/30 whitespace-nowrap"
                                              >Set</button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {/* 64.4: Duplicate */}
                                  <button
                                    onClick={() => void handleDuplicate(reminder.id)}
                                    aria-label="Duplicate reminder"
                                    disabled={duplicatingId === reminder.id}
                                    className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#00F0FF] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEditClick(reminder)}
                                    aria-label="Edit reminder"
                                    className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#BF5FFF] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(reminder.id)}
                                    aria-label="Delete reminder"
                                    className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#FF6161] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            filteredReminders.map((reminder) => {
              const formatted = formatDateTime(reminder.datetime);
              const overdue = isOverdue(reminder.datetime);
              const dueSoon = isDueSoon(reminder.datetime, reminder.completed);

              return (
                <Card
                  key={reminder.id}
                  className={`bg-[#0C0C18] border transition-all duration-300 ${
                    completingIds.has(reminder.id)
                      ? 'border-[#00FF88] bg-[#00FF88]/10'
                      : reminder.completed
                      ? 'border-[#00F0FF]/10 opacity-60'
                      : overdue
                      ? 'border-[#FF6161]/30'
                      : 'border-[#00F0FF]/20'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Bulk select checkbox — active for snooze, completed for delete */}
                      {!reminder.completed && (
                        <Checkbox
                          checked={selectedActiveIds.has(reminder.id)}
                          onCheckedChange={() => handleToggleSelectActive(reminder.id)}
                          aria-label="Select reminder for bulk snooze"
                          className="mt-1 flex-shrink-0"
                        />
                      )}
                      {reminder.completed && (
                        <Checkbox
                          checked={selectedIds.has(reminder.id)}
                          onCheckedChange={() => handleToggleSelect(reminder.id)}
                          aria-label="Select reminder for bulk delete"
                          className="mt-1 flex-shrink-0"
                        />
                      )}

                      {/* Date badge */}
                      <div className={`flex-shrink-0 w-14 text-center p-2 rounded-xl ${
                        reminder.completed
                          ? 'bg-[#00F0FF]/10'
                          : overdue
                          ? 'bg-[#FF6161]/10'
                          : 'bg-[#00F0FF]/10'
                      }`}>
                        <div className={`text-xs ${overdue ? 'text-[#FF6161]' : 'text-[#00F0FF]'}`}>
                          {formatted.month}
                        </div>
                        <div className={`text-xl font-bold ${overdue ? 'text-[#FF6161]' : 'text-[#E8E8F0]'}`}>
                          {formatted.day}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {inlineEditId === reminder.id ? (
                              <input
                                ref={inlineEditRef}
                                autoFocus
                                className="w-full bg-[#0A0A14] border border-[#00F0FF]/40 rounded px-2 py-0.5 text-[#E8E8F0] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/60"
                                value={inlineEditValue}
                                onChange={(e) => setInlineEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineEditSave(reminder.id);
                                  if (e.key === 'Escape') { setInlineEditId(null); setInlineEditValue(''); }
                                }}
                                onBlur={() => handleInlineEditSave(reminder.id)}
                              />
                            ) : (
                              <p
                                className={`font-medium cursor-text hover:bg-[#00F0FF]/5 rounded px-1 -mx-1 transition-colors ${reminder.completed ? 'line-through text-[#6B7280]' : 'text-[#E8E8F0]'}`}
                                title="Click to edit"
                                onClick={() => { if (!reminder.completed) { setInlineEditId(reminder.id); setInlineEditValue(reminder.text); } }}
                              >
                                {reminder.text}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-[#FF6161]' : 'text-[#6B7280]'}`}>
                                <Clock className="w-3 h-3" />
                                {formatted.time}
                                {overdue && ' (overdue)'}
                              </span>
                              {dueSoon && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30">
                                  due in {Math.ceil((new Date(reminder.datetime).getTime() - Date.now()) / 3600000)}h
                                </Badge>
                              )}
                              <Badge
                                style={{ backgroundColor: `${categoryColors[reminder.category]}20`, color: categoryColors[reminder.category], borderColor: `${categoryColors[reminder.category]}40` }}
                                className="text-xs"
                              >
                                {reminder.category}
                              </Badge>
                              {reminder.recurring && (
                                <Badge className="bg-[#00F0FF]/20 text-[#00F0FF] text-xs">
                                  <Repeat className="w-3 h-3 mr-1" />
                                  {reminder.recurring}
                                </Badge>
                              )}
                              {reminder.recurrence && (
                                <Badge className="bg-[#BF5FFF]/20 text-[#BF5FFF] text-xs">
                                  🔁 {reminder.recurrence}
                                </Badge>
                              )}
                              {/* 39.5: priority quick-edit — click to cycle low→normal→high→urgent */}
                              {!reminder.completed && (
                                <button
                                  onClick={() => {
                                    const order: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
                                    const cur = order.indexOf((reminder.priority || 'normal') as ReminderPriority);
                                    const next = order[(cur + 1) % order.length];
                                    void updateReminder(reminder.id, { priority: next });
                                  }}
                                  title="Click to change priority"
                                  className="text-xs px-1.5 py-0 rounded-full border transition-colors hover:opacity-80"
                                  style={{
                                    backgroundColor: priorityConfig[reminder.priority ?? 'normal']?.bg,
                                    color: priorityConfig[reminder.priority ?? 'normal']?.color,
                                    borderColor: `${priorityConfig[reminder.priority ?? 'normal']?.color}40`,
                                  }}
                                >
                                  {priorityConfig[reminder.priority ?? 'normal']?.label}
                                </button>
                              )}
                              {(reminder.snoozeCount ?? 0) > 0 && (
                                <div className="relative">
                                  <button
                                    onClick={() => handleShowSnoozeHistory(reminder.id)}
                                    className="text-xs px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/20 transition-colors"
                                    aria-label="Show snooze history"
                                  >
                                    Snoozed {reminder.snoozeCount}×
                                  </button>
                                  {snoozeHistoryId === reminder.id && (
                                    <div className="absolute left-0 top-full mt-1 z-20 bg-[#0C0C18] border border-[#F59E0B]/30 rounded-xl shadow-lg p-3 min-w-[200px]">
                                      <p className="text-xs font-medium text-[#F59E0B] mb-2">Snooze history</p>
                                      {snoozeHistoryLoading ? (
                                        <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin mx-auto" />
                                      ) : snoozeHistory.length === 0 ? (
                                        <p className="text-xs text-[#6B7280]">No history yet</p>
                                      ) : (
                                        <>
                                          <div className="space-y-1.5">
                                            {snoozeHistory.map((h) => (
                                              <div key={h.id} className="text-xs text-[#6B7280]">
                                                <span className="text-[#E8E8F0]">{h.preset}</span>
                                                {' → '}
                                                {new Date(h.new_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                              </div>
                                            ))}
                                          </div>
                                          {/* 40.5: Snooze analytics summary */}
                                          {(() => {
                                            const counts: Record<string, number> = {};
                                            snoozeHistory.forEach((h) => { counts[h.preset] = (counts[h.preset] ?? 0) + 1; });
                                            const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                                            return (
                                              <p className="text-[10px] text-[#6B7280]/70 border-t border-[#F59E0B]/20 pt-1.5 mt-1.5">
                                                Total {snoozeHistory.length} snooze{snoozeHistory.length !== 1 ? 's' : ''}
                                                {mostUsed ? <>{' · Most used: '}<span className="text-[#F59E0B]">{mostUsed}</span></> : null}
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleComplete(reminder.id)}
                              aria-label={reminder.completed ? 'Mark as incomplete' : 'Mark as complete'}
                              className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                                reminder.completed
                                  ? 'bg-[#00FF88]/20 text-[#00FF88]'
                                  : 'bg-[#06060B] text-[#6B7280] hover:text-[#00FF88]'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            {!reminder.completed && (
                              <div className="relative">
                                <button
                                  onClick={() => setSnoozeOpenId(snoozeOpenId === reminder.id ? null : reminder.id)}
                                  aria-label="Snooze reminder"
                                  className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#FFB800] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                >
                                  <AlarmClock className="w-4 h-4" />
                                </button>
                                {snoozeOpenId === reminder.id && (
                                  <div className="absolute right-0 top-full mt-1 z-10 bg-[#0C0C18] border border-[#FFB800]/30 rounded-xl shadow-lg p-2 flex flex-col gap-1 min-w-[120px]">
                                    <button onClick={() => handleSnooze(reminder.id, '1h')} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#E8E8F0] whitespace-nowrap">+1 hour</button>
                                    <button onClick={() => handleSnooze(reminder.id, 'tomorrow')} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#E8E8F0] whitespace-nowrap">Tomorrow 9am</button>
                                    <button onClick={() => handleSnooze(reminder.id, 'next-week')} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#E8E8F0] whitespace-nowrap">Next week</button>
                                    <button onClick={() => setSnoozeCustomId(snoozeCustomId === reminder.id ? null : reminder.id)} className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#FFB800]/10 text-[#FFB800] whitespace-nowrap">Custom time…</button>
                                    {snoozeCustomId === reminder.id && (
                                      <div className="flex gap-1 mt-1 px-1">
                                        <input
                                          type="datetime-local"
                                          className="text-xs bg-[#06060B] border border-[#FFB800]/30 rounded-lg px-2 py-1 text-[#E8E8F0] flex-1 min-w-0"
                                          value={snoozeCustomValue}
                                          onChange={(e) => setSnoozeCustomValue(e.target.value)}
                                        />
                                        <button
                                          onClick={() => handleSnoozeCustom(reminder.id)}
                                          className="text-xs px-2 py-1 rounded-lg bg-[#FFB800]/20 text-[#FFB800] hover:bg-[#FFB800]/30 whitespace-nowrap"
                                        >Set</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* 64.4: Duplicate */}
                            <button
                              onClick={() => void handleDuplicate(reminder.id)}
                              aria-label="Duplicate reminder"
                              disabled={duplicatingId === reminder.id}
                              className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#00F0FF] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditClick(reminder)}
                              aria-label="Edit reminder"
                              className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#BF5FFF] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(reminder.id)}
                              aria-label="Delete reminder"
                              className="p-2.5 rounded-lg bg-[#06060B] text-[#6B7280] hover:text-[#FF6161] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        // Calendar view
        <Card className="border-[#00F0FF]/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00F0FF]" />
              Calendar View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-xs text-[#6B7280] py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-[#06060B] border border-[#00F0FF]/10 p-1 text-xs text-[#6B7280]"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Reminder Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) {
          setEditingReminder(null);
          setNewReminder({ text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal' });
        }
      }}>
        <DialogContent className="glass-card-v2 border-[#00F0FF]/20 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingReminder ? 'Edit Reminder' : 'Add Reminder'}</DialogTitle>
          </DialogHeader>

          {/* Natural Language Input — hidden in edit mode */}
          <div className="space-y-4">
            {!editingReminder && (
              <>
                <div>
                  <label className="text-sm text-[#6B7280] mb-2 block">
                    Type naturally (e.g., "tomorrow at 3pm call mom")
                  </label>
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      data-testid="reminder-text"
                      placeholder="Remind me..."
                      value={naturalInput}
                      onChange={(e) => setNaturalInput(e.target.value)}
                      className="flex-1 bg-[#06060B] border-[#00F0FF]/20"
                      autoFocus
                    />
                    <Button
                      onClick={handleNaturalAdd}
                      disabled={!parsedReminder}
                      className="bg-[#00F0FF] hover:bg-[#00D4B0]"
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {parsedReminder && (
                    <div className="mt-2 p-3 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/20">
                      <p className="text-sm text-[#E8E8F0]">{parsedReminder.text}</p>
                      <p className="text-xs text-[#00FF88] mt-1">
                        {parsedReminder.datetime.toLocaleString()}
                        {parsedReminder.recurring && ` • ${parsedReminder.recurring}`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#00F0FF]/20" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-[#0C0C18] text-xs text-[#6B7280]">Or manually</span>
                  </div>
                </div>
              </>
            )}

            {/* Manual Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B7280] mb-1 block">What to remind?</label>
                <Input
                  placeholder="Enter reminder text..."
                  value={newReminder.text}
                  onChange={(e) => setNewReminder({ ...newReminder, text: e.target.value })}
                  className="bg-[#06060B] border-[#00F0FF]/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block">When?</label>
                  <Input
                    type="datetime-local"
                    value={newReminder.datetime}
                    onChange={(e) => setNewReminder({ ...newReminder, datetime: e.target.value })}
                    className="bg-[#06060B] border-[#00F0FF]/20"
                  />
                  {/* 27.5: Quick date preset buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      {
                        label: 'In 1 hour',
                        getDatetime: () => {
                          const d = new Date(Date.now() + 60 * 60 * 1000);
                          return d.toISOString().slice(0, 16);
                        },
                      },
                      {
                        label: 'Tomorrow 9am',
                        getDatetime: () => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          d.setHours(9, 0, 0, 0);
                          return d.toISOString().slice(0, 16);
                        },
                      },
                      {
                        label: 'Next Monday',
                        getDatetime: () => {
                          const d = new Date();
                          const day = d.getDay();
                          const daysUntilMonday = day === 0 ? 1 : 8 - day;
                          d.setDate(d.getDate() + daysUntilMonday);
                          d.setHours(9, 0, 0, 0);
                          return d.toISOString().slice(0, 16);
                        },
                      },
                      {
                        label: 'In 1 week',
                        getDatetime: () => {
                          const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                          return d.toISOString().slice(0, 16);
                        },
                      },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setNewReminder({ ...newReminder, datetime: preset.getDatetime() })}
                        className="px-2 py-1 rounded text-xs bg-[#06060B] border border-[#00F0FF]/20 text-[#6B7280] hover:border-[#00F0FF]/60 hover:text-[#00F0FF] transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] mb-1 block">Category</label>
                  <select
                    value={newReminder.category}
                    onChange={(e) => setNewReminder({ ...newReminder, category: e.target.value as ReminderCategory })}
                    className="w-full px-3 py-2 rounded-md bg-[#06060B] border border-[#00F0FF]/20 text-[#E8E8F0] text-sm"
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="health">Health</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              {/* 62.2: Visual recurring rule builder — unified, replaces split Recurring+Repeat UI */}
              <div>
                <label className="text-xs text-[#6B7280] mb-1.5 block">Recurrence</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { label: 'Never', value: '' as const, desc: 'One-time' },
                    { label: 'Daily', value: 'daily' as const, desc: 'Every day' },
                    { label: 'Weekly', value: 'weekly' as const, desc: 'Every week' },
                    { label: 'Monthly', value: 'monthly' as const, desc: 'Every month' },
                  ]).map(({ label, value, desc }) => (
                    <button
                      key={value || 'never'}
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, recurrence: value, recurring: value })}
                      className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-center transition-colors ${
                        (newReminder.recurrence || '') === value
                          ? 'border-[#00F0FF] bg-[#00F0FF]/10 text-[#00F0FF]'
                          : 'border-[#1C1C2E] bg-[#06060B] text-[#6B7280] hover:border-[#00F0FF]/30 hover:text-[#E8E8F0]'
                      }`}
                    >
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-[10px] opacity-60">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div data-testid="priority-selector">
                <label className="text-xs text-[#6B7280] mb-1 block">Priority</label>
                <div className="flex gap-2">
                  {(['low', 'normal', 'high', 'urgent'] as const).map((p) => {
                    const cfg = priorityConfig[p];
                    return (
                      <button
                        key={p}
                        onClick={() => setNewReminder({ ...newReminder, priority: p })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                        style={{
                          background: newReminder.priority === p ? cfg.bg : 'transparent',
                          border: `1px solid ${newReminder.priority === p ? cfg.color : '#374151'}`,
                          color: newReminder.priority === p ? cfg.color : '#6B7280',
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              data-testid="submit-reminder-btn"
              onClick={editingReminder ? handleEditSave : handleLegacyAdd}
              disabled={!newReminder.text || !newReminder.datetime}
            >
              {editingReminder ? 'Save Changes' : 'Add Reminder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 45.4: Mobile Quick-Add FAB — visible only on mobile, clears above bottom nav */}
      <button
        onClick={() => { setEditingReminder(null); setIsAddDialogOpen(true); }}
        className="md:hidden fixed bottom-20 right-4 w-12 h-12 rounded-full bg-[#00F0FF] text-black flex items-center justify-center shadow-lg z-40 text-xl font-bold"
        aria-label="Add reminder"
      >
        +
      </button>

      {/* 51.2: Recurring reminder edit — choose scope before opening edit dialog */}
      {recurringEditChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <div className="w-full max-w-sm rounded-2xl border border-[#BF5FFF]/30 p-6" style={{ background: '#06060B' }}>
            <h3 className="text-base font-semibold text-[#E8E8F0] mb-1">Edit recurring reminder</h3>
            <p className="text-sm text-[#6B7280] mb-5">This is a <span className="text-[#BF5FFF]">{recurringEditChoice.recurrence}</span> reminder. What would you like to edit?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const r = recurringEditChoice;
                  setRecurringEditChoice(null);
                  setEditAsOneOff(true);
                  handleEditClick(r, true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#BF5FFF]/10 border border-[#BF5FFF]/30 hover:bg-[#BF5FFF]/20 text-[#BF5FFF] text-sm font-medium transition-colors"
              >
                This occurrence only
              </button>
              <button
                onClick={() => {
                  const r = recurringEditChoice;
                  setRecurringEditChoice(null);
                  setEditAsOneOff(false);
                  handleEditClick(r, true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 text-[#00F0FF] text-sm font-medium transition-colors"
              >
                All future occurrences
              </button>
              <button
                onClick={() => setRecurringEditChoice(null)}
                className="w-full py-2 text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
