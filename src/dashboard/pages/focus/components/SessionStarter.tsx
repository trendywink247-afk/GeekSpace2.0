// ============================================================
// SessionStarter — idle state: duration picker + CTA
// Aurora: coral for "Start Now" CTA, violet selected duration
// ============================================================

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { GlassCard } from "@/components/ui/agentin";
import { DURATIONS, pad } from "../helpers";
import { TimerRing } from "./FocusTimer";

export interface SessionStarterProps {
	durInput: number;
	setDurInput: (v: number) => void;
	onOpenModal: () => void;
}

export function SessionStarter({
	durInput,
	setDurInput,
	onOpenModal,
}: SessionStarterProps) {
	return (
		<GlassCard className="p-6">
			<div className="text-center space-y-5">
				{/* Idle ring showing selected duration */}
				<TimerRing progress={0} size={200} strokeWidth={9} accent="violet">
					<div>
						<div
							className="text-3xl font-mono font-bold"
							style={{
								color: "rgba(167,139,250,0.35)",
								fontVariantNumeric: "tabular-nums",
							}}
						>
							{pad(durInput)}:00
						</div>
						<div
							className="text-xs mt-1 font-mono uppercase tracking-widest"
							style={{ color: "var(--ag-text-muted)" }}
						>
							ready
						</div>
					</div>
				</TimerRing>

				{/* Duration selector */}
				<div className="grid grid-cols-4 gap-2">
					{DURATIONS.map((d) => {
						const isSelected = durInput === d.value;
						return (
							<motion.button
								key={d.value}
								onClick={() => setDurInput(d.value)}
								whileTap={{ scale: 0.93 }}
								className="rounded-2xl p-2.5 text-center transition-all duration-200
                  focus-visible:ring-2 focus-visible:outline-none min-h-[52px]"
								style={{
									background: isSelected
										? "rgba(139,92,246,0.14)"
										: "var(--ag-bg-surface)",
									color: isSelected
										? "var(--ag-violet-soft)"
										: "var(--ag-text-secondary)",
									border: `1px solid ${isSelected ? "rgba(139,92,246,0.35)" : "var(--ag-border-subtle)"}`,
									boxShadow: isSelected
										? "0 0 14px rgba(139,92,246,0.12)"
										: "none",
								}}
							>
								<div
									className="text-lg font-bold font-heading"
									style={{ fontVariantNumeric: "tabular-nums" }}
								>
									{d.label}
								</div>
								<div className="text-[10px] mt-0.5 opacity-70">{d.desc}</div>
							</motion.button>
						);
					})}
				</div>

				{/* CTA — coral per Aurora spec */}
				<motion.button
					onClick={onOpenModal}
					whileTap={{ scale: 0.96 }}
					className="h-14 px-10 rounded-2xl text-base font-semibold
            focus-visible:ring-2 focus-visible:outline-none
            flex items-center justify-center gap-2.5 mx-auto
            transition-all duration-200"
					style={{
						background:
							"linear-gradient(135deg, var(--ag-coral), var(--ag-amber))",
						color: "#0d0d1a",
						boxShadow:
							"0 0 0 1px rgba(251,146,60,0.25), 0 6px 20px rgba(251,146,60,0.22)",
					}}
				>
					<Play size={18} className="ml-0.5 flex-shrink-0" />
					Start Focus
				</motion.button>
			</div>
		</GlassCard>
	);
}
