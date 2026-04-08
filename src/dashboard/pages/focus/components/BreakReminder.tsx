// ============================================================
// BreakReminder — post-session break suggestion card
// Aurora: emerald accent for "session complete" positivity
// ============================================================

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/agentin";
import { Button } from "@/components/ui/button";
import { getRandomBreakTip } from "../helpers";

export interface BreakReminderProps {
	onDismiss: () => void;
}

export function BreakReminder({ onDismiss }: BreakReminderProps) {
	const [tip] = useState(getRandomBreakTip);

	return (
		<motion.div
			initial={{ opacity: 0, y: 14, scale: 0.97 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: "spring", duration: 0.4, bounce: 0 }}
		>
			<GlassCard accent="emerald" className="p-6 text-center space-y-4">
				{/* Icon */}
				<div
					className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
					style={{
						background: "rgba(16,185,129,0.12)",
						border: "1px solid rgba(16,185,129,0.2)",
					}}
				>
					<Zap size={22} style={{ color: "var(--ag-emerald)" }} />
				</div>

				{/* Copy */}
				<div className="space-y-1.5">
					<p
						className="text-sm font-semibold font-heading"
						style={{ color: "var(--ag-text-primary)" }}
					>
						Session complete! 🎉
					</p>
					<p
						className="text-sm leading-relaxed"
						style={
							{
								color: "var(--ag-text-secondary)",
								textWrap: "pretty",
							} as React.CSSProperties
						}
					>
						{tip}
					</p>
				</div>

				{/* Dismiss */}
				<motion.div whileTap={{ scale: 0.96 }}>
					<Button
						size="sm"
						variant="ghost"
						onClick={onDismiss}
						className="min-h-[44px] rounded-xl font-medium"
						style={{ color: "var(--ag-emerald)" }}
					>
						Got it, thanks
					</Button>
				</motion.div>
			</GlassCard>
		</motion.div>
	);
}
