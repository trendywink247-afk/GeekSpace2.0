import { create } from 'zustand';
import type { Reminder } from '@/types';
import type { SnoozeHistoryEntry } from '../types';

export interface UndoToast {
  ids: string[];
  count: number;
}

interface RemindersUIState {
  snoozeToast: string | null;
  undoToast: UndoToast | null;
  showCelebration: boolean;
  isComposerOpen: boolean;
  editingReminder: Reminder | null;
  recurringEditChoice: Reminder | null;
  editAsOneOff: boolean;
  snoozeOpenId: string | null;
  snoozeCustomId: string | null;
  snoozeCustomValue: string;
  snoozeHistoryId: string | null;
  snoozeHistory: SnoozeHistoryEntry[];
  snoozeHistoryLoading: boolean;
  inlineEditId: string | null;
  inlineEditValue: string;
  duplicatingId: string | null;
  completingIds: Set<string>;
  justCompletedIds: Set<string>;
  selectedActiveIds: Set<string>;
  selectedIds: Set<string>;
  isBulkDeleting: boolean;
  isBulkRestoringSnooze: boolean;
  isBatchEditing: boolean;
  isBulkSnoozing: boolean;
  isBulkCompleting: boolean;
  isBulkDeletingActive: boolean;
  isMarkingAllOverdue: boolean;
  setSnoozeToast: (msg: string | null) => void;
  setUndoToast: (toast: UndoToast | null) => void;
  setShowCelebration: (v: boolean) => void;
  openComposer: (reminder?: Reminder) => void;
  closeComposer: () => void;
  setRecurringEditChoice: (r: Reminder | null) => void;
  setEditAsOneOff: (v: boolean) => void;
  setSnoozeOpenId: (id: string | null) => void;
  setSnoozeCustomId: (id: string | null) => void;
  setSnoozeCustomValue: (v: string) => void;
  setSnoozeHistoryId: (id: string | null) => void;
  setSnoozeHistory: (h: SnoozeHistoryEntry[]) => void;
  setSnoozeHistoryLoading: (v: boolean) => void;
  setInlineEditId: (id: string | null) => void;
  setInlineEditValue: (v: string) => void;
  setDuplicatingId: (id: string | null) => void;
  addCompletingId: (id: string) => void;
  removeCompletingId: (id: string) => void;
  addJustCompletedId: (id: string) => void;
  removeJustCompletedId: (id: string) => void;
  toggleSelectActive: (id: string) => void;
  selectAllActive: (ids: string[]) => void;
  clearSelectActive: () => void;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelect: () => void;
  setIsBulkDeleting: (v: boolean) => void;
  setIsBulkRestoringSnooze: (v: boolean) => void;
  setIsBatchEditing: (v: boolean) => void;
  setIsBulkSnoozing: (v: boolean) => void;
  setIsBulkCompleting: (v: boolean) => void;
  setIsBulkDeletingActive: (v: boolean) => void;
  setIsMarkingAllOverdue: (v: boolean) => void;
}

export const useRemindersUI = create<RemindersUIState>((set) => ({
  snoozeToast: null, undoToast: null, showCelebration: false,
  isComposerOpen: false, editingReminder: null, recurringEditChoice: null, editAsOneOff: false,
  snoozeOpenId: null, snoozeCustomId: null, snoozeCustomValue: '',
  snoozeHistoryId: null, snoozeHistory: [], snoozeHistoryLoading: false,
  inlineEditId: null, inlineEditValue: '',
  duplicatingId: null, completingIds: new Set(), justCompletedIds: new Set(),
  selectedActiveIds: new Set(), selectedIds: new Set(),
  isBulkDeleting: false, isBulkRestoringSnooze: false, isBatchEditing: false,
  isBulkSnoozing: false, isBulkCompleting: false, isBulkDeletingActive: false, isMarkingAllOverdue: false,
  setSnoozeToast: (msg) => set({ snoozeToast: msg }),
  setUndoToast: (toast) => set({ undoToast: toast }),
  setShowCelebration: (v) => set({ showCelebration: v }),
  openComposer: (reminder) => set({ isComposerOpen: true, editingReminder: reminder ?? null }),
  closeComposer: () => set({ isComposerOpen: false, editingReminder: null, editAsOneOff: false }),
  setRecurringEditChoice: (r) => set({ recurringEditChoice: r }),
  setEditAsOneOff: (v) => set({ editAsOneOff: v }),
  setSnoozeOpenId: (id) => set({ snoozeOpenId: id }),
  setSnoozeCustomId: (id) => set({ snoozeCustomId: id }),
  setSnoozeCustomValue: (v) => set({ snoozeCustomValue: v }),
  setSnoozeHistoryId: (id) => set({ snoozeHistoryId: id }),
  setSnoozeHistory: (h) => set({ snoozeHistory: h }),
  setSnoozeHistoryLoading: (v) => set({ snoozeHistoryLoading: v }),
  setInlineEditId: (id) => set({ inlineEditId: id }),
  setInlineEditValue: (v) => set({ inlineEditValue: v }),
  setDuplicatingId: (id) => set({ duplicatingId: id }),
  addCompletingId: (id) => set((s) => ({ completingIds: new Set([...s.completingIds, id]) })),
  removeCompletingId: (id) => set((s) => { const n = new Set(s.completingIds); n.delete(id); return { completingIds: n }; }),
  addJustCompletedId: (id) => set((s) => ({ justCompletedIds: new Set([...s.justCompletedIds, id]) })),
  removeJustCompletedId: (id) => set((s) => { const n = new Set(s.justCompletedIds); n.delete(id); return { justCompletedIds: n }; }),
  toggleSelectActive: (id) => set((s) => { const n = new Set(s.selectedActiveIds); n.has(id) ? n.delete(id) : n.add(id); return { selectedActiveIds: n }; }),
  selectAllActive: (ids) => set({ selectedActiveIds: new Set(ids) }),
  clearSelectActive: () => set({ selectedActiveIds: new Set() }),
  toggleSelect: (id) => set((s) => { const n = new Set(s.selectedIds); n.has(id) ? n.delete(id) : n.add(id); return { selectedIds: n }; }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelect: () => set({ selectedIds: new Set() }),
  setIsBulkDeleting: (v) => set({ isBulkDeleting: v }),
  setIsBulkRestoringSnooze: (v) => set({ isBulkRestoringSnooze: v }),
  setIsBatchEditing: (v) => set({ isBatchEditing: v }),
  setIsBulkSnoozing: (v) => set({ isBulkSnoozing: v }),
  setIsBulkCompleting: (v) => set({ isBulkCompleting: v }),
  setIsBulkDeletingActive: (v) => set({ isBulkDeletingActive: v }),
  setIsMarkingAllOverdue: (v) => set({ isMarkingAllOverdue: v }),
}));
