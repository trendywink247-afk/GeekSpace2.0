/**
 * Chip — small inline label/tag with icon + text + optional close button.
 * Used for tags, filters, and selected-item labels.
 */

import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AccentColor } from "./StatCard";

const CHIP_ACCENT: Record<
	Exclude<AccentColor, "none">,
	{ bg: string; color: string; border: string }
> = {
	violet: {
		bg: "rgba(139, 92, 246, 0.1)",
		color: "var(--ag-violet-soft)",
		border: "rgba(139, 92, 246, 0.2)",
	},
	indigo: {
		bg: "rgba(99, 102, 241, 0.1)",
		color: "var(--ag-indigo)",
		border: "rgba(99, 102, 241, 0.2)",
	},
	emerald: {
		bg: "rgba(16, 185, 129, 0.1)",
		color: "var(--ag-emerald)",
		border: "rgba(16, 185, 129, 0.2)",
	},
	amber: {
		bg: "rgba(245, 158, 11, 0.1)",
		color: "var(--ag-amber)",
		border: "rgba(245, 158, 11, 0.2)",
	},
	coral: {
		bg: "rgba(251, 146, 60, 0.1)",
		color: "var(--ag-coral)",
		border: "rgba(251, 146, 60, 0.2)",
	},
};

export interface ChipProps {
	icon?: LucideIcon;
	children: ReactNode;
	onRemove?: () => void;
	accent?: AccentColor;
	className?: string;
}

export function Chip({
	icon: Icon,
	children,
	onRemove,
	accent = "violet",
	className,
}: ChipProps) {
	const resolved = accent === "none" ? "violet" : accent;
	const styles = CHIP_ACCENT[resolved];

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-2 py-1 rounded-full",
				"text-[11px] font-medium leading-none",
				className,
			)}
			style={{
				background: styles.bg,
				color: styles.color,
				border: `1px solid ${styles.border}`,
			}}
		>
			{Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
			{children}
			{onRemove && (
				<button
					type="button"
					onClick={onRemove}
					className="ml-0.5 rounded-full p-0.5 opacity-60 hover:opacity-100 transition-opacity min-h-[16px] min-w-[16px] flex items-center justify-center"
					aria-label="Remove"
				>
					<X className="w-2.5 h-2.5" />
				</button>
			)}
		</span>
	);
}
