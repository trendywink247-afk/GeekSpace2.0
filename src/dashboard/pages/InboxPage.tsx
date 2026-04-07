// InboxPage.tsx — Phase 1 mobile revamp: split-view + swipe + thread panel
// Owner: Aria (#FF6B9D) · tokens: landing palette via CSS vars

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Inbox } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardPageWrapper } from "@/components/agentin";
import { Kbd } from "@/components/ui/kbd";
import { useAgentCanvas } from "@/hooks/use-agent-canvas";
import api from "@/services/api";
import type { Filter, InboxMessage } from "./inbox/helpers";
import { FAST, priorityWeight, SPRING } from "./inbox/helpers";
import { InboxHeader } from "./inbox/InboxHeader";
import { MessageList } from "./inbox/MessageList";
import { ThreadView } from "./inbox/ThreadView";

// ─── Keyboard Hints ───────────────────────────────────────────────────────────

function KeyboardHints() {
	return (
		<motion.div
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0, transition: SPRING }}
			exit={{ opacity: 0, y: -6, transition: FAST }}
			className="hidden sm:flex items-center justify-center gap-4 py-3 select-none"
		>
			{[
				{ keys: ["J", "K"], label: "navigate" },
				{ keys: ["Enter"], label: "open" },
				{ keys: ["E"], label: "archive" },
				{ keys: ["R"], label: "reply" },
				{ keys: ["Esc"], label: "close" },
			].map(({ keys, label }) => (
				<span key={label} className="inline-flex items-center gap-1">
					{keys.map((k) => (
						<Kbd
							key={k}
							className="bg-white/[0.06] text-[#94A3B8]/60 border-white/[0.08] h-4 min-w-4 text-[10px] font-mono"
						>
							{k}
						</Kbd>
					))}
					<span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#94A3B8]/40 ml-0.5">
						{label}
					</span>
				</span>
			))}
		</motion.div>
	);
}

// ─── InboxPage ────────────────────────────────────────────────────────────────

export function InboxPage({ shell: _shell = true }: { shell?: boolean } = {}) {
	const [messages, setMessages] = useState<InboxMessage[]>([]);
	const [filter, setFilter] = useState<Filter>("all");
	const [loading, setLoading] = useState(false);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [replyMap, setReplyMap] = useState<Record<number, string>>({});
	const [sending, setSending] = useState<number | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [focusIdx, setFocusIdx] = useState(-1);
	const [showKbHints, setShowKbHints] = useState(false);
	const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

	const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const { notifyDone, notifyFail } = useAgentCanvas({
		agent: "aria",
		page: "inbox",
	});

	// ── Data fetching ──────────────────────────────────────────────────────────

	const fetchMessages = useCallback(async () => {
		setLoading(true);
		setErr(null);
		try {
			const params: Record<string, string> = {};
			if (filter === "unread") params.unreadOnly = "true";
			else if (filter === "urgent") params.priority = "urgent";
			else if (filter !== "all") params.source = filter;
			const res = await api.get("/inbox", { params });
			setMessages(res.data.messages ?? []);
		} catch {
			setErr("Failed to load inbox");
		} finally {
			setLoading(false);
		}
	}, [filter]);

	useEffect(() => {
		fetchMessages();
	}, [fetchMessages]);

	// Auto-refresh every 30s
	useEffect(() => {
		const id = setInterval(() => {
			void fetchMessages();
		}, 30_000);
		return () => clearInterval(id);
	}, [fetchMessages]);

	// ── Sorted messages ────────────────────────────────────────────────────────

	const sortedMessages = useMemo(
		() =>
			[...messages].sort((a, b) => {
				if (a.read !== b.read) return a.read - b.read;
				const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
				if (pw !== 0) return pw;
				return b.received_at - a.received_at;
			}),
		[messages],
	);

	// ── Active thread ──────────────────────────────────────────────────────────

	const selectedMsg = useMemo(
		() => messages.find((m) => m.id === selectedId) ?? null,
		[messages, selectedId],
	);

	// ── Actions ────────────────────────────────────────────────────────────────

	const handleMarkRead = useCallback(
		async (id: number) => {
			try {
				await api.patch(`/inbox/${id}/read`);
				setMessages((prev) =>
					prev.map((m) => (m.id === id ? { ...m, read: 1 } : m)),
				);
				void notifyDone("message marked as read");
			} catch {
				void notifyFail("failed to mark message read");
			}
		},
		[notifyDone, notifyFail],
	);

	const handleArchive = useCallback(
		async (id: number) => {
			try {
				await api.patch(`/inbox/${id}/archive`);
				setMessages((prev) => prev.filter((m) => m.id !== id));
				if (selectedId === id) {
					setSelectedId(null);
					setMobileThreadOpen(false);
				}
				void notifyDone("message archived");
			} catch {
				void notifyFail("failed to archive message");
			}
		},
		[selectedId, notifyDone, notifyFail],
	);

	const handleDelete = useCallback(
		async (id: number) => {
			try {
				await api.delete(`/inbox/${id}`);
				setMessages((prev) => prev.filter((m) => m.id !== id));
				if (selectedId === id) {
					setSelectedId(null);
					setMobileThreadOpen(false);
				}
				void notifyDone("message deleted");
			} catch {
				void notifyFail("failed to delete message");
			}
		},
		[selectedId, notifyDone, notifyFail],
	);

	const handleReply = useCallback(
		async (msg: InboxMessage) => {
			const text = replyMap[msg.id];
			if (!text?.trim()) return;
			setSending(msg.id);
			try {
				await api.post(`/inbox/${msg.id}/reply`, { text });
				setReplyMap((prev) => {
					const n = { ...prev };
					delete n[msg.id];
					return n;
				});
				void handleMarkRead(msg.id);
				void notifyDone(`reply sent to ${msg.sender ?? msg.source}`);
			} catch {
				setErr("Failed to send reply");
				void notifyFail("failed to send reply");
			} finally {
				setSending(null);
			}
		},
		[replyMap, handleMarkRead, notifyDone, notifyFail],
	);

	// ── Select → open thread ───────────────────────────────────────────────────

	const handleSelect = useCallback(
		(id: number, idx: number) => {
			setSelectedId((prev) => (prev === id ? null : id));
			setFocusIdx(idx);
			setMobileThreadOpen(true);
			// Auto mark-read after short open delay
			const msg = messages.find((m) => m.id === id);
			if (msg && msg.read === 0) {
				setTimeout(() => void handleMarkRead(id), 600);
			}
		},
		[messages, handleMarkRead],
	);

	const handleCloseThread = useCallback(() => {
		setMobileThreadOpen(false);
		// Desktop: keep selected; mobile close clears selection too
		setSelectedId(null);
	}, []);

	// ── Keyboard navigation ────────────────────────────────────────────────────

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			const t = e.target as HTMLElement;
			if (
				t.tagName === "INPUT" ||
				t.tagName === "TEXTAREA" ||
				t.isContentEditable
			)
				return;
			const len = sortedMessages.length;
			if (len === 0) return;

			switch (e.key) {
				case "j":
				case "J": {
					e.preventDefault();
					const next = Math.min(focusIdx + 1, len - 1);
					setFocusIdx(next);
					itemRefs.current
						.get(sortedMessages[next].id)
						?.scrollIntoView({ block: "nearest", behavior: "smooth" });
					break;
				}
				case "k":
				case "K": {
					e.preventDefault();
					const prev = Math.max(focusIdx - 1, 0);
					setFocusIdx(prev);
					itemRefs.current
						.get(sortedMessages[prev].id)
						?.scrollIntoView({ block: "nearest", behavior: "smooth" });
					break;
				}
				case "Enter": {
					if (focusIdx >= 0 && focusIdx < len) {
						e.preventDefault();
						handleSelect(sortedMessages[focusIdx].id, focusIdx);
					}
					break;
				}
				case "Escape": {
					e.preventDefault();
					setMobileThreadOpen(false);
					setSelectedId(null);
					break;
				}
				case "e":
				case "E": {
					if (focusIdx >= 0 && focusIdx < len) {
						e.preventDefault();
						void handleArchive(sortedMessages[focusIdx].id);
					}
					break;
				}
				case "r":
				case "R": {
					if (focusIdx >= 0 && focusIdx < len) {
						e.preventDefault();
						handleSelect(sortedMessages[focusIdx].id, focusIdx);
					}
					break;
				}
				case "?": {
					e.preventDefault();
					setShowKbHints((h) => !h);
					break;
				}
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [focusIdx, sortedMessages, handleArchive, handleSelect]);

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<DashboardPageWrapper>
			{/* ── Sticky InboxHeader ── */}
			<InboxHeader
				filter={filter}
				messages={messages}
				loading={loading}
				showKbHints={showKbHints}
				onFilterChange={(f) => {
					setFilter(f);
					setFocusIdx(-1);
				}}
				onRefresh={() => void fetchMessages()}
				onToggleKbHints={() => setShowKbHints((h) => !h)}
			/>

			{/* ── Error banner ── */}
			<AnimatePresence>
				{err && (
					<motion.div
						key="error"
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0, transition: SPRING }}
						exit={{ opacity: 0, y: -8, transition: FAST }}
						className="flex items-center gap-2.5 mx-4 mt-3 text-[#FF2D78] bg-[#FF2D78]/[0.07] border border-[#FF2D78]/20 rounded-2xl px-4 py-3"
					>
						<AlertCircle className="w-4 h-4 shrink-0" />
						<span className="flex-1 text-[13px] [text-wrap:pretty]">{err}</span>
						<button
							type="button"
							onClick={() => setErr(null)}
							aria-label="Dismiss error"
							className="text-[#FF2D78]/60 hover:text-[#FF2D78] min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors"
						>
							<Check className="w-3.5 h-3.5" />
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── Split layout: list + thread pane ── */}
			{/* Mobile: full-width list, thread slides in as overlay.
          md+: list (w-[380px] fixed) + thread pane (flex-1) side-by-side. */}
			<div className="flex min-h-0 mt-3 pb-24 md:pb-6">
				{/* ── Message list column ── */}
				<div className="w-full md:w-[380px] md:shrink-0 flex flex-col">
					{/* Glass card container — landing exact spec */}
					<div className="mx-4 rounded-2xl overflow-hidden border border-white/[0.06] bg-[#06061a]">
						<MessageList
							messages={messages}
							sortedMessages={sortedMessages}
							loading={loading}
							selectedId={selectedId}
							focusIdx={focusIdx}
							onSelect={handleSelect}
							onMarkRead={(id) => void handleMarkRead(id)}
							onArchive={(id) => void handleArchive(id)}
							onDelete={(id) => void handleDelete(id)}
							itemRef={(id, el) => {
								if (el) itemRefs.current.set(id, el);
								else itemRefs.current.delete(id);
							}}
						/>
					</div>

					{/* Keyboard hints + nudge */}
					<AnimatePresence>
						{showKbHints && <KeyboardHints key="kbhints" />}
					</AnimatePresence>
					{!showKbHints && sortedMessages.length > 0 && (
						<motion.p
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="hidden sm:block text-center font-mono text-[9px] uppercase tracking-[0.15em] text-[#94A3B8]/25 mt-3 select-none"
						>
							Press <span className="text-[#94A3B8]/40">?</span> for shortcuts
						</motion.p>
					)}

					{/* Subtle inbox icon accent when totally empty */}
					{!loading && sortedMessages.length === 0 && filter === "all" && (
						<div className="flex justify-center mt-2">
							<Inbox className="w-3.5 h-3.5 text-[#94A3B8]/15" />
						</div>
					)}
				</div>

				{/* ── Thread pane (desktop right pane + mobile overlay) ── */}
				<ThreadView
					msg={selectedMsg}
					replyText={selectedId != null ? (replyMap[selectedId] ?? "") : ""}
					isSending={selectedId != null && sending === selectedId}
					mobileOpen={mobileThreadOpen}
					onClose={handleCloseThread}
					onMarkRead={(id) => void handleMarkRead(id)}
					onArchive={(id) => void handleArchive(id)}
					onDelete={(id) => void handleDelete(id)}
					onReplyChange={(id, text) =>
						setReplyMap((prev) => ({ ...prev, [id]: text }))
					}
					onSendReply={(msg) => void handleReply(msg)}
					onUseSuggestion={(id, suggestion) =>
						setReplyMap((prev) => ({ ...prev, [id]: suggestion }))
					}
				/>
			</div>
		</DashboardPageWrapper>
	);
}
