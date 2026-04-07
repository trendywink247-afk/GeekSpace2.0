/**
 * OverviewHeader — sticky page header for the Overview/home page.
 *
 * Visual language matches the landing page:
 * - Glass chrome with backdrop-blur
 * - Mono uppercase eyebrow label
 * - Refresh button with tap-safe 44 px target
 * - Optional festival badge (amber pill)
 */

import { RefreshCw, Sparkles } from "lucide-react";
import { MobilePageHeader } from "@/components/mobile";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/utils";

interface OverviewHeaderProps {
	greeting: string;
	firstName: string;
	pendingRemindersCount: number;
	messagesToday: number;
	festivalGreeting: string | null;
	isRefreshing: boolean;
	onRefresh: () => void;
}

export function OverviewHeader({
	greeting,
	firstName,
	pendingRemindersCount,
	messagesToday,
	festivalGreeting,
	isRefreshing,
	onRefresh,
}: OverviewHeaderProps) {
	const { t } = useTranslation();

	const subtitle =
		pendingRemindersCount > 0
			? `${pendingRemindersCount} reminder${pendingRemindersCount !== 1 ? "s" : ""} due today`
			: messagesToday > 0
				? `${messagesToday} message${messagesToday !== 1 ? "s" : ""} sent today`
				: "All clear — ready to build something great";

	return (
		<MobilePageHeader
			title={`${t(greeting)}, ${firstName}`}
			subtitle={subtitle}
			actions={
				<>
					{/* Festival badge — hidden on very small screens to keep header clean */}
					{festivalGreeting && (
						<span
							className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono uppercase tracking-[0.12em] animate-pulse shrink-0"
							style={{
								background: "rgba(245,158,11,0.08)",
								borderColor: "rgba(245,158,11,0.2)",
								color: "var(--ag-amber)",
							}}
							aria-label={festivalGreeting}
						>
							<Sparkles className="w-3 h-3 shrink-0" aria-hidden />
							<span className="max-w-[88px] truncate">{festivalGreeting}</span>
						</span>
					)}

					{/* Refresh — always visible */}
					<button
						type="button"
						onClick={onRefresh}
						disabled={isRefreshing}
						aria-label="Refresh dashboard"
						className={cn(
							"flex items-center justify-center rounded-xl transition-all duration-150",
							"min-w-[44px] min-h-[44px]",
							"text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]",
							"hover:bg-white/[0.04]",
							"active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40",
						)}
					>
						<RefreshCw
							className={cn("w-4 h-4", isRefreshing && "animate-spin")}
							aria-hidden
						/>
					</button>
				</>
			}
		/>
	);
}
