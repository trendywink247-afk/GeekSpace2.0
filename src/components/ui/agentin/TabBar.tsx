/**
 * TabBar — horizontal tab list with pill indicator. Mobile-scrollable.
 * Used for page-level and section-level navigation.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabItem {
	id: string;
	label: string;
	icon?: LucideIcon;
}

export interface TabBarProps {
	tabs: TabItem[];
	activeId: string;
	onChange: (id: string) => void;
	className?: string;
}

export function TabBar({ tabs, activeId, onChange, className }: TabBarProps) {
	return (
		<div
			className={cn(
				"flex gap-1 overflow-x-auto scrollbar-none",
				"p-1 rounded-xl",
				className,
			)}
			style={{
				background: "var(--ag-active-bg)",
				border: "1px solid var(--ag-border-subtle)",
			}}
			role="tablist"
		>
			{tabs.map((tab) => {
				const isActive = tab.id === activeId;
				const Icon = tab.icon;
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						onClick={() => onChange(tab.id)}
						className={cn(
							"flex items-center gap-1.5 px-3 py-2 rounded-lg",
							"text-xs font-medium whitespace-nowrap flex-shrink-0",
							"transition-all duration-200 min-h-[36px]",
							"focus-visible:outline-none focus-visible:ring-2",
							"focus-visible:ring-[var(--ag-violet)] focus-visible:ring-offset-0",
						)}
						style={{
							background: isActive ? "var(--ag-bg-elevated)" : "transparent",
							color: isActive
								? "var(--ag-text-primary)"
								: "var(--ag-text-secondary)",
							boxShadow: isActive ? "var(--ag-glow-sm)" : "none",
							border: isActive
								? "1px solid var(--ag-border-default)"
								: "1px solid transparent",
						}}
					>
						{Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
