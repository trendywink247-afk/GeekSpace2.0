// inbox/ThreadView.tsx — full message thread panel
// Mobile: fixed full-screen slide-in overlay (x: 100% → 0)
// md+: right-pane of split layout (flex-1, border-l)
// Sticky header (MobilePageHeader), sticky reply bar at bottom.

import { AnimatePresence, motion } from "framer-motion";
import {
	Archive,
	Clock,
	Eye,
	EyeOff,
	Send,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useRef } from "react";
import { MobilePageHeader } from "@/components/mobile";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "./helpers";
import { formatTime, PRIORITY_PILL, SOURCE_LABELS } from "./helpers";

// ─── Source colour map (threads use a bubble tint) ────────────────────────────

const SOURCE_BG: Record<string, string> = {
	telegram: "bg-[#8B5CF6]/[0.08] border-[#8B5CF6]/20",
	whatsapp: "bg-[#10B981]/[0.08] border-[#10B981]/20",
	system: "bg-white/[0.04] border-white/[0.08]",
};

// ─── Triage Eyebrow Banner ────────────────────────────────────────────────────

function TriageBanner({ msg }: { msg: InboxMessage }) {
	const priPill = PRIORITY_PILL[msg.priority] ?? PRIORITY_PILL.normal;

	return (
		<div
			className={cn(
				"flex items-center gap-3 px-4 py-3",
				"border-b border-white/[0.06]",
				"bg-white/[0.02]",
			)}
		>
			{/* Aria badge */}
			<div className="w-7 h-7 rounded-lg bg-[#FF6B9D]/10 flex items-center justify-center shrink-0">
				<Sparkles className="w-3.5 h-3.5 text-[#FF6B9D]" />
			</div>

			<div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
				{/* mono eyebrow */}
				<span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/60">
					AI Triage
				</span>

				{/* Source chip */}
				<span
					className={cn(
						"font-mono text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full",
						msg.source === "telegram"
							? "bg-[#8B5CF6]/12 text-[#8B5CF6]"
							: msg.source === "whatsapp"
								? "bg-[#10B981]/12 text-[#10B981]"
								: "bg-white/[0.06] text-[#94A3B8]/70",
					)}
				>
					{SOURCE_LABELS[msg.source] ?? msg.source}
				</span>

				{/* Priority */}
				{msg.priority !== "normal" && (
					<span
						className={cn(
							"font-mono text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full",
							priPill,
						)}
					>
						{msg.priority}
					</span>
				)}

				{/* Time — mono right */}
				<span className="ml-auto font-mono text-[10px] text-[#94A3B8]/50 tabular-nums shrink-0">
					{formatTime(msg.received_at)}
				</span>
			</div>
		</div>
	);
}

// ─── AI Suggestion Box ────────────────────────────────────────────────────────

function AISuggestion({ text, onUse }: { text: string; onUse: () => void }) {
	return (
		<div
			className={cn(
				"rounded-xl border px-4 py-3 mx-4 mb-4",
				"bg-[#8B5CF6]/[0.06] border-[#8B5CF6]/20",
			)}
		>
			<div className="flex items-center gap-2 mb-2">
				<Sparkles className="w-3 h-3 text-[#8B5CF6] shrink-0" />
				<span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8B5CF6]/80">
					AI Suggested Reply
				</span>
			</div>
			<p className="text-[13px] text-[#CBD5E1] leading-relaxed mb-3">{text}</p>
			<button
				type="button"
				onClick={onUse}
				className={cn(
					"text-[11px] font-semibold font-mono uppercase tracking-[0.1em]",
					"text-[#8B5CF6] hover:text-[#A78BFA]",
					"transition-colors duration-150",
				)}
			>
				Use this reply →
			</button>
		</div>
	);
}

// ─── Reply Bar (sticky bottom) ────────────────────────────────────────────────

interface ReplyBarProps {
	canReply: boolean;
	replyText: string;
	isSending: boolean;
	onChange: (v: string) => void;
	onSend: () => void;
}

function ReplyBar({
	canReply,
	replyText,
	isSending,
	onChange,
	onSend,
}: ReplyBarProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	if (!canReply) return null;

	return (
		<div
			className={cn(
				"sticky bottom-0 z-10",
				"border-t border-white/[0.06]",
				"bg-[rgba(6,6,26,0.92)] backdrop-blur-xl",
				"px-4 py-3",
				"pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
			)}
		>
			<div className="flex items-end gap-2">
				<textarea
					ref={textareaRef}
					value={replyText}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={(e) => {
						// Cmd/Ctrl + Enter → send
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							if (replyText.trim()) onSend();
						}
					}}
					placeholder="Type a reply…"
					rows={1}
					className={cn(
						"flex-1 resize-none min-h-[40px] max-h-[120px]",
						"rounded-xl px-3 py-2.5",
						"text-[13px] text-[#F1F5F9] placeholder-[#6B7280]",
						"bg-white/[0.04] border border-white/[0.08]",
						"focus:outline-none focus:border-[#8B5CF6]/40 focus:bg-white/[0.06]",
						"transition-[border-color,background-color] duration-150",
					)}
					style={{
						// auto-grow via JS
						fieldSizing: "content" as React.CSSProperties["fieldSizing"],
					}}
				/>
				<button
					type="button"
					onClick={onSend}
					disabled={isSending || !replyText.trim()}
					aria-label="Send reply"
					className={cn(
						"shrink-0 flex items-center justify-center gap-1.5",
						"h-10 px-3.5 rounded-xl",
						"text-[12px] font-semibold",
						"bg-[#8B5CF6] hover:bg-[#7C3AED] text-white",
						"disabled:opacity-30 disabled:pointer-events-none",
						"transition-all duration-150",
						"active:scale-95",
					)}
					style={{
						boxShadow: replyText.trim()
							? "0 2px 8px rgba(139,92,246,0.3), 0 0 0 1px rgba(139,92,246,0.3)"
							: "none",
					}}
				>
					<Send className="w-3.5 h-3.5" />
					<span className="hidden sm:inline">
						{isSending ? "Sending…" : "Send"}
					</span>
				</button>
			</div>
			<p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#94A3B8]/40">
				{replyText.trim() ? "⌘↵ to send" : "Write a reply"}
			</p>
		</div>
	);
}

// ─── Action Toolbar ───────────────────────────────────────────────────────────

interface ThreadActionsProps {
	msg: InboxMessage;
	onMarkRead: () => void;
	onArchive: () => void;
	onDelete: () => void;
}

function ThreadActions({
	msg,
	onMarkRead,
	onArchive,
	onDelete,
}: ThreadActionsProps) {
	const isUnread = msg.read === 0;
	return (
		<div
			className={cn(
				"flex items-center gap-0.5 px-3 py-2",
				"border-b border-white/[0.06]",
			)}
		>
			<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#94A3B8]/40 mr-2">
				Actions
			</span>

			<ActionBtn
				onClick={onMarkRead}
				label={isUnread ? "Mark read" : "Mark unread"}
			>
				{isUnread ? (
					<Eye className="w-3.5 h-3.5" />
				) : (
					<EyeOff className="w-3.5 h-3.5" />
				)}
			</ActionBtn>
			<ActionBtn
				onClick={onArchive}
				label="Archive"
				hoverColor="text-[#10B981] hover:bg-[#10B981]/10"
			>
				<Archive className="w-3.5 h-3.5" />
			</ActionBtn>
			<ActionBtn
				onClick={() => {
					/* snooze */
				}}
				label="Snooze"
				hoverColor="text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
			>
				<Clock className="w-3.5 h-3.5" />
			</ActionBtn>
			<ActionBtn
				onClick={onDelete}
				label="Delete"
				hoverColor="text-[#FF2D78] hover:bg-[#FF2D78]/10"
			>
				<Trash2 className="w-3.5 h-3.5" />
			</ActionBtn>
		</div>
	);
}

function ActionBtn({
	onClick,
	label,
	children,
	hoverColor = "text-[#10B981] hover:bg-[#10B981]/10",
}: {
	onClick: () => void;
	label: string;
	children: React.ReactNode;
	hoverColor?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className={cn(
				"flex items-center justify-center w-9 h-9 rounded-xl",
				"text-[#94A3B8]/60",
				hoverColor,
				"transition-all duration-150",
			)}
		>
			{children}
		</button>
	);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ThreadViewProps {
	msg: InboxMessage | null;
	replyText: string;
	isSending: boolean;
	/** Mobile: whether the panel is visible as an overlay */
	mobileOpen: boolean;
	onClose: () => void;
	onMarkRead: (id: number) => void;
	onArchive: (id: number) => void;
	onDelete: (id: number) => void;
	onReplyChange: (id: number, text: string) => void;
	onSendReply: (msg: InboxMessage) => void;
	onUseSuggestion: (id: number, suggestion: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThreadView({
	msg,
	replyText,
	isSending,
	mobileOpen,
	onClose,
	onMarkRead,
	onArchive,
	onDelete,
	onReplyChange,
	onSendReply,
	onUseSuggestion,
}: ThreadViewProps) {
	const canReply =
		!!msg && (msg.source === "telegram" || msg.source === "whatsapp");
	const sourceBg = msg ? (SOURCE_BG[msg.source] ?? SOURCE_BG.system) : "";

	// ── Desktop (md+): always rendered, hidden until msg selected
	// ── Mobile: AnimatePresence slide-in overlay
	return (
		<>
			{/* ── MOBILE overlay ── */}
			<AnimatePresence>
				{mobileOpen && msg && (
					<motion.div
						key="thread-mobile"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", duration: 0.38, bounce: 0 }}
						className={cn(
							"md:hidden",
							"fixed inset-0 z-50",
							"flex flex-col",
							"bg-[#06061a]",
						)}
					>
						<ThreadContent
							msg={msg}
							canReply={canReply}
							replyText={replyText}
							isSending={isSending}
							sourceBg={sourceBg}
							onBack={onClose}
							onMarkRead={() => onMarkRead(msg.id)}
							onArchive={() => {
								onArchive(msg.id);
								onClose();
							}}
							onDelete={() => {
								onDelete(msg.id);
								onClose();
							}}
							onReplyChange={(v) => onReplyChange(msg.id, v)}
							onSendReply={() => onSendReply(msg)}
							onUseSuggestion={() =>
								onUseSuggestion(msg.id, msg.suggested_reply ?? "")
							}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── DESKTOP pane ── */}
			<div
				className={cn(
					"hidden md:flex flex-col",
					"flex-1 min-w-0",
					"border-l border-white/[0.06]",
					"bg-[#06061a]",
					"min-h-full",
				)}
			>
				{msg ? (
					<ThreadContent
						msg={msg}
						canReply={canReply}
						replyText={replyText}
						isSending={isSending}
						sourceBg={sourceBg}
						onBack={onClose}
						onMarkRead={() => onMarkRead(msg.id)}
						onArchive={() => {
							onArchive(msg.id);
							onClose();
						}}
						onDelete={() => {
							onDelete(msg.id);
							onClose();
						}}
						onReplyChange={(v) => onReplyChange(msg.id, v)}
						onSendReply={() => onSendReply(msg)}
						onUseSuggestion={() =>
							onUseSuggestion(msg.id, msg.suggested_reply ?? "")
						}
					/>
				) : (
					// Desktop empty state when nothing selected
					<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
						<div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
							<Sparkles className="w-5 h-5 text-[#8B5CF6]/40" />
						</div>
						<p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/40">
							Select a message
						</p>
						<p className="text-[12px] text-[#6B7280] max-w-[200px] leading-relaxed">
							Tap a message from the list to read it here
						</p>
					</div>
				)}
			</div>
		</>
	);
}

// ─── ThreadContent (shared between mobile overlay + desktop pane) ─────────────

interface ThreadContentProps {
	msg: InboxMessage;
	canReply: boolean;
	replyText: string;
	isSending: boolean;
	sourceBg: string;
	onBack: () => void;
	onMarkRead: () => void;
	onArchive: () => void;
	onDelete: () => void;
	onReplyChange: (v: string) => void;
	onSendReply: () => void;
	onUseSuggestion: () => void;
}

function ThreadContent({
	msg,
	canReply,
	replyText,
	isSending,
	sourceBg,
	onBack,
	onMarkRead,
	onArchive,
	onDelete,
	onReplyChange,
	onSendReply,
	onUseSuggestion,
}: ThreadContentProps) {
	return (
		<div className="flex flex-col h-full">
			{/* Sticky header */}
			<MobilePageHeader
				title={msg.sender ?? msg.source}
				subtitle={`${SOURCE_LABELS[msg.source] ?? msg.source} · ${formatTime(msg.received_at)}`}
				onBack={onBack}
				className="shrink-0"
			/>

			{/* Action toolbar */}
			<ThreadActions
				msg={msg}
				onMarkRead={onMarkRead}
				onArchive={onArchive}
				onDelete={onDelete}
			/>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto overscroll-contain">
				{/* Triage banner */}
				<TriageBanner msg={msg} />

				{/* Message bubble — landing glass card style */}
				<div className={cn("mx-4 my-4 rounded-2xl border p-4", sourceBg)}>
					{/* Subject / summary header */}
					{msg.summary && msg.summary !== msg.content && (
						<p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/60 mb-3">
							Summary
						</p>
					)}
					{msg.summary && msg.summary !== msg.content && (
						<p className="text-[13px] text-[#CBD5E1] leading-relaxed mb-4 pb-4 border-b border-white/[0.06]">
							{msg.summary}
						</p>
					)}

					{/* Full content */}
					<p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/60 mb-2">
						Full Message
					</p>
					<p className="text-[13px] text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
						{msg.content}
					</p>
				</div>

				{/* AI suggested reply */}
				{msg.suggested_reply && (
					<AISuggestion text={msg.suggested_reply} onUse={onUseSuggestion} />
				)}

				{/* Bottom spacer so content isn't hidden by reply bar */}
				<div className="h-4" />
			</div>

			{/* Sticky reply bar */}
			<ReplyBar
				canReply={canReply}
				replyText={replyText}
				isSending={isSending}
				onChange={onReplyChange}
				onSend={onSendReply}
			/>
		</div>
	);
}
