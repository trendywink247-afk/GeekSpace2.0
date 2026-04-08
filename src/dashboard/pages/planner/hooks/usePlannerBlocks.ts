// usePlannerBlocks — data fetching, caching, and mutations for time blocks.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { plannerService } from "@/services/api";
import type { BacklogItem, TimeBlock } from "../helpers";
import {
	apiBlockToLocal,
	dateKey,
	generateId,
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
	const [blocks, setBlocks] = useState<Record<string, TimeBlock[]>>(() => {
		try { const s = localStorage.getItem(LS_KEY); return s ? (JSON.parse(s) as Record<string, TimeBlock[]>) : {}; } catch { return {}; }
	});
	const dk = dateKey(currentDate);

	useEffect(() => {
		try {
			localStorage.setItem(LS_KEY, JSON.stringify(blocks));
		} catch {
			/* storage full */
		}
	}, [blocks]);

	// API fetch
	const fetchBlocksForDate = useCallback(async (date: string) => {
		try {
			const res = await plannerService.getByDate(date);
			const apiBlocks = (res.data.blocks || []).map(apiBlockToLocal);
			setBlocks((prev) => ({ ...prev, [date]: apiBlocks }));
		} catch {
			/* rely on localStorage */
		}
	}, []);

	// eslint-disable-next-line react-hooks/set-state-in-effect -- async function, setState is in .then() callback
	useEffect(() => { void fetchBlocksForDate(dk); }, [dk, fetchBlocksForDate]);

	useEffect(() => { if (viewMode === "week") weekDates.forEach((d) => void fetchBlocksForDate(dateKey(d))); }, [viewMode, weekDates, fetchBlocksForDate]);

	const todayBlocks = useMemo(() => blocks[dk] || [], [blocks, dk]);

	// Mutations
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
					/* optimistic stays */
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
		(item: BacklogItem, hour: number, targetDate?: Date): TimeBlock => {
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
	};
}
