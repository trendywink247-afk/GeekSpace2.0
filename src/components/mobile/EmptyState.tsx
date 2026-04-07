/**
 * EmptyState — icon + title + description + optional CTA.
 * Shown when a list or page section has no content.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	/** CTA button label */
	ctaLabel?: string;
	/** CTA click handler */
	onCta?: () => void;
	className?: string;
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	ctaLabel,
	onCta,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
				className,
			)}
		>
			{/* Icon container */}
			<div
				className={cn(
					"w-14 h-14 rounded-2xl flex items-center justify-center",
					"bg-[var(--ag-active-bg)]",
					"border border-[var(--ag-border-subtle)]",
				)}
			>
				<Icon className="w-6 h-6 text-[var(--ag-text-muted)]" />
			</div>

			{/* Text */}
			<div className="max-w-[240px]">
				<p
					className="text-sm font-semibold text-[var(--ag-text-primary)]"
					style={{ fontFamily: "Syne, sans-serif" }}
				>
					{title}
				</p>
				{description && (
					<p className="text-xs text-[var(--ag-text-muted)] mt-1 leading-relaxed">
						{description}
					</p>
				)}
			</div>

			{/* CTA */}
			{ctaLabel && onCta && (
				<button
					type="button"
					onClick={onCta}
					className={cn(
						"px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
						"bg-[var(--ag-violet)] text-white",
						"hover:opacity-90 active:scale-95",
						"min-h-[44px]",
					)}
				>
					{ctaLabel}
				</button>
			)}
		</div>
	);
}
