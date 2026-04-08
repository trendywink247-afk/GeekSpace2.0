/**
 * PageHeader — sticky hero header for dashboard pages.
 * Mono eyebrow + Syne display title + description + optional actions.
 * Uses Aurora tokens only.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
	/** Small mono label shown above title */
	eyebrow?: string;
	/** Main page title */
	title: string;
	/** Optional supporting description */
	description?: string;
	/** Slot for action buttons on the right */
	actions?: ReactNode;
	/** Optional leading icon */
	icon?: LucideIcon;
	className?: string;
}

export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	icon: Icon,
	className,
}: PageHeaderProps) {
	return (
		<div
			className={cn(
				"sticky top-0 z-20 w-full",
				"bg-[var(--ag-bg-chrome)] backdrop-blur-xl",
				"border-b border-[var(--ag-border-subtle)]",
				className,
			)}
		>
			<div className="flex items-start gap-4 px-4 py-4 sm:px-6 sm:py-5">
				{/* Leading icon */}
				{Icon && (
					<div
						className="mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
						style={{
							background: "var(--ag-active-bg)",
							border: "1px solid var(--ag-border-default)",
						}}
					>
						<Icon className="w-5 h-5" style={{ color: "var(--ag-violet)" }} />
					</div>
				)}

				{/* Text block */}
				<div className="flex-1 min-w-0">
					{eyebrow && (
						<p
							className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1"
							style={{ color: "var(--ag-text-muted)" }}
						>
							{eyebrow}
						</p>
					)}
					<h1
						className="text-xl font-bold leading-tight truncate"
						style={{
							fontFamily: "Syne, sans-serif",
							color: "var(--ag-text-primary)",
						}}
					>
						{title}
					</h1>
					{description && (
						<p
							className="text-xs mt-0.5 leading-relaxed line-clamp-2"
							style={{ color: "var(--ag-text-secondary)" }}
						>
							{description}
						</p>
					)}
				</div>

				{/* Actions */}
				{actions && (
					<div className="flex items-center gap-2 flex-shrink-0 self-center">
						{actions}
					</div>
				)}
			</div>
		</div>
	);
}
