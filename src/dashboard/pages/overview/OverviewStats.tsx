/**
 * OverviewStats — key metric cards grid.
 *
 * Landing-page aesthetic:
 * - Glass cards: `rounded-2xl border-white/[0.06] bg-white/[0.02] backdrop-blur-sm`
 * - Big display numbers in `text-gradient`
 * - Mono uppercase label below value
 * - Violet glow on card via box-shadow
 * - 2-col grid on mobile (≥360 px), 4-col on md:+
 */

import { MobileSection } from "@/components/mobile";
import { cn } from "@/lib/utils";
import type { GlanceCard } from "./helpers";

interface OverviewStatsProps {
	loading: boolean;
	glanceCards: GlanceCard[];
	onNavigate?: (page: string) => void;
	onOpenChat?: () => void;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function StatSkeleton() {
	return (
		<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
			<div className="w-9 h-9 rounded-xl bg-white/[0.04] mb-3" />
			<div className="h-8 w-14 rounded-lg bg-white/[0.04] mb-2" />
			<div className="h-2.5 w-20 rounded bg-white/[0.03] mb-1" />
			<div className="h-2 w-16 rounded bg-white/[0.03]" />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Navigation helper
// ---------------------------------------------------------------------------

function navigate(
	key: string,
	onNavigate?: (p: string) => void,
	onOpenChat?: () => void,
) {
	if (key === "reminders") onNavigate?.("reminders");
	else if (key === "messages") onOpenChat?.();
	else if (key === "focus") onNavigate?.("focus");
	else if (key === "time-saved") onNavigate?.("activity");
}

// ---------------------------------------------------------------------------
// OverviewStats
// ---------------------------------------------------------------------------

export function OverviewStats({
	loading,
	glanceCards,
	onNavigate,
	onOpenChat,
}: OverviewStatsProps) {
	return (
		<MobileSection noPadding className="pt-5">
			{/* Mono eyebrow — matches landing section headers */}
			<p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]/60 px-4 mb-3">
				Today at a Glance
			</p>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4">
				{loading
					? Array.from({ length: 4 }).map((_, i) => (
							<StatSkeleton key={`stat-sk-${i}`} />
						))
					: glanceCards.map((card) => (
							<button
								key={card.key}
								type="button"
								onClick={() => navigate(card.key, onNavigate, onOpenChat)}
								aria-label={`${card.label}: ${card.value}`}
								className={cn(
									// Shape + glass — matches landing TrustStrip cards
									"rounded-2xl border border-white/[0.06] bg-white/[0.02]",
									"backdrop-blur-sm",
									// Hover lift
									"hover:bg-white/[0.04] hover:border-white/[0.10]",
									"transition-all duration-150",
									// Tap feedback
									"active:scale-[0.97]",
									// Subtle violet glow on the primary stat
									card.key === "time-saved" &&
										"shadow-[0_0_40px_rgba(139,92,246,0.15)]",
									// Layout
									"p-4 text-left cursor-pointer",
									// A11y
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40",
								)}
								style={{ WebkitTapHighlightColor: "transparent" }}
							>
								{/* Icon circle */}
								<div
									className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
									style={{ backgroundColor: card.bgColor }}
									aria-hidden
								>
									<card.icon
										className="w-4.5 h-4.5"
										style={{ color: card.color }}
										aria-hidden
									/>
								</div>

								{/* Big display number — text-gradient for hero feel */}
								<div
									className="text-[1.75rem] font-heading font-bold leading-none tabular-nums text-gradient"
									aria-hidden
								>
									{card.value}
								</div>

								{/* Mono label */}
								<p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#94A3B8]/60 mt-2 leading-snug">
									{card.label}
								</p>

								{/* Sub-label */}
								<p className="text-[11px] text-[var(--ag-text-muted)] mt-0.5 leading-snug">
									{card.sub}
								</p>
							</button>
						))}
			</div>
		</MobileSection>
	);
}
