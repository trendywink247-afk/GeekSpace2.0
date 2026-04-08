// ============================================================
// FocusTimer — big circular SVG ring timer with Aurora glow
// Aurora: violet = active, indigo = paused, emerald = completed
// ============================================================

import { motion } from "framer-motion";
import { Pause, Target } from "lucide-react";
import { GlassCard } from "@/components/ui/agentin";
import type { FocusSession } from "../helpers";

// ── Timer ring with gradient + glow ──────────────────────────

interface TimerRingProps {
	progress: number;
	size?: number;
	strokeWidth?: number;
	children: React.ReactNode;
	accent?: "violet" | "indigo" | "emerald" | "amber";
}

const RING_GRADIENTS: Record<string, [string, string]> = {
	violet: ["var(--ag-violet)", "var(--ag-indigo)"],
	indigo: ["var(--ag-indigo)", "var(--ag-violet-soft)"],
	emerald: ["var(--ag-emerald)", "var(--ag-chartreuse)"],
	amber: ["var(--ag-amber)", "var(--ag-coral)"],
};

const RING_GLOWS: Record<string, string> = {
	violet: "rgba(139,92,246,0.22)",
	indigo: "rgba(99,102,241,0.22)",
	emerald: "rgba(16,185,129,0.22)",
	amber: "rgba(245,158,11,0.22)",
};

export function TimerRing({
	progress,
	size = 240,
	strokeWidth = 11,
	children,
	accent = "violet",
}: TimerRingProps) {
	const r = (size - strokeWidth * 2) / 2;
	const circ = 2 * Math.PI * r;
	const center = size / 2;
	const gradId = `timer-grad-${accent}-${size}`;
	const [startColor, endColor] = RING_GRADIENTS[accent];
	const glowColor = RING_GLOWS[accent];

	return (
		<div
			className="relative flex items-center justify-center mx-auto"
			style={{ width: size, height: size }}
		>
			<svg
				className="absolute inset-0"
				style={{ transform: "rotate(-90deg)" }}
				viewBox={`0 0 ${size} ${size}`}
			>
				<defs>
					<linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor={startColor} />
						<stop offset="100%" stopColor={endColor} />
					</linearGradient>
				</defs>
				{/* Track */}
				<circle
					cx={center}
					cy={center}
					r={r}
					fill="none"
					stroke="rgba(139,92,246,0.06)"
					strokeWidth={strokeWidth}
				/>
				{/* Glow layer */}
				{progress > 0 && (
					<circle
						cx={center}
						cy={center}
						r={r}
						fill="none"
						stroke={glowColor}
						strokeWidth={strokeWidth + 8}
						strokeLinecap="round"
						strokeDasharray={circ}
						strokeDashoffset={circ * (1 - progress / 100)}
						opacity={0.35}
						style={{
							filter: "blur(8px)",
							transition: "stroke-dashoffset 1s linear",
						}}
					/>
				)}
				{/* Progress arc */}
				<circle
					cx={center}
					cy={center}
					r={r}
					fill="none"
					stroke={`url(#${gradId})`}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circ}
					strokeDashoffset={circ * (1 - progress / 100)}
					style={{ transition: "stroke-dashoffset 1s linear" }}
				/>
			</svg>
			<div className="relative z-10 text-center">{children}</div>
		</div>
	);
}

// ── Active session timer display ─────────────────────────────

export interface FocusTimerProps {
	session: FocusSession;
	progress: number;
	remaining: number | null;
	remainStr: string;
	elapsedStr: string;
	isLoading: boolean;
	onEnd: () => Promise<void>;
}

export function FocusTimer({
	session,
	progress,
	remaining,
	remainStr,
	elapsedStr,
	isLoading,
	onEnd,
}: FocusTimerProps) {
	const isNearEnd = remaining !== null && remaining < 60 && progress > 5;

	return (
		<GlassCard accent="violet" className="p-6">
			<div className="space-y-5">
				{/* Big ring timer */}
				<TimerRing
					progress={progress}
					size={240}
					strokeWidth={11}
					accent={isNearEnd ? "amber" : "violet"}
				>
					<div>
						<motion.div
							className="text-4xl font-mono font-bold tracking-wider"
							style={{
								color: "var(--ag-text-primary)",
								fontVariantNumeric: "tabular-nums",
							}}
							animate={{ opacity: [1, 0.7, 1] }}
							transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
						>
							{remaining !== null ? remainStr : elapsedStr}
						</motion.div>
						<div
							className="text-xs mt-1.5 font-mono uppercase tracking-widest"
							style={{ color: "var(--ag-text-muted)" }}
						>
							{remaining !== null ? "remaining" : "elapsed"}
						</div>
					</div>
				</TimerRing>

				{/* Session info */}
				{session.goal && (
					<p
						className="text-center text-sm flex items-center justify-center gap-1.5"
						style={{ color: "var(--ag-text-secondary)" }}
					>
						<Target size={13} style={{ color: "var(--ag-violet-soft)" }} />
						<span className="truncate max-w-[18rem]">{session.goal}</span>
					</p>
				)}
				<div
					className="text-center text-xs font-mono"
					style={{ color: "var(--ag-text-muted)" }}
				>
					{session.duration_min
						? `${session.duration_min} min session`
						: "Open session"}
				</div>

				{/* End button */}
				<motion.button
					onClick={() => void onEnd()}
					disabled={isLoading}
					whileTap={{ scale: 0.96 }}
					className="w-full h-14 px-8 rounded-xl text-white font-semibold
            flex items-center justify-center gap-2
            focus-visible:ring-2 focus-visible:outline-none
            disabled:opacity-50 transition-all"
					style={{
						background:
							"linear-gradient(135deg, rgba(225,29,72,0.85), rgba(190,18,60,0.75))",
						boxShadow:
							"0 0 0 1px rgba(225,29,72,0.2), 0 4px 12px rgba(225,29,72,0.18)",
					}}
				>
					<Pause size={18} />
					End Session
				</motion.button>
			</div>
		</GlassCard>
	);
}
