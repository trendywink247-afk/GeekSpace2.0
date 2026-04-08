/**
 * /dev/ui — UI primitives showcase.
 * Only mounted when import.meta.env.DEV is true.
 * Demonstrates all components from src/components/mobile/ (Phase 0)
 * and src/components/ui/agentin/ (Aurora Phase — new).
 */

import {
	Activity,
	Bell,
	BookOpen,
	Cpu,
	Inbox,
	Layers,
	LayoutDashboard,
	Search,
	Sparkles,
	Star,
	Tag,
	Trash2,
	TrendingUp,
	Zap,
} from "lucide-react";
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
import {
	Chip,
	GlassCard,
	KeyValueList,
	ListItem,
	LoadingBeam,
	PageHeader,
	PillButton,
	SectionHeader,
	StatCard,
	TabBar,
	Toolbar,
} from "@/components/ui/agentin";

// ─── Static data ────────────────────────────────────────────────────────────

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
	{
		id: "search",
		label: "Search",
		icon: Search,
		activeColor: "var(--ag-amber)",
	},
	{
		id: "starred",
		label: "Starred",
		icon: Star,
		activeColor: "var(--ag-coral)",
	},
];

const TOOLBAR_ACTIONS = [
	{ id: "new", label: "New", icon: Sparkles, accent: "violet" as const },
	{ id: "import", label: "Import", icon: Layers, accent: "indigo" as const },
	{ id: "export", label: "Export", icon: Activity, accent: "emerald" as const },
	{
		id: "delete",
		label: "Delete",
		icon: Trash2,
		accent: "coral" as const,
		disabled: false,
	},
];

const TAB_ITEMS = [
	{ id: "overview", label: "Overview", icon: LayoutDashboard },
	{ id: "activity", label: "Activity", icon: Activity },
	{ id: "agents", label: "Agents", icon: Cpu },
	{ id: "docs", label: "Docs", icon: BookOpen },
];

const KV_ITEMS = [
	{ label: "Model", value: "claude-3-7-sonnet", mono: true },
	{ label: "Tokens used", value: "12,450" },
	{ label: "Latency", value: "340ms", mono: true },
	{ label: "Status", value: "Active" },
	{ label: "Version", value: "2.0.0", mono: true },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function UiShowcase() {
	const navigate = useNavigate();
	const [activeNav, setActiveNav] = useState("overview");
	const [showSkeleton, setShowSkeleton] = useState(false);
	const [activeTab, setActiveTab] = useState("overview");
	const [beamActive, setBeamActive] = useState(false);
	const [activeFilter, setActiveFilter] = useState<string | null>(null);

	return (
		<div
			className="min-h-dvh flex flex-col"
			style={{
				background: "var(--ag-bg-base)",
				color: "var(--ag-text-primary)",
			}}
		>
			{/* Loading beam demo */}
			<LoadingBeam loading={beamActive} />

			{/* Page header */}
			<MobilePageHeader
				title="UI Showcase"
				subtitle="Phase 0 + Aurora Primitives"
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

			{/* Scroll area */}
			<div className="flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
				{showSkeleton ? (
					<div className="py-4">
						<p className="px-4 text-xs text-[var(--ag-text-muted)] mb-2">
							PageSkeleton component:
						</p>
						<PageSkeleton cards={4} showHeader />
					</div>
				) : (
					<>
						{/* ══════════════════════════════════════════════════
						    AURORA SECTION — NEW PRIMITIVES
						    ══════════════════════════════════════════════════ */}
						<div className="px-4 pt-6 pb-2">
							<div
								className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-4"
								style={{
									background: "rgba(139,92,246,0.1)",
									border: "1px solid var(--ag-border-default)",
									color: "var(--ag-violet-soft)",
								}}
							>
								<Sparkles className="w-3 h-3" />
								Agentin Aurora — New Primitives
							</div>
						</div>

						{/* ── PageHeader ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="PageHeader" className="mb-3" />
							<div
								className="rounded-2xl overflow-hidden"
								style={{ border: "1px solid var(--ag-border-subtle)" }}
							>
								<PageHeader
									eyebrow="workspace"
									title="Project Overview"
									description="All your projects, deadlines, and team activity in one place."
									icon={LayoutDashboard}
									actions={
										<button
											type="button"
											className="text-xs px-3 py-1.5 rounded-lg min-h-[36px]"
											style={{
												background: "var(--ag-violet)",
												color: "#fff",
											}}
										>
											New
										</button>
									}
								/>
							</div>
						</div>

						{/* ── SectionHeader ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="SectionHeader variants" className="mb-3" />
							<GlassCard className="p-4 flex flex-col gap-3">
								<SectionHeader
									label="default tone"
									action={
										<span
											className="text-xs"
											style={{ color: "var(--ag-violet-soft)" }}
										>
											See all
										</span>
									}
								/>
								<SectionHeader label="muted tone" tone="muted" />
							</GlassCard>
						</div>

						{/* ── StatCards ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="StatCard" className="mb-3" />
							<div className="grid grid-cols-2 gap-3">
								<StatCard
									label="Total Tasks"
									value="1,248"
									delta={12}
									deltaLabel="vs last week"
									icon={Activity}
									accent="violet"
								/>
								<StatCard
									label="AI Calls"
									value="84.2k"
									delta={-3}
									deltaLabel="vs yesterday"
									icon={Cpu}
									accent="indigo"
								/>
								<StatCard
									label="Revenue"
									value="$4,820"
									delta={8}
									deltaLabel="MoM"
									icon={TrendingUp}
									accent="emerald"
								/>
								<StatCard
									label="Warnings"
									value="7"
									delta={0}
									deltaLabel="unchanged"
									icon={Zap}
									accent="amber"
								/>
							</div>
						</div>

						{/* ── GlassCard ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="GlassCard" className="mb-3" />
							<div className="flex flex-col gap-3">
								{(
									["violet", "indigo", "emerald", "coral", "none"] as const
								).map((accent) => (
									<GlassCard key={accent} accent={accent} hover className="p-4">
										<p
											className="text-xs font-mono"
											style={{ color: "var(--ag-text-muted)" }}
										>
											accent="{accent}"
										</p>
										<p
											className="text-sm mt-1"
											style={{ color: "var(--ag-text-primary)" }}
										>
											Hover me — glass morphism with accent glow.
										</p>
									</GlassCard>
								))}
							</div>
						</div>

						{/* ── TabBar ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="TabBar" className="mb-3" />
							<TabBar
								tabs={TAB_ITEMS}
								activeId={activeTab}
								onChange={setActiveTab}
							/>
							<p
								className="text-xs mt-2"
								style={{ color: "var(--ag-text-muted)" }}
							>
								Active: <span className="font-mono">{activeTab}</span>
							</p>
						</div>

						{/* ── PillButton ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="PillButton" className="mb-3" />
							<div className="flex flex-wrap gap-2">
								{(
									["violet", "indigo", "emerald", "amber", "coral"] as const
								).map((accent) => (
									<PillButton
										key={accent}
										icon={Tag}
										accent={accent}
										active={activeFilter === accent}
										onClick={() =>
											setActiveFilter(activeFilter === accent ? null : accent)
										}
									>
										{accent}
									</PillButton>
								))}
								<PillButton icon={Trash2} disabled accent="coral">
									disabled
								</PillButton>
							</div>
						</div>

						{/* ── Chip ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="Chip" className="mb-3" />
							<div className="flex flex-wrap gap-2">
								<Chip icon={Sparkles} accent="violet">
									AI Agent
								</Chip>
								<Chip icon={Cpu} accent="indigo">
									GPT-4o
								</Chip>
								<Chip icon={Activity} accent="emerald">
									Active
								</Chip>
								<Chip icon={Zap} accent="amber">
									Warning
								</Chip>
								<Chip accent="coral" onRemove={() => {}}>
									Removable
								</Chip>
							</div>
						</div>

						{/* ── ListItem ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="ListItem" className="mb-3" />
							<GlassCard className="overflow-hidden">
								<ListItem
									icon={Cpu}
									title="Weebo Agent"
									subtitle="Last active 2 min ago"
									chevron
									onClick={() => {}}
								/>
								<ListItem
									icon={Sparkles}
									title="Nova Agent"
									subtitle="Running 3 tasks"
									trailing={
										<span
											className="text-xs font-mono px-2 py-0.5 rounded-full"
											style={{
												background: "rgba(16,185,129,0.1)",
												color: "var(--ag-emerald)",
											}}
										>
											active
										</span>
									}
									chevron
									onClick={() => {}}
								/>
								<ListItem icon={BookOpen} title="Docs Agent" subtitle="Idle" />
							</GlassCard>
						</div>

						{/* ── Toolbar ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="Toolbar" className="mb-3" />
							<GlassCard className="p-3">
								<Toolbar actions={TOOLBAR_ACTIONS} />
							</GlassCard>
						</div>

						{/* ── KeyValueList ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="KeyValueList" className="mb-3" />
							<GlassCard className="p-4">
								<KeyValueList items={KV_ITEMS} />
							</GlassCard>
						</div>

						{/* ── LoadingBeam ── */}
						<div className="px-4 mb-6">
							<SectionHeader label="LoadingBeam" className="mb-3" />
							<GlassCard className="p-4 flex items-center gap-3">
								<PillButton
									icon={Zap}
									accent="violet"
									active={beamActive}
									onClick={() => {
										setBeamActive(true);
										setTimeout(() => setBeamActive(false), 2000);
									}}
								>
									Trigger beam (2s)
								</PillButton>
								<span
									className="text-xs"
									style={{ color: "var(--ag-text-muted)" }}
								>
									Watch the top of the page
								</span>
							</GlassCard>
						</div>

						{/* ══════════════════════════════════════════════════
						    PHASE 0 SECTION — Original mobile primitives
						    ══════════════════════════════════════════════════ */}
						<div className="px-4 pt-4 pb-2">
							<div
								className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-4"
								style={{
									background: "rgba(99,102,241,0.1)",
									border: "1px solid rgba(99,102,241,0.2)",
									color: "var(--ag-indigo)",
								}}
							>
								<Layers className="w-3 h-3" />
								Phase 0 — Mobile Primitives (original)
							</div>
						</div>

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

							<MobileCard onPress={() => {}} className="mb-3">
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
									onCta={() => {}}
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
								"StatCard",
								"PageHeader",
								"SectionHeader",
								"GlassCard",
								"PillButton",
								"Chip",
								"ListItem",
								"TabBar",
								"LoadingBeam",
								"KeyValueList",
								"Toolbar",
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
