/** Logical-day helpers implementing Q16 (configurable boundary) + Q18 (default 4 AM). */

export const DEFAULT_DAY_START_HOUR = 4;

const MS_PER_DAY = 86_400_000;

/** Pad to two digits. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as YYYY-MM-DD in *local* time (not UTC). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse YYYY-MM-DD into a local Date at noon (avoids DST edge cases). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromISODate(s);
  return toISODate(d) === s;
}

/**
 * The current *logical* day: any time before `dayStartHour` belongs to the
 * previous calendar date. So at 01:00 on the 26th with a 4 AM boundary, the
 * logical day is the 25th.
 */
export function logicalToday(dayStartHour: number = DEFAULT_DAY_START_HOUR, now = new Date()): string {
  const shifted = new Date(now.getTime() - dayStartHour * 3_600_000);
  return toISODate(shifted);
}

/** Shift a logical day by N days. */
export function addDays(iso: string, days: number): string {
  return toISODate(new Date(fromISODate(iso).getTime() + days * MS_PER_DAY));
}

/** Whole days from `a` to `b` (b - a). Negative if b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / MS_PER_DAY);
}

/** Inclusive list of logical days from start to end. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const n = daysBetween(start, end);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

/** True when `iso` falls inside the inclusive goal range. */
export function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

/** A sensible default goal window: the current month to its last day. */
export function todayISORange(now = new Date()): [string, string] {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDay)}`];
}

/** Today in the user's locale, e.g. "Sat 26 Sep". */
export function formatDayLabel(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatLongDayLabel(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
