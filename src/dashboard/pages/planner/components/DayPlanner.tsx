import {
	CalendarCheck,
	ChevronLeft,
	ChevronRight,
	LayoutGrid,
	Plus,
} from "lucide-react";
import { DateTime } from "luxon";
import { useRef } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { GlassCard, SectionHeader } from "@/components/ui/agentin";
import { Button } from "@/components/ui/button";
import type { BacklogItem, TimeBlock } from "../helpers";
import { formatDate, formatHour, HOURS } from "../helpers";
import { BacklogCard, TimeBlockCard } from "./BlockCard";
import { BlockComposer } from "./BlockComposer";
import { EmptyDay } from "./EmptyDay";
import { PriorityList } from "./PriorityList";

interface DayPlannerProps {
	currentDate: Date;
	isToday: boolean;
	currentHourFraction: number;
	todayBlocks: TimeBlock[];
	backlogItems: BacklogItem[];
	topThree: TimeBlock[];
	habitsLoading: boolean;
	dragItem: BacklogItem | null;
	dropTarget: number | null;
	quickAddHour: number | null;
	quickAddTitle: string;
	quickAddDuration: number;
	onGoPrev: () => void;
	onGoNext: () => void;
	onGoToday: () => void;
	onDragStart: (item: BacklogItem) => void;
	onDragOver: (e: React.DragEvent, hour: number) => void;
	onDragLeave: () => void;
	onDrop: (e: React.DragEvent, hour: number) => void;
	onRemoveBlock: (id: string) => void;
	onQuickAddHourSet: (hour: number | null) => void;
	onQuickAddTitleChange: (v: string) => void;
	onQuickAddDurationChange: (v: number) => void;
	onQuickAddSubmit: () => void;
	onQuickAddCancel: () => void;
}

export function DayPlanner({
	currentDate,
	isToday,
	currentHourFraction,
	todayBlocks,
	backlogItems,
	topThree,
	habitsLoading,
	dragItem,
	dropTarget,
	quickAddHour,
	quickAddTitle,
	quickAddDuration,
	onGoPrev,
	onGoNext,
	onGoToday,
	onDragStart,
	onDragOver,
	onDragLeave,
	onDrop,
	onRemoveBlock,
	onQuickAddHourSet,
	onQuickAddTitleChange,
	onQuickAddDurationChange,
	onQuickAddSubmit,
	onQuickAddCancel,
}: DayPlannerProps) {
	const quickAddRef = useRef<HTMLInputElement>(null);

	return (
		<div className="flex flex-col lg:flex-row gap-4">
			{/* Left: backlog + priority */}
			<BlurFade delay={0.15}>
				<div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
					{isToday && topThree.length > 0 && (
						<GlassCard accent="amber" className="p-4">
							<PriorityList blocks={topThree} />
						</GlassCard>
					)}

					<GlassCard className="overflow-hidden">
						<div
							className="px-4 py-3 flex items-center justify-between"
							style={{ borderBottom: "1px solid var(--ag-border-subtle)" }}
						>
							<SectionHeader
								label="Backlog"
								className="flex-1 py-0"
								action={
									<span
										className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
										style={{
											background: "rgba(139,92,246,0.12)",
											color: "var(--ag-violet-soft)",
										}}
									>
										{backlogItems.length}
									</span>
								}
							/>
							<LayoutGrid
								className="w-3.5 h-3.5 flex-shrink-0 ml-2"
								style={{ color: "var(--ag-text-muted)" }}
							/>
						</div>

						<div className="p-2 space-y-1 max-h-[35vh] lg:max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar">
							{habitsLoading ? (
								<div className="py-8 text-center">
									<div
										className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
										style={{
											borderColor: "rgba(139,92,246,0.2)",
											borderTopColor: "var(--ag-violet)",
										}}
									/>
									<p
										className="text-xs mt-2"
										style={{ color: "var(--ag-text-muted)" }}
									>
										Loading…
									</p>
								</div>
							) : backlogItems.length === 0 ? (
								<div className="py-8 text-center">
									<CalendarCheck
										className="w-8 h-8 mx-auto mb-2"
										style={{ color: "rgba(139,92,246,0.25)" }}
									/>
									<p
										className="text-xs"
										style={{ color: "var(--ag-text-muted)" }}
									>
										{isToday ? "All caught up!" : "No items for this day"}
									</p>
								</div>
							) : (
								backlogItems.map((item) => (
									<BacklogCard
										key={item.id}
										item={item}
										onDragStart={onDragStart}
									/>
								))
							)}
						</div>

						<div
							className="px-4 py-2.5 flex items-center gap-3"
							style={{ borderTop: "1px solid var(--ag-border-subtle)" }}
						>
							{[
								{ color: "var(--ag-violet-soft)", label: "Reminders" },
								{ color: "var(--ag-emerald)", label: "Habits" },
								{ color: "var(--ag-violet)", label: "Custom" },
							].map(({ color, label }) => (
								<span key={label} className="flex items-center gap-1">
									<span
										className="w-1.5 h-1.5 rounded-full flex-shrink-0"
										style={{ background: color }}
									/>
									<span
										className="text-[10px]"
										style={{ color: "var(--ag-text-muted)" }}
									>
										{label}
									</span>
								</span>
							))}
						</div>
					</GlassCard>
				</div>
			</BlurFade>

			{/* Right: timeline */}
			<BlurFade delay={0.25}>
				<div className="flex-1 min-w-0">
					<GlassCard className="overflow-hidden">
						{/* Date nav */}
						<div
							className="px-4 py-3 flex items-center justify-between"
							style={{ borderBottom: "1px solid var(--ag-border-subtle)" }}
						>
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-11 w-11 sm:h-9 sm:w-9"
									style={{ color: "var(--ag-text-secondary)" }}
									onClick={onGoPrev}
								>
									<ChevronLeft className="w-4 h-4" />
								</Button>
								<button
									onClick={onGoToday}
									className="px-2 text-sm font-semibold transition-colors min-h-[44px]"
									style={{
										fontFamily: "Syne, sans-serif",
										color: isToday
											? "var(--ag-violet-soft)"
											: "var(--ag-text-primary)",
									}}
								>
									{formatDate(currentDate)}
								</button>
								<Button
									variant="ghost"
									size="icon"
									className="h-11 w-11 sm:h-9 sm:w-9"
									style={{ color: "var(--ag-text-secondary)" }}
									onClick={onGoNext}
								>
									<ChevronRight className="w-4 h-4" />
								</Button>
							</div>

							{!isToday && (
								<Button
									variant="ghost"
									size="sm"
									className="text-xs min-h-[44px] sm:min-h-0 sm:h-7"
									style={{ color: "var(--ag-violet-soft)" }}
									onClick={onGoToday}
								>
									Today
								</Button>
							)}

							{isToday && (
								<div className="flex items-center gap-1.5">
									<span
										className="relative flex h-2 w-2"
										title={DateTime.now().toLocaleString(DateTime.TIME_SIMPLE)}
									>
										<span
											className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
											style={{ background: "var(--ag-emerald)" }}
										/>
										<span
											className="relative inline-flex rounded-full h-2 w-2"
											style={{ background: "var(--ag-emerald)" }}
										/>
									</span>
									<span
										className="text-[10px] font-mono"
										style={{ color: "var(--ag-emerald)" }}
									>
										Live
									</span>
								</div>
							)}
						</div>

						{/* Time grid */}
						<div className="relative max-h-[65vh] sm:max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
							{todayBlocks.length === 0 && !dragItem && (
								<div className="py-4 px-4">
									<EmptyDay
										isToday={isToday}
										onAddBlock={() => onQuickAddHourSet(9)}
									/>
								</div>
							)}

							{HOURS.map((hour) => {
								const isCurrentHour =
									isToday && Math.floor(currentHourFraction) === hour;
								const isDrop = dropTarget === hour;
								const slotBlocks = todayBlocks.filter(
									(b) => Math.floor(b.startHour) === hour,
								);

								return (
									<div
										key={hour}
										className="flex border-b transition-colors duration-150"
										style={{
											borderBottomColor: "rgba(255,255,255,0.025)",
											minHeight: 64,
											background: isCurrentHour
												? "rgba(139,92,246,0.03)"
												: isDrop
													? "rgba(139,92,246,0.05)"
													: undefined,
										}}
										onDragOver={(e) => onDragOver(e, hour)}
										onDragLeave={onDragLeave}
										onDrop={(e) => onDrop(e, hour)}
									>
										<div
											className="w-16 sm:w-20 flex-shrink-0 py-2 px-2 sm:px-3 text-right"
											style={{
												borderRight: isCurrentHour
													? "2px solid var(--ag-violet)"
													: "1px solid rgba(255,255,255,0.04)",
												color: isCurrentHour
													? "var(--ag-violet-soft)"
													: "var(--ag-text-muted)",
											}}
										>
											<span className="font-mono text-xs tabular-nums">
												{formatHour(hour)}
											</span>
										</div>

										<div
											className="flex-1 py-1.5 px-2 sm:px-3 relative"
											style={{
												minHeight: 64,
												outline: isDrop
													? "1px solid rgba(139,92,246,0.25)"
													: undefined,
												outlineOffset: "-1px",
												borderRadius: isDrop ? "0 8px 8px 0" : undefined,
											}}
										>
											{slotBlocks.map((block) => (
												<TimeBlockCard
													key={block.id}
													block={block}
													onRemove={onRemoveBlock}
												/>
											))}

											{isDrop && slotBlocks.length === 0 && (
												<div
													className="absolute inset-1 rounded-xl flex items-center justify-center"
													style={{ border: "1px dashed rgba(139,92,246,0.35)" }}
												>
													<span
														className="text-[10px]"
														style={{ color: "rgba(139,92,246,0.5)" }}
													>
														Drop here
													</span>
												</div>
											)}

											{!dragItem &&
												slotBlocks.length === 0 &&
												quickAddHour !== hour && (
													<button
														onClick={() => onQuickAddHourSet(hour)}
														className="absolute top-1 right-1 w-11 h-11 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all opacity-0 hover:opacity-100"
														style={{
															background: "rgba(139,92,246,0.08)",
															border: "1px solid rgba(139,92,246,0.12)",
															color: "var(--ag-violet)",
														}}
														title="Add custom block"
													>
														<Plus className="w-3.5 h-3.5" />
													</button>
												)}

											{quickAddHour === hour && (
												<BlockComposer
													inputRef={quickAddRef}
													title={quickAddTitle}
													duration={quickAddDuration}
													onTitleChange={onQuickAddTitleChange}
													onDurationChange={onQuickAddDurationChange}
													onSubmit={onQuickAddSubmit}
													onCancel={onQuickAddCancel}
												/>
											)}
										</div>
									</div>
								);
							})}

							{/* Current time line */}
							{isToday &&
								currentHourFraction >= 6 &&
								currentHourFraction <= 23 && (
									<div
										className="absolute left-0 right-0 pointer-events-none z-10"
										style={{
											top: `${((currentHourFraction - 6) / 17) * 100}%`,
										}}
									>
										<div className="flex items-center">
											<div
												className="w-2 h-2 rounded-full flex-shrink-0 -ml-1"
												style={{ background: "var(--ag-coral)" }}
											/>
											<div
												className="flex-1 h-[2px]"
												style={{ background: "rgba(251,146,60,0.55)" }}
											/>
										</div>
									</div>
								)}
						</div>
					</GlassCard>
				</div>
			</BlurFade>
		</div>
	);
}
