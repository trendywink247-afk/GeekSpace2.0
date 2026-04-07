// inbox/MessageListItem.tsx — dense list row: Superhuman × Linear × landing aesthetic
// Glass card, swipe-left for actions, unread violet dot, mono timestamp.
// Mobile-first 430 → 360 px.

import { AnimatePresence, motion } from "framer-motion";
import { Archive, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "./helpers";
import { formatTime, PRIORITY_PILL, SOURCE_LABELS } from "./helpers";

// ─── Sender Avatar ────────────────────────────────────────────────────────────
// rounded-full, violet gradient fallback matching landing agent avatars

const AVATAR_GRADIENT: Record<string, string> = {
	telegram: "from-[#8B5CF6] to-[#6366F1]",
	whatsapp: "from-[#10B981] to-[#059669]",
	system: "from-[#374151] to-[#1F2937]",
};

function SenderAvatar({
	msg,
	isUnread,
}: {
	msg: InboxMessage;
	isUnread: boolean;
}) {
	const initial = (msg.sender ?? msg.source).charAt(0).toUpperCase();
	const gradient = AVATAR_GRADIENT[msg.source] ?? "from-[#8B5CF6] to-[#A78BFA]";

	return (
		<div className="relative shrink-0">
			{/* Circle avatar — landing agent aesthetic */}
			<div
				className={cn(
					"w-9 h-9 rounded-full flex items-center justify-center",
					"bg-gradient-to-br",
					gradient,
					"text-white text-sm font-bold select-none",
					!isUnread && "opacity-50",
				)}
				style={{ fontFamily: "Syne, sans-serif" }}
			>
				{initial}
			</div>

			{/* Unread dot — violet, 6 px, bottom-right */}
			{isUnread && (
				<span
					aria-hidden
					className={cn(
						"absolute -bottom-0.5 -right-0.5",
						"w-[7px] h-[7px] rounded-full",
						"bg-[#8B5CF6]",
						"ring-[1.5px] ring-[#06061a]",
					)}
				/>
			)}
		</div>
	);
}

// ─── Swipe-reveal Actions ─────────────────────────────────────────────────────
// Green archive (#10B981), Red delete (#FF2D78) — landing palette

interface SwipeActionsProps {
	onArchive: () => void;
	onDelete: () => void;
	visible: boolean;
}

function SwipeActions({ onArchive, onDelete, visible }: SwipeActionsProps) {
	return (
		<AnimatePresence>
			{visible && (
				<motion.div
					key="swipe-actions"
					initial={{ opacity: 0, x: 20 }}
					animate={{
						opacity: 1,
						x: 0,
						transition: { duration: 0.13, ease: "easeOut" },
					}}
					exit={{ opacity: 0, x: 20, transition: { duration: 0.1 } }}
					className="absolute right-0 inset-y-0 flex items-center gap-1.5 px-3"
					// Prevent row tap from firing
					onPointerDown={(e) => e.stopPropagation()}
				>
					<button
						type="button"
						onClick={onArchive}
						aria-label="Archive message"
						className={cn(
							"flex items-center justify-center w-10 h-10 rounded-xl",
							"bg-[#10B981]/15 text-[#10B981]",
							"hover:bg-[#10B981]/25 active:scale-95",
							"transition-all duration-100",
						)}
					>
						<Archive className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={onDelete}
						aria-label="Delete message"
						className={cn(
							"flex items-center justify-center w-10 h-10 rounded-xl",
							"bg-[#FF2D78]/15 text-[#FF2D78]",
							"hover:bg-[#FF2D78]/25 active:scale-95",
							"transition-all duration-100",
						)}
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MessageListItemProps {
	msg: InboxMessage;
	isSelected: boolean;
	isFocused: boolean;
	staggerDelay: number;
	onSelect: () => void;
	onArchive: () => void;
	onDelete: () => void;
	itemRef: (el: HTMLDivElement | null) => void;
}

// ─── Swipe constants ──────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 56; // px to commit swipe
const SWIPE_MAX_DRAG = 120; // clamp drag distance

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageListItem({
	msg,
	isSelected,
	isFocused,
	staggerDelay,
	onSelect,
	onArchive,
	onDelete,
	itemRef,
}: MessageListItemProps) {
	const isUnread = msg.read === 0;
	const priPill = PRIORITY_PILL[msg.priority] ?? PRIORITY_PILL.normal;

	// ── Swipe state ──
	const touchStart = useRef<{ x: number; y: number } | null>(null);
	const dragging = useRef(false);
	const [dragX, setDragX] = useState(0);
	const [actionsOpen, setActionsOpen] = useState(false);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			// Only track primary pointer; ignore if actions already open
			if (actionsOpen) return;
			touchStart.current = { x: e.clientX, y: e.clientY };
			dragging.current = false;
		},
		[actionsOpen],
	);

	const handlePointerMove = useCallback((e: React.PointerEvent) => {
		if (!touchStart.current) return;
		const dx = e.clientX - touchStart.current.x;
		const dy = Math.abs(e.clientY - touchStart.current.y);
		// Abort if primary scroll intent
		if (dy > 10 && !dragging.current) {
			touchStart.current = null;
			return;
		}
		if (dx < -4) {
			dragging.current = true;
			// Clamp and apply rubber-band feel
			const raw = Math.max(dx, -SWIPE_MAX_DRAG);
			const eased =
				raw < -SWIPE_THRESHOLD
					? -SWIPE_THRESHOLD + (raw + SWIPE_THRESHOLD) * 0.25
					: raw;
			setDragX(eased);
		}
	}, []);

	const commitSwipe = useCallback(() => {
		if (dragX < -SWIPE_THRESHOLD) {
			setActionsOpen(true);
		}
		touchStart.current = null;
		dragging.current = false;
		setDragX(0);
	}, [dragX]);

	const cancelSwipe = useCallback(() => {
		touchStart.current = null;
		dragging.current = false;
		setDragX(0);
	}, []);

	const handleArchive = useCallback(() => {
		setActionsOpen(false);
		onArchive();
	}, [onArchive]);

	const handleDelete = useCallback(() => {
		setActionsOpen(false);
		onDelete();
	}, [onDelete]);

	const handleRowClick = useCallback(() => {
		if (actionsOpen) {
			setActionsOpen(false);
			return;
		}
		if (dragging.current) return;
		onSelect();
	}, [actionsOpen, onSelect]);

	// ── Priority left-border classes ──
	const priorityAccent =
		msg.priority === "urgent"
			? "border-l-[3px] border-l-[#FF2D78]"
			: msg.priority === "high"
				? "border-l-[3px] border-l-[#F59E0B]"
				: "border-l-[3px] border-l-transparent";

	return (
		<motion.div
			ref={itemRef}
			layout
			initial={{ opacity: 0, y: 10 }}
			animate={{
				opacity: 1,
				y: 0,
				transition: {
					type: "spring",
					duration: 0.38,
					bounce: 0,
					delay: staggerDelay,
				},
			}}
			exit={{
				opacity: 0,
				x: -24,
				transition: { duration: 0.16, ease: "easeIn" },
			}}
			className="relative overflow-hidden"
		>
			{/* Swipe actions sit behind the row */}
			<SwipeActions
				visible={actionsOpen}
				onArchive={handleArchive}
				onDelete={handleDelete}
			/>

			{/* ── Main row ── */}
			<motion.div
				role="button"
				tabIndex={0}
				aria-selected={isSelected}
				aria-label={`${isUnread ? "Unread message" : "Message"} from ${msg.sender ?? msg.source}`}
				// Pointer / swipe
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={commitSwipe}
				onPointerCancel={cancelSwipe}
				// Click
				onClick={handleRowClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onSelect();
					}
					if (e.key === "Escape") setActionsOpen(false);
				}}
				// Animated drag offset
				animate={{ x: dragX }}
				transition={{ type: "spring", duration: 0.18, bounce: 0 }}
				className={cn(
					// Layout
					"relative flex items-start gap-3 px-4 py-3.5",
					// Interaction
					"cursor-pointer select-none outline-none",
					"[touch-action:pan-y]",
					// Glass card — landing page exact spec
					"bg-white/[0.02] backdrop-blur-sm",
					"border-b border-white/[0.06]",
					// Priority left accent
					priorityAccent,
					// Selected highlight
					isSelected && "bg-[#8B5CF6]/[0.07] border-b-[#8B5CF6]/20",
					// Focus ring
					isFocused && "ring-inset ring-1 ring-[#8B5CF6]/30",
					// Hover
					"hover:bg-white/[0.04]",
					// Read/unread dim
					!isUnread && "opacity-60",
					// Tap
					"active:bg-white/[0.06]",
				)}
				style={{ WebkitTapHighlightColor: "transparent" }}
			>
				{/* Avatar */}
				<SenderAvatar msg={msg} isUnread={isUnread} />

				{/* Content */}
				<div className="flex-1 min-w-0">
					{/* Row 1: sender + badge chips + timestamp */}
					<div className="flex items-center gap-1.5 mb-1">
						<span
							className={cn(
								"text-[13px] truncate",
								isUnread
									? "font-semibold text-[#F1F5F9]"
									: "font-medium text-[#94A3B8]",
							)}
							style={{ fontFamily: "Syne, sans-serif" }}
						>
							{msg.sender ?? msg.source}
						</span>

						{/* Source chip */}
						<span
							className={cn(
								"shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.1em]",
								"px-1.5 py-0.5 rounded-full",
								msg.source === "telegram"
									? "bg-[#8B5CF6]/12 text-[#8B5CF6]"
									: msg.source === "whatsapp"
										? "bg-[#10B981]/12 text-[#10B981]"
										: "bg-white/[0.06] text-[#94A3B8]/70",
							)}
						>
							{SOURCE_LABELS[msg.source] ?? msg.source}
						</span>

						{/* Priority chip — urgent / high only */}
						{msg.priority !== "normal" && (
							<span
								className={cn(
									"shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.1em]",
									"px-1.5 py-0.5 rounded-full",
									priPill,
								)}
							>
								{msg.priority}
							</span>
						)}

						{/* Timestamp — mono, right */}
						<span className="ml-auto shrink-0 font-mono text-[10px] text-[#94A3B8]/50 tabular-nums">
							{formatTime(msg.received_at)}
						</span>
					</div>

					{/* Row 2: preview snippet */}
					<p
						className={cn(
							"text-[12px] leading-[1.5] line-clamp-2",
							isUnread ? "text-[#CBD5E1]" : "text-[#6B7280]",
						)}
					>
						{msg.summary ?? msg.content}
					</p>
				</div>
			</motion.div>
		</motion.div>
	);
}
