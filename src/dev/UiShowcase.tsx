/**
 * /dev/ui — Mobile primitives showcase.
 * Only mounted when import.meta.env.DEV is true.
 * Demonstrates all components from src/components/mobile/.
 */

import { Bell, Inbox, Layers, Search, Star } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	BottomNav,
	type BottomNavItem,
	EmptyState,
	MobileCard,
	MobilePageHeader,
	MobileSection,
	PageSkeleton,
} from "@/components/mobile";

const NAV_ITEMS: BottomNavItem[] = [
	{ id: "chat", label: "Chat", icon: Bell, activeColor: "var(--ag-violet)" },
	{
		id: "inbox",
		label: "Inbox",
		icon: Inbox,
		activeColor: "var(--ag-cyan)",
		badge: 3,
	},
	{
		id: "overview",
		label: "Overview",
		icon: Layers,
		activeColor: "var(--ag-green)",
	},
	{ id: "search", label: "Search", icon: Search, activeColor: "#F59E0B" },
	{ id: "starred", label: "Starred", icon: Star, activeColor: "#EC4899" },
];

export function UiShowcase() {
	const navigate = useNavigate();
	const [activeNav, setActiveNav] = useState("overview");
	const [showSkeleton, setShowSkeleton] = useState(false);

	return (
		<div
			className="min-h-dvh flex flex-col"
			style={{
				background: "var(--ag-bg-base)",
				color: "var(--ag-text-primary)",
			}}
		>
			{/* Page header */}
			<MobilePageHeader
				title="Mobile Primitives"
				subtitle="Phase 0 — Design System Showcase"
				onBack={() => navigate(-1)}
				actions={
					<button
						type="button"
						onClick={() => setShowSkeleton((v) => !v)}
						className="text-xs px-3 py-1.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
						style={{
							background: "var(--ag-active-bg)",
							color: "var(--ag-text-accent)",
						}}
					>
						{showSkeleton ? "Hide" : "Skeleton"}
					</button>
				}
			/>

			{/* Scroll area — needs bottom padding to clear BottomNav */}
			<div className="flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
				{showSkeleton ? (
					/* ── PageSkeleton demo ── */
					<div className="py-4">
						<p className="px-4 text-xs text-[var(--ag-text-muted)] mb-2">
							PageSkeleton component:
						</p>
						<PageSkeleton cards={4} showHeader />
					</div>
				) : (
					<>
						{/* ── MobileSection + MobileCard ── */}
						<MobileSection
							title="MobileCard variants"
							description="Tap the interactive card"
							action={
								<span className="text-xs text-[var(--ag-text-accent)]">
									action slot
								</span>
							}
						>
							{/* Static card */}
							<MobileCard className="mb-3">
								<p
									className="text-xs font-semibold mb-1"
									style={{ color: "var(--ag-text-muted)" }}
								>
									STATIC CARD
								</p>
								<p
									className="text-sm"
									style={{ color: "var(--ag-text-primary)" }}
								>
									Default glass card — no tap handler.
								</p>
							</MobileCard>

							{/* Interactive card */}
							<MobileCard
								onPress={() => alert("Card tapped!")}
								className="mb-3"
							>
								<p
									className="text-xs font-semibold mb-1"
									style={{ color: "var(--ag-text-accent)" }}
								>
									INTERACTIVE CARD — tap me
								</p>
								<p
									className="text-sm"
									style={{ color: "var(--ag-text-primary)" }}
								>
									Tap for press scale + border glow.
								</p>
							</MobileCard>
						</MobileSection>

						{/* ── EmptyState ── */}
						<MobileSection title="EmptyState">
							<MobileCard noPadding>
								<EmptyState
									icon={Inbox}
									title="No messages yet"
									description="When you receive messages they'll appear here."
									ctaLabel="Compose message"
									onCta={() => alert("CTA tapped")}
								/>
							</MobileCard>
						</MobileSection>

						{/* ── BottomNav preview ── */}
						<MobileSection title="BottomNav (live below)">
							<MobileCard>
								<p
									className="text-sm"
									style={{ color: "var(--ag-text-secondary)" }}
								>
									The BottomNav is rendered at the bottom of this page. Current
									tab:{" "}
									<strong style={{ color: "var(--ag-text-accent)" }}>
										{activeNav}
									</strong>
								</p>
								<p
									className="text-xs mt-2"
									style={{ color: "var(--ag-text-muted)" }}
								>
									It has 44×44 tap targets, a safe-area inset, and is hidden on{" "}
									<code className="font-mono">md:</code>+.
								</p>
							</MobileCard>
						</MobileSection>

						{/* ── Component list ── */}
						<MobileSection title="All primitives">
							{[
								"MobilePageHeader",
								"MobileSection",
								"MobileCard",
								"EmptyState",
								"PageSkeleton",
								"BottomNav",
							].map((name) => (
								<MobileCard key={name} className="mb-2" noPadding={false}>
									<div className="flex items-center gap-3">
										<div
											className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
											style={{
												background: "var(--ag-active-bg)",
												color: "var(--ag-text-accent)",
											}}
										>
											{name[0]}
										</div>
										<span
											className="text-sm font-medium font-mono"
											style={{ color: "var(--ag-text-primary)" }}
										>
											{name}
										</span>
									</div>
								</MobileCard>
							))}
						</MobileSection>
					</>
				)}
			</div>

			{/* BottomNav wired up */}
			<BottomNav
				activeId={activeNav}
				onSelect={setActiveNav}
				items={NAV_ITEMS}
			/>
		</div>
	);
}
