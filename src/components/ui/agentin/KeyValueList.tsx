/**
 * KeyValueList — labeled rows: label left, value right.
 * Used in detail views, info panels, and metadata displays.
 */

import { cn } from "@/lib/utils";

export interface KeyValueItem {
	label: string;
	value: string | number;
	mono?: boolean;
}

export interface KeyValueListProps {
	items: KeyValueItem[];
	className?: string;
}

export function KeyValueList({ items, className }: KeyValueListProps) {
	return (
		<div
			className={cn("flex flex-col divide-y", className)}
			style={{ borderColor: "var(--ag-border-subtle)" }}
		>
			{items.map((item) => (
				<div
					key={item.label}
					className="flex items-center justify-between gap-4 py-2.5 px-1"
				>
					<span
						className="text-xs flex-shrink-0"
						style={{ color: "var(--ag-text-muted)" }}
					>
						{item.label}
					</span>
					<span
						className={cn(
							"text-xs text-right min-w-0 break-all",
							item.mono && "font-mono",
						)}
						style={{ color: "var(--ag-text-primary)" }}
					>
						{item.value}
					</span>
				</div>
			))}
		</div>
	);
}
