// inbox/MessageList.tsx — list shell using MessageListItem (Phase 1 revamp)
// Triage banner + InboxSkeleton + InboxEmptyState + staggered AnimatePresence list.

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "./helpers";
import { FADE_UP, SPRING } from "./helpers";
import { InboxEmptyState } from "./InboxEmptyState";
import { InboxSkeleton } from "./InboxSkeleton";
import { MessageListItem } from "./MessageListItem";

// ─── Triage Summary Banner ────────────────────────────────────────────────────

function TriageSummary({ messages }: { messages: InboxMessage[] }) {
	const total = messages.length;
	const unread = messages.filter((m) => m.read === 0).length;
	const urgent = messages.filter((m) => m.priority === "urgent").length;
	const withAI = messages.filter(
		(m) => !!m.suggested_reply && m.read === 0,
	).length;

	if (total === 0) return null;

	return (
		<motion.div
			variants={FADE_UP}
			className={cn(
				"flex items-start gap-3 px-4 py-3.5",
				"border-b border-white/[0.06]",
				"bg-gradient-to-r from-[#FF6B9D]/[0.05] to-[#8B5CF6]/[0.05]",
			)}
		>
			{/* Aria icon */}
			<div className="w-7 h-7 rounded-lg bg-[#FF6B9D]/10 flex items-center justify-center shrink-0 mt-0.5">
				<Sparkles className="w-3.5 h-3.5 text-[#FF6B9D]" />
			</div>

			<div className="flex-1 min-w-0">
				{/* Mono eyebrow — landing signature */}
				<p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/60 mb-1.5">
					Aria's Triage
				</p>
				<div className="flex items-center gap-2 flex-wrap">
					{urgent > 0 && (
						<span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#FF2D78]/12 text-[#FF2D78] tabular-nums font-bold">
							{urgent} urgent
						</span>
					)}
					{unread > 0 && (
						<span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/12 text-[#8B5CF6] tabular-nums font-bold">
							{unread} unread
						</span>
					)}
					<span className="font-mono text-[10px] text-[#6B7280] tabular-nums">
						{total} total
					</span>
				</div>
				{withAI > 0 && (
					<p className="text-[11px] text-[#94A3B8]/60 mt-1.5 leading-relaxed">
						AI has {withAI} suggested repl{withAI > 1 ? "ies" : "y"} ready
					</p>
				)}
			</div>
		</motion.div>
	);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MessageListProps {
	messages: InboxMessage[];
	sortedMessages: InboxMessage[];
	loading: boolean;
	selectedId: number | null;
	focusIdx: number;
	onSelect: (id: number, idx: number) => void;
	onMarkRead: (id: number) => void;
	onArchive: (id: number) => void;
	onDelete: (id: number) => void;
	itemRef: (id: number, el: HTMLDivElement | null) => void;
}

// ─── MessageList ──────────────────────────────────────────────────────────────

export function MessageList({
	messages,
	sortedMessages,
	loading,
	selectedId,
	focusIdx,
	onSelect,
	onArchive,
	onDelete,
	itemRef,
}: MessageListProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	return (
		<motion.div
			ref={containerRef}
			initial="hidden"
			animate="visible"
			variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
			className="flex flex-col"
		>
			{/* Loading skeletons */}
			{loading && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1, transition: { ...SPRING, duration: 0.25 } }}
				>
					<InboxSkeleton count={4} />
				</motion.div>
			)}

			{/* Empty state */}
			{!loading && sortedMessages.length === 0 && (
				<motion.div variants={FADE_UP}>
					<InboxEmptyState />
				</motion.div>
			)}

			{/* Messages */}
			{!loading && sortedMessages.length > 0 && (
				<>
					<TriageSummary messages={messages} />
					<AnimatePresence mode="popLayout">
						{sortedMessages.map((msg, idx) => (
							<MessageListItem
								key={msg.id}
								msg={msg}
								isSelected={selectedId === msg.id}
								isFocused={focusIdx === idx}
								staggerDelay={Math.min(idx * 0.04, 0.3)}
								onSelect={() => onSelect(msg.id, idx)}
								onArchive={() => onArchive(msg.id)}
								onDelete={() => onDelete(msg.id)}
								itemRef={(el) => itemRef(msg.id, el)}
							/>
						))}
					</AnimatePresence>
				</>
			)}
		</motion.div>
	);
}
