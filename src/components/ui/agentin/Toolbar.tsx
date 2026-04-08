/**
 * Toolbar — horizontal row of pill buttons with optional divider + overflow slot.
 * Used for page-level action toolbars and contextual action bars.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PillButton } from "./PillButton";
import type { AccentColor } from "./StatCard";

export interface ToolbarAction {
	id: string;
	label: string;
	icon?: LucideIcon;
	accent?: AccentColor;
	active?: boolean;
	disabled?: boolean;
	onClick?: () => void;
}

export interface ToolbarProps {
	actions: ToolbarAction[];
	/** Slot for extra content on the right (e.g. overflow menu) */
	trailing?: ReactNode;
	className?: string;
}

export function Toolbar({ actions, trailing, className }: ToolbarProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-1 overflow-x-auto scrollbar-none flex-wrap",
				className,
			)}
		>
			{actions.map((action, i) => (
				<>
					{/* Optional divider after groups (every 3 items when not trailing) */}
					{i > 0 && i % 4 === 0 && !trailing && (
						<div
							key={`div-${action.id}`}
							className="w-px h-4 mx-1 flex-shrink-0"
							style={{ background: "var(--ag-border-subtle)" }}
							role="separator"
						/>
					)}
					<PillButton
						key={action.id}
						icon={action.icon}
						active={action.active}
						disabled={action.disabled}
						accent={action.accent}
						onClick={action.onClick}
					>
						{action.label}
					</PillButton>
				</>
			))}

			{/* Trailing slot */}
			{trailing && (
				<>
					<div
						className="w-px h-4 mx-1 flex-shrink-0"
						style={{ background: "var(--ag-border-subtle)" }}
						role="separator"
					/>
					<div className="flex items-center">{trailing}</div>
				</>
			)}
		</div>
	);
}
