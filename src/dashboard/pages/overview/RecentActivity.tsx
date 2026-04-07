/**
 * RecentActivity — recent conversations timeline.
 *
 * Landing-page aesthetic:
 * - Glass card wrapper
 * - Mono eyebrow
 * - Status dot indicator per conversation
 * - Dividers: border-white/[0.06]
 * - Empty state with mono label
 */

import { ArrowRight, MessageSquare, Plus } from "lucide-react";
import { MobileSection } from "@/components/mobile";
import { cn } from "@/lib/utils";
import type { ConversationEntry } from "@/types";
import { relativeTime } from "./helpers";

interface RecentActivityProps {
	loading: boolean;
	conversations: ConversationEntry[];
	onNavigate?: (page: string) => void;
	onOpenChat?: () => void;
}

const AGENT_COLORS = ["#A78BFA", "#ADFF2F", "#8B5CF6", "#FF2D78", "#F59E0B"];

// ---------------------------------------------------------------------------
// Row skeleton
// ---------------------------------------------------------------------------

function RowSkeleton({ delay }: { delay: number }) {
	return (
		<div
			className="flex items-start gap-3 p-4 animate-pulse"
			style={{ animationDelay: `${delay}ms` }}
		>
			<div className="w-9 h-9 rounded-full bg-white/[0.04] shrink-0" />
			<div className="flex-1 space-y-2">
				<div className="h-3.5 w-3/4 rounded bg-white/[0.04]" />
				<div className="h-2.5 w-1/2 rounded bg-white/[0.03]" />
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// RecentActivity
// ---------------------------------------------------------------------------

export function RecentActivity({
	loading,
	conversations,
	onNavigate,
	onOpenChat,
}: RecentActivityProps) {
	return (
		<MobileSection noPadding className="pt-5">
			{/* Header row */}
			<div className="flex items-center justify-between px-4 mb-3">
				<p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]/60">
					Recent Activity
				</p>
				<button
					type="button"
					onClick={() => onNavigate?.("chat")}
					className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-colors min-h-[44px] px-1"
					aria-label="View all conversations"
				>
					View all
					<ArrowRight className="w-3 h-3" aria-hidden />
				</button>
			</div>

			{/* Glass card */}
			<div className="mx-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
				{loading ? (
					<div className="divide-y divide-white/[0.06]">
						<RowSkeleton delay={0} />
						<RowSkeleton delay={80} />
						<RowSkeleton delay={160} />
					</div>
				) : conversations.length > 0 ? (
					<div className="divide-y divide-white/[0.06]">
						{conversations.map((convo) => {
							const colorIdx = convo.id.charCodeAt(0) % AGENT_COLORS.length;
							const agentColor = AGENT_COLORS[colorIdx];
							return (
								<button
									key={convo.id}
									type="button"
									onClick={() => onOpenChat?.()}
									className={cn(
										"w-full p-4 flex items-start gap-3 text-left",
										"hover:bg-white/[0.03] transition-colors group",
										"active:scale-[0.99] min-h-[44px]",
										"focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40",
									)}
									style={{ WebkitTapHighlightColor: "transparent" }}
								>
									{/* Avatar with status dot */}
									<div className="relative shrink-0 mt-0.5">
										<div
											className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono font-bold"
											style={{
												background: `${agentColor}15`,
												color: agentColor,
												border: `1.5px solid ${agentColor}30`,
											}}
											aria-hidden
										>
											W
										</div>
										{/* Status dot — 2×2 rounded-full matching landing pattern */}
										<span
											className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--ag-bg-chrome)]"
											style={{ background: agentColor }}
											aria-hidden
										/>
									</div>

									<div className="flex-1 min-w-0">
										<p className="text-sm text-[var(--ag-text-primary)] truncate leading-snug group-hover:text-[var(--ag-text-accent)] transition-colors">
											{convo.content.length > 80
												? `${convo.content.slice(0, 77)}…`
												: convo.content}
										</p>
										<div className="flex items-center gap-2 mt-1">
											<span
												className="text-[11px] font-mono"
												style={{ color: agentColor }}
											>
												Weebo
											</span>
											<span className="text-white/[0.12]" aria-hidden>
												·
											</span>
											<span className="text-[11px] text-[var(--ag-text-muted)]">
												{relativeTime(convo.createdAt)}
											</span>
										</div>
									</div>

									<ArrowRight
										className="w-3.5 h-3.5 text-white/20 group-hover:text-[var(--ag-text-muted)] transition-colors shrink-0 mt-1"
										aria-hidden
									/>
								</button>
							);
						})}
					</div>
				) : (
					/* Empty state */
					<div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
						<div className="w-12 h-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
							<MessageSquare className="w-5 h-5 text-white/20" aria-hidden />
						</div>
						<div>
							<p className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">
								No conversations yet
							</p>
							<p className="text-[11px] font-mono text-[#94A3B8]/50 mt-1 uppercase tracking-wider">
								Chat with Weebo to get started
							</p>
						</div>
						<button
							type="button"
							onClick={() => onOpenChat?.()}
							className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[#8B5CF6] to-[#10B981] hover:opacity-90 transition-opacity min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40"
						>
							<Plus className="w-3.5 h-3.5" aria-hidden />
							Start a chat
						</button>
					</div>
				)}
			</div>
		</MobileSection>
	);
}
