/**
 * Reminder dates travel as plain `YYYY-MM-DD` strings end to end. They are never turned into a `Date` and back
 * through UTC, which is what makes "3 October" turn into "2 October" in some timezones.
 */

export function dateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateKeyOf(date: Date): string {
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The user's own "today", in their local timezone. */
export function todayKey(now: Date = new Date()): string {
  return dateKeyOf(now);
}

/** A local-midnight `Date` for formatting a key; only for display, never for arithmetic on the stored value. */
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

/** First and last day of the month containing `month`, as keys. */
export function monthRange(month: Date): { from: string; to: string } {
  const year = month.getFullYear();
  const index = month.getMonth();
  return { from: dateKey(year, index, 1), to: dateKey(year, index, new Date(year, index + 1, 0).getDate()) };
}

/** `14:00:00` -> `14:00`. */
export function shortTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}
