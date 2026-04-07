/**
 * MobileSection — section wrapper with consistent vertical rhythm.
 * Use for dividing page content into clearly separated sections.
 */

import { cn } from "@/lib/utils";

interface MobileSectionProps {
	/** Optional section heading */
	title?: string;
	/** Optional section description */
	description?: string;
	/** Right-side slot for section-level actions */
	action?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
	/** Remove default vertical padding */
	noPadding?: boolean;
}

export function MobileSection({
	title,
	description,
	action,
	children,
	className,
	noPadding = false,
}: MobileSectionProps) {
	return (
		<section className={cn("w-full", !noPadding && "py-4", className)}>
			{/* Section header */}
			{(title || action) && (
				<div className="flex items-start justify-between gap-2 px-4 mb-3">
					<div className="min-w-0">
						{title && (
							<h2
								className="text-sm font-semibold text-[var(--ag-text-primary)]"
								style={{ fontFamily: "Syne, sans-serif" }}
							>
								{title}
							</h2>
						)}
						{description && (
							<p className="text-xs text-[var(--ag-text-muted)] mt-0.5">
								{description}
							</p>
						)}
					</div>
					{action && <div className="shrink-0">{action}</div>}
				</div>
			)}

			{/* Content */}
			{children}
		</section>
	);
}
