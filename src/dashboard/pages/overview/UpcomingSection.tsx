/**
 * UpcomingSection — unified reminders, habits, and calendar preview.
 *
 * Landing-page aesthetic:
 * - Mono uppercase eyebrow per card group
 * - Glass cards with dividers border-white/[0.06]
 * - Status dot accents
 * - Accent-coloured time labels / delta indicators
 * - Progress bar for habits (green gradient, matches landing trust strip)
 */

import type { LucideIcon } from "lucide-react";
import {
	ArrowRight,
	Bell,
	CalendarDays,
	Check,
	CheckCircle2,
	Loader2,
	Target,
} from "lucide-react";
import { MobileSection } from "@/components/mobile";
import { cn } from "@/lib/utils";
import type { OverviewData } from "./helpers";

interface UpcomingSectionProps {
	overviewData: OverviewData | null;
	overviewLoading: boolean;
	completingReminder: string | null;
	onCompleteReminder: (id: string) => void;
	onNavigate?: (page: string) => void;
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function CardSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse">
			{/* header */}
			<div className="flex items-center justify-between px-4 pt-3 pb-2.5">
				<div className="h-2.5 w-24 rounded bg-white/[0.04]" />
				<div className="h-2.5 w-10 rounded bg-white/[0.04]" />
			</div>
			<div className="divide-y divide-white/[0.06]">
				{Array.from({ length: rows }).map((_, i) => (
					<div
						key={`sk-row-${i}`}
						className="px-4 py-3 flex items-center gap-3"
					>
						<div className="w-8 h-8 rounded-xl bg-white/[0.04] shrink-0" />
						<div className="flex-1 space-y-1.5">
							<div className="h-3.5 w-2/3 rounded bg-white/[0.04]" />
							<div className="h-2.5 w-1/3 rounded bg-white/[0.03]" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Card header row helper
// ---------------------------------------------------------------------------

function CardHeader({
	icon: Icon,
	color,
	label,
	ctaLabel,
	onCta,
}: {
	icon: LucideIcon;
	color: string;
	label: string;
	ctaLabel: string;
	onCta: () => void;
}) {
	return (
		<div className="flex items-center justify-between px-4 pt-3 pb-2.5">
			<div className="flex items-center gap-2">
				<Icon className="w-3 h-3 shrink-0" style={{ color }} aria-hidden />
				<span
					className="font-mono text-[10px] uppercase tracking-[0.15em]"
					style={{ color: "#94A3B8", opacity: 0.6 }}
				>
					{label}
				</span>
			</div>
			<button
				type="button"
				onClick={onCta}
				className="flex items-center gap-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors min-h-[44px] px-1"
			>
				{ctaLabel}
				<ArrowRight className="w-2.5 h-2.5" aria-hidden />
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// UpcomingSection
// ---------------------------------------------------------------------------

export function UpcomingSection({
	overviewData,
	overviewLoading,
	completingReminder,
	onCompleteReminder,
	onNavigate,
}: UpcomingSectionProps) {
	const reminders = overviewData?.remindersDueToday ?? [];
	const habits = overviewData?.habitsToday ?? [];
	const calEvents = overviewData?.calendarEventsToday ?? [];

	const habitsDone = habits.filter((h) => h.loggedToday).length;
	const habitsTotal = habits.length;
	const habitsPct =
		habitsTotal > 0 ? Math.round((habitsDone / habitsTotal) * 100) : 0;
	// eslint-disable-next-line react-hooks/purity
	const now = Date.now();

	const hasContent =
		reminders.length > 0 || habits.length > 0 || calEvents.length > 0;

	// Loading state
	if (overviewLoading) {
		return (
			<MobileSection noPadding className="pt-5">
				<p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]/60 px-4 mb-3">
					Upcoming
				</p>
				<div className="flex flex-col gap-3 px-4">
					<CardSkeleton rows={3} />
					<CardSkeleton rows={2} />
				</div>
			</MobileSection>
		);
	}

	if (!hasContent) return null;

	return (
		<MobileSection noPadding className="pt-5">
			{/* Mono eyebrow */}
			<p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]/60 px-4 mb-3">
				Upcoming
			</p>

			<div className="flex flex-col gap-3 px-4">
				{/* ── Reminders ─────────────────────────────────────────────────── */}
				{reminders.length > 0 && (
					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden shadow-[0_0_40px_rgba(139,92,246,0.08)]">
						<CardHeader
							icon={Bell}
							color="var(--ag-cyan)"
							label="Reminders Today"
							ctaLabel="All"
							onCta={() => onNavigate?.("reminders")}
						/>
						<div className="divide-y divide-white/[0.06]">
							{reminders.slice(0, 4).map((rem) => (
								<div
									key={rem.id}
									className={cn(
										"px-4 py-3 flex items-center gap-3 min-h-[52px]",
										rem.overdue && "bg-[#FF2D78]/[0.03]",
									)}
								>
									{/* Icon dot */}
									<div
										className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
										style={{
											background: rem.overdue
												? "rgba(255,45,120,0.1)"
												: "rgba(167,139,250,0.1)",
										}}
										aria-hidden
									>
										<Bell
											className="w-3.5 h-3.5"
											style={{
												color: rem.overdue
													? "var(--ag-pink)"
													: "var(--ag-cyan)",
											}}
											aria-hidden
										/>
									</div>

									<div className="flex-1 min-w-0">
										<p className="text-sm text-[var(--ag-text-primary)] truncate leading-snug">
											{rem.text}
										</p>
										<span
											className="text-[11px] font-mono"
											style={{
												color: rem.overdue ? "var(--ag-pink)" : "#94A3B8",
												opacity: rem.overdue ? 1 : 0.6,
											}}
										>
											{new Date(rem.datetime).toLocaleTimeString([], {
												hour: "numeric",
												minute: "2-digit",
											})}
											{rem.overdue && (
												<span className="ml-1.5 uppercase tracking-wider text-[10px]">
													· Overdue
												</span>
											)}
										</span>
									</div>

									{/* Complete button */}
									<button
										type="button"
										onClick={() => onCompleteReminder(rem.id)}
										disabled={completingReminder === rem.id}
										aria-label={`Mark "${rem.text}" as complete`}
										className="flex items-center justify-center w-8 h-8 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#A78BFA]/30 transition-all min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40"
									>
										{completingReminder === rem.id ? (
											<Loader2
												className="w-3.5 h-3.5 text-[var(--ag-text-muted)] animate-spin"
												aria-hidden
											/>
										) : (
											<Check
												className="w-3.5 h-3.5 text-[var(--ag-cyan)]"
												aria-hidden
											/>
										)}
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* ── Habits ──────────────────────────────────────────────────── */}
				{habits.length > 0 && (
					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
						<CardHeader
							icon={Target}
							color="#10B981"
							label="Habits Today"
							ctaLabel="Manage"
							onCta={() => onNavigate?.("reminders")}
						/>

						{/* Progress bar */}
						<div className="px-4 pb-3">
							<div className="flex items-center justify-between mb-1.5">
								<span className="text-[11px] font-mono text-[#94A3B8]/50 uppercase tracking-wider">
									{habitsDone}/{habitsTotal} done
								</span>
								<span
									className="text-[11px] font-mono tabular-nums"
									style={{ color: "#10B981" }}
								>
									{habitsPct}%
								</span>
							</div>
							<div
								className="h-1 rounded-full bg-white/[0.04] overflow-hidden"
								role="progressbar"
								aria-valuenow={habitsPct}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={`${habitsPct}% of habits completed`}
							>
								<div
									className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#A78BFA] transition-all duration-500"
									style={{ width: `${habitsPct}%` }}
								/>
							</div>
						</div>

						<div className="divide-y divide-white/[0.06]">
							{habits.slice(0, 4).map((habit) => (
								<div
									key={habit.id}
									className="px-4 py-3 flex items-center gap-3 min-h-[52px]"
								>
									<div
										className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
										style={{
											background: habit.loggedToday
												? "rgba(16,185,129,0.1)"
												: "rgba(139,92,246,0.08)",
										}}
										aria-hidden
									>
										{habit.loggedToday ? (
											<CheckCircle2
												className="w-3.5 h-3.5 text-[#10B981]"
												aria-hidden
											/>
										) : (
											<Target
												className="w-3.5 h-3.5 text-white/20"
												aria-hidden
											/>
										)}
									</div>

									<div className="flex-1 min-w-0">
										<p
											className="text-sm truncate leading-snug"
											style={{
												color: habit.loggedToday
													? "var(--ag-text-muted)"
													: "var(--ag-text-primary)",
												textDecoration: habit.loggedToday
													? "line-through"
													: "none",
												opacity: habit.loggedToday ? 0.6 : 1,
											}}
										>
											{habit.name}
										</p>
										{habit.streak > 0 && (
											<span className="text-[11px] font-mono text-[#F59E0B]/70">
												🔥 {habit.streak}d streak
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* ── Calendar Events ────────────────────────────────────────── */}
				{calEvents.length > 0 && (
					<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
						<CardHeader
							icon={CalendarDays}
							color="var(--ag-violet)"
							label="Calendar Today"
							ctaLabel="Open"
							onCta={() => onNavigate?.("calendar")}
						/>
						<div className="divide-y divide-white/[0.06]">
							{calEvents.slice(0, 4).map((evt) => {
								const startDate = new Date(evt.start_time);
								const isCurrent =
									evt.start_time <= now &&
									(evt.end_time ? evt.end_time >= now : true);
								return (
									<div
										key={evt.id}
										className={cn(
											"px-4 py-3 flex items-center gap-3 min-h-[52px]",
											isCurrent &&
												"bg-[#A78BFA]/[0.04] border-l-2 border-l-[var(--ag-cyan)]",
										)}
									>
										<div
											className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
											style={{
												background: isCurrent
													? "rgba(167,139,250,0.12)"
													: "rgba(139,92,246,0.08)",
											}}
											aria-hidden
										>
											<CalendarDays
												className="w-3.5 h-3.5"
												style={{
													color: isCurrent
														? "var(--ag-cyan)"
														: "var(--ag-violet)",
												}}
												aria-hidden
											/>
										</div>

										<div className="flex-1 min-w-0">
											<p className="text-sm text-[var(--ag-text-primary)] truncate leading-snug">
												{evt.title}
											</p>
											<span className="text-[11px] font-mono text-[#94A3B8]/50">
												{startDate.toLocaleTimeString([], {
													hour: "numeric",
													minute: "2-digit",
												})}
												{isCurrent && (
													<span
														className="ml-2 uppercase tracking-wider text-[10px] font-semibold"
														style={{ color: "var(--ag-cyan)" }}
													>
														Now
													</span>
												)}
											</span>
										</div>

										{/* Status dot — matches landing pattern */}
										<span
											className="w-2 h-2 rounded-full shrink-0"
											style={{
												background: isCurrent
													? "var(--ag-cyan)"
													: "var(--ag-violet)",
												opacity: isCurrent ? 1 : 0.4,
												boxShadow: isCurrent
													? "0 0 6px var(--ag-cyan)"
													: "none",
											}}
											aria-hidden
										/>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</MobileSection>
	);
}
