// inbox/InboxSkeleton.tsx — list-item shaped skeletons matching MessageListItem layout
// Uses landing glass card style (border border-white/[0.06] bg-white/[0.02]).
import { motion } from "framer-motion";

function ItemSkeleton({ delay }: { delay: number }) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1, transition: { duration: 0.3, delay } }}
			className="flex items-start gap-3 px-4 py-3.5 border-b border-white/[0.06] animate-pulse"
		>
			{/* Avatar circle */}
			<div className="w-9 h-9 rounded-full bg-white/[0.06] shrink-0" />

			{/* Content */}
			<div className="flex-1 min-w-0 space-y-2 pt-0.5">
				{/* Row 1: sender + timestamp */}
				<div className="flex items-center gap-2">
					<div className="h-3 w-28 rounded-full bg-white/[0.07]" />
					<div className="h-3 w-10 rounded-full bg-white/[0.05]" />
					<div className="ml-auto h-2.5 w-12 rounded-full bg-white/[0.04]" />
				</div>
				{/* Row 2: preview line 1 */}
				<div className="h-2.5 w-full rounded-full bg-white/[0.05]" />
				{/* Row 3: preview line 2 (shorter) */}
				<div className="h-2.5 w-3/5 rounded-full bg-white/[0.04]" />
			</div>
		</motion.div>
	);
}

interface InboxSkeletonProps {
	count?: number;
}

export function InboxSkeleton({ count = 4 }: InboxSkeletonProps) {
	return (
		<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mx-0">
			{Array.from({ length: count }).map((_, i) => (
				<ItemSkeleton key={`skel-${i}`} delay={i * 0.06} />
			))}
		</div>
	);
}
