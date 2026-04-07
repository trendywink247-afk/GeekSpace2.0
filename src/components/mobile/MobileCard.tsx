/**
 * MobileCard — rounded-2xl card with tap states and glass backdrop.
 * Adapts to dark/light via CSS vars. Safe to use anywhere on mobile.
 */

import { cn } from "@/lib/utils";

interface MobileCardProps {
	children: React.ReactNode;
	/** Tap / click handler — adds active press scale when provided */
	onPress?: () => void;
	className?: string;
	/** Remove horizontal margin (for full-bleed edge-to-edge cards) */
	fullBleed?: boolean;
	/** Disable the default padding */
	noPadding?: boolean;
	/** Disable hover/tap visual states (static display card) */
	static?: boolean;
}

export function MobileCard({
	children,
	onPress,
	className,
	fullBleed = false,
	noPadding = false,
	static: isStatic = false,
}: MobileCardProps) {
	const isInteractive = !isStatic && !!onPress;

	const cardCls = cn(
		// Shape
		"rounded-2xl",
		// Glass surface
		"bg-[var(--ag-bg-surface)] backdrop-blur-xl",
		"border border-[var(--ag-border-subtle)]",
		// Default padding
		!noPadding && "p-4",
		// Horizontal margin (unless full-bleed)
		!fullBleed && "mx-4",
		// Interactive states
		isInteractive && [
			"cursor-pointer select-none",
			"transition-all duration-150",
			"hover:border-[var(--ag-border-default)]",
			"hover:bg-[var(--ag-bg-surface-hover)]",
			"active:scale-[0.98]",
			"active:border-[var(--ag-border-glow)]",
			"-webkit-tap-highlight-color: transparent",
		],
		className,
	);

	if (onPress) {
		return (
			<button
				type="button"
				onClick={onPress}
				className={cardCls}
				style={{
					WebkitTapHighlightColor: "transparent",
					textAlign: "left",
					width: "100%",
				}}
			>
				{children}
			</button>
		);
	}

	return <div className={cardCls}>{children}</div>;
}
