import { DateTime } from 'luxon';

/** "2 hours ago" / "in 3 days" */
export function timeAgo(iso: string | Date): string {
  const dt = typeof iso === 'string' ? DateTime.fromISO(iso) : DateTime.fromJSDate(iso);
  return dt.toRelative() ?? dt.toLocaleString(DateTime.DATETIME_SHORT);
}

/** "Mar 23, 2026 4:30 PM" */
export function formatDateTime(iso: string | Date): string {
  const dt = typeof iso === 'string' ? DateTime.fromISO(iso) : DateTime.fromJSDate(iso);
  return dt.toLocaleString(DateTime.DATETIME_MED);
}

/** "Mar 23" */
export function formatDate(iso: string | Date): string {
  const dt = typeof iso === 'string' ? DateTime.fromISO(iso) : DateTime.fromJSDate(iso);
  return dt.toLocaleString(DateTime.DATE_MED);
}

/** Duration between two dates: "2h 15m" */
export function duration(start: string | Date, end: string | Date): string {
  const s = typeof start === 'string' ? DateTime.fromISO(start) : DateTime.fromJSDate(start);
  const e = typeof end === 'string' ? DateTime.fromISO(end) : DateTime.fromJSDate(end);
  const diff = e.diff(s, ['hours', 'minutes']);
  const h = Math.floor(diff.hours);
  const m = Math.round(diff.minutes);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
