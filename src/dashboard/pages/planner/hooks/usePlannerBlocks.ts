// ============================================================
// usePlannerBlocks — data fetching, caching, and mutations for time blocks.
// Wraps plannerService with optimistic updates and localStorage cache.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { plannerService } from "@/services/api";
import type { BacklogItem, TimeBlock } from "../helpers";
import {
	apiBlockToLocal,
	dateKey,
	generateId,
	isSameDay,
	LS_KEY,
	localBlockToApi,
	TYPE_COLORS,
} from "../helpers";

interface UsePlannerBlocksOptions {
	currentDate: Date;
	weekDates: Date[];
	viewMode: "day" | "week";
}

export function usePlannerBlocks({
	currentDate,
	weekDates,
	viewMode,
}: UsePlannerBlocksOptions) {
	const [blocks, setBlocks] = useState<Record<string, TimeBlock[]>>({});

	const dk = dateKey(currentDate);

	// ── localStorage hydration ───────────────────────────────────────────────
	useEffect(() => {
		try {
			const saved = localStorage.getItem(LS_KEY);
			if (saved) setBlocks(JSON.parse(saved));
		} catch {
			/* ignore corrupt data */
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem(LS_KEY, JSON.stringify(blocks));
		} catch {
			/* storage full */
		}
	}, [blocks]);

	// ── API fetch ────────────────────────────────────────────────────────────
	const fetchBlocksForDate = useCallback(async (date: string) => {
		try {
			const res = await plannerService.getByDate(date);
			const apiBlocks = (res.data.blocks || []).map(apiBlockToLocal);
			setBlocks((prev) => ({ ...prev, [date]: apiBlocks }));
		} catch {
			/* rely on localStorage cache */
		}
	}, []);

	useEffect(() => {
		fetchBlocksForDate(dk);
	}, [dk, fetchBlocksForDate]);

	useEffect(() => {
		if (viewMode === "week") {
			weekDates.forEach((d) => fetchBlocksForDate(dateKey(d)));
		}
	}, [viewMode, weekDates, fetchBlocksForDate]);

	// ── Derived ──────────────────────────────────────────────────────────────
	const todayBlocks = useMemo(() => blocks[dk] || [], [blocks, dk]);

	// ── Mutations ────────────────────────────────────────────────────────────
	const addBlock = useCallback(
		(block: TimeBlock, targetDate?: string) => {
			const targetDk = targetDate ?? dk;
			setBlocks((prev) => ({
				...prev,
				[targetDk]: [...(prev[targetDk] || []), block],
			}));

			plannerService
				.create(localBlockToApi(block, targetDk))
				.then((res) => {
					const serverBlock = apiBlockToLocal(res.data.block);
					setBlocks((prev) => ({
						...prev,
						[targetDk]: (prev[targetDk] || []).map((b) =>
							b.id === block.id ? serverBlock : b,
						),
					}));
				})
				.catch(() => {
					// Optimistic block stays; server sync failed silently
				});
		},
		[dk],
	);

	const removeBlock = useCallback(
		(blockId: string) => {
			setBlocks((prev) => ({
				...prev,
				[dk]: (prev[dk] || []).filter((b) => b.id !== blockId),
			}));
			plannerService
				.delete(blockId)
				.then(() => toast.success("Block removed"))
				.catch(() => toast.error("Failed to delete block"));
		},
		[dk],
	);

	const scheduleBacklogItem = useCallback(
		(item: BacklogItem, hour: number, targetDate?: Date) => {
			const targetDk = targetDate ? dateKey(targetDate) : dk;
			const block: TimeBlock = {
				id: generateId(),
				title: item.title,
				startHour: hour,
				duration: 1,
				type: item.type,
				color: TYPE_COLORS[item.type],
				reminderId:
					item.type === "reminder" ? String(item.sourceId) : undefined,
				habitId: item.type === "habit" ? Number(item.sourceId) : undefined,
			};
			addBlock(block, targetDk);
			return block;
		},
		[dk, addBlock],
	);

	const addCustomBlock = useCallback(
		(title: string, hour: number, duration: number): TimeBlock => {
			const block: TimeBlock = {
				id: generateId(),
				title,
				startHour: hour,
				duration,
				type: "custom",
				color: TYPE_COLORS.custom,
			};
			addBlock(block);
			return block;
		},
		[addBlock],
	);

	return {
		blocks,
		todayBlocks,
		addBlock,
		removeBlock,
		scheduleBacklogItem,
		addCustomBlock,
		isSameDay,
	};
}
