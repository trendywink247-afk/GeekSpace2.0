/**
 * StatCard — displays a key metric with label, big value, optional delta, and icon.
 * Uses Aurora palette tokens only — no hardcoded hex.
 */

import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccentColor =
	| "violet"
	| "indigo"
	| "emerald"
	| "amber"
	| "coral"
	| "none";

const ACCENT_VARS: Record<Exclude<AccentColor, "none">, string> = {
	violet: "var(--ag-violet)",
	indigo: "var(--ag-indigo)",
	emerald: "var(--ag-emerald)",
	amber: "var(--ag-amber)",
	coral: "var(--ag-coral)",
};

const ACCENT_GLOW: Record<Exclude<AccentColor, "none">, string> = {
	violet: "var(--ag-glow-sm)",
	indigo: "0 0 20px rgba(99, 102, 241, 0.15)",
	emerald: "var(--ag-glow-success)",
	amber: "0 0 20px rgba(245, 158, 11, 0.15)",
	coral: "var(--ag-glow-warm)",
};

const ACCENT_BORDER: Record<Exclude<AccentColor, "none">, string> = {
	violet: "var(--ag-border-default)",
	indigo: "rgba(99, 102, 241, 0.2)",
	emerald: "var(--ag-border-success)",
	amber: "rgba(245, 158, 11, 0.2)",
	coral: "var(--ag-border-warm)",
};

export interface StatCardProps {
	label: string;
	value: string | number;
	delta?: number;
	deltaLabel?: string;
	icon?: LucideIcon;
	accent?: AccentColor;
	className?: string;
}

export function StatCard({
	label,
	value,
	delta,
	deltaLabel,
	icon: Icon,
	accent = "violet",
	className,
}: StatCardProps) {
	const accentColor =
		accent !== "none" ? ACCENT_VARS[accent] : "var(--ag-text-muted)";
	const glowStyle = accent !== "none" ? ACCENT_GLOW[accent] : "none";
	const borderColor =
		accent !== "none" ? ACCENT_BORDER[accent] : "var(--ag-border-subtle)";

	const isPositive = delta !== undefined && delta > 0;
	const isNegative = delta !== undefined && delta < 0;

	return (
		<div
			className={cn(
				"relative rounded-2xl p-5 flex flex-col gap-3",
				"bg-[var(--ag-bg-surface)] backdrop-blur-xl",
				"transition-all duration-300 hover:bg-[var(--ag-bg-surface-hover)]",
				className,
			)}
			style={{
				border: `1px solid ${borderColor}`,
				boxShadow: glowStyle,
			}}
		>
			{/* Top row: icon + label */}
			<div className="flex items-center justify-between gap-2">
				<span
					className="text-xs font-mono uppercase tracking-widest"
					style={{ color: "var(--ag-text-muted)" }}
				>
					{label}
				</span>
				{Icon && (
					<div
						className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
						style={{
							background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
						}}
					>
						<Icon className="w-4 h-4" style={{ color: accentColor }} />
					</div>
				)}
			</div>

			{/* Value */}
			<p
				className="text-3xl font-bold leading-none tracking-tight"
				style={{
					color: "var(--ag-text-primary)",
					fontFamily: "Syne, sans-serif",
				}}
			>
				{value}
			</p>

			{/* Delta */}
			{delta !== undefined && (
				<div className="flex items-center gap-1.5">
					{isPositive ? (
						<TrendingUp
							className="w-3.5 h-3.5"
							style={{ color: "var(--ag-emerald)" }}
						/>
					) : isNegative ? (
						<TrendingDown
							className="w-3.5 h-3.5"
							style={{ color: "var(--ag-rose)" }}
						/>
					) : null}
					<span
						className="text-xs font-medium"
						style={{
							color: isPositive
								? "var(--ag-emerald)"
								: isNegative
									? "var(--ag-rose)"
									: "var(--ag-text-muted)",
						}}
					>
						{isPositive ? "+" : ""}
						{delta}%
					</span>
					{deltaLabel && (
						<span className="text-xs" style={{ color: "var(--ag-text-muted)" }}>
							{deltaLabel}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
