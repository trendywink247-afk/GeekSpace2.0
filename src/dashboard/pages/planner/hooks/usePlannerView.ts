// ============================================================
// usePlannerView — derived view state for the planner.
// Computes week dates, stats, backlog items from raw data.
// ============================================================

import { useMemo } from "react";
import type { Reminder } from "@/types";
import type { BacklogItem, HabitItem, TimeBlock } from "../helpers";
import { dateKey, isSameDay } from "../helpers";

interface UsePlannerViewOptions {
	currentDate: Date;
	todayBlocks: TimeBlock[];
	habits: HabitItem[];
	reminders: Reminder[];
}

export function usePlannerView({
	currentDate,
	todayBlocks,
	habits,
	reminders,
}: UsePlannerViewOptions) {
	const now = new Date();
	const isToday = isSameDay(currentDate, now);
	const currentHourFraction = now.getHours() + now.getMinutes() / 60;

	const weekDates = useMemo(() => {
		const start = new Date(currentDate);
		const dayOfWeek = start.getDay();
		start.setDate(start.getDate() - dayOfWeek);
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(d.getDate() + i);
			return d;
		});
	}, [currentDate]);

	const backlogItems = useMemo<BacklogItem[]>(() => {
		const items: BacklogItem[] = [];

		reminders
			.filter((r: Reminder) => {
				if (r.completed) return false;
				if (todayBlocks.some((b) => b.reminderId === r.id)) return false;
				if (!r.datetime) return isSameDay(currentDate, now);
				return isSameDay(new Date(r.datetime), currentDate);
			})
			.forEach((r: Reminder) => {
				items.push({
					id: `rem_${r.id}`,
					title: r.text,
					type: "reminder",
					priority: r.priority || "normal",
					icon: "bell",
					sourceId: r.id,
				});
			});

		if (isToday) {
			habits
				.filter(
					(h) =>
						!h.logged_today && !todayBlocks.some((b) => b.habitId === h.id),
				)
				.forEach((h) => {
					items.push({
						id: `hab_${h.id}`,
						title: `${h.icon} ${h.name}`,
						type: "habit",
						icon: "flame",
						sourceId: h.id,
					});
				});
		}

		return items;
	}, [reminders, habits, currentDate, todayBlocks, isToday, now]);

	const stats = useMemo(() => {
		const planned = todayBlocks.length;
		const hoursBlocked = todayBlocks.reduce((s, b) => s + b.duration, 0);
		const pct = Math.round((hoursBlocked / 17) * 100);
		const completedCount = todayBlocks.filter(
			(b) => b.type !== "habit" || b.habitId == null,
		).length;
		return { planned, hoursBlocked, pct, completedCount };
	}, [todayBlocks]);

	const topThree = useMemo(() => {
		return todayBlocks
			.slice()
			.sort((a, b) => a.startHour - b.startHour)
			.slice(0, 3);
	}, [todayBlocks]);

	return {
		isToday,
		currentHourFraction,
		weekDates,
		backlogItems,
		stats,
		topThree,
		dateKey,
	};
}
