import { useCallback, useEffect, useMemo, useState } from "react";
import { plannerService } from "@/services/api";
import { toast } from "sonner";
import { LS_KEY, generateId, dateKey, apiBlockToLocal, localBlockToApi, TYPE_COLORS } from "../helpers";
import type { BacklogItem, TimeBlock } from "../helpers";
interface Opts { currentDate: Date; weekDates: Date[]; viewMode: "day" | "week"; }
export function usePlannerBlocks({ currentDate, weekDates, viewMode }: Opts) {
  const [blocks, setBlocks] = useState<Record<string, TimeBlock[]>>({});
  const dk = dateKey(currentDate);
  useEffect(() => { try { const s = localStorage.getItem(LS_KEY); if (s) setBlocks(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(blocks)); } catch {} }, [blocks]);
  const fetchBlocksForDate = useCallback(async (date: string) => {
    try { const res = await plannerService.getByDate(date); setBlocks(prev => ({ ...prev, [date]: (res.data.blocks || []).map(apiBlockToLocal) })); } catch {}
  }, []);
  useEffect(() => { fetchBlocksForDate(dk); }, [dk, fetchBlocksForDate]);
  useEffect(() => { if (viewMode === "week") weekDates.forEach(d => fetchBlocksForDate(dateKey(d))); }, [viewMode, weekDates, fetchBlocksForDate]);
  const todayBlocks = useMemo(() => blocks[dk] || [], [blocks, dk]);
  const addBlock = useCallback((block: TimeBlock, targetDate?: string) => {
    const t = targetDate ?? dk;
    setBlocks(prev => ({ ...prev, [t]: [...(prev[t] || []), block] }));
    plannerService.create(localBlockToApi(block, t)).then(res => { const sb = apiBlockToLocal(res.data.block); setBlocks(prev => ({ ...prev, [t]: (prev[t] || []).map(b => b.id === block.id ? sb : b) })); }).catch(() => {});
  }, [dk]);
  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => ({ ...prev, [dk]: (prev[dk] || []).filter(b => b.id !== id) }));
    plannerService.delete(id).then(() => toast.success("Block removed")).catch(() => toast.error("Failed to delete block"));
  }, [dk]);
  const scheduleBacklogItem = useCallback((item: BacklogItem, hour: number, targetDate?: Date): TimeBlock => {
    const t = targetDate ? dateKey(targetDate) : dk;
    const block: TimeBlock = { id: generateId(), title: item.title, startHour: hour, duration: 1, type: item.type, color: TYPE_COLORS[item.type], reminderId: item.type === "reminder" ? String(item.sourceId) : undefined, habitId: item.type === "habit" ? Number(item.sourceId) : undefined };
    addBlock(block, t); return block;
  }, [dk, addBlock]);
  const addCustomBlock = useCallback((title: string, hour: number, duration: number): TimeBlock => {
    const block: TimeBlock = { id: generateId(), title, startHour: hour, duration, type: "custom", color: TYPE_COLORS.custom };
    addBlock(block); return block;
  }, [addBlock]);
  return { blocks, todayBlocks, addBlock, removeBlock, scheduleBacklogItem, addCustomBlock };
}
