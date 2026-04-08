import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { BlurFade } from "@/components/magicui/blur-fade";
import { GlassCard } from "@/components/ui/agentin";
import { Button } from "@/components/ui/button";
import type { TimeBlock } from "../helpers";
import { dateKey, formatHour, HOURS, isSameDay } from "../helpers";

const DL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WeekOverviewProps {
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
	return (
		<BlurFade delay={0.2}>
			<GlassCard accent="indigo" className="overflow-hidden">
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
							{" \u2013 "}
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
				<div className="overflow-x-auto">
					<div style={{ minWidth: 700 }}>
						<div
							className="grid"
							style={{
								gridTemplateColumns: "60px repeat(7, 1fr)",
								borderBottom: "1px solid var(--ag-border-subtle)",
							}}
						>
							<div className="p-2" />
							{weekDates.map((d) => {
								const iDT = isSameDay(d, today);
								return (
									<button
										key={dateKey(d)}
										type="button"
										onClick={() => onSelectDate(d)}
										className="p-2 text-center transition-colors min-h-[44px]"
										style={{
											background: iDT ? "rgba(99,102,241,0.05)" : undefined,
										}}
									>
										<span
											className="text-[10px] uppercase tracking-wider block"
											style={{
												color: iDT
													? "var(--ag-indigo)"
													: "var(--ag-text-muted)",
												fontFamily: "JetBrains Mono, monospace",
											}}
										>
											{DL[d.getDay()]}
										</span>
										<span
											className="text-lg font-bold block mt-0.5"
											style={{
												fontFamily: "Syne, sans-serif",
												color: iDT
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
										const db = (blocks[dk] || []).filter(
											(b) =>
												Math.floor(b.startHour) === hour ||
												Math.floor(b.startHour) === hour + 1,
										);
										const iDT = isSameDay(d, today);
										const iC =
											iDT &&
											Math.floor(currentHourFraction) >= hour &&
											Math.floor(currentHourFraction) < hour + 2;
										return (
											<div
												key={dk}
												className="p-0.5 min-h-[48px] transition-colors"
												style={{
													borderRight: "1px solid rgba(255,255,255,0.03)",
													background: iC
														? "rgba(99,102,241,0.04)"
														: iDT
															? "rgba(255,255,255,0.008)"
															: undefined,
												}}
												onDragOver={(e) => {
													e.preventDefault();
													e.dataTransfer.dropEffect = "move";
												}}
												onDrop={(e) => onWeekDrop(e, hour, d)}
											>
												{db.map((block) => (
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
