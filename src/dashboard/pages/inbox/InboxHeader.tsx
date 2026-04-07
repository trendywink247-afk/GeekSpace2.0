// inbox/InboxHeader.tsx — sticky chrome: MobilePageHeader + filter pill tabs
// Aesthetic: landing page glass + mono eyebrows + violet pill filters
import { motion } from "framer-motion";
import { Keyboard, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Filter, InboxMessage } from "./helpers";
import { FILTERS } from "./helpers";

// ─── Filter Pill Tabs ─────────────────────────────────────────────────────────

interface FilterTabsProps {
	filter: Filter;
	messages: InboxMessage[];
	onChange: (f: Filter) => void;
}

// Count helper per filter
function filterCount(f: Filter, messages: InboxMessage[]): number {
	if (f === "unread") return messages.filter((m) => m.read === 0).length;
	if (f === "urgent")
		return messages.filter((m) => m.priority === "urgent").length;
	if (f === "all") return 0; // no badge on "All"
	return messages.filter((m) => m.source === f).length;
}

function FilterTabs({ filter, messages, onChange }: FilterTabsProps) {
	return (
		<div
			className={cn(
				"flex gap-1.5 overflow-x-auto scrollbar-none",
				"px-4 pb-3 pt-2",
				// same glass chrome as MobilePageHeader continuation
				"bg-[rgba(6,6,26,0.88)] backdrop-blur-xl",
				"border-b border-white/[0.06]",
			)}
		>
			{FILTERS.map((f) => {
				const isActive = filter === f;
				const cnt = filterCount(f, messages);
				const label =
					f === "urgent" ? "Urgent" : f.charAt(0).toUpperCase() + f.slice(1);

				return (
					<button
						key={f}
						type="button"
						onClick={() => onChange(f)}
						className={cn(
							// pill shape
							"shrink-0 rounded-full px-3.5 py-1.5",
							"text-[11px] font-semibold whitespace-nowrap",
							"font-mono uppercase tracking-[0.1em]",
							"min-h-[32px]",
							"transition-all duration-150",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50",
							isActive
								? "bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30"
								: "text-[#94A3B8]/70 hover:text-[#F1F5F9] hover:bg-white/[0.05] border border-transparent",
						)}
					>
						{label}
						{cnt > 0 && (
							<span
								className={cn(
									"ml-1.5 text-[10px] tabular-nums font-bold",
									"px-1.5 py-0.5 rounded-full",
									f === "urgent"
										? "bg-[#FF2D78]/15 text-[#FF2D78]"
										: "bg-[#8B5CF6]/15 text-[#8B5CF6]",
								)}
							>
								{cnt}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

// ─── InboxHeader ─────────────────────────────────────────────────────────────

export interface InboxHeaderProps {
	filter: Filter;
	messages: InboxMessage[];
	loading: boolean;
	showKbHints: boolean;
	onFilterChange: (f: Filter) => void;
	onRefresh: () => void;
	onToggleKbHints: () => void;
}

export function InboxHeader({
	filter,
	messages,
	loading,
	showKbHints,
	onFilterChange,
	onRefresh,
	onToggleKbHints,
}: InboxHeaderProps) {
	const unreadCount = messages.filter((m) => m.read === 0).length;

	return (
		<div className="sticky top-0 z-30">
			{/* ── Chrome row: title + actions ── */}
			<div
				className={cn(
					"flex items-center gap-3 px-4 h-14",
					"bg-[rgba(6,6,26,0.88)] backdrop-blur-xl",
					"border-b border-white/[0.04]",
					// Safe area
					"pt-[env(safe-area-inset-top,0px)]",
				)}
			>
				{/* Aria live dot + eyebrow + title */}
				<div className="flex-1 min-w-0 flex items-center gap-2.5">
					{/* Aria pulse */}
					<div className="relative w-5 h-5 shrink-0 flex items-center justify-center rounded-lg bg-[#FF6B9D]/10">
						<Sparkles className="w-3 h-3 text-[#FF6B9D]" />
						<span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#10B981]">
							<span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-60" />
						</span>
					</div>

					<div className="min-w-0">
						<div className="flex items-baseline gap-2">
							<h1
								className="text-sm font-semibold truncate text-[#F1F5F9]"
								style={{ fontFamily: "Syne, sans-serif" }}
							>
								AI Inbox
							</h1>
							{unreadCount > 0 && (
								<Badge className="bg-[#8B5CF6]/15 text-[#8B5CF6] border-0 text-[10px] font-bold tabular-nums py-0 h-4">
									{unreadCount}
								</Badge>
							)}
						</div>
						{/* Mono eyebrow — landing page signature */}
						<p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/60 leading-none mt-0.5">
							Triaged by Aria
						</p>
					</div>
				</div>

				{/* Right actions */}
				<div className="flex items-center gap-0.5 shrink-0">
					{/* Keyboard shortcuts — desktop only */}
					<Tooltip>
						<TooltipTrigger asChild>
							<motion.button
								whileTap={{ scale: 0.9 }}
								onClick={onToggleKbHints}
								aria-label="Keyboard shortcuts"
								aria-pressed={showKbHints}
								className={cn(
									"hidden sm:flex items-center justify-center",
									"w-9 h-9 rounded-xl",
									"transition-all duration-150",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40",
									showKbHints
										? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
										: "text-[#94A3B8]/60 hover:text-[#F1F5F9] hover:bg-white/[0.06]",
								)}
							>
								<Keyboard className="w-3.5 h-3.5" />
							</motion.button>
						</TooltipTrigger>
						<TooltipContent>Keyboard shortcuts (?)</TooltipContent>
					</Tooltip>

					{/* Refresh */}
					<Tooltip>
						<TooltipTrigger asChild>
							<motion.button
								whileTap={{ scale: 0.9 }}
								onClick={onRefresh}
								disabled={loading}
								aria-label="Refresh inbox"
								className={cn(
									"flex items-center justify-center",
									"w-9 h-9 rounded-xl",
									"text-[#94A3B8]/60 hover:text-[#F1F5F9] hover:bg-white/[0.06]",
									"transition-all duration-150",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40",
									loading ? "animate-spin pointer-events-none opacity-50" : "",
								)}
							>
								<RefreshCw className="w-3.5 h-3.5" />
							</motion.button>
						</TooltipTrigger>
						<TooltipContent>Refresh</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* ── Filter pill tabs ── */}
			<FilterTabs
				filter={filter}
				messages={messages}
				onChange={onFilterChange}
			/>
		</div>
	);
}
