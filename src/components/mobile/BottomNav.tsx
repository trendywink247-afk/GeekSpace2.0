/**
 * BottomNav — fixed bottom navigation bar for mobile.
 * 44×44 tap targets, safe-area inset, hidden on md+.
 *
 * Default tabs: Chat · Inbox · Overview · Calendar · More
 * Accepts custom items via the `items` prop.
 */

import {
	Calendar,
	Inbox,
	LayoutDashboard,
	type LucideIcon,
	MessageSquare,
	MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomNavItem {
	id: string;
	label: string;
	icon: LucideIcon;
	/** Notification badge count — omit or 0 to hide */
	badge?: number;
	/** Override icon color when active */
	activeColor?: string;
}

const DEFAULT_ITEMS: BottomNavItem[] = [
	{
		id: "chat",
		label: "Chat",
		icon: MessageSquare,
		activeColor: "var(--ag-violet)",
	},
	{ id: "inbox", label: "Inbox", icon: Inbox, activeColor: "var(--ag-cyan)" },
	{
		id: "overview",
		label: "Overview",
		icon: LayoutDashboard,
		activeColor: "var(--ag-green)",
	},
	{ id: "calendar", label: "Calendar", icon: Calendar, activeColor: "#F59E0B" },
	{
		id: "more",
		label: "More",
		icon: MoreHorizontal,
		activeColor: "var(--ag-text-muted)",
	},
];

interface BottomNavProps {
	/** Currently active item ID */
	activeId: string;
	/** Called with the item id when a tab is tapped */
	onSelect: (id: string) => void;
	/** Override default tabs */
	items?: BottomNavItem[];
	className?: string;
}

export function BottomNav({
	activeId,
	onSelect,
	items = DEFAULT_ITEMS,
	className,
}: BottomNavProps) {
	return (
		<nav
			role="tablist"
			aria-label="Main navigation"
			className={cn(
				// Position + stacking
				"fixed bottom-0 left-0 right-0 z-40",
				// Hide on desktop
				"md:hidden",
				// Glass chrome
				"backdrop-blur-2xl",
				"border-t border-[var(--ag-border-subtle)]",
				// Safe area inset
				"pb-[env(safe-area-inset-bottom,0px)]",
				className,
			)}
			style={{
				background: "var(--ag-bg-chrome)",
				WebkitBackdropFilter: "blur(24px)",
			}}
		>
			<div className="flex items-stretch justify-around h-[56px]">
				{items.map((item) => {
					const isActive = activeId === item.id;
					const Icon = item.icon;
					const color = isActive
						? (item.activeColor ?? "var(--ag-violet)")
						: "var(--ag-text-muted)";

					return (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={isActive}
							aria-label={item.label}
							onClick={() => onSelect(item.id)}
							className={cn(
								// Full-height tap target (44+ px)
								"relative flex flex-col items-center justify-center gap-1",
								"flex-1 min-w-0 min-h-[44px]",
								// Transitions
								"transition-all duration-200",
								// Tap feedback
								"active:scale-95",
								isActive ? "opacity-100" : "opacity-70 hover:opacity-90",
							)}
							style={{
								WebkitTapHighlightColor: "transparent",
								color,
							}}
						>
							{/* Active indicator pill */}
							<span
								className={cn(
									"absolute top-0 left-1/2 -translate-x-1/2",
									"h-0.5 rounded-full transition-all duration-200",
									isActive ? "w-6" : "w-0",
								)}
								style={isActive ? { background: color } : undefined}
								aria-hidden="true"
							/>

							{/* Icon + badge */}
							<span className="relative flex items-center justify-center w-6 h-6">
								<Icon className="w-5 h-5" />
								{!!item.badge && item.badge > 0 && (
									<span
										className={cn(
											"absolute -top-1.5 -right-1.5",
											"min-w-[16px] h-4 rounded-full px-1",
											"flex items-center justify-center",
											"text-[9px] font-bold leading-none",
											"bg-[var(--ag-violet)] text-white",
										)}
										aria-label={`${item.badge} unread`}
									>
										{item.badge > 99 ? "99+" : item.badge}
									</span>
								)}
							</span>

							{/* Label */}
							<span className="text-[10px] font-medium leading-none truncate">
								{item.label}
							</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}
