/**
 * useReminders — CRUD + card interaction handlers for the Reminders page.
 * Wraps the dashboard store and reminderService, coordinating all server ops
 * and dispatching UI side-effects through the reminders-store.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAgentCanvas } from "@/hooks/use-agent-canvas";
import { reminderService } from "@/services/api";
import { useDashboardStore } from "@/stores/dashboard-store";
import type { Reminder, ReminderPriority } from "@/types";
import type { ParsedReminder } from "@/utils/reminder-parser";
import { useRemindersUI } from "../state/reminders-store";
import type { NewReminderForm } from "../types";

export function useReminders() {
	const {
		reminders,
		addReminder,
		updateReminder,
		toggleReminder,
		snoozeReminder,
		deleteReminder,
		loadReminders,
		bulkSnoozeReminders,
	} = useDashboardStore();

	const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({
		agent: "cal",
		page: "reminders",
	});

	const ui = useRemindersUI();
	const prevActiveCountRef = useRef<number | null>(null);

	// ── Streak ─────────────────────────────────────────────────────────────────
	const streakRef = useRef<{ streak: number } | null>(null);
	useEffect(() => {
		reminderService
			.getStreak()
			.then((res) => {
				streakRef.current = res.data;
			})
			.catch(() => {});
	}, []);

	// ── Celebration banner ─────────────────────────────────────────────────────
	useEffect(() => {
		const active = reminders.filter((r) => !r.completed).length;
		const completed = reminders.filter((r) => r.completed).length;
		if (
			prevActiveCountRef.current !== null &&
			prevActiveCountRef.current > 0 &&
			active === 0 &&
			completed > 0
		) {
			ui.setShowCelebration(true);
			const t = setTimeout(() => ui.setShowCelebration(false), 5000);
			return () => clearTimeout(t);
		}
		prevActiveCountRef.current = active;
	}, [reminders, ui]);

	// ── Polling ────────────────────────────────────────────────────────────────
	useEffect(() => {
		const id = setInterval(() => {
			void loadReminders();
		}, 30_000);
		return () => clearInterval(id);
	}, [loadReminders]);

	// ── Snooze helpers ─────────────────────────────────────────────────────────
	const showSnoozeToast = useCallback(
		(newDatetime: string) => {
			const formatted = new Date(newDatetime).toLocaleString("en", {
				hour: "2-digit",
				minute: "2-digit",
				weekday: "short",
				month: "short",
				day: "numeric",
			});
			ui.setSnoozeToast(`Snoozed until ${formatted}`);
			setTimeout(() => ui.setSnoozeToast(null), 3000);
		},
		[ui],
	);

	// ── Card handlers ──────────────────────────────────────────────────────────
	const handleComplete = useCallback(
		async (id: string) => {
			ui.addCompletingId(id);
			await new Promise((r) => setTimeout(r, 500));
			try {
				await toggleReminder(id);
				void notifyDone("reminder completed");
			} catch {
				void notifyFail("failed to complete reminder");
			}
			ui.removeCompletingId(id);
			ui.addJustCompletedId(id);
			setTimeout(() => ui.removeJustCompletedId(id), 600);
		},
		[toggleReminder, notifyDone, notifyFail, ui],
	);

	const handleDelete = useCallback(
		async (id: string) => {
			try {
				await deleteReminder(id);
				void notifyDone("reminder deleted");
			} catch {
				void notifyFail("failed to delete reminder");
			}
		},
		[deleteReminder, notifyDone, notifyFail],
	);

	const handleDuplicate = useCallback(
		async (id: string) => {
			ui.setDuplicatingId(id);
			try {
				await reminderService.duplicate(id);
				await loadReminders();
			} catch {
				/* non-fatal */
			} finally {
				ui.setDuplicatingId(null);
			}
		},
		[loadReminders, ui],
	);

	const handleSnooze = useCallback(
		async (id: string, preset: "1h" | "tomorrow" | "next-week") => {
			try {
				const res = await reminderService.snooze(id, preset);
				await snoozeReminder(id, res.data.newDatetime);
				showSnoozeToast(res.data.newDatetime);
			} catch {
				/* ignore */
			}
			ui.setSnoozeOpenId(null);
		},
		[snoozeReminder, showSnoozeToast, ui],
	);

	const handleSnoozeCustom = useCallback(
		async (id: string) => {
			if (!ui.snoozeCustomValue) return;
			try {
				const res = await reminderService.snooze(
					id,
					undefined,
					ui.snoozeCustomValue,
				);
				await snoozeReminder(id, res.data.newDatetime);
				showSnoozeToast(res.data.newDatetime);
				ui.setSnoozeCustomId(null);
				ui.setSnoozeCustomValue("");
				ui.setSnoozeOpenId(null);
			} catch {
				/* ignore */
			}
		},
		[snoozeReminder, showSnoozeToast, ui],
	);

	const handleShowSnoozeHistory = useCallback(
		async (id: string) => {
			if (ui.snoozeHistoryId === id) {
				ui.setSnoozeHistoryId(null);
				return;
			}
			ui.setSnoozeHistoryId(id);
			ui.setSnoozeHistoryLoading(true);
			try {
				const res = await reminderService.getSnoozeHistory(id);
				ui.setSnoozeHistory(res.data.history);
			} catch {
				ui.setSnoozeHistory([]);
			} finally {
				ui.setSnoozeHistoryLoading(false);
			}
		},
		[ui],
	);

	const handleInlineEditSave = useCallback(
		async (id: string) => {
			const trimmed = ui.inlineEditValue.trim();
			const original = reminders.find((r) => r.id === id)?.text;
			if (trimmed && trimmed !== original) {
				await updateReminder(id, { text: trimmed }).catch(() => {});
			}
			ui.setInlineEditId(null);
			ui.setInlineEditValue("");
		},
		[reminders, updateReminder, ui],
	);

	const handleUpdatePriority = useCallback(
		(id: string, priority: ReminderPriority) => {
			void updateReminder(id, { priority });
		},
		[updateReminder],
	);

	// ── Edit handlers ──────────────────────────────────────────────────────────
	const handleEditClick = useCallback(
		(reminder: Reminder, skipChoiceDialog = false) => {
			if (reminder.recurrence && !skipChoiceDialog) {
				ui.setRecurringEditChoice(reminder);
				return;
			}
			ui.openComposer(reminder);
		},
		[ui],
	);

	// Form for Add/Edit (managed outside store because it's transient form state)
	const emptyForm: NewReminderForm = {
		text: "",
		datetime: "",
		channel: "telegram",
		recurring: "",
		recurrence: "",
		category: "personal",
		priority: "normal",
	};

	const buildFormFromReminder = useCallback(
		(reminder: Reminder): NewReminderForm => {
			const pad = (n: number) => String(n).padStart(2, "0");
			const d = new Date(reminder.datetime);
			const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
			const validP: ReminderPriority[] = ["low", "normal", "high", "urgent"];
			const safePriority: ReminderPriority = validP.includes(
				reminder.priority as ReminderPriority,
			)
				? (reminder.priority as ReminderPriority)
				: "normal";
			return {
				text: reminder.text,
				datetime: local,
				channel: reminder.channel,
				recurring: reminder.recurring ?? "",
				recurrence:
					(reminder.recurrence as "daily" | "weekly" | "monthly" | undefined) ??
					"",
				category: reminder.category,
				priority: safePriority,
			};
		},
		[],
	);

	// ── CRUD ───────────────────────────────────────────────────────────────────
	const handleEditSave = useCallback(
		async (
			form: NewReminderForm,
			editingReminder: Reminder | null,
			editAsOneOff: boolean,
		) => {
			if (!editingReminder || !form.text || !form.datetime) return;
			if (editAsOneOff) {
				await addReminder({
					text: form.text,
					datetime: new Date(form.datetime).toISOString(),
					channel: form.channel,
					category: form.category,
					priority: form.priority,
				});
			} else {
				await updateReminder(editingReminder.id, {
					text: form.text,
					datetime: new Date(form.datetime).toISOString(),
					channel: form.channel,
					recurring: (form.recurring || undefined) as Reminder["recurring"],
					recurrence: (form.recurrence || undefined) as Reminder["recurrence"],
					category: form.category,
					priority: form.priority,
				});
			}
		},
		[addReminder, updateReminder],
	);

	const handleLegacyAdd = useCallback(
		async (form: NewReminderForm) => {
			if (!form.text || !form.datetime) return;
			void notifyStart("creating reminder");
			try {
				await addReminder({
					text: form.text,
					datetime: form.datetime,
					channel: form.channel,
					recurring: form.recurring || undefined,
					recurrence: form.recurrence || undefined,
					category: form.category,
					priority: form.priority,
				});
				void notifyDone(`reminder created: ${form.text}`);
			} catch {
				void notifyFail("failed to create reminder");
			}
		},
		[addReminder, notifyStart, notifyDone, notifyFail],
	);

	const handleQuickAdd = useCallback(
		async (parsed: ParsedReminder) => {
			void notifyStart("creating reminder");
			try {
				await addReminder({
					text: parsed.text,
					datetime: parsed.datetime.toISOString(),
					channel: "telegram",
					recurring: parsed.recurring,
					category: "personal",
				});
				void notifyDone(`reminder created: ${parsed.text}`);
			} catch {
				void notifyFail("failed to create reminder");
			}
		},
		[addReminder, notifyStart, notifyDone, notifyFail],
	);

	const handleDialogNaturalAdd = useCallback(
		async (parsed: ParsedReminder) => {
			void notifyStart("creating reminder");
			try {
				await addReminder({
					text: parsed.text,
					datetime: parsed.datetime.toISOString(),
					channel: "telegram",
					recurring: parsed.recurring,
					category: "personal",
				});
				void notifyDone(`reminder created: ${parsed.text}`);
			} catch {
				void notifyFail("failed to create reminder");
			}
			ui.closeComposer();
		},
		[addReminder, notifyStart, notifyDone, notifyFail, ui],
	);

	// ── Bulk handlers ──────────────────────────────────────────────────────────
	const handleBulkDelete = useCallback(async () => {
		if (ui.selectedIds.size === 0) return;
		ui.setIsBulkDeleting(true);
		try {
			await reminderService.bulkDelete(Array.from(ui.selectedIds));
			ui.clearSelect();
			await loadReminders();
		} finally {
			ui.setIsBulkDeleting(false);
		}
	}, [loadReminders, ui]);

	const handleBulkRestoreSnooze = useCallback(
		async (preset: "1h" | "tomorrow" | "next-week") => {
			if (ui.selectedIds.size === 0) return;
			ui.setIsBulkRestoringSnooze(true);
			try {
				await reminderService.bulkRestoreSnooze(
					Array.from(ui.selectedIds),
					preset,
				);
				ui.clearSelect();
				await loadReminders();
			} finally {
				ui.setIsBulkRestoringSnooze(false);
			}
		},
		[loadReminders, ui],
	);

	const handleBulkSnooze = useCallback(
		async (preset: "1h" | "tomorrow" | "next-week") => {
			if (ui.selectedActiveIds.size === 0) return;
			ui.setIsBulkSnoozing(true);
			try {
				await bulkSnoozeReminders(Array.from(ui.selectedActiveIds), preset);
				ui.clearSelectActive();
			} finally {
				ui.setIsBulkSnoozing(false);
			}
		},
		[bulkSnoozeReminders, ui],
	);

	const handleBulkComplete = useCallback(async () => {
		if (ui.selectedActiveIds.size === 0) return;
		const ids = Array.from(ui.selectedActiveIds);
		ui.setIsBulkCompleting(true);
		try {
			await reminderService.bulkComplete(ids);
			ui.clearSelectActive();
			await loadReminders();
			ui.setUndoToast({ ids, count: ids.length });
			setTimeout(() => ui.setUndoToast(null), 5000);
		} finally {
			ui.setIsBulkCompleting(false);
		}
	}, [loadReminders, ui]);

	const handleUndoBulkComplete = useCallback(async () => {
		if (!ui.undoToast) return;
		const { ids } = ui.undoToast;
		ui.setUndoToast(null);
		await Promise.allSettled(
			ids.map((id) => reminderService.update(id, { completed: false })),
		);
		await loadReminders();
	}, [loadReminders, ui]);

	const handleBulkDeleteActive = useCallback(async () => {
		if (ui.selectedActiveIds.size === 0) return;
		ui.setIsBulkDeletingActive(true);
		try {
			await reminderService.bulkDelete(Array.from(ui.selectedActiveIds));
			ui.clearSelectActive();
			await loadReminders();
		} finally {
			ui.setIsBulkDeletingActive(false);
		}
	}, [loadReminders, ui]);

	const handleBatchEdit = useCallback(
		async (ids: string[], fields: { priority?: string; category?: string }) => {
			if (ids.length === 0) return;
			ui.setIsBatchEditing(true);
			try {
				await reminderService.batchEdit(ids, fields);
				await loadReminders();
			} finally {
				ui.setIsBatchEditing(false);
			}
		},
		[loadReminders, ui],
	);

	const handleMarkAllOverdueComplete = useCallback(
		async (overdueIds: string[]) => {
			if (overdueIds.length === 0) return;
			ui.setIsMarkingAllOverdue(true);
			try {
				await reminderService.bulkComplete(overdueIds);
				await loadReminders();
			} finally {
				ui.setIsMarkingAllOverdue(false);
			}
		},
		[loadReminders, ui],
	);

	// ── Export handlers ────────────────────────────────────────────────────────
	const handleExportCsv = useCallback(async (filter: string) => {
		try {
			const { data } = await reminderService.exportCsv(filter);
			const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
			const a = document.createElement("a");
			a.href = url;
			a.download = `reminders-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			/* ignore */
		}
	}, []);

	const handleExportIcs = useCallback(async () => {
		try {
			const { data } = await reminderService.exportIcs("active");
			const url = URL.createObjectURL(
				new Blob([data], { type: "text/calendar" }),
			);
			const a = document.createElement("a");
			a.href = url;
			a.download = `reminders-${new Date().toISOString().slice(0, 10)}.ics`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			/* ignore */
		}
	}, []);

	return {
		// Raw data
		reminders,
		loadReminders,
		streakRef,
		emptyForm,
		buildFormFromReminder,
		// Handlers
		handleComplete,
		handleDelete,
		handleDuplicate,
		handleSnooze,
		handleSnoozeCustom,
		handleShowSnoozeHistory,
		handleInlineEditSave,
		handleUpdatePriority,
		handleEditClick,
		handleEditSave,
		handleLegacyAdd,
		handleQuickAdd,
		handleDialogNaturalAdd,
		handleBulkDelete,
		handleBulkRestoreSnooze,
		handleBulkSnooze,
		handleBulkComplete,
		handleUndoBulkComplete,
		handleBulkDeleteActive,
		handleBatchEdit,
		handleMarkAllOverdueComplete,
		handleExportCsv,
		handleExportIcs,
	};
}
