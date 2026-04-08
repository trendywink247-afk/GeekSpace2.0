// ============================================================
// PlannerHeader — Aurora PageHeader with view toggle + Ask Cal CTA.
// ============================================================

import { CalendarCheck, CalendarDays, Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader, PillButton } from "@/components/ui/agentin";
import type { ViewMode } from "../state/planner-store";

interface PlannerHeaderProps {
	viewMode: ViewMode;
	onViewChange: (mode: ViewMode) => void;
}

export function PlannerHeader({ viewMode, onViewChange }: PlannerHeaderProps) {
	const navigate = useNavigate();

	return (
		<PageHeader
			icon={CalendarCheck}
			eyebrow="Productivity"
			title="Planner"
			description={
				viewMode === "day"
					? "Drag tasks from backlog into your timeline"
					: "See your full week at a glance"
			}
			actions={
				<div className="flex items-center gap-2">
					{/* View toggle */}
					<div
						className="flex items-center rounded-xl overflow-hidden p-0.5"
						style={{
							background: "var(--ag-active-bg)",
							border: "1px solid var(--ag-border-subtle)",
						}}
					>
						<PillButton
							icon={Clock}
							active={viewMode === "day"}
							accent="violet"
							onClick={() => onViewChange("day")}
						>
							Day
						</PillButton>
						<PillButton
							icon={CalendarDays}
							active={viewMode === "week"}
							accent="indigo"
							onClick={() => onViewChange("week")}
						>
							Week
						</PillButton>
					</div>

					{/* Ask Cal CTA */}
					<button
						type="button"
						onClick={() =>
							navigate("/dashboard/chat?agent=cal&prompt=Plan+my+week")
						}
						className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
              transition-all duration-150 active:scale-95 min-h-[36px]"
						style={{
							background: "rgba(251, 146, 60, 0.1)",
							border: "1px solid rgba(251, 146, 60, 0.25)",
							color: "var(--ag-coral)",
						}}
					>
						<Sparkles className="w-3.5 h-3.5" />
						Ask Cal
					</button>
				</div>
			}
		/>
	);
}
