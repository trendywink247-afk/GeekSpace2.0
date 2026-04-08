// ============================================================
// Focus Zustand store — active session + loading state
// ============================================================

import { create } from "zustand";
import type { FocusSession, NotifSettings } from "../helpers";

interface FocusStoreState {
	activeSession: FocusSession | null;
	settings: NotifSettings | null;
	deferredCount: number;
	isLoading: boolean;
	setActiveSession: (session: FocusSession | null) => void;
	setSettings: (settings: NotifSettings | null) => void;
	setDeferredCount: (count: number) => void;
	setLoading: (loading: boolean) => void;
}

export const useFocusStore = create<FocusStoreState>((set) => ({
	activeSession: null,
	settings: null,
	deferredCount: 0,
	isLoading: false,
	setActiveSession: (session) => set({ activeSession: session }),
	setSettings: (settings) => set({ settings }),
	setDeferredCount: (count) => set({ deferredCount: count }),
	setLoading: (loading) => set({ isLoading: loading }),
}));
