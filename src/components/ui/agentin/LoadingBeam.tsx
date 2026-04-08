/**
 * LoadingBeam — thin 2px gradient bar that sweeps across the top of the page.
 * Like the YouTube/NProgress loader. Used for async operations.
 */

import { cn } from "@/lib/utils";

export interface LoadingBeamProps {
	/** Whether the beam is visible and animating */
	loading?: boolean;
	className?: string;
}

export function LoadingBeam({ loading = true, className }: LoadingBeamProps) {
	if (!loading) return null;

	return (
		<div
			className={cn("fixed top-0 left-0 right-0 z-50 h-0.5", className)}
			aria-hidden="true"
		>
			<div
				className="h-full w-full animate-[loading-beam_1.5s_ease-in-out_infinite]"
				style={{
					background: `linear-gradient(
            to right,
            transparent 0%,
            var(--ag-violet) 30%,
            var(--ag-indigo) 60%,
            var(--ag-coral) 85%,
            transparent 100%
          )`,
					backgroundSize: "60% 100%",
					backgroundRepeat: "no-repeat",
				}}
			/>

			{/* Keyframe via style tag — inserted once */}
			<style>{`
        @keyframes loading-beam {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
		</div>
	);
}
