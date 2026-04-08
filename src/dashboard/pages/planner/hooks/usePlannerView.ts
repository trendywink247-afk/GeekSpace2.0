import { useMemo } from "react";
import { dateKey, isSameDay } from "../helpers";
import type { BacklogItem, HabitItem, TimeBlock } from "../helpers";
import type { Reminder } from "@/types";
interface Opts { currentDate: Date; todayBlocks: TimeBlock[]; habits: HabitItem[]; reminders: Reminder[]; }
export function usePlannerView({ currentDate, todayBlocks, habits, reminders }: Opts) {
  const now = new Date();
  const isToday = isSameDay(currentDate, now);
  const currentHourFraction = now.getHours() + now.getMinutes() / 60;
  const weekDates = useMemo(() => { const start = new Date(currentDate); start.setDate(start.getDate() - start.getDay()); return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; }); }, [currentDate]);
  const backlogItems = useMemo<BacklogItem[]>(() => {
    const items: BacklogItem[] = [];
    const n = new Date();
    reminders.filter((r: Reminder) => { if (r.completed) return false; if (todayBlocks.some(b => b.reminderId === r.id)) return false; if (!r.datetime) return isSameDay(currentDate, n); return isSameDay(new Date(r.datetime), currentDate); }).forEach((r: Reminder) => { items.push({ id: "rem_" + r.id, title: r.text, type: "reminder", priority: r.priority || "normal", icon: "bell", sourceId: r.id }); });
    if (isToday) habits.filter(h => !h.logged_today && !todayBlocks.some(b => b.habitId === h.id)).forEach(h => { items.push({ id: "hab_" + h.id, title: h.icon + " " + h.name, type: "habit", icon: "flame", sourceId: h.id }); });
    return items;
  }, [reminders, habits, currentDate, todayBlocks, isToday]);
  const stats = useMemo(() => { const planned = todayBlocks.length; const hoursBlocked = todayBlocks.reduce((s, b) => s + b.duration, 0); return { planned, hoursBlocked, pct: Math.round((hoursBlocked / 17) * 100) }; }, [todayBlocks]);
  const topThree = useMemo(() => todayBlocks.slice().sort((a, b) => a.startHour - b.startHour).slice(0, 3), [todayBlocks]);
  return { isToday, currentHourFraction, weekDates, backlogItems, stats, topThree, dateKey };
}
