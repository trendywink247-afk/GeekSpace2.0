// ============================================================
// SessionHistory — weekly bar chart + recent sessions list
// Uses GlassCard + Aurora tokens, mono eyebrows, Syne headings
// ============================================================

import { motion, type TargetAndTransition } from "framer-motion";
import { Calendar, TrendingUp } from "lucide-react";
import { Chip, GlassCard, SectionHeader } from "@/components/ui/agentin";
import {
	type FocusSession,
	formatDuration,
	formatRelativeDate,
	getDayLabel,
} from "../helpers";

// ── Weekly bar chart ─────────────────────────────────────────

function WeeklyFocusChart({ sessions }: { sessions: FocusSession[] }) {
	const now = new Date();
	const dayOfWeek = now.getDay();
	const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	const monday = new Date(now);
	monday.setDate(now.getDate() - mondayOffset);
	monday.setHours(0, 0, 0, 0);

	const dailyMinutes: number[] = Array(7).fill(0);
	for (const s of sessions) {
		if (!s.ended_at || !s.duration_min) continue;
		const sessionDate = new Date(s.started_at);
		const diffDays = Math.floor(
			(sessionDate.getTime() - monday.getTime()) / 86400000,
		);
		if (diffDays >= 0 && diffDays < 7) {
			dailyMinutes[diffDays] += s.duration_min;
		}
	}

	const maxMin = Math.max(...dailyMinutes, 30);
	const barWidth = 28;
	const chartHeight = 100;
	const chartWidth = barWidth * 7 + 6 * 8;
	const gap = 8;
	const todayIndex = mondayOffset;

	return (
		<div className="w-full overflow-x-auto">
			<svg
				viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
				className="w-full max-w-[320px] mx-auto"
				preserveAspectRatio="xMidYMid meet"
			>
				<defs>
					<linearGradient id="bar-grad-hist" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" stopColor="var(--ag-violet-soft)" />
						<stop offset="100%" stopColor="var(--ag-violet)" />
					</linearGradient>
				</defs>
				{dailyMinutes.map((mins, i) => {
					const barH = maxMin > 0 ? (mins / maxMin) * chartHeight : 0;
					const x = i * (barWidth + gap);
					const y = chartHeight - barH;
					const isToday = i === todayIndex;
					const hasData = mins > 0;
					return (
						<g key={i}>
							<rect
								x={x}
								y={0}
								width={barWidth}
								height={chartHeight}
								rx={6}
								fill="rgba(139,92,246,0.04)"
							/>
							{hasData && (
								<rect
									x={x}
									y={y}
									width={barWidth}
									height={Math.max(barH, 4)}
									rx={6}
									fill={isToday ? "url(#bar-grad-hist)" : "var(--ag-violet)"}
									opacity={isToday ? 1 : 0.4}
									style={{
										transition: "height 0.4s ease-out, y 0.4s ease-out",
									}}
								/>
							)}
							{hasData && (
								<text
									x={x + barWidth / 2}
									y={y - 4}
									textAnchor="middle"
									fill="var(--ag-text-muted)"
									fontSize="9"
									fontFamily="monospace"
								>
									{mins}m
								</text>
							)}
							<text
								x={x + barWidth / 2}
								y={chartHeight + 16}
								textAnchor="middle"
								fill={
									isToday ? "var(--ag-violet-soft)" : "var(--ag-text-muted)"
								}
								fontSize="10"
								fontWeight={isToday ? "bold" : "normal"}
								fontFamily="inherit"
							>
								{getDayLabel(i)}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}

// ── Single history row ────────────────────────────────────────

const SHADOW_BASE =
	"0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.28)";
const SHADOW_HOVER =
	"0 0 0 1px rgba(139,92,246,0.18), 0 6px 20px rgba(0,0,0,0.38)";

function SessionRow({ session }: { session: FocusSession }) {
	const isCompleted =
		session.completed === 1 ||
		session.completed === (true as unknown as number);
	return (
		<motion.div
			className="flex items-center justify-between py-2.5 px-3 rounded-xl backdrop-blur-xl"
			style={{
				background: "var(--ag-bg-surface)",
				boxShadow: SHADOW_BASE,
				transition: "box-shadow var(--ag-transition-fast)",
			}}
			whileHover={{ boxShadow: SHADOW_HOVER } as TargetAndTransition}
		>
			<div className="flex items-center gap-3 min-w-0">
				<div
					className="w-2 h-2 rounded-full flex-shrink-0"
					style={{
						background: isCompleted ? "var(--ag-emerald)" : "var(--ag-coral)",
					}}
				/>
				<div className="min-w-0">
					<p
						className="text-sm truncate"
						style={{ color: "var(--ag-text-primary)" }}
					>
						{session.goal ?? "Focus session"}
					</p>
					<p
						className="text-xs"
						style={{
							color: "var(--ag-text-muted)",
							fontVariantNumeric: "tabular-nums",
						}}
					>
						{formatRelativeDate(session.started_at)}
					</p>
				</div>
			</div>
			<Chip
				accent={isCompleted ? "emerald" : "coral"}
				className="flex-shrink-0 ml-2"
			>
				{session.duration_min ? formatDuration(session.duration_min) : "--"}
			</Chip>
		</motion.div>
	);
}

// ── SessionHistory ────────────────────────────────────────────

export interface SessionHistoryProps {
	history: FocusSession[];
	completedHistory: FocusSession[];
}

export function SessionHistory({
	history,
	completedHistory,
}: SessionHistoryProps) {
	if (completedHistory.length === 0) return null;

	return (
		<div className="space-y-4">
			{/* Weekly chart */}
			<GlassCard className="p-5">
				<SectionHeader
					label="This week"
					action={
						<TrendingUp size={13} style={{ color: "var(--ag-violet-soft)" }} />
					}
					className="mb-3"
				/>
				<WeeklyFocusChart sessions={history} />
			</GlassCard>

			{/* Recent sessions */}
			<div className="space-y-2">
				<SectionHeader
					label="Recent sessions"
					action={
						<Calendar size={13} style={{ color: "var(--ag-text-muted)" }} />
					}
				/>
				<div className="space-y-1.5">
					{completedHistory.slice(0, 6).map((s, idx) => (
						<motion.div
							key={s.id}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{
								delay: idx * 0.05,
								type: "spring",
								duration: 0.35,
								bounce: 0,
							}}
						>
							<SessionRow session={s} />
						</motion.div>
					))}
				</div>
			</div>
		</div>
	);
}
