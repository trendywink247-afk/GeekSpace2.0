import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reminder } from "@/types";
import type { HabitItem, TimeBlock } from "../helpers";
import { usePlannerView } from "../hooks/usePlannerView";

const TODAY = new Date("2026-04-08T09:00:00.000Z");

const blk = (p: Partial<TimeBlock> = {}): TimeBlock => ({
	id: "b1",
	title: "Test",
	startHour: 9,
	duration: 1,
	type: "custom",
	color: "#8B5CF6",
	...p,
});

const rem = (p: Partial<Reminder> = {}): Reminder =>
	({
		id: "r1",
		text: "Buy groceries",
		completed: false,
		priority: "normal",
		datetime: null,
		...p,
	}) as unknown as Reminder;

const hab = (p: Partial<HabitItem> = {}): HabitItem => ({
	id: 1,
	name: "Run",
	icon: "running",
	description: null,
	frequency: "daily",
	current_streak: 3,
	longest_streak: 7,
	logged_today: false,
	...p,
});

describe("usePlannerView", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(TODAY);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("empty day gives zero stats", () => {
		const { result } = renderHook(() =>
			usePlannerView({
				currentDate: TODAY,
				todayBlocks: [],
				habits: [],
				reminders: [],
			}),
		);
		expect(result.current.stats.planned).toBe(0);
		expect(result.current.stats.hoursBlocked).toBe(0);
	});

	it("sums duration into stats", () => {
		const { result } = renderHook(() =>
			usePlannerView({
				currentDate: TODAY,
				todayBlocks: [
					blk({ duration: 2 }),
					blk({ id: "b2", duration: 1.5, startHour: 11 }),
				],
				habits: [],
				reminders: [],
			}),
		);
		expect(result.current.stats.hoursBlocked).toBe(3.5);
		expect(result.current.stats.planned).toBe(2);
	});

	it("weekDates[0] is Sunday", () => {
		const { result } = renderHook(() =>
			usePlannerView({
				currentDate: TODAY,
				todayBlocks: [],
				habits: [],
				reminders: [],
			}),
		);
		expect(result.current.weekDates[0].getDay()).toBe(0);
		expect(result.current.weekDates).toHaveLength(7);
	});

	it("puts unscheduled reminder in backlog", () => {
		const { result } = renderHook(() =>
			usePlannerView({
				currentDate: TODAY,
				todayBlocks: [],
				habits: [],
				reminders: [rem({ text: "Call dentist" })],
			}),
		);
		expect(result.current.backlogItems).toHaveLength(1);
		expect(result.current.backlogItems[0].type).toBe("reminder");
	});

	it("excludes reminder already in a block", () => {
		const { result } = renderHook(() =>
			usePlannerView({
				currentDate: TODAY,
				todayBlocks: [blk({ reminderId: "r1" })],
				habits: [],
				reminders: [rem()],
			}),
		);
		expect(result.current.backlogItems).toHaveLength(0);
	});

	it("puts unlogged habit in backlog for today", () => {
		const { result } = renderHook(() =>
			usePlannerView({
				currentDate: TODAY,
				todayBlocks: [],
				habits: [hab()],
				reminders: [],
			}),
		);
		expect(
			result.current.backlogItems.filter((i) => i.type === "habit"),
		).toHaveLength(1);
	});

	it("topThree returns max 3 sorted by startHour", () => {
		const { result } = renderHook(() =>
			usePlannerView({
				currentDate: TODAY,
				todayBlocks: [
					blk({ id: "a", startHour: 14 }),
					blk({ id: "b", startHour: 8 }),
					blk({ id: "c", startHour: 10 }),
					blk({ id: "d", startHour: 16 }),
				],
				habits: [],
				reminders: [],
			}),
		);
		expect(result.current.topThree).toHaveLength(3);
		expect(result.current.topThree[0].startHour).toBe(8);
	});
});
