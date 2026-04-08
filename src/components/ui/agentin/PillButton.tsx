/**
 * PillButton — rounded-full button with optional icon + accent glow on hover.
 * For quick actions, filter pills, and toggleable selections.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AccentColor } from "./StatCard";

const ACCENT_BG_ACTIVE: Record<Exclude<AccentColor, "none">, string> = {
	violet: "rgba(139, 92, 246, 0.15)",
	indigo: "rgba(99, 102, 241, 0.15)",
	emerald: "rgba(16, 185, 129, 0.15)",
	amber: "rgba(245, 158, 11, 0.15)",
	coral: "rgba(251, 146, 60, 0.15)",
};

const ACCENT_COLOR: Record<Exclude<AccentColor, "none">, string> = {
	violet: "var(--ag-violet)",
	indigo: "var(--ag-indigo)",
	emerald: "var(--ag-emerald)",
	amber: "var(--ag-amber)",
	coral: "var(--ag-coral)",
};

const ACCENT_BORDER: Record<Exclude<AccentColor, "none">, string> = {
	violet: "rgba(139, 92, 246, 0.3)",
	indigo: "rgba(99, 102, 241, 0.3)",
	emerald: "rgba(16, 185, 129, 0.3)",
	amber: "rgba(245, 158, 11, 0.3)",
	coral: "rgba(251, 146, 60, 0.3)",
};

export interface PillButtonProps {
	icon?: LucideIcon;
	children?: ReactNode;
	onClick?: () => void;
	active?: boolean;
	disabled?: boolean;
	accent?: AccentColor;
	className?: string;
}

export function PillButton({
	icon: Icon,
	children,
	onClick,
	active = false,
	disabled = false,
	accent = "violet",
	className,
}: PillButtonProps) {
	const resolvedAccent = accent === "none" ? "violet" : accent;
	const accentColor = ACCENT_COLOR[resolvedAccent];
	const activeBg = ACCENT_BG_ACTIVE[resolvedAccent];
	const activeBorder = ACCENT_BORDER[resolvedAccent];

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
				"text-xs font-medium transition-all duration-150",
				"min-h-[32px] min-w-[32px] select-none",
				"focus-visible:outline-none",
				disabled
					? "opacity-40 cursor-not-allowed"
					: "cursor-pointer active:scale-95",
				className,
			)}
			style={{
				background: active ? activeBg : "var(--ag-active-bg)",
				border: `1px solid ${active ? activeBorder : "var(--ag-border-subtle)"}`,
				color: active ? accentColor : "var(--ag-text-secondary)",
				boxShadow: active ? `0 0 12px ${activeBg}` : "none",
			}}
		>
			{Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
			{children}
		</button>
	);
}
