import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { BlurFade } from "@/components/magicui/blur-fade";
import { GlassCard } from "@/components/ui/agentin";
import { Button } from "@/components/ui/button";
import type { TimeBlock } from "../helpers";
import { dateKey, formatHour, HOURS, isSameDay } from "../helpers";

<<<<<<< HEAD
const DL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WeekOverviewProps {
=======
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WeekOverviewProps {
	/** Used for future highlighting of selected day */
>>>>>>> origin/ui/wave1-reminders
	currentDate: Date;
	weekDates: Date[];
	currentHourFraction: number;
	blocks: Record<string, TimeBlock[]>;
	onSelectDate: (date: Date) => void;
	onGoToday: () => void;
	onGoPrev: () => void;
	onGoNext: () => void;
	onWeekDrop: (e: React.DragEvent, hour: number, date: Date) => void;
}

export function WeekOverview({
	currentDate: _cd,
	weekDates,
	currentHourFraction,
	blocks,
	onSelectDate,
	onGoToday,
	onGoPrev,
	onGoNext,
	onWeekDrop,
}: WeekOverviewProps) {
	const today = new Date();
<<<<<<< HEAD
	return (
		<BlurFade delay={0.2}>
			<GlassCard accent="indigo" className="overflow-hidden">
=======

	return (
		<BlurFade delay={0.2}>
			<GlassCard accent="indigo" className="overflow-hidden">
				{/* Header */}
>>>>>>> origin/ui/wave1-reminders
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
						<span
							className="text-sm font-semibold px-2"
							style={{
								fontFamily: "Syne, sans-serif",
								color: "var(--ag-text-primary)",
							}}
						>
							{DateTime.fromJSDate(weekDates[0]).toLocaleString({
								month: "short",
								day: "numeric",
							})}
<<<<<<< HEAD
							{" \u2013 "}
=======
							{" – "}
>>>>>>> origin/ui/wave1-reminders
							{DateTime.fromJSDate(weekDates[6]).toLocaleString({
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
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
					<Button
						variant="ghost"
						size="sm"
						className="text-xs min-h-[44px] sm:min-h-0 sm:h-7"
						style={{ color: "var(--ag-indigo)" }}
						onClick={onGoToday}
					>
						This Week
					</Button>
				</div>
<<<<<<< HEAD
				<div className="overflow-x-auto">
					<div style={{ minWidth: 700 }}>
=======

				{/* Grid */}
				<div className="overflow-x-auto">
					<div style={{ minWidth: 700 }}>
						{/* Day headers */}
>>>>>>> origin/ui/wave1-reminders
						<div
							className="grid"
							style={{
								gridTemplateColumns: "60px repeat(7, 1fr)",
								borderBottom: "1px solid var(--ag-border-subtle)",
							}}
						>
							<div className="p-2" />
							{weekDates.map((d) => {
<<<<<<< HEAD
								const iDT = isSameDay(d, today);
=======
								const isDateToday = isSameDay(d, today);
>>>>>>> origin/ui/wave1-reminders
								return (
									<button
										key={dateKey(d)}
										type="button"
										onClick={() => onSelectDate(d)}
										className="p-2 text-center transition-colors min-h-[44px]"
										style={{
<<<<<<< HEAD
											background: iDT ? "rgba(99,102,241,0.05)" : undefined,
=======
											background: isDateToday
												? "rgba(99,102,241,0.05)"
												: undefined,
>>>>>>> origin/ui/wave1-reminders
										}}
									>
										<span
											className="text-[10px] uppercase tracking-wider block"
											style={{
<<<<<<< HEAD
												color: iDT
=======
												color: isDateToday
>>>>>>> origin/ui/wave1-reminders
													? "var(--ag-indigo)"
													: "var(--ag-text-muted)",
												fontFamily: "JetBrains Mono, monospace",
											}}
										>
<<<<<<< HEAD
											{DL[d.getDay()]}
=======
											{DAY_LABELS[d.getDay()]}
>>>>>>> origin/ui/wave1-reminders
										</span>
										<span
											className="text-lg font-bold block mt-0.5"
											style={{
												fontFamily: "Syne, sans-serif",
<<<<<<< HEAD
												color: iDT
=======
												color: isDateToday
>>>>>>> origin/ui/wave1-reminders
													? "var(--ag-indigo)"
													: "var(--ag-text-primary)",
											}}
										>
											{d.getDate()}
										</span>
									</button>
								);
							})}
						</div>
<<<<<<< HEAD
=======

						{/* Hour rows */}
>>>>>>> origin/ui/wave1-reminders
						<div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
							{HOURS.filter((_, i) => i % 2 === 0).map((hour) => (
								<div
									key={hour}
									className="grid"
									style={{
										gridTemplateColumns: "60px repeat(7, 1fr)",
										borderBottom: "1px solid rgba(255,255,255,0.03)",
									}}
								>
									<div
										className="p-1.5 text-right text-[10px] font-mono"
										style={{
											color: "var(--ag-text-muted)",
											borderRight: "1px solid var(--ag-border-subtle)",
										}}
									>
										{formatHour(hour)}
									</div>
									{weekDates.map((d) => {
										const dk = dateKey(d);
<<<<<<< HEAD
										const db = (blocks[dk] || []).filter(
=======
										const dayBlocks = (blocks[dk] || []).filter(
>>>>>>> origin/ui/wave1-reminders
											(b) =>
												Math.floor(b.startHour) === hour ||
												Math.floor(b.startHour) === hour + 1,
										);
<<<<<<< HEAD
										const iDT = isSameDay(d, today);
										const iC =
											iDT &&
											Math.floor(currentHourFraction) >= hour &&
											Math.floor(currentHourFraction) < hour + 2;
=======
										const isDateToday = isSameDay(d, today);
										const isCurrent =
											isDateToday &&
											Math.floor(currentHourFraction) >= hour &&
											Math.floor(currentHourFraction) < hour + 2;

>>>>>>> origin/ui/wave1-reminders
										return (
											<div
												key={dk}
												className="p-0.5 min-h-[48px] transition-colors"
												style={{
													borderRight: "1px solid rgba(255,255,255,0.03)",
<<<<<<< HEAD
													background: iC
														? "rgba(99,102,241,0.04)"
														: iDT
=======
													background: isCurrent
														? "rgba(99,102,241,0.04)"
														: isDateToday
>>>>>>> origin/ui/wave1-reminders
															? "rgba(255,255,255,0.008)"
															: undefined,
												}}
												onDragOver={(e) => {
													e.preventDefault();
													e.dataTransfer.dropEffect = "move";
												}}
												onDrop={(e) => onWeekDrop(e, hour, d)}
											>
<<<<<<< HEAD
												{db.map((block) => (
=======
												{dayBlocks.map((block) => (
>>>>>>> origin/ui/wave1-reminders
													<button
														key={block.id}
														type="button"
														onClick={() => onSelectDate(d)}
														className="w-full rounded px-1 py-0.5 mb-0.5 text-[10px] truncate text-left transition-opacity hover:opacity-75"
														style={{
															background: `${block.color}0D`,
															borderLeft: `2px solid ${block.color}`,
															color: block.color,
														}}
														title={`${block.title} (${formatHour(block.startHour)})`}
													>
														{block.title}
													</button>
												))}
											</div>
										);
									})}
								</div>
							))}
						</div>
					</div>
				</div>
			</GlassCard>
		</BlurFade>
	);
}
