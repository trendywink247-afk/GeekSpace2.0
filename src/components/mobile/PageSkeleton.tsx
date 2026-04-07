/**
 * PageSkeleton — page-level skeleton loader.
 * Shows pulsing placeholder blocks while page content loads.
 */

import { cn } from "@/lib/utils";

interface PageSkeletonProps {
	/** Number of card-shaped skeleton blocks */
	cards?: number;
	/** Show a header skeleton at the top */
	showHeader?: boolean;
	className?: string;
}

function SkeletonBlock({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"rounded-xl bg-[var(--ag-bg-surface)] animate-pulse",
				className,
			)}
		/>
	);
}

export function PageSkeleton({
	cards = 3,
	showHeader = true,
	className,
}: PageSkeletonProps) {
	return (
		<div className={cn("flex flex-col gap-4 px-4 pt-4", className)}>
			{/* Page header skeleton */}
			{showHeader && (
				<div className="flex flex-col gap-2 mb-2">
					<SkeletonBlock className="h-6 w-48" />
					<SkeletonBlock className="h-4 w-32" />
				</div>
			)}

			{/* Card skeletons — index keys are safe here; list is static */}
			{Array.from({ length: cards }).map((_, i) => (
				<div
					key={`skeleton-card-${i}`}
					className={cn(
						"rounded-2xl border border-[var(--ag-border-subtle)]",
						"bg-[var(--ag-bg-surface)] p-4 space-y-3",
					)}
					style={{ animationDelay: `${i * 100}ms` }}
				>
					{/* Card header line */}
					<div className="flex items-center gap-3">
						<SkeletonBlock className="w-9 h-9 rounded-xl shrink-0" />
						<div className="flex-1 space-y-1.5">
							<SkeletonBlock className="h-4 w-2/3 animate-pulse" />
							<SkeletonBlock className="h-3 w-1/2 animate-pulse opacity-70" />
						</div>
					</div>
					{/* Card body lines */}
					<SkeletonBlock className="h-3 w-full animate-pulse opacity-60" />
					<SkeletonBlock className="h-3 w-4/5 animate-pulse opacity-50" />
				</div>
			))}
		</div>
	);
}
