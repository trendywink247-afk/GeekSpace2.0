// ============================================================
// PriorityList — top 3 scheduled blocks for today.
// Shown as a compact teaser above the timeline.
// ============================================================

import { Zap } from "lucide-react";
import { SectionHeader } from "@/components/ui/agentin";
import type { TimeBlock } from "../helpers";
import { formatHour } from "../helpers";

const TYPE_ACCENT: Record<string, string> = {
	reminder: "var(--ag-violet-soft)",
	habit: "var(--ag-emerald)",
	custom: "var(--ag-amber)",
};

interface PriorityListProps {
	blocks: TimeBlock[];
}

export function PriorityList({ blocks }: PriorityListProps) {
	if (blocks.length === 0) return null;

	return (
		<div className="space-y-2">
			<SectionHeader
				label="Top priorities today"
				action={
					<Zap className="w-3.5 h-3.5" style={{ color: "var(--ag-amber)" }} />
				}
			/>

			<div className="flex flex-col gap-1.5">
				{blocks.map((block, i) => {
					const accent = TYPE_ACCENT[block.type] ?? "var(--ag-violet)";
					return (
						<div
							key={block.id}
							className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
							style={{
								background: "var(--ag-active-bg)",
								border: "1px solid var(--ag-border-subtle)",
							}}
						>
							{/* Rank badge */}
							<span
								className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
								style={{
									background: `color-mix(in srgb, ${accent} 12%, transparent)`,
									color: accent,
								}}
							>
								{i + 1}
							</span>

							{/* Color dot */}
							<span
								className="w-2 h-2 rounded-full flex-shrink-0"
								style={{ background: block.color }}
							/>

							{/* Title */}
							<span
								className="text-xs font-medium flex-1 truncate"
								style={{ color: "var(--ag-text-primary)" }}
							>
								{block.title}
							</span>

							{/* Time */}
							<span
								className="text-[10px] font-mono tabular-nums flex-shrink-0"
								style={{ color: "var(--ag-text-muted)" }}
							>
								{formatHour(block.startHour)}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
