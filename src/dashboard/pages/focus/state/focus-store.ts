import { create } from 'zustand';
import type { FocusSession, NotifSettings } from '../helpers';
interface FocusStoreState {
  activeSession: FocusSession | null; settings: NotifSettings | null; deferredCount: number; isLoading: boolean;
  setActiveSession: (s: FocusSession | null) => void; setSettings: (s: NotifSettings | null) => void;
  setDeferredCount: (n: number) => void; setLoading: (l: boolean) => void;
}
export const useFocusStore = create<FocusStoreState>((set) => ({
  activeSession: null, settings: null, deferredCount: 0, isLoading: false,
  setActiveSession: (activeSession) => set({ activeSession }),
  setSettings: (settings) => set({ settings }),
  setDeferredCount: (deferredCount) => set({ deferredCount }),
  setLoading: (isLoading) => set({ isLoading }),
}));
