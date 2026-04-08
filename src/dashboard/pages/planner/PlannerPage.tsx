// ============================================================
// PlannerPage — Aurora revamp (Wave 1).
// Orchestrates state/hooks and renders PlannerHeader + DayPlanner/WeekOverview.
// Old PlannerPage.tsx re-exports this component for backward-compat.
// ============================================================

import { CalendarDays, Clock, PercentSquare } from "lucide-react";
import { DateTime } from "luxon";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardPageWrapper, PageShell } from "@/components/agentin";
import { BlurFade } from "@/components/magicui/blur-fade";
import { StatCard } from "@/components/ui/agentin";
import api, { plannerService } from "@/services/api";
import { useDashboardStore } from "@/stores/dashboard-store";
import { DayPlanner } from "./components/DayPlanner";
import { PlannerHeader } from "./components/PlannerHeader";
import { WeekOverview } from "./components/WeekOverview";
import type { BacklogItem, HabitItem, TimeBlock } from "./helpers";
import {
	dateKey,
	formatHour,
	generateId,
	isSameDay,
	TYPE_COLORS,
} from "./helpers";
import { usePlannerBlocks } from "./hooks/usePlannerBlocks";
import { usePlannerView } from "./hooks/usePlannerView";
import { usePlannerStore } from "./state/planner-store";

export function PlannerPage() {
	// ── Planner store (view + nav) ────────────────────────────────────────────
	const {
		currentDate,
		viewMode,
		setCurrentDate,
		goToday,
		goPrev,
		goNext,
		setViewMode,
		dragItemId,
		setDragItemId,
		quickAddHour,
		quickAddTitle,
		quickAddDuration,
		setQuickAddHour,
		setQuickAddTitle,
		setQuickAddDuration,
		resetQuickAdd,
	} = usePlannerStore();

	// ── Local state (habits + drag item ref) ─────────────────────────────────
	const [habits, setHabits] = useState<HabitItem[]>([]);
	const [habitsLoading, setHabitsLoading] = useState(true);
	const [dropTarget, setDropTarget] = useState<number | null>(null);
	const dragItemRef = useRef<BacklogItem | null>(null);
	const quickAddRef = useRef<HTMLInputElement>(null);

	// ── Dashboard store ───────────────────────────────────────────────────────
	const { reminders, loadReminders } = useDashboardStore();

	// ── View helpers ─────────────────────────────────────────────────────────
	const weekDates = (() => {
		const start = new Date(currentDate);
		start.setDate(start.getDate() - start.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(d.getDate() + i);
			return d;
		});
	})();

	// ── Blocks hook ───────────────────────────────────────────────────────────
	const {
		blocks,
		todayBlocks,
		addBlock,
		removeBlock,
		scheduleBacklogItem,
		addCustomBlock,
	} = usePlannerBlocks({ currentDate, weekDates, viewMode });

	// ── View derivations ──────────────────────────────────────────────────────
	const { isToday, currentHourFraction, backlogItems, stats, topThree } =
		usePlannerView({
			currentDate,
			todayBlocks,
			habits,
			reminders,
		});

	// ── Data loading ──────────────────────────────────────────────────────────
	useEffect(() => {
		loadReminders();
	}, [loadReminders]);

	useEffect(() => {
		let alive = true;
		api
			.get("/habits")
			.then((res) => {
				if (alive)
					setHabits((res.data as { habits: HabitItem[] }).habits || []);
			})
			.catch(() => {
				if (alive) setHabits([]);
			})
			.finally(() => {
				if (alive) setHabitsLoading(false);
			});
		return () => {
			alive = false;
		};
	}, []);

	// ── Quick-add effect ──────────────────────────────────────────────────────
	useEffect(() => {
		if (quickAddHour !== null && quickAddRef.current)
			quickAddRef.current.focus();
	}, [quickAddHour]);

	// ── Drag handlers ─────────────────────────────────────────────────────────
	const handleDragStart = useCallback(
		(item: BacklogItem) => {
			dragItemRef.current = item;
			setDragItemId(item.id);
		},
		[setDragItemId],
	);

	const handleDragOver = useCallback((e: React.DragEvent, hour: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDropTarget(hour);
	}, []);

	const handleDragLeave = useCallback(() => setDropTarget(null), []);

	const handleDrop = useCallback(
		(e: React.DragEvent, hour: number) => {
			e.preventDefault();
			setDropTarget(null);
			const item = dragItemRef.current;
			if (!item) return;
			const block = scheduleBacklogItem(item, hour);
			dragItemRef.current = null;
			setDragItemId(null);
			toast.success(`Scheduled "${block.title}" at ${formatHour(hour)}`);
		},
		[scheduleBacklogItem, setDragItemId],
	);

	const handleWeekDrop = useCallback(
		(e: React.DragEvent, hour: number, date: Date) => {
			e.preventDefault();
			const item = dragItemRef.current;
			if (!item) return;
			const block = scheduleBacklogItem(item, hour, date);
			dragItemRef.current = null;
			setDragItemId(null);
			toast.success(
				`Scheduled "${block.title}" at ${formatHour(hour)} on ${DateTime.fromJSDate(
					date,
				).toLocaleString({ weekday: "short" })}`,
			);
		},
		[scheduleBacklogItem, setDragItemId],
	);

	// ── Quick-add handlers ────────────────────────────────────────────────────
	const handleQuickAdd = useCallback(() => {
		if (!quickAddTitle.trim() || quickAddHour === null) return;
		const block = addCustomBlock(
			quickAddTitle.trim(),
			quickAddHour,
			quickAddDuration,
		);
		toast.success(`Added "${block.title}" at ${formatHour(quickAddHour)}`);
		resetQuickAdd();
	}, [
		quickAddTitle,
		quickAddHour,
		quickAddDuration,
		addCustomBlock,
		resetQuickAdd,
	]);

	// ── Remove block ─────────────────────────────────────────────────────────
	const handleRemoveBlock = useCallback(
		(blockId: string) => {
			removeBlock(blockId);
		},
		[removeBlock],
	);

	// ── Stats ────────────────────────────────────────────────────────────────
	const dragItem = dragItemId ? dragItemRef.current : null;

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<DashboardPageWrapper>
			<PageShell noPadding>
				{/* Sticky header */}
				<PlannerHeader viewMode={viewMode} onViewChange={setViewMode} />

				<div className="px-4 sm:px-6 py-4 space-y-5">
					{/* Stats row */}
					<BlurFade delay={0.1}>
						<div className="grid grid-cols-3 gap-3">
							<StatCard
								label="Planned"
								value={stats.planned}
								icon={CalendarDays}
								accent="violet"
							/>
							<StatCard
								label="Hours"
								value={`${stats.hoursBlocked}h`}
								icon={Clock}
								accent="indigo"
							/>
							<StatCard
								label="Day filled"
								value={`${stats.pct}%`}
								icon={PercentSquare}
								accent={
									stats.pct >= 70
										? "emerald"
										: stats.pct >= 40
											? "amber"
											: "coral"
								}
							/>
						</div>
					</BlurFade>

					{/* View content */}
					{viewMode === "week" ? (
						<WeekOverview
							currentDate={currentDate}
							weekDates={weekDates}
							currentHourFraction={currentHourFraction}
							blocks={blocks}
							onSelectDate={(d) => {
								setCurrentDate(d);
								setViewMode("day");
							}}
							onGoToday={goToday}
							onGoPrev={goPrev}
							onGoNext={goNext}
							onWeekDrop={handleWeekDrop}
						/>
					) : (
						<DayPlanner
							currentDate={currentDate}
							isToday={isToday}
							currentHourFraction={currentHourFraction}
							todayBlocks={todayBlocks}
							backlogItems={backlogItems}
							topThree={topThree}
							habitsLoading={habitsLoading}
							dragItem={dragItem}
							dropTarget={dropTarget}
							quickAddHour={quickAddHour}
							quickAddTitle={quickAddTitle}
							quickAddDuration={quickAddDuration}
							onGoPrev={goPrev}
							onGoNext={goNext}
							onGoToday={goToday}
							onDragStart={handleDragStart}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onRemoveBlock={handleRemoveBlock}
							onQuickAddHourSet={setQuickAddHour}
							onQuickAddTitleChange={setQuickAddTitle}
							onQuickAddDurationChange={setQuickAddDuration}
							onQuickAddSubmit={handleQuickAdd}
							onQuickAddCancel={resetQuickAdd}
						/>
					)}
				</div>
			</PageShell>
		</DashboardPageWrapper>
	);
}
