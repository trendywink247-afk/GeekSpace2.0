/**
 * SettingsRow — single row matching landing page glass aesthetic.
 *
 * Layout: icon? | label + description | control + chevron?
 * Separator is handled by SettingsGroup's divide-y — no per-row border needed.
 */

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsRowProps {
	/** Primary label */
	label: string;
	/** Optional description below label */
	description?: string;
	/** Optional icon on the left */
	icon?: LucideIcon;
	/** Icon background tint (CSS color or var). Defaults to white/[0.05] */
	iconTint?: string;
	/** Right-side control slot: toggle, select, value text, etc. */
	control?: React.ReactNode;
	/** Makes the row tappable and shows a ChevronRight */
	onPress?: () => void;
	/** Extra classes on the wrapper */
	className?: string;
	/** data-testid forwarded to the root element */
	testId?: string;
	/** Red/pink destructive styling on the label */
	destructive?: boolean;
	/** Disabled state */
	disabled?: boolean;
}

export function SettingsRow({
	label,
	description,
	icon: Icon,
	iconTint,
	control,
	onPress,
	className,
	testId,
	destructive = false,
	disabled = false,
}: SettingsRowProps) {
	const inner = (
		<>
			{/* Left: icon + text */}
			<div className="flex items-center gap-3 flex-1 min-w-0">
				{Icon && (
					<span
						className="flex items-center justify-center w-8 h-8 rounded-[10px] shrink-0"
						style={{
							background: iconTint ?? "rgba(255,255,255,0.05)",
							border: "1px solid rgba(255,255,255,0.06)",
						}}
					>
						<Icon
							className="w-[15px] h-[15px]"
							style={{
								color: destructive ? "#FF2D78" : "var(--ag-text-accent)",
							}}
						/>
					</span>
				)}
				<div className="min-w-0 flex-1">
					<span
						className={cn(
							"text-sm font-medium leading-tight block truncate",
							destructive ? "text-[#FF2D78]" : "text-[#F1F5F9]",
							disabled && "opacity-40",
						)}
					>
						{label}
					</span>
					{description && (
						<span className="text-xs text-[#6B7280] mt-0.5 block leading-snug">
							{description}
						</span>
					)}
				</div>
			</div>

			{/* Right: control slot + optional chevron */}
			<div className="flex items-center gap-2 shrink-0 ml-3">
				{control && <div className="flex items-center">{control}</div>}
				{onPress && (
					<ChevronRight className="w-4 h-4 text-[#6B7280] shrink-0" />
				)}
			</div>
		</>
	);

	const base = cn(
		"flex items-center px-4 py-3.5 min-h-[52px] w-full transition-colors duration-150",
		onPress && !disabled
			? "cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04]"
			: "cursor-default",
		disabled && "pointer-events-none",
		className,
	);

	if (onPress && !disabled) {
		return (
			<button
				type="button"
				onClick={onPress}
				className={base}
				data-testid={testId}
				style={{ WebkitTapHighlightColor: "transparent", textAlign: "left" }}
			>
				{inner}
			</button>
		);
	}

	return (
		<div className={base} data-testid={testId}>
			{inner}
		</div>
	);
}
