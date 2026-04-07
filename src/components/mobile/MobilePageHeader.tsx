/**
 * MobilePageHeader — sticky top header with safe-area awareness.
 * Used for mobile page-level headers with optional back button, title, and right actions.
 */

import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobilePageHeaderProps {
	title: string;
	subtitle?: string;
	/** Callback for back navigation. If omitted, back arrow is hidden. */
	onBack?: () => void;
	/** Right-side slot — any action buttons / icons */
	actions?: React.ReactNode;
	className?: string;
}

export function MobilePageHeader({
	title,
	subtitle,
	onBack,
	actions,
	className,
}: MobilePageHeaderProps) {
	return (
		<header
			className={cn(
				// Sticky + safe area top
				"sticky top-0 z-30 w-full",
				// Glass chrome
				"bg-[var(--ag-bg-chrome)] backdrop-blur-xl",
				"border-b border-[var(--ag-border-subtle)]",
				// Safe area inset
				"pt-[env(safe-area-inset-top,0px)]",
				className,
			)}
		>
			<div className="flex items-center gap-3 px-4 h-14">
				{/* Back button */}
				{onBack && (
					<button
						onClick={onBack}
						className={cn(
							"flex items-center justify-center rounded-xl transition-colors",
							"min-w-[44px] min-h-[44px]",
							"text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]",
							"hover:bg-[var(--ag-active-bg)]",
							"active:scale-95",
						)}
						aria-label="Go back"
					>
						<ArrowLeft className="w-5 h-5" />
					</button>
				)}

				{/* Title block */}
				<div className="flex-1 min-w-0">
					<h1
						className="text-base font-semibold truncate text-[var(--ag-text-primary)]"
						style={{ fontFamily: "Syne, sans-serif" }}
					>
						{title}
					</h1>
					{subtitle && (
						<p className="text-xs text-[var(--ag-text-muted)] truncate mt-0.5">
							{subtitle}
						</p>
					)}
				</div>

				{/* Right actions */}
				{actions && (
					<div className="flex items-center gap-1 shrink-0">{actions}</div>
				)}
			</div>
		</header>
	);
}
