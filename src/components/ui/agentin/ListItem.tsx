/**
 * ListItem — row component: icon/avatar + title + subtitle + trailing + chevron.
 * Used in lists, menus, and activity feeds.
 */

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListItemProps {
	icon?: LucideIcon;
	title: string;
	subtitle?: string;
	trailing?: ReactNode;
	chevron?: boolean;
	onClick?: () => void;
	className?: string;
}

export function ListItem({
	icon: Icon,
	title,
	subtitle,
	trailing,
	chevron = false,
	onClick,
	className,
}: ListItemProps) {
	const isInteractive = !!onClick;

	return (
		<div
			role={isInteractive ? "button" : undefined}
			tabIndex={isInteractive ? 0 : undefined}
			onClick={onClick}
			onKeyDown={
				isInteractive
					? (e) => {
							if (e.key === "Enter" || e.key === " ") onClick?.();
						}
					: undefined
			}
			className={cn(
				"flex items-center gap-3 px-3 py-3 rounded-xl",
				"transition-all duration-150",
				"min-h-[44px]",
				isInteractive &&
					"cursor-pointer hover:bg-[var(--ag-active-bg)] active:scale-[0.99] select-none",
				className,
			)}
		>
			{/* Leading icon */}
			{Icon && (
				<div
					className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
					style={{
						background: "var(--ag-active-bg)",
						border: "1px solid var(--ag-border-subtle)",
					}}
				>
					<Icon className="w-4 h-4" style={{ color: "var(--ag-text-muted)" }} />
				</div>
			)}

			{/* Text block */}
			<div className="flex-1 min-w-0">
				<p
					className="text-sm font-medium truncate"
					style={{ color: "var(--ag-text-primary)" }}
				>
					{title}
				</p>
				{subtitle && (
					<p
						className="text-xs mt-0.5 truncate"
						style={{ color: "var(--ag-text-muted)" }}
					>
						{subtitle}
					</p>
				)}
			</div>

			{/* Trailing + chevron */}
			{trailing && <div className="flex-shrink-0">{trailing}</div>}
			{chevron && (
				<ChevronRight
					className="w-4 h-4 flex-shrink-0 opacity-40"
					style={{ color: "var(--ag-text-muted)" }}
				/>
			)}
		</div>
	);
}
