/**
 * SettingsNav — desktop vertical sidebar for settings sections.
 *
 * Active state: `bg-[#8B5CF6]/10 border-l-2 border-[#8B5CF6]` (Linear-style)
 * Inactive hover: `hover:bg-white/[0.03]`
 *
 * Hidden on mobile (<md) — mobile uses SettingsMobileMenu drill-down instead.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsNavItem {
	id: string;
	label: string;
	icon: LucideIcon;
	description?: string;
}

interface SettingsNavProps {
	items: SettingsNavItem[];
	activeId: string;
	onSelect: (id: string) => void;
	className?: string;
}

export function SettingsNav({
	items,
	activeId,
	onSelect,
	className,
}: SettingsNavProps) {
	return (
		<nav
			aria-label="Settings sections"
			className={cn(
				// Desktop-only sidebar
				"hidden md:flex flex-col gap-0.5 w-52 shrink-0",
				className,
			)}
		>
			{items.map(({ id, label, icon: NavIcon }) => {
				const isActive = id === activeId;
				return (
					<button
						key={id}
						type="button"
						onClick={() => onSelect(id)}
						aria-current={isActive ? "page" : undefined}
						className={cn(
							// Base
							"flex items-center gap-2.5 px-3 py-2.5 rounded-xl",
							"text-sm font-medium transition-all duration-150 text-left",
							"min-h-[44px] w-full relative",
							// Active: Linear-style left border + tinted bg
							isActive
								? [
										"bg-[#8B5CF6]/10 text-[#C4B5FD]",
										"before:absolute before:left-0 before:inset-y-1 before:w-0.5",
										"before:bg-[#8B5CF6] before:rounded-full",
									]
								: [
										"text-[#94A3B8]",
										"hover:text-[#F1F5F9]",
										"hover:bg-white/[0.03]",
									],
						)}
					>
						<NavIcon
							className={cn(
								"w-4 h-4 shrink-0",
								isActive ? "text-[#8B5CF6]" : "text-[#6B7280]",
							)}
						/>
						{label}
					</button>
				);
			})}
		</nav>
	);
}
