// ============================================================
// useFocusHistory — fetch + memoize session history + summary
// ============================================================

import { useCallback, useState } from "react";
import { toast } from "sonner";
import api from "@/services/api";
import type { FocusSession, FocusSummary } from "../helpers";

export interface UseFocusHistoryReturn {
	history: FocusSession[];
	summary: FocusSummary | null;
	completedHistory: FocusSession[];
	focusStreak: number;
	loadHistory: () => Promise<void>;
}

export function useFocusHistory(): UseFocusHistoryReturn {
	const [history, setHistory] = useState<FocusSession[]>([]);
	const [summary, setSummary] = useState<FocusSummary | null>(null);

	const loadHistory = useCallback(async () => {
		try {
			const [histRes, sumRes] = await Promise.all([
				api.get("/focus/history?limit=20"),
				api.get("/focus/summary"),
			]);
			setHistory((histRes.data as { sessions: FocusSession[] }).sessions);
			setSummary((sumRes.data as { summary: FocusSummary }).summary);
		} catch {
			toast.error("Failed to load focus history");
		}
	}, []);

	const completedHistory = history.filter((h) => h.ended_at !== null);

	const focusStreak = (() => {
		if (completedHistory.length === 0) return 0;
		const sessionDates = new Set(
			completedHistory
				.filter((s) => s.completed)
				.map((s) => new Date(s.started_at).toISOString().slice(0, 10)),
		);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		let streak = 0;
		const check = new Date(today);
		const todayStr = check.toISOString().slice(0, 10);
		const yest = new Date(check);
		yest.setDate(yest.getDate() - 1);
		const yestStr = yest.toISOString().slice(0, 10);
		if (!sessionDates.has(todayStr) && !sessionDates.has(yestStr)) return 0;
		if (!sessionDates.has(todayStr)) {
			check.setDate(check.getDate() - 1);
		}
		while (sessionDates.has(check.toISOString().slice(0, 10))) {
			streak++;
			check.setDate(check.getDate() - 1);
		}
		return streak;
	})();

	return { history, summary, completedHistory, focusStreak, loadHistory };
}
