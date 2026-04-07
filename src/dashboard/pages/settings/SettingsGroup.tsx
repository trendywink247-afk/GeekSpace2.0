/**
 * SettingsGroup — groups SettingsRows into a glass card with an optional eyebrow label.
 *
 * Visual language: landing page glass aesthetic
 * - Eyebrow: font-mono 11px uppercase tracking-[0.2em] text-[#8B5CF6]/70
 * - Card: border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm rounded-2xl
 * - Row dividers: divide-y divide-white/[0.06]
 */

import { cn } from "@/lib/utils";

interface SettingsGroupProps {
	/** Eyebrow section title above the card (rendered as mono uppercase) */
	title?: string;
	/** Optional description below the eyebrow */
	description?: string;
	children: React.ReactNode;
	className?: string;
	/** Skip the default horizontal padding (for full-width usage) */
	fullBleed?: boolean;
	/** data-testid on the card */
	testId?: string;
}

export function SettingsGroup({
	title,
	description,
	children,
	className,
	fullBleed = false,
	testId,
}: SettingsGroupProps) {
	return (
		<div className={cn("w-full mb-6", !fullBleed && "px-4", className)}>
			{/* Eyebrow header */}
			{title && (
				<div className="mb-2 px-1">
					<span className="font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-[#8B5CF6]/70 block">
						{title}
					</span>
					{description && (
						<p className="text-xs text-[#6B7280] mt-1 leading-snug">
							{description}
						</p>
					)}
				</div>
			)}

			{/* Glass card with divide-y separators */}
			<div
				data-testid={testId}
				className={cn(
					// Shape + glass
					"rounded-2xl overflow-hidden",
					"border border-white/[0.06]",
					"bg-white/[0.02]",
					"backdrop-blur-sm",
					// Hover lift
					"transition-colors duration-300",
					"hover:border-white/[0.08]",
					// Divide rows
					"divide-y divide-white/[0.06]",
				)}
			>
				{children}
			</div>
		</div>
	);
}
