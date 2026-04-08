/**
 * SectionHeader — lightweight section divider with mono label + optional action.
 * Used for grouping content within a page.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
	label: string;
	action?: ReactNode;
	tone?: "default" | "muted";
	className?: string;
}

export function SectionHeader({
	label,
	action,
	tone = "default",
	className,
}: SectionHeaderProps) {
	return (
		<div
			className={cn("flex items-center justify-between gap-3 py-2", className)}
		>
			<span
				className="text-[10px] font-mono uppercase tracking-[0.18em]"
				style={{
					color:
						tone === "muted"
							? "var(--ag-text-muted)"
							: "var(--ag-text-secondary)",
				}}
			>
				{label}
			</span>
			{action && <div className="flex items-center">{action}</div>}
		</div>
	);
}
