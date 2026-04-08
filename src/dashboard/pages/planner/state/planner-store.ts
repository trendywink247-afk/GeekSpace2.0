// planner-store — Zustand store for Planner page state.
import { create } from 'zustand';
import { dateKey } from '../helpers';

export type ViewMode = 'day' | 'week';

export interface PlannerState {
  currentDate: Date;
  viewMode: ViewMode;
  dragItemId: string | null;
  quickAddHour: number | null;
  quickAddTitle: string;
  quickAddDuration: number;
  setCurrentDate: (date: Date) => void;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  setViewMode: (mode: ViewMode) => void;
  setDragItemId: (id: string | null) => void;
  setQuickAddHour: (hour: number | null) => void;
  setQuickAddTitle: (title: string) => void;
  setQuickAddDuration: (duration: number) => void;
  resetQuickAdd: () => void;
}

export const usePlannerStore = create<PlannerState>((set) => ({
  currentDate: new Date(),
  viewMode: 'day',
  dragItemId: null,
  quickAddHour: null,
  quickAddTitle: '',
  quickAddDuration: 1,

  setCurrentDate: (date) => set({ currentDate: date }),
  goToday: () => set({ currentDate: new Date() }),
  goPrev: () =>
    set((s) => {
      const d = new Date(s.currentDate);
      d.setDate(d.getDate() - (s.viewMode === 'week' ? 7 : 1));
      return { currentDate: d };
    }),
  goNext: () =>
    set((s) => {
      const d = new Date(s.currentDate);
      d.setDate(d.getDate() + (s.viewMode === 'week' ? 7 : 1));
      return { currentDate: d };
    }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setDragItemId: (id) => set({ dragItemId: id }),
  setQuickAddHour: (hour) => set({ quickAddHour: hour }),
  setQuickAddTitle: (title) => set({ quickAddTitle: title }),
  setQuickAddDuration: (duration) => set({ quickAddDuration: duration }),
  resetQuickAdd: () => set({ quickAddHour: null, quickAddTitle: '', quickAddDuration: 1 }),
}));

export function currentDateKey(date: Date): string {
  return dateKey(date);
}
