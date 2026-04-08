/**
 * GlassCard — generic glassmorphism container.
 * Background + backdrop-blur + optional hover + optional accent border glow.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AccentColor } from "./StatCard";

const ACCENT_BORDER_MAP: Record<Exclude<AccentColor, "none">, string> = {
	violet: "rgba(139, 92, 246, 0.2)",
	indigo: "rgba(99, 102, 241, 0.2)",
	emerald: "rgba(16, 185, 129, 0.2)",
	amber: "rgba(245, 158, 11, 0.2)",
	coral: "rgba(251, 146, 60, 0.25)",
};

const ACCENT_GLOW_MAP: Record<Exclude<AccentColor, "none">, string> = {
	violet: "var(--ag-glow-sm)",
	indigo: "0 0 20px rgba(99, 102, 241, 0.12)",
	emerald: "0 0 20px rgba(16, 185, 129, 0.12)",
	amber: "0 0 20px rgba(245, 158, 11, 0.12)",
	coral: "0 0 20px rgba(251, 146, 60, 0.15)",
};

export interface GlassCardProps {
	children: ReactNode;
	hover?: boolean;
	accent?: AccentColor;
	className?: string;
	onClick?: () => void;
}

export function GlassCard({
	children,
	hover = false,
	accent = "none",
	className,
	onClick,
}: GlassCardProps) {
	const borderColor =
		accent !== "none" ? ACCENT_BORDER_MAP[accent] : "var(--ag-border-subtle)";
	const glowStyle = accent !== "none" ? ACCENT_GLOW_MAP[accent] : "none";

	return (
		<div
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={onClick}
			onKeyDown={
				onClick
					? (e) => {
							if (e.key === "Enter" || e.key === " ") onClick();
						}
					: undefined
			}
			className={cn(
				"rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl",
				"transition-all duration-200",
				hover &&
					"hover:bg-[var(--ag-bg-surface-hover)] hover:scale-[1.01] cursor-pointer",
				onClick && "cursor-pointer select-none",
				className,
			)}
			style={{
				border: `1px solid ${borderColor}`,
				boxShadow: glowStyle,
			}}
		>
			{children}
		</div>
	);
}
